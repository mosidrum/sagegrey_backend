# GoMe API

A Node.js + TypeScript + Express banking API: authentication, bank accounts, funding, withdrawals, transfers, and a transaction-PIN security layer, backed by PostgreSQL/Knex.

## Prerequisites

- Node.js 20+
- npm
- Docker and Docker Compose (for containerized development)

## Installation

```bash
npm install
```

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

## Running in Docker

Build the images (only needed the first time, or after changing the `Dockerfile`/dependencies):

```bash
npm run docker:build
```

Start the API on port 8000 and a Postgres database, with hot reload on file changes. This reuses the already-built image, so it starts fast:

```bash
npm run dev
```

The API will be available at http://localhost:8000.

Stop the containers and remove them along with the Postgres data volume:

```bash
npm run docker:down
```

Since `docker:down` only drops containers and volumes (not the built image), running `npm run dev` again afterwards starts right up without rebuilding.

`npm run dev` only streams the api container's own logs (postgres's verbose first-run bootstrap output is hidden). If postgres fails to become healthy, inspect it directly:

```bash
docker compose logs postgres
```

With the stack running, apply database migrations (needed once, and again any time `docker:down` drops the Postgres volume):

```bash
npm run migrate
```

## Architecture

The app is layered under `src/`, each folder with a single responsibility:

- **`routes/`** — Express route wiring only (which path/method, which validators, which controller). No logic.
- **`middleware/validators/`** — `express-validator` chains per domain, ending in a shared `runValidation` middleware that turns validation failures into an `AppError(400, ...)`. Routes chain these directly in front of the controller, so controllers never parse/validate the request themselves.
- **`controllers/`** — request handlers: read the already-validated `req.body`/`req.params`, call a service, shape the response via `res.success(...)`. No direct DB access, no validation logic.
- **`services/`** — business logic (hashing, token/account-number generation, balance arithmetic, ownership/lock/PIN checks, DB transactions). Return plain data or throw `AppError`; never touch `res`.
- **`repositories/`** — data access only, one per table, raw Knex queries (`create`, `getById`, `update`, plus domain lookups). Account/transaction repositories accept an optional Knex transaction (`trx`) so services can wrap multi-step money movements atomically. No business rules.
- **`models/`** — plain TypeScript interfaces for DB rows (Knex is a query builder, not a decorator-based ORM, so there are no class-based entities).
- **`middleware/`** — Express middleware: security headers/CORS/rate limiting, the response-shape attacher, the global error handler, and `authenticate`.
- **`database/`** — Knex instance, `knexfile.ts`, and migrations.
- **`common/`** — cross-cutting infrastructure used by every layer: `AppError`, `asyncHandler`, the logger, `http.ts`'s `HTTP` status constants, and `money.ts`/`accountNumber.ts` helpers.

The domain has two aggregate models — **User** and **Account** (one user has many accounts) — and business logic is organized along that line: `auth.*` (signup/login/logout/me) and `user.*` (transaction PIN) operate on the User model; `account.*` (create/list/balance/lock) and `transaction.*` (fund/withdraw/transfer) operate on the Account model.

## Error handling & responses

Route handlers should throw `AppError(statusCode, message)` (from `src/common/errors.ts`) instead of building error responses by hand — use the named constants in `src/common/http.ts` (`HTTP.NOT_FOUND`, `HTTP.UNAUTHORIZED`, etc.) rather than raw numbers. A global `errorHandler` (`src/middleware/errorHandler.ts`) catches it and any other thrown error, and unmatched routes are turned into 404s by `notFoundHandler`. Wrap async handlers with `asyncHandler` (`src/common/asyncHandler.ts`) so rejected promises reach it.

For success responses, call `res.success(data, message?, statusCode?)` (attached by `src/middleware/response.ts`). Every JSON response is `{ message }`, plus a `data` field only when there's actually a payload to return — success responses include it whenever `data` is passed; error responses never include it, since `AppError` doesn't carry a payload.

## Database

