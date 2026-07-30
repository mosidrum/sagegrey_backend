# sagegrey-backend

Minimal Node.js + TypeScript + Express backend.

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

- **`routes/`** — Express route wiring only (which path/method calls which controller). No logic.
- **`controllers/`** — request handlers: parse/validate the request, call a service, shape the response via `res.success(...)`. No direct DB access.
- **`services/`** — business logic (hashing, token generation, uniqueness rules). Return plain data or throw `AppError`; never touch `res`.
- **`repositories/`** — data access only, one per table, raw Knex queries (`create`, `get`, `getById`, `update`, `remove`, `save`, plus domain lookups like `findByEmail`). No business rules.
- **`models/`** — plain TypeScript interfaces for DB rows (Knex is a query builder, not a decorator-based ORM, so there are no class-based entities).
- **`middleware/`** — Express middleware: security headers/CORS/rate limiting, the response-shape attacher, the global error handler, and `authenticate`.
- **`database/`** — Knex instance, `knexfile.ts`, and migrations.
- **`common/`** — cross-cutting infrastructure used by every layer: `AppError`, `asyncHandler`, the logger, and `http.ts`'s `HTTP` status constants.

## Error handling & responses

Route handlers should throw `AppError(statusCode, message)` (from `src/common/errors.ts`) instead of building error responses by hand — use the named constants in `src/common/http.ts` (`HTTP.NOT_FOUND`, `HTTP.UNAUTHORIZED`, etc.) rather than raw numbers. A global `errorHandler` (`src/middleware/errorHandler.ts`) catches it and any other thrown error, and unmatched routes are turned into 404s by `notFoundHandler`. Wrap async handlers with `asyncHandler` (`src/common/asyncHandler.ts`) so rejected promises reach it.

For success responses, call `res.success(data, message?, statusCode?)` (attached by `src/middleware/response.ts`). Every JSON response, success or error, follows the same `{ message, data }` shape.

## Database

`src/database/connection.ts` exports the shared Knex instance (`db`) used by repositories, and `verifyConnection()`, which opens and immediately closes a plain `pg` connection (no query) to confirm Postgres is reachable. `server.ts` awaits this before calling `app.listen`, logging `Database connection established` first — if it fails, the error is logged and the process exits instead of starting an API that can't reach its database. `src/database/knexfile.ts` holds the Knex config, and `src/database/migrations/` the migrations.

## Authentication

Opaque token-based auth against the `users` table, split across the layers above (`routes/auth.routes.ts` → `controllers/auth.controller.ts` → `services/auth.service.ts` → `repositories/user.repository.ts`):

- `POST /api/auth/signup` — `{ email, password }` (password min. 8 chars). Creates the user and returns `{ user, token }`, i.e. signup logs the user in immediately.
- `POST /api/auth/login` — `{ email, password }`. Validates the bcrypt-hashed password and issues a new token (replacing any previous one, so logging in elsewhere invalidates the old session).
- `POST /api/auth/logout` — requires `Authorization: Bearer <token>`. Clears the stored token.
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`. Returns the current user.

Tokens are random 32-byte values stored directly on the user row (no JWT signing/expiry — deliberately simple). `authenticate` (`src/middleware/auth.middleware.ts`) looks the token up and attaches `req.user`; protected routes just add it before their handler.

## Security

`src/middleware/security.ts` wires up baseline hardening, applied before every other middleware in `app.ts`:

- **helmet** — sets standard protective headers (CSP, HSTS, `X-Content-Type-Options`, etc.) and hides `X-Powered-By`.
- **cors** — restricted to the origins in the comma-separated `CORS_ORIGIN` env var; if it's unset, any origin is reflected back (convenient for local development, tighten this in production).
- **express-rate-limit** — caps each IP at 100 requests per 15 minutes, returned via standard `RateLimit-*` headers. In production, `app.set('trust proxy', 1)` is enabled so rate limiting keys off the real client IP behind a reverse proxy/load balancer.

## Logging

`src/common/logger.ts` is a Winston logger with custom uppercase levels (`ERROR`, `WARN`, `INFO`, `DEBUG` — call as `logger.ERROR(...)`, `logger.INFO(...)`, etc.), colorized console output, and a timestamp. The minimum level is `DEBUG` outside of `NODE_ENV=production`, `INFO` in production.

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
│   │   ├── logger.ts               # Winston logger (uppercase levels)
│   │   ├── errors.ts               # AppError
│   │   └── asyncHandler.ts         # Wraps async route handlers for error propagation
│   ├── database/
│   │   ├── connection.ts           # Knex instance + startup connection check
│   │   ├── knexfile.ts             # Knex configuration for PostgreSQL
│   │   └── migrations/
│   │       └── ..._create_users_table.ts
│   ├── middleware/
│   │   ├── security.ts             # helmet, cors, rate limiting
│   │   ├── response.ts             # Attaches res.success() for consistent responses
│   │   ├── errorHandler.ts         # Global error handler + 404 handler
│   │   └── auth.middleware.ts      # authenticate — attaches req.user
│   ├── models/
│   │   └── user.model.ts           # User / SafeUser / NewUser types
│   ├── repositories/
│   │   └── user.repository.ts      # Raw Knex queries for the users table
│   ├── services/
│   │   └── auth.service.ts         # signup/login/logout/findByToken business logic
│   ├── controllers/
│   │   └── auth.controller.ts      # /api/auth/* request handlers
│   └── routes/
│       ├── index.ts                # Root router — GET / + mounts feature routers
│       └── auth.routes.ts          # /api/auth/* route wiring
├── tests
│   ├── app.test.ts               # Integration tests (GET /, 404, security headers)
│   └── auth.controller.test.ts   # Controller tests (service layer mocked)
├── Dockerfile
├── docker-compose.yml
```
