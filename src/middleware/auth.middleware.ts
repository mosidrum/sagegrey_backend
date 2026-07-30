import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import { SafeUser } from '../models/user.model';
import { findByToken } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    throw new AppError(HTTP.UNAUTHORIZED, 'Missing or invalid Authorization header');
  }

  const user = await findByToken(token);
  if (!user) {
    throw new AppError(HTTP.UNAUTHORIZED, 'Invalid or expired token');
  }

  req.user = user;
  next();
});
