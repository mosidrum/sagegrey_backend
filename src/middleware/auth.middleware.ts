import { RequestHandler } from 'express';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import { AuthUser } from '../models/user.model';
import { verifyToken } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(HTTP.UNAUTHORIZED, 'Missing or invalid Authorization header'));
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