`src/database/connection.ts` exports the shared Knex instance (`db`) used by repositories, and `verifyConnection()`, which opens and immediately closes a plain `pg` connection (no query) to confirm Postgres is reachable. `server.ts` awaits this before calling `app.listen`, logging `Database connection established` first — if it fails, the error is logged and the process exits instead of starting an API that can't reach its database. `src/database/knexfile.ts` holds the Knex config (loading `.env` by absolute path, so it works regardless of the CLI's working directory), and `src/database/migrations/` the migrations.

Two databases share the same Postgres instance: `app` (dev, `DB_NAME` in `.env`) and `app_test` (used by `npm test`, see [Tests](#tests)).

## IDs

`users.id`, `accounts.id`, and `transactions.id` are all `uuid` primary keys, defaulted at the database level via Postgres's built-in `gen_random_uuid()` (no extension required on Postgres 13+) — never auto-incrementing integers. This avoids sequential-id enumeration (guessing `/api/accounts/2`, `/api/accounts/3`, ...) and matches the shape the JWT's `sub` claim needs (see [Authentication](#authentication)). Every model/repository/service function that takes an id takes it as a `string`; every `:id` route param is validated with `express-validator`'s `isUUID()`.

## Authentication

Stateless JWT auth against the `users` table, split across the layers above (`routes/auth.routes.ts` → `controllers/auth.controller.ts` → `services/auth.service.ts` → `repositories/user.repository.ts`):

- `POST /api/auth/signup` — `{ fullName, email, password }` (password min. 8 chars). Creates the user and returns `{ user, token }`, i.e. signup logs the user in immediately.
- `POST /api/auth/login` — `{ email, password }`. Validates the bcrypt-hashed password and issues a fresh token.
- `POST /api/auth/logout` — requires `Authorization: Bearer <token>`. Since the token is stateless (see below), this doesn't invalidate anything server-side — it's kept for API symmetry and audit logging; the client is expected to discard the token.
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`. Returns the identity embedded in the token.

The bearer token is a signed JWT (`jsonwebtoken`, `HS256`), not an opaque random string, and nothing is stored in the database for it — verification is signature + expiry only, no DB lookup per request. Its payload carries `sub` (the user's UUID), `email`, and `name` (the user's full name), signed with `JWT_SECRET` and expiring after `JWT_EXPIRES_IN` (both env vars, default `7d`). `authenticate` (`src/middleware/auth.middleware.ts`) verifies the signature via `authService.verifyToken` and attaches `{ id, email, full_name }` to `req.user` — note this is derived entirely from the token, so `req.user` doesn't carry `created_at` the way the `user` object in the signup/login response body does (that one comes straight from the database row). Because there's no server-side session state, a user's info embedded in a token (name/email) won't reflect changes made after the token was issued until they log in again.

## Transaction PIN (`services/user.service.ts`)

A 4-digit PIN, distinct from the login password, required before any withdrawal or transfer. It's a property of the User model, so it lives in its own `user.*` layer rather than in `auth.*` or `account.*`:

- `PUT /api/users/pin` — requires `Authorization: Bearer <token>` and `{ pin }`. If a PIN is already set, `{ pin, currentPin }` is required and `currentPin` is verified before the change. Hashed with bcrypt; never stored or returned in plain text.

Withdrawals and transfers call `userService.verifyPin` before touching any balance — it throws a clear "set your PIN first" error if unset, or "incorrect PIN" on mismatch. Funding and balance checks never require a PIN.

## Bank accounts & transactions (`services/account.service.ts`, `services/transaction.service.ts`)

Every `:id` below is a UUID (`users.id`, `accounts.id`, and `transactions.id` are all `uuid` primary keys, generated by Postgres's `gen_random_uuid()` — see [IDs](#ids)), not a sequential number.

- `POST /api/accounts` — creates a bank account for the caller with a unique 10-digit account number and a zero balance.
- `GET /api/accounts` — lists the caller's own accounts.
- `GET /api/accounts/:id/balance` — returns the balance of an account the caller owns (403 otherwise).
- `POST /api/accounts/:id/lock` / `POST /api/accounts/:id/unlock` — locks/unlocks an owned account. Locked accounts reject all debits (withdrawals, transfers out) but still accept credits (funding, incoming transfers).
- `POST /api/accounts/:id/fund` — `{ amount, description? }`. Credits any account by id (no ownership check — crediting is unrestricted, same as a transfer's destination); no PIN required.
- `POST /api/accounts/:id/withdraw` — `{ amount, pin, description? }`. Debits an account the caller owns; requires the correct PIN, an unlocked account, and sufficient funds.
- `POST /api/accounts/:id/transfer` — `{ destinationAccountNumber, amount, pin, description? }`. One endpoint handles both same-user and cross-user transfers — the destination is looked up by account number, regardless of who owns it.
- `GET /api/accounts/:id/transactions` — lists the transaction history for an owned account.

**Money** is stored as integer minor units (`bigint` columns, e.g. cents) and converted via `src/common/money.ts`'s string-based `toMinorUnits`/`fromMinorUnits` — never floating-point arithmetic. The API accepts/returns amounts as decimal strings (e.g. `"100.50"`).

**Atomicity & concurrency**: every balance-mutating operation runs inside a Knex `db.transaction(...)`, row-locking the account(s) involved with `.forUpdate()`. Transfers lock both the source and destination accounts in a single query ordered by ascending `id`, which rules out deadlocks between two transfers moving money in opposite directions between the same pair of accounts. If any step fails, the whole transaction rolls back and no partial balance change is persisted.

**Transaction ledger**: every funding/withdrawal/transfer writes to the `transactions` table (id, type, account, counterparty account, amount, balance after, description, status, timestamp). A transfer writes two linked rows — `transfer_debit` on the source, `transfer_credit` on the destination — sharing one `transfer_group_id`, so "all transactions for account X" is always a simple `WHERE account_id = X` query regardless of operation type.

## Security

`src/middleware/security.ts` wires up baseline hardening, applied before every other middleware in `app.ts`:

- **helmet** — sets standard protective headers (CSP, HSTS, `X-Content-Type-Options`, etc.) and hides `X-Powered-By`.
- **cors** — restricted to the origins in the comma-separated `CORS_ORIGIN` env var; if it's unset, any origin is reflected back (convenient for local development, tighten this in production).
- **express-rate-limit** — caps each IP at 100 requests per 15 minutes, returned via standard `RateLimit-*` headers. In production, `app.set('trust proxy', 1)` is enabled so rate limiting keys off the real client IP behind a reverse proxy/load balancer.

## Logging

`src/common/logger.ts` is a Winston logger with custom uppercase levels (`ERROR`, `WARN`, `INFO`, `DEBUG` — call as `logger.ERROR(...)`, `logger.INFO(...)`, etc.), colorized console output, and a timestamp. The minimum level is `DEBUG` outside of `NODE_ENV=production`, `INFO` in production.

Pass structured context as a second argument — `logger.INFO('Account funded', { userId, accountId, amount, transactionId })` — and it's rendered as JSON after the message. Never pass `password`, `password_hash`, `pin`, `pin_hash`, or `token` as context. The global `errorHandler` logs every 4xx at `WARN` and every 5xx at `ERROR`; services additionally log `DEBUG`/`INFO`/`ERROR` around each DB transaction (start/commit/rollback) for money-moving operations.

## Build & start (production)

```bash
npm run build
npm start
```

## Tests

```bash
npm test
npm run test:watch
```

`npm test` runs against a separate `app_test` database (`DB_NAME=app_test`), migrated automatically by a `pretest` hook — it never touches the dev `app` database. Tests run with `--runInBand` (serially) since several suites share and `TRUNCATE` that same database between tests; running them in parallel workers would race. There are two kinds of test:

- **Controller tests** (`tests/*.controller.test.ts`) — Supertest against the real Express app with the service layer mocked (`jest.mock('../src/services/...')`). Validators run for real, so these also exercise the `express-validator` chains end-to-end.
- **Service integration tests** (`tests/services/*.test.ts`) — hit the real `app_test` Postgres database to verify things a mock can't: atomic rollback on failure, row-level locking (`FOR UPDATE`) preventing a locked/insufficient-funds account from being double-debited, and correct balance math.

Since Postgres needs to be reachable, run `npm test` inside the container (`docker compose exec gome-api npm test`) rather than on the bare host, unless you've overridden `DB_HOST=localhost` locally.

## Linting & formatting

```bash
npm run lint
npm run lint:fix
npm run format
```

## Project structure

```
.
├── src
│   ├── app.ts                    # Express app definition
│   ├── server.ts                 # Entry point, starts the HTTP server
│   ├── common/
│   │   ├── http.ts                 # HTTP status constants
│   │   ├── logger.ts               # Winston logger (uppercase levels, structured context)
│   │   ├── errors.ts               # AppError
│   │   ├── asyncHandler.ts         # Wraps async route handlers for error propagation
│   │   ├── money.ts                # Decimal-string <-> integer-minor-units conversion
│   │   └── accountNumber.ts        # Random 10-digit account number generation
│   ├── database/
│   │   ├── connection.ts           # Knex instance + startup connection check
│   │   ├── knexfile.ts             # Knex configuration for PostgreSQL
│   │   └── migrations/
│   │       ├── ..._create_users_table.ts
│   │       ├── ..._add_full_name_to_users_table.ts
│   │       ├── ..._add_pin_hash_to_users_table.ts
│   │       ├── ..._create_accounts_table.ts
│   │       └── ..._create_transactions_table.ts
│   ├── middleware/
│   │   ├── security.ts             # helmet, cors, rate limiting
│   │   ├── response.ts             # Attaches res.success() for consistent responses
│   │   ├── errorHandler.ts         # Global error handler + 404 handler
│   │   ├── auth.middleware.ts      # authenticate — attaches req.user
│   │   └── validators/
│   │       ├── validate.ts           # runValidation — turns validation errors into AppError
│   │       ├── auth.validators.ts    # signup/login validation chains
│   │       ├── user.validators.ts    # setPin validation chain
│   │       ├── account.validators.ts # :id param validation
│   │       └── transaction.validators.ts # fund/withdraw/transfer validation chains
│   ├── models/
│   │   ├── user.model.ts           # User / SafeUser / NewUser types
│   │   ├── account.model.ts        # Account / NewAccount types
│   │   └── transaction.model.ts    # Transaction / NewTransaction types
│   ├── repositories/
│   │   ├── user.repository.ts      # Raw Knex queries for the users table
│   │   ├── account.repository.ts   # Raw Knex queries for the accounts table (trx-aware)
│   │   └── transaction.repository.ts # Raw Knex queries for the transactions table (trx-aware)
│   ├── services/
│   │   ├── auth.service.ts         # signup/login/logout/findByToken business logic
│   │   ├── user.service.ts         # Transaction PIN set/verify (User model)
│   │   ├── account.service.ts      # Create/list/balance/lock (Account model)
│   │   └── transaction.service.ts  # fund/withdraw/transfer — atomic, row-locked
│   ├── controllers/
│   │   ├── auth.controller.ts      # /api/auth/* request handlers
│   │   ├── user.controller.ts      # /api/users/* request handlers
│   │   ├── account.controller.ts   # /api/accounts/* (CRUD/lock/balance) request handlers
│   │   └── transaction.controller.ts # /api/accounts/* (fund/withdraw/transfer) request handlers
│   └── routes/
│       ├── index.ts                # Root router — GET / + mounts feature routers
│       ├── auth.routes.ts          # /api/auth/* route wiring
│       ├── user.routes.ts          # /api/users/* route wiring
│       ├── account.routes.ts       # /api/accounts/* route wiring
│       └── transaction.routes.ts   # /api/accounts/*/fund|withdraw|transfer route wiring
├── tests
│   ├── app.test.ts                   # Integration tests (GET /, 404, security headers)
│   ├── auth.controller.test.ts       # Controller tests (service layer mocked)
│   ├── user.controller.test.ts
│   ├── account.controller.test.ts
│   ├── transaction.controller.test.ts
│   ├── setup/testDb.ts               # Real Knex instance + resetDb() for integration tests
│   └── services/                     # Integration tests against a real Postgres app_test DB
│       ├── user.service.test.ts
│       ├── account.service.test.ts
│       └── transaction.service.test.ts
├── Dockerfile
├── docker-compose.yml
```
