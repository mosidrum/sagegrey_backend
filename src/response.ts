import { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required to augment Express's Response type
  namespace Express {
    interface Response {
      success<T>(data?: T, message?: string, statusCode?: number): void;
    }
  }
}

export function responseHandler(_req: Request, res: Response, next: NextFunction): void {
  res.success = function success<T>(
    data: T | null = null,
    message = 'Success',
    statusCode = 200,
  ): void {
    res.status(statusCode).json({ message, data });
  };

  next();
}
