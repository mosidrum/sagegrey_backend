import { AppError } from '../../src/common/errors';
import { HTTP } from '../../src/common/http';
import * as accountService from '../../src/services/account.service';
import * as authService from '../../src/services/auth.service';
import * as transactionService from '../../src/services/transaction.service';
import * as userService from '../../src/services/user.service';
import * as transactionRepository from '../../src/repositories/transaction.repository';
import { db, resetDb } from '../setup/testDb';

const PIN = '1234';
const DEFAULT_PIN = '0000';

async function createFundedAccount(
  email: string,
  openingBalance: string,
): Promise<{
  userId: string;
  accountId: string;
  accountNumber: string;
}> {
  const { user } = await authService.signup('Test User', email, 'password123');
  await userService.setPin(user.id, PIN, DEFAULT_PIN);
  const account = await accountService.createAccount(user.id);

  if (openingBalance !== '0.00') {
    await transactionService.fund(user.id, account.id, openingBalance);
  }

  return { userId: user.id, accountId: account.id, accountNumber: account.accountNumber };
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await db.destroy();
});

describe('fund', () => {
  it('increases the balance and records a funding transaction', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '0.00');

    const transaction = await transactionService.fund(userId, accountId, '50.00');

    expect(transaction.type).toBe('funding');
    expect(transaction.amount).toBe('50.00');
    expect(transaction.balanceAfter).toBe('50.00');

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('50.00');
  });

  it('funds a locked account without unlocking it', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '0.00');
    await accountService.lockAccount(userId, accountId);

    await transactionService.fund(userId, accountId, '25.00');

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('25.00');
    expect(balance.isLocked).toBe(true);
  });
});

describe('withdraw', () => {
  it('decreases the balance and records a withdrawal transaction', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '100.00');

    const transaction = await transactionService.withdraw(userId, accountId, '40.00', PIN);

    expect(transaction.type).toBe('withdrawal');
    expect(transaction.amount).toBe('40.00');
    expect(transaction.balanceAfter).toBe('60.00');
  });

  it('rejects insufficient funds without mutating the balance', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '10.00');

    await expect(transactionService.withdraw(userId, accountId, '20.00', PIN)).rejects.toEqual(
      new AppError(HTTP.BAD_REQUEST, 'Insufficient funds to complete this transaction.'),
    );

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('10.00');
  });

  it('rejects a locked account without mutating the balance', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '100.00');
    await accountService.lockAccount(userId, accountId);

    await expect(transactionService.withdraw(userId, accountId, '10.00', PIN)).rejects.toEqual(
      new AppError(HTTP.FORBIDDEN, 'This account is currently locked.'),
    );

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('100.00');
  });

  it('rejects a withdrawal while the PIN is still the default 0000', async () => {
    const { user } = await authService.signup('Test User', 'nopin@example.com', 'password123');
    const account = await accountService.createAccount(user.id);
    await transactionService.fund(user.id, account.id, '100.00');

    await expect(
      transactionService.withdraw(user.id, account.id, '10.00', DEFAULT_PIN),
    ).rejects.toEqual(
      new AppError(
        HTTP.BAD_REQUEST,
        'Please set your transaction PIN before performing this action.',
      ),
    );

    const balance = await accountService.getBalance(user.id, account.id);
    expect(balance.balance).toBe('100.00');
  });

  it('rejects a withdrawal with an incorrect PIN without mutating the balance', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '100.00');

    await expect(transactionService.withdraw(userId, accountId, '10.00', '9999')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Incorrect transaction PIN.'),
    );

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('100.00');
  });

  it('rolls back the balance update when recording the transaction fails', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '100.00');

    jest.spyOn(transactionRepository, 'create').mockRejectedValueOnce(new Error('disk full'));

    await expect(transactionService.withdraw(userId, accountId, '30.00', PIN)).rejects.toThrow(
      'disk full',
    );

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('100.00');
  });
});

describe('transfer', () => {
  it('debits the source and credits the destination with a shared transfer group id', async () => {
    const source = await createFundedAccount('sender@example.com', '100.00');
    const destination = await createFundedAccount('recipient@example.com', '0.00');

    const { debit, credit } = await transactionService.transfer(
      source.userId,
      source.accountId,
      destination.accountNumber,
      '40.00',
      PIN,
    );

    expect(debit.type).toBe('transfer_debit');
    expect(debit.amount).toBe('40.00');
    expect(debit.balanceAfter).toBe('60.00');
    expect(debit.counterpartyAccountId).toBe(destination.accountId);

    expect(credit.type).toBe('transfer_credit');
    expect(credit.amount).toBe('40.00');
    expect(credit.balanceAfter).toBe('40.00');
    expect(credit.counterpartyAccountId).toBe(source.accountId);

    expect(debit.transferGroupId).toBe(credit.transferGroupId);
    expect(debit.transferGroupId).not.toBeNull();
  });

  it('rejects a transfer to a nonexistent destination account number', async () => {
    const source = await createFundedAccount('sender@example.com', '100.00');

    await expect(
      transactionService.transfer(source.userId, source.accountId, '0000000000', '10.00', PIN),
    ).rejects.toEqual(new AppError(HTTP.NOT_FOUND, 'Destination account was not found.'));
  });

  it('rejects a transfer from an account the caller does not own', async () => {
    const source = await createFundedAccount('sender@example.com', '100.00');
    const destination = await createFundedAccount('recipient@example.com', '0.00');

    await expect(
      transactionService.transfer(
        destination.userId,
        source.accountId,
        destination.accountNumber,
        '10.00',
        PIN,
      ),
    ).rejects.toEqual(
      new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.'),
    );
  });
});

describe('concurrent withdrawals', () => {
  it('only allows one of two simultaneous withdrawals that would jointly overdraw the account', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com', '100.00');

    const results = await Promise.allSettled([
      transactionService.withdraw(userId, accountId, '80.00', PIN),
      transactionService.withdraw(userId, accountId, '80.00', PIN),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const balance = await accountService.getBalance(userId, accountId);
    expect(balance.balance).toBe('20.00');
  });
});
