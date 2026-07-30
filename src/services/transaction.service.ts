import crypto from 'crypto';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import { fromMinorUnits, toMinorUnits } from '../common/money';
import db from '../database/connection';
import { Transaction, TransactionStatus, TransactionType } from '../models/transaction.model';
import * as accountHistoryRepository from '../repositories/accountHistory.repository';
import * as accountRepository from '../repositories/account.repository';
import * as transactionRepository from '../repositories/transaction.repository';
import * as accountService from './account.service';
import * as userService from './user.service';

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  accountId: string;
  counterpartyAccountId: string | null;
  amount: string;
  balanceAfter: string;
  description: string | null;
  status: TransactionStatus;
  transferGroupId: string | null;
  createdAt: Date;
}

function toTransactionRecord(row: Transaction): TransactionRecord {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    counterpartyAccountId: row.counterparty_account_id,
    amount: fromMinorUnits(row.amount_minor),
    balanceAfter: fromMinorUnits(row.balance_after_minor),
    description: row.description,
    status: row.status,
    transferGroupId: row.transfer_group_id,
    createdAt: row.created_at,
  };
}

export async function fund(
  fundedByUserId: string,
  accountId: string,
  amount: string,
  description?: string,
): Promise<TransactionRecord> {
  const amountMinor = toMinorUnits(amount);

  logger.DEBUG('Starting funding transaction', { userId: fundedByUserId, accountId, amount });

  try {
    const transaction = await db.transaction(async (trx) => {
      const account = await accountRepository.getByIdForUpdate(accountId, trx);
      if (!account) {
        throw new AppError(HTTP.NOT_FOUND, 'Account not found.');
      }

      const newBalance = BigInt(account.balance_minor) + amountMinor;
      await accountRepository.updateBalance(account.id, newBalance.toString(), trx);

      const row = await transactionRepository.create(
        {
          type: 'funding',
          account_id: account.id,
          counterparty_account_id: null,
          amount_minor: amountMinor.toString(),
          balance_after_minor: newBalance.toString(),
          description: description ?? null,
          status: 'completed',
          transfer_group_id: null,
        },
        trx,
      );

      if (!row) {
        throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to record the transaction.');
      }

      await accountHistoryRepository.create(
        { account_id: account.id, user_id: fundedByUserId, type: 'credit' },
        trx,
      );

      return row;
    });

    logger.INFO('Funding transaction committed', {
      userId: fundedByUserId,
      accountId,
      amount,
      transactionId: transaction.id,
    });
    return toTransactionRecord(transaction);
  } catch (error) {
    logger.ERROR(`Funding transaction rolled back: ${(error as Error).message}`, {
      userId: fundedByUserId,
      accountId,
      amount,
    });
    throw error;
  }
}

export async function withdraw(
  userId: string,
  accountId: string,
  amount: string,
  pin: string,
  description?: string,
): Promise<TransactionRecord> {
  await userService.verifyPin(userId, pin);

  const amountMinor = toMinorUnits(amount);

  logger.DEBUG('Starting withdrawal transaction', { userId, accountId, amount });

  try {
    const transaction = await db.transaction(async (trx) => {
      const account = await accountRepository.getByIdForUpdate(accountId, trx);
      if (!account) {
        throw new AppError(HTTP.NOT_FOUND, 'Account not found.');
      }

      if (account.user_id !== userId) {
        throw new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.');
      }

      if (account.is_locked) {
        throw new AppError(HTTP.FORBIDDEN, 'This account is currently locked.');
      }

      const currentBalance = BigInt(account.balance_minor);
      if (currentBalance < amountMinor) {
        throw new AppError(HTTP.BAD_REQUEST, 'Insufficient funds to complete this transaction.');
      }

      const newBalance = currentBalance - amountMinor;
      await accountRepository.updateBalance(account.id, newBalance.toString(), trx);

      const row = await transactionRepository.create(
        {
          type: 'withdrawal',
          account_id: account.id,
          counterparty_account_id: null,
          amount_minor: amountMinor.toString(),
          balance_after_minor: newBalance.toString(),
          description: description ?? null,
          status: 'completed',
          transfer_group_id: null,
        },
        trx,
      );

      if (!row) {
        throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to record the transaction.');
      }

      await accountHistoryRepository.create(
        { account_id: account.id, user_id: userId, type: 'debit' },
        trx,
      );

      return row;
    });

    logger.INFO('Withdrawal transaction committed', {
      userId,
      accountId,
      amount,
      transactionId: transaction.id,
    });
    return toTransactionRecord(transaction);
  } catch (error) {
    logger.ERROR(`Withdrawal transaction rolled back: ${(error as Error).message}`, {
      userId,
      accountId,
      amount,
    });
    throw error;
  }
}

