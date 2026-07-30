import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../common/errors';
import { HTTP } from '../../common/http';

export function runValidation(req: Request, _res: Response, next: NextFunction): void {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const firstError = result.array({ onlyFirstError: true })[0];
    next(new AppError(HTTP.BAD_REQUEST, firstError?.msg ?? 'Invalid request.'));
    return;
  }

  next();
}
