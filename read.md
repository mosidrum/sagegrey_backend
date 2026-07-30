# A Guided Tour of GoMe

_A file-by-file walkthrough of the codebase, presented for anyone who wants to understand how the app is put together — no prior familiarity with the code required._

---

## 1. What Is GoMe?

GoMe is a small banking backend. It lets someone sign up, log in, open one or more bank accounts, fund them, withdraw money, transfer money to their own or someone else's account, lock an account, check a balance, and view an account's history — all protected by a login token _and_ a 4-digit transaction PIN for anything that moves money out of an account. Retried payment requests are also safe to repeat without double-processing, thanks to idempotency keys (more on that below).

It's built with **Node.js, TypeScript, Express, and PostgreSQL** (via a query-building library called Knex).

---

## 2. The Mental Model

Two things exist in this system, and everything else exists to serve them:

- **A User** — someone with an email, a name, a password, and a transaction PIN.
- **An Account** — a bank account, owned by exactly one user, identified by a unique account number, holding a balance.

A user can own several accounts. Every request to move money touches one or two accounts and always leaves a paper trail (a **transaction** record).

Every request follows the same path through the code, regardless of which feature it's hitting:

```mermaid
flowchart LR
    A[Request arrives] --> B[Routes\nwhich URL goes where]
    B --> C[Validators\nis the input well-formed?]
    C --> D[Controller\ntranslate HTTP <-> plain data]
    D --> E[Service\nthe actual business rules]
    E --> F[Repository\ntalk to the database]
    F --> G[(PostgreSQL)]
```

Keeping each of those five stops in its own file, doing exactly one job, is the single biggest organizing idea in this codebase. Once you know that, every file's purpose becomes predictable from which folder it lives in.

---

## 3. Where the App Starts

| File            | What it's for                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts` | The very first thing that runs. Checks the database is reachable, then starts listening for HTTP requests on a port. If the database isn't reachable, it logs the problem and shuts down rather than pretending to work.                                                                                                                                                  |
| `src/app.ts`    | Builds the Express application itself: wires up every piece of middleware in the correct order (security headers → CORS → rate limiting → JSON parsing → response helper → routes → 404 handler → error handler), then hands the finished app to `server.ts`. Kept separate from `server.ts` so tests can import the app directly without starting a real network server. |

---

## 4. `src/common/` — Shared Building Blocks

Small, dependency-free helpers that every other layer relies on.

| File               | What it's for                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errors.ts`        | Defines `AppError` — a custom error that carries an HTTP status code alongside its message. Whenever the app needs to say "this request failed, and here's why," it throws one of these instead of manually building an error response.                                                                                       |
| `http.ts`          | A single source of truth for HTTP status code numbers (`HTTP.NOT_FOUND`, `HTTP.BAD_REQUEST`, etc.), so nobody has to remember or mistype `404` by hand.                                                                                                                                                                       |
| `asyncHandler.ts`  | A small wrapper around `async` route handlers. Express doesn't automatically catch errors thrown inside `async` functions — this wrapper makes sure it does, so a failed database call doesn't crash the server.                                                                                                              |
| `logger.ts`        | The app's logger (built on a library called Winston). Every important event — a user registering, a withdrawal, a failed login — is written here with a timestamp, a severity level (`INFO`, `WARN`, `ERROR`, `DEBUG`), and extra context like which user or account was involved. Never logs passwords, PINs, or tokens.     |
| `money.ts`         | Converts between the amounts people type (like `"100.50"`) and the whole-number-of-cents format the database stores (`10050`). Money is _never_ handled as a floating-point number anywhere in this app, because floating-point math can silently lose fractions of a cent — this file is what makes that guarantee possible. |
| `accountNumber.ts` | Generates a random 10-digit account number when a new bank account is opened.                                                                                                                                                                                                                                                 |

---

## 5. `src/database/` — The Connection to PostgreSQL

