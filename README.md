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

## Error handling & responses

Route handlers should throw `AppError(statusCode, message)` (from `src/errors.ts`) instead of building error responses by hand; a global `errorHandler` (`src/errorHandler.ts`) catches it and any other thrown error, and unmatched routes are turned into 404s by `notFoundHandler`. Wrap async handlers with `asyncHandler` (`src/asyncHandler.ts`) so rejected promises reach it.

For success responses, call `res.success(data, message?, statusCode?)` (attached by `src/response.ts`). Every JSON response, success or error, follows the same `{ message, data }` shape.

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
│   ├── app.ts          # Express app definition
│   ├── server.ts       # Entry point, starts the HTTP server
│   ├── routes.ts       # Route definitions
│   ├── logger.ts        # Winston logger
│   ├── errors.ts         # AppError
│   ├── errorHandler.ts    # Global error handler + 404 handler
│   ├── asyncHandler.ts    # Wraps async route handlers for error propagation
│   └── response.ts        # Attaches res.success() for consistent responses
├── tests
│   └── app.test.ts   # Integration tests
├── knexfile.ts        # Knex configuration for PostgreSQL
├── Dockerfile
├── docker-compose.yml
```
