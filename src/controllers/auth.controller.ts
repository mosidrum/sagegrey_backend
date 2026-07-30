import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import * as authService from '../services/auth.service';

function parseCredentials(body: unknown): { email: string; password: string } {
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    password.length < 8
  ) {
    throw new AppError(
      HTTP.BAD_REQUEST,
      'A valid email and a password of at least 8 characters are required',
    );
  }

  return { email: email.trim().toLowerCase(), password };
}

export const signup: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const { user, token } = await authService.signup(email, password);
  res.success({ user, token }, 'Signed up successfully', HTTP.CREATED);
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const { user, token } = await authService.login(email, password);
  res.success({ user, token }, 'Logged in successfully');
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  await authService.logout(req.user!.id);
  res.success(undefined, 'Logged out successfully');
});

export const me: RequestHandler = (req, res) => {
  res.success(req.user, 'Current user');
};