| File                                                        | What it's for                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connection.ts`                                             | Creates the one shared connection to the database that the rest of the app reuses, and offers a way to double-check the database is actually reachable at startup. |
| `knexfile.ts`                                               | Configuration: which database to connect to, using which credentials, and where migration files live.                                                              |
| `migrations/20260729230000_create_users_table.ts`           | The very first migration — creates the `users` table (email, password, login token).                                                                               |
| `migrations/20260730012545_add_full_name_to_users_table.ts` | Adds a `full_name` column to `users`, so signup can capture a person's name, not just their email.                                                                 |
| `migrations/20260730012546_add_pin_hash_to_users_table.ts`  | Adds a `pin_hash` column to `users` — the securely-hashed transaction PIN. Never the raw PIN, only its hash.                                                       |
| `migrations/20260730012546_create_accounts_table.ts`        | Creates the `accounts` table: which user owns it, its unique account number, its balance (in cents), and whether it's locked.                                      |
| `migrations/20260730012547_create_transactions_table.ts`    | Creates the `transactions` table — the permanent record of every funding, withdrawal, and transfer that has ever happened.                                         |
| `migrations/20260730085557_create_idempotency_keys_table.ts` | Creates the `idempotency_keys` table — remembers which requests have already been handled, so a retried request can be answered without repeating it.             |
| `migrations/20260730093027_create_account_history_table.ts`  | Creates the `account_history` table — a simple log of "this account was debited" / "this account was credited" events, who caused each one, and when.              |

_A "migration" is just a small, timestamped file that describes one change to the database's shape. Running them in order, oldest first, is how the database schema is built up incrementally and predictably._

---

## 6. `src/middleware/` — Code That Runs on the Way In (and Out)

Middleware sits between "a request arrived" and "a controller handles it," doing something to every request that passes through — or, in the validators' case, checking specific requests before they're allowed further.

| File                                   | What it's for                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security.ts`                          | Turns on baseline protections: security-related HTTP headers, cross-origin request restrictions, and a rate limiter that stops any one visitor from hammering the API.                                                                                                                                                  |
| `response.ts`                          | Adds a `res.success(...)` helper to every response, so every successful reply from the API has the same predictable shape: `{ message, data }`.                                                                                                                                                                         |
| `responseLogger.ts`                    | Logs a line for every request that finishes: which method, which URL, what status code, how long it took.                                                                                                                                                                                                               |
| `errorHandler.ts`                      | The single place that turns any thrown error into an HTTP response. If it's an `AppError`, it uses that error's status code and message; anything unexpected becomes a generic "something went wrong" 500 response instead of leaking internal details. Also logs 4xx errors as warnings and 5xx errors as full errors. |
| `auth.middleware.ts`                   | Reads the `Authorization: Bearer <token>` header and checks the token's signature is genuine and hasn't expired (the token itself is a signed JWT carrying who the user is — see the Authentication section of the tour for the full picture). Attaches that identity to the request. Every protected route relies on this having run first.                                                                                                                              |
| `idempotency.middleware.ts`            | Reads an optional `Idempotency-Key` header on money-moving requests and makes retries safe — see "How Idempotency Keeps Retries Safe" below for the full story.                                                                                                                                                          |
| `validators/validate.ts`               | The last step in every validation chain — if any check failed, turns that into a clear 400 error before the request ever reaches a controller.                                                                                                                                                                          |
| `validators/auth.validators.ts`        | Checks signup and login requests: full name present, email looks like an email, password is at least 8 characters.                                                                                                                                                                                                      |
| `validators/user.validators.ts`        | Checks PIN-setting requests: the new PIN and the current PIN must both be exactly 4 digits — the current PIN is always required, since every account starts with a default PIN rather than no PIN at all (see the Transaction PIN note further down).                                                                  |
| `validators/account.validators.ts`     | Checks that an `:id` in a URL (like `/api/accounts/<uuid>/balance`) is actually a valid UUID before anything tries to look it up.                                                                                                                                                                          |
| `validators/transaction.validators.ts` | Checks funding/withdrawal/transfer requests: the amount is a valid, positive figure with at most two decimal places; the PIN is 4 digits; a transfer's destination account number is a valid 10-digit number.                                                                                                           |

---

## 7. `src/models/` — What the Data Looks Like

Plain descriptions of each database row — no logic, just shape.

