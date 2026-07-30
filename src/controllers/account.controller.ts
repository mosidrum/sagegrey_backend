import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { HTTP } from '../common/http';
import * as accountService from '../services/account.service';

export const createAccount: RequestHandler = asyncHandler(async (req, res) => {
  const account = await accountService.createAccount(req.user!.id);
  res.success(account, 'Account created successfully', HTTP.CREATED);
});

export const listAccounts: RequestHandler = asyncHandler(async (req, res) => {
  const accounts = await accountService.getAccountsForUser(req.user!.id);
  res.success(accounts, 'Accounts retrieved successfully');
});

export const getBalance: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const account = await accountService.getBalance(req.user!.id, accountId);
  res.success(account, 'Balance retrieved successfully');
});

export const lockAccount: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const account = await accountService.lockAccount(req.user!.id, accountId);
  res.success(account, 'Account locked successfully');
});

export const unlockAccount: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const account = await accountService.unlockAccount(req.user!.id, accountId);
  res.success(account, 'Account unlocked successfully');
});