export async function transfer(
  userId: string,
  sourceAccountId: string,
  destinationAccountNumber: string,
  amount: string,
  pin: string,
  description?: string,
): Promise<{ debit: TransactionRecord; credit: TransactionRecord }> {
  await userService.verifyPin(userId, pin);

  const amountMinor = toMinorUnits(amount);

  logger.DEBUG('Starting transfer transaction', {
    userId,
    sourceAccountId,
    destinationAccountNumber,
    amount,
  });

  try {
    const result = await db.transaction(async (trx) => {
      const destination = await accountRepository.findByAccountNumber(
        destinationAccountNumber,
        trx,
      );
      if (!destination) {
        throw new AppError(HTTP.NOT_FOUND, 'Destination account was not found.');
      }

      if (destination.id === sourceAccountId) {
        throw new AppError(HTTP.BAD_REQUEST, 'You cannot transfer to the same account.');
      }

      const lockedAccounts = await accountRepository.getManyByIdsForUpdate(
        [sourceAccountId, destination.id],
        trx,
      );
      const source = lockedAccounts.find((account) => account.id === sourceAccountId);
      const lockedDestination = lockedAccounts.find((account) => account.id === destination.id);

      if (!source || !lockedDestination) {
        throw new AppError(HTTP.NOT_FOUND, 'Account not found.');
      }

      if (source.user_id !== userId) {
        throw new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.');
      }

      if (source.is_locked) {
        throw new AppError(HTTP.FORBIDDEN, 'This account is currently locked.');
      }

      const sourceBalance = BigInt(source.balance_minor);
      if (sourceBalance < amountMinor) {
        throw new AppError(HTTP.BAD_REQUEST, 'Insufficient funds to complete this transaction.');
      }

      const newSourceBalance = sourceBalance - amountMinor;
      const newDestinationBalance = BigInt(lockedDestination.balance_minor) + amountMinor;

      await accountRepository.updateBalance(source.id, newSourceBalance.toString(), trx);
      await accountRepository.updateBalance(
        lockedDestination.id,
        newDestinationBalance.toString(),
        trx,
      );

      const transferGroupId = crypto.randomUUID();

      const debitRow = await transactionRepository.create(
        {
          type: 'transfer_debit',
          account_id: source.id,
          counterparty_account_id: lockedDestination.id,
          amount_minor: amountMinor.toString(),
          balance_after_minor: newSourceBalance.toString(),
          description: description ?? null,
          status: 'completed',
          transfer_group_id: transferGroupId,
        },
        trx,
      );

      const creditRow = await transactionRepository.create(
        {
          type: 'transfer_credit',
          account_id: lockedDestination.id,
          counterparty_account_id: source.id,
          amount_minor: amountMinor.toString(),
          balance_after_minor: newDestinationBalance.toString(),
          description: description ?? null,
          status: 'completed',
          transfer_group_id: transferGroupId,
        },
        trx,
      );

      if (!debitRow || !creditRow) {
        throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to record the transfer.');
      }

      await accountHistoryRepository.create(
        { account_id: source.id, user_id: userId, type: 'debit' },
        trx,
      );
      await accountHistoryRepository.create(
        { account_id: lockedDestination.id, user_id: userId, type: 'credit' },
        trx,
      );

      return { debit: debitRow, credit: creditRow };
    });

    logger.INFO('Transfer transaction committed', {
      userId,
      sourceAccountId,
      destinationAccountId: result.credit.account_id,
      amount,
      transferGroupId: result.debit.transfer_group_id,
    });
    return { debit: toTransactionRecord(result.debit), credit: toTransactionRecord(result.credit) };
  } catch (error) {
    logger.ERROR(`Transfer transaction rolled back: ${(error as Error).message}`, {
      userId,
      sourceAccountId,
      destinationAccountNumber,
      amount,
    });
    throw error;
  }
}

export async function listTransactions(
  userId: string,
  accountId: string,
): Promise<TransactionRecord[]> {
  const account = await accountService.getOwnedAccount(userId, accountId);
  const rows = await transactionRepository.findByAccountId(account.id);
  return rows.map(toTransactionRecord);
}