| File                   | What it's for                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.model.ts`        | Describes a user row (id, email, full name, password hash, PIN hash, created date) — and a "safe" version of that shape that deliberately leaves out the password hash and PIN hash, for anything that gets sent back to a client. |
| `account.model.ts`     | Describes an account row (id, owning user, account number, balance, locked flag, created date).                                                                                                                                                         |
| `transaction.model.ts` | Describes a transaction row (id, type — funding/withdrawal/transfer in/transfer out —, amount, which account, which counterparty account if any, description, status, created date).                                                                    |
| `idempotencyKey.model.ts` | Describes a stored idempotency reservation: which user made the request, their key, a fingerprint of the request, whether it's still being handled or already finished, and the response to replay if it comes again.                             |
| `accountHistory.model.ts` | Describes one history entry: which account, which user caused it, whether it was a debit or a credit, and when.                                                                                                                                     |

---

## 8. `src/repositories/` — The Only Files That Talk SQL

Every database query in the app lives in one of these files. No other file is allowed to query the database directly — that boundary is what makes it possible to reason about (and test) the business logic separately from the database.

| File                        | What it's for                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.repository.ts`        | Create a user, find one by email, update a user's PIN hash.                                                                                                                                                                                                                                        |
| `account.repository.ts`     | Create an account, find one by id or by account number, list all accounts for a user, update a balance, lock/unlock — including special versions of these queries that lock a row (`FOR UPDATE`) so two simultaneous withdrawals can't both read the same stale balance and overdraw the account. |
| `transaction.repository.ts` | Record a new transaction, look one up by id, list every transaction for a given account.                                                                                                                                                                                                          |
| `idempotencyKey.repository.ts` | Reserve a new idempotency key, look one up by user and key, mark one as finished with its stored response.                                                                                                                                                                                     |
| `accountHistory.repository.ts` | Record a new debit/credit history entry, list every entry for a given account.                                                                                                                                                                                                                  |

---

## 9. `src/services/` — Where the Actual Rules Live

This is the heart of the app: what's _allowed_ to happen, and what happens when it does. Services never touch HTTP directly — they take plain values in, return plain values out, or throw an `AppError` when a rule is broken.

