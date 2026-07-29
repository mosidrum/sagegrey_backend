import 'dotenv/config';
import app from './app';
import logger from './logger';

const port = process.env.PORT || 8000;

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
