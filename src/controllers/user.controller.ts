import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import * as userService from '../services/user.service';

export const setPin: RequestHandler = asyncHandler(async (req, res) => {
  const { pin, currentPin } = req.body as { pin: string; currentPin?: string };
  await userService.setPin(req.user!.id, pin, currentPin);
  res.success(undefined, 'Transaction PIN set successfully');
});