| File                     | What it's for                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.service.ts`        | Sign up (hash the password, create the user, issue a login token), log in (check the password, issue a fresh token), log out (clear the token), and look up "who does this token belong to."                                                                                                                                                                                                                                                                                      |
| `user.service.ts`        | Set or change a transaction PIN (hashing it, and requiring the _current_ PIN if one's already set), and verify a PIN is correct before a sensitive operation is allowed to proceed.                                                                                                                                                                                                                                                                                               |
| `account.service.ts`     | Open a new account (with a guaranteed-unique account number), list a user's accounts, fetch a balance, lock or unlock an account — always double-checking the requester actually owns the account first.                                                                                                                                                                                                                                                                          |
| `transaction.service.ts` | The money-moving core: fund an account, withdraw from an account, and transfer between two accounts. Every one of these runs inside a database transaction with the relevant account row(s) locked, so a crash or a concurrent request can never leave a balance half-updated or let two withdrawals both succeed when only one should. A transfer always PIN-checks and writes two linked records — one debit, one credit — so the full picture is always reconstructable later. Each of these also writes an account history entry (debit/credit) in the same database transaction. |
| `idempotency.service.ts` | Reserves an idempotency key before a money-moving request runs, replays the stored response if the same key/request comes again, and marks the reservation finished once the real response is known. |
| `accountHistory.service.ts` | Fetches the debit/credit history for an account, after checking the requester actually owns that account. |

---

## 10. How Idempotency Keeps Retries Safe

A dropped connection or a client retry must never turn one withdrawal into two. `POST /api/transactions/:id/fund`, `.../withdraw`, and `.../transfer` all accept an optional `Idempotency-Key` request header — any client-generated string (e.g. a UUID) that names "this one specific attempt at this operation":

- **First time a key is used** — `idempotency.middleware.ts` reserves it (in the `idempotency_keys` table) before the real handler runs, then lets the request proceed normally.
- **Same key, same request, sent again** — the middleware recognizes it and replays the exact response from the first attempt, without re-running the withdrawal/transfer/fund at all. This works for error responses too, not just successes.
- **Same key, but a different request body** — rejected with a `409 Conflict`, since reusing a key for two different operations is almost certainly a client bug.
- **Two copies of the same request arriving at once** — a database-level uniqueness rule on the key ensures only one of them actually runs; the other is told the operation is already in progress.
- **No key sent at all** — nothing changes; the request runs exactly as it always did. Idempotency is opt-in.

This protection only applies to the three money-moving endpoints, since a duplicate account creation is a minor annoyance, but a duplicate withdrawal is a real financial mistake.

---

## 11. Account History

Every time an account is debited or credited — by a funding, withdrawal, or transfer — a row is written to `account_history` recording which account, which user caused it, whether it was a `debit` or a `credit`, and when. This happens in the same database transaction as the balance change itself, so the history can never drift out of sync with what actually happened to the balance.

- `GET /api/history/:id` — requires `Authorization: Bearer <token>`. Returns the full debit/credit history for the account identified by `:id`, newest first. The account must belong to the caller — a 404 if it doesn't exist, a 403 if it belongs to someone else.

This is a separate, simpler record from the `transactions` table: `transactions` captures the full financial detail of each operation (amount, resulting balance, counterparty), while `account_history` is a lightweight audit trail of just "who touched this account, which direction, and when."

---

## 12. `src/controllers/` — Translating HTTP into Plain Function Calls

Deliberately thin. Each controller reads the already-validated request, calls exactly one service function, and shapes the reply.

| File                        | What it's for                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `auth.controller.ts`        | Handles sign up, log in, log out, and "who am I."                                         |
| `user.controller.ts`        | Handles setting/changing the transaction PIN.                                             |
| `account.controller.ts`     | Handles opening an account, listing accounts, checking a balance, locking, and unlocking. |
| `transaction.controller.ts` | Handles funding, withdrawing, transferring, and listing an account's transaction history. |
| `accountHistory.controller.ts` | Handles fetching an account's debit/credit history. |

---

## 13. `src/routes/` — The Address Book

Maps a URL and HTTP method to (validator →) controller. No logic lives here — just wiring.

| File                    | What it's for                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`              | The root router — handles the "hello world" health-check route, and mounts every other route file under its URL prefix (`/api/auth`, `/api/users`, `/api/accounts`, `/api/transactions`, `/api/history`). |
| `auth.routes.ts`        | `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.                                                                                           |
| `user.routes.ts`        | `/api/users/pin` — set or change the transaction PIN.                                                                                                                |
| `account.routes.ts`     | `/api/accounts` (create/list), `/api/accounts/:id/balance`, `/api/accounts/:id/lock`, `/api/accounts/:id/unlock`.                                                    |
| `transaction.routes.ts` | `/api/transactions/:id/fund`, `/api/transactions/:id/withdraw`, `/api/transactions/:id/transfer`, `/api/transactions/:id` (transaction history).                     |
| `accountHistory.routes.ts` | `/api/history/:id` — an account's debit/credit history.                                                                                                           |

---

## 14. `tests/` — Proof the App Works

Three flavors of test, deliberately kept separate.

**Controller tests — fast, no real database, run every time**

| File                             | What it's for                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `app.test.ts`                    | Sanity checks: the health-check route responds, unknown routes return a proper 404, security headers are present. |
| `auth.controller.test.ts`        | Sign up / log in / log out / "who am I" — checked with the real validators but a stand-in (mocked) service layer. |
| `user.controller.test.ts`        | Setting a transaction PIN, including the validation and error-propagation cases.                                  |
| `account.controller.test.ts`     | Opening/listing accounts, checking balances, locking/unlocking, including ownership and not-found error cases.    |
| `transaction.controller.test.ts` | Funding, withdrawing, transferring, and listing transactions, including validation and error-propagation cases.   |
| `accountHistory.controller.test.ts` | Fetching an account's history, including authentication, validation, and ownership error cases.               |

**Service integration tests — slower, hit a real disposable test database**

| File                                   | What it's for                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup/testDb.ts`                      | Shared helper: connects to the real (isolated) test database and wipes it clean before every test.                                                                                                                                                                                                                                                                                                                                                                       |
| `services/user.service.test.ts`        | Proves PIN set/verify actually works against the database — including requiring the correct current PIN to change it.                                                                                                                                                                                                                                                                                                                                                    |
| `services/account.service.test.ts`     | Proves account creation, the automatic retry when a random account number collides, and ownership checks all work for real.                                                                                                                                                                                                                                                                                                                                              |
| `services/transaction.service.test.ts` | The most important test file in the project. Proves, against a real database, that: funding/withdrawing/transferring change balances correctly; insufficient funds and locked accounts are rejected _without_ touching the balance; a failure partway through a transaction rolls back cleanly with nothing left half-done; and — critically — firing two simultaneous withdrawals that would jointly overdraw an account results in exactly one succeeding, never both. |
| `services/accountHistory.service.test.ts` | Proves a history entry is written for fundings, withdrawals, and both sides of a transfer, that a failed operation writes no history at all, and that fetching another user's account history is rejected. |

**End-to-end test — nothing mocked, real app + real database**

| File                  | What it's for                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotency.test.ts` | Proves the `Idempotency-Key` header actually works across the full HTTP + middleware + database stack: replay, conflict on a mismatched body, and two concurrent requests racing for the same key. |

---

## 15. Configuration & Project Files

| File                    | What it's for                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`          | The project's identity, dependencies, and every runnable command (`npm run dev`, `npm test`, `npm run migrate`, etc.).                                  |
| `package-lock.json`     | An exact, reproducible record of every installed dependency's version — ensures "it works on my machine" also works on everyone else's.                 |
| `tsconfig.json`         | Tells TypeScript how strictly to check the code and how to compile it to plain JavaScript.                                                              |
| `jest.config.ts`        | Tells the test runner where to find test files and how to handle TypeScript.                                                                            |
| `eslint.config.mjs`     | The project's code-style and code-quality rules, enforced automatically.                                                                                |
| `.prettierrc`           | Formatting rules (spacing, quote style, line width) applied automatically.                                                                              |
| `Dockerfile`            | The recipe for building the app into a container image.                                                                                                 |
| `docker-compose.yml`    | Describes the two containers needed for local development — the app itself (`gome-api`) and a PostgreSQL database — and how they're wired together.     |
| `.env` / `.env.example` | Environment-specific settings (database credentials, port, etc.) that the app reads at startup. `.env.example` is the template; `.env` is the real one. |
| `.gitignore`            | Tells Git which files (like `node_modules` or `.env`) should never be committed.                                                                        |
| `README.md`             | The short version: how to install and run the app. This tour is the detailed companion to it.                                                          |

---

## 16. The Whole Thing, One More Time

Someone calling `POST /api/transactions/<accountId>/withdraw` walks through:

1. **`routes/transaction.routes.ts`** matches the URL and method.
2. **`middleware/auth.middleware.ts`** confirms they're logged in.
3. **`middleware/idempotency.middleware.ts`** checks for an `Idempotency-Key` header — if this exact request was already handled, the stored response is replayed here and nothing further runs.
4. **`middleware/validators/transaction.validators.ts`** confirms the amount and PIN are well-formed.
5. **`controllers/transaction.controller.ts`** hands the (now-trusted) values to the service layer.
6. **`services/transaction.service.ts`** checks the PIN, opens a database transaction, locks the account row, checks ownership/lock-status/sufficient-funds, updates the balance, writes a transaction record, and writes an account history entry — all atomically.
7. **`repositories/account.repository.ts`**, **`repositories/transaction.repository.ts`**, and **`repositories/accountHistory.repository.ts`** are the only files that actually spoke SQL to make that happen.
8. **`middleware/response.ts`** shapes the reply; if anything went wrong anywhere along the way, **`middleware/errorHandler.ts`** shaped a clear error instead. Either way, the idempotency middleware persists that response against the key before it reaches the client.

Every feature in the app — signing up, opening an account, transferring money — follows that same general shape. Once it clicks for one feature, it clicks for all of them.
