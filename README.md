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
