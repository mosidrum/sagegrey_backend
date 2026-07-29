import { NextFunction, Request, Response } from 'express';
import { AppError } from './errors';
import logger from './logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  if (statusCode >= 500) {
    logger.error(err.stack ?? err.message);
  }

  res.status(statusCode).json({ message, data: null });
}
