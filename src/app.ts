import express from 'express';
import routes from './routes';
import { corsMiddleware, rateLimiter, securityHeaders } from './middleware/security';
import { responseHandler } from './middleware/response';
import { responseLogger } from './middleware/responseLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(responseLogger);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(rateLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(responseHandler);
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
