# GoMe API

A banking API: sign up, open accounts, fund, withdraw, and transfer money.

## Prerequisites

- Docker and Docker Compose

## Getting started

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Build the images (first time only, or after changing dependencies):

   ```bash
   npm run docker:build
   ```

3. Start the API and database:

   ```bash
   npm run dev
   ```

   The API is now running at http://localhost:8000.

4. Apply database migrations (first time only, and again any time `npm run docker:down` drops the database):

   ```bash
   npm run migrate
   ```

## Stopping

```bash
npm run docker:down
```

## Running tests

```bash
docker compose exec gome-api npm test
```

For a full technical walkthrough of the codebase, see [read.md](read.md).
