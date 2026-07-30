import 'dotenv/config';
import app from './app';
import { verifyConnection } from './database/connection';
import logger from './common/logger';

const port = process.env.PORT || 8000;

async function start(): Promise<void> {
  await verifyConnection();
  logger.INFO('Database connection established');

  app.listen(port, () => {
    logger.INFO(`Server listening on port ${port}`);
  });
}

start().catch((error: Error) => {
  logger.ERROR(error.stack ?? error.message);
  process.exit(1);
});
