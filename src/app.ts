import express from 'express';
import routes from './routes';
import { errorHandler, notFoundHandler } from './errorHandler';

const app = express();

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
