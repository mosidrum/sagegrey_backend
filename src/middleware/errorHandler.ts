import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(HTTP.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : HTTP.INTERNAL_SERVER_ERROR;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  if (statusCode >= HTTP.INTERNAL_SERVER_ERROR) {
    logger.ERROR(err.stack ?? err.message);
  }

  res.status(statusCode).json({ message, data: null });
}
