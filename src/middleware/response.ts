import { NextFunction, Request, Response } from 'express';
import { HTTP } from '../common/http';

declare global {
  namespace Express {
    interface Response {
      success<T>(data?: T, message?: string, statusCode?: number): void;
    }
  }
}

export function responseHandler(_req: Request, res: Response, next: NextFunction): void {
  res.success = function success<T>(data?: T, message = 'Success', statusCode = HTTP.OK): void {
    const body = data === undefined ? { message } : { message, data };
    res.status(statusCode).json(body);
  };

  next();
}
