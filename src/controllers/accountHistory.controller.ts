import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import * as accountHistoryService from '../services/accountHistory.service';

export const listForAccount: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const history = await accountHistoryService.getHistoryForAccount(req.user!.id, accountId);
  res.success(history, 'Account history retrieved successfully');
});
