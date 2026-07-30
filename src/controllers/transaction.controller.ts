import { RequestHandler } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { HTTP } from '../common/http';
import * as transactionService from '../services/transaction.service';

export const fund: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const { amount, description } = req.body as { amount: string; description?: string };
  const transaction = await transactionService.fund(req.user!.id, accountId, amount, description);
  res.success(transaction, 'Account funded successfully', HTTP.CREATED);
});

export const withdraw: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const { amount, pin, description } = req.body as {
    amount: string;
    pin: string;
    description?: string;
  };
  const transaction = await transactionService.withdraw(
    req.user!.id,
    accountId,
    amount,
    pin,
    description,
  );
  res.success(transaction, 'Withdrawal completed successfully', HTTP.CREATED);
});

export const transfer: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const { destinationAccountNumber, amount, pin, description } = req.body as {
    destinationAccountNumber: string;
    amount: string;
    pin: string;
    description?: string;
  };
  const transaction = await transactionService.transfer(
    req.user!.id,
    accountId,
    destinationAccountNumber,
    amount,
    pin,
    description,
  );
  res.success(transaction, 'Funds transferred successfully', HTTP.CREATED);
});

export const listForAccount: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = req.params.id!;
  const transactions = await transactionService.listTransactions(req.user!.id, accountId);
  res.success(transactions, 'Transactions retrieved successfully');
});
