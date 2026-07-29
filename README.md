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

## Running with Docker (recommended)

Starts the API on port 8000 and a Postgres database, with hot reload on file changes:

```bash
docker compose up --build
```

The API will be available at http://localhost:8000.

## Running locally (without Docker)

Requires a Postgres instance reachable via the settings in `.env`.

```bash
npm run dev
```

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
│   ├── app.ts        # Express app definition
│   ├── server.ts     # Entry point, starts the HTTP server
│   └── routes.ts      # Route definitions
├── tests
│   └── app.test.ts   # Integration tests
├── knexfile.ts        # Knex configuration for PostgreSQL
├── Dockerfile
├── docker-compose.yml
```
