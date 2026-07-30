import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { HTTP } from '../common/http';
import * as authService from '../services/auth.service';

export const signup: RequestHandler = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body as {
    fullName: string;
    email: string;
    password: string;
  };
  const { user, token } = await authService.signup(fullName, email, password);
  res.success({ user, token }, 'Signed up successfully', HTTP.CREATED);
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
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
