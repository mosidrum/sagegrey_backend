import { AppError } from '../common/errors';
import { generateAccountNumber } from '../common/accountNumber';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import { fromMinorUnits } from '../common/money';
import { Account } from '../models/account.model';
import * as accountRepository from '../repositories/account.repository';

const MAX_ACCOUNT_NUMBER_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

export interface AccountSummary {
  id: number;
  accountNumber: string;
  balance: string;
  isLocked: boolean;
  createdAt: Date;
}

function toAccountSummary(account: Account): AccountSummary {
  return {
    id: account.id,
    accountNumber: account.account_number,
    balance: fromMinorUnits(account.balance_minor),
    isLocked: account.is_locked,
    createdAt: account.created_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export async function createAccount(userId: number): Promise<AccountSummary> {
  for (let attempt = 1; attempt <= MAX_ACCOUNT_NUMBER_ATTEMPTS; attempt += 1) {
    const accountNumber = generateAccountNumber();

    try {
      const account = await accountRepository.create({
        user_id: userId,
        account_number: accountNumber,
      });

      if (!account) {
        throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to create account.');
      }

      logger.INFO('Account created', {
        userId,
        accountId: account.id,
        accountNumber: account.account_number,
      });
      return toAccountSummary(account);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new AppError(
    HTTP.INTERNAL_SERVER_ERROR,
    'Failed to generate a unique account number. Please try again.',
  );
}

export async function getAccountsForUser(userId: number): Promise<AccountSummary[]> {
  const accounts = await accountRepository.findByUserId(userId);
  return accounts.map(toAccountSummary);
}

export async function getOwnedAccount(userId: number, accountId: number): Promise<Account> {
  const account = await accountRepository.getById(accountId);

  if (!account) {
    throw new AppError(HTTP.NOT_FOUND, 'Account not found.');
  }

  if (account.user_id !== userId) {
    throw new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.');
  }

  return account;
}

export async function getBalance(userId: number, accountId: number): Promise<AccountSummary> {
  const account = await getOwnedAccount(userId, accountId);
  return toAccountSummary(account);
}

export async function lockAccount(userId: number, accountId: number): Promise<AccountSummary> {
  const account = await getOwnedAccount(userId, accountId);

  if (!account.is_locked) {
    await accountRepository.setLock(account.id, true);
    logger.WARN('Account locked', { userId, accountId: account.id });
  }

  return { ...toAccountSummary(account), isLocked: true };
}

export async function unlockAccount(userId: number, accountId: number): Promise<AccountSummary> {
  const account = await getOwnedAccount(userId, accountId);

  if (account.is_locked) {
    await accountRepository.setLock(account.id, false);
    logger.INFO('Account unlocked', { userId, accountId: account.id });
  }

  return { ...toAccountSummary(account), isLocked: false };
}
