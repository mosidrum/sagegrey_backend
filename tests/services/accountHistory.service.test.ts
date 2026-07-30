import { AppError } from '../../src/common/errors';
import { HTTP } from '../../src/common/http';
import * as accountHistoryService from '../../src/services/accountHistory.service';
import * as accountService from '../../src/services/account.service';
import * as authService from '../../src/services/auth.service';
import * as transactionService from '../../src/services/transaction.service';
import * as userService from '../../src/services/user.service';
import { db, resetDb } from '../setup/testDb';

const PIN = '1234';
const DEFAULT_PIN = '0000';

async function createFundedAccount(
  email: string,
): Promise<{ userId: string; accountId: string; accountNumber: string }> {
  const { user } = await authService.signup('Test User', email, 'password123');
  await userService.setPin(user.id, PIN, DEFAULT_PIN);
  const account = await accountService.createAccount(user.id);
  await transactionService.fund(user.id, account.id, '100.00');

  return { userId: user.id, accountId: account.id, accountNumber: account.accountNumber };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.destroy();
});

describe('getHistoryForAccount', () => {
  it('records a credit entry for a funding operation', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com');

    const history = await accountHistoryService.getHistoryForAccount(userId, accountId);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ accountId, userId, type: 'credit' });
  });

  it('records a debit entry for a withdrawal', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com');

    await transactionService.withdraw(userId, accountId, '40.00', PIN);

    const history = await accountHistoryService.getHistoryForAccount(userId, accountId);

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ accountId, userId, type: 'debit' });
    expect(history[1]).toMatchObject({ accountId, userId, type: 'credit' });
  });

  it('records a debit entry for the source and a credit entry for the destination on a transfer', async () => {
    const source = await createFundedAccount('sender@example.com');
    const destination = await createFundedAccount('recipient@example.com');

    await transactionService.transfer(
      source.userId,
      source.accountId,
      destination.accountNumber,
      '25.00',
      PIN,
    );

    const sourceHistory = await accountHistoryService.getHistoryForAccount(
      source.userId,
      source.accountId,
    );
    const destinationHistory = await accountHistoryService.getHistoryForAccount(
      destination.userId,
      destination.accountId,
    );

    expect(sourceHistory[0]).toMatchObject({
      accountId: source.accountId,
      userId: source.userId,
      type: 'debit',
    });
    expect(destinationHistory[0]).toMatchObject({
      accountId: destination.accountId,
      userId: source.userId,
      type: 'credit',
    });
  });

  it('does not record a history entry when the underlying operation fails', async () => {
    const { userId, accountId } = await createFundedAccount('owner@example.com');

    await expect(transactionService.withdraw(userId, accountId, '1000.00', PIN)).rejects.toEqual(
      new AppError(HTTP.BAD_REQUEST, 'Insufficient funds to complete this transaction.'),
    );

    const history = await accountHistoryService.getHistoryForAccount(userId, accountId);
    expect(history).toHaveLength(1);
    expect(history[0]?.type).toBe('credit');
  });

  it('throws a 403 when the account does not belong to the caller', async () => {
    const owner = await createFundedAccount('owner@example.com');
    const other = await createFundedAccount('other@example.com');

    await expect(
      accountHistoryService.getHistoryForAccount(other.userId, owner.accountId),
    ).rejects.toEqual(
      new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.'),
    );
  });

  it('throws a 404 when the account does not exist', async () => {
    const { userId } = await createFundedAccount('owner@example.com');

    await expect(
      accountHistoryService.getHistoryForAccount(userId, '99999999-9999-4999-8999-999999999999'),
    ).rejects.toEqual(new AppError(HTTP.NOT_FOUND, 'Account not found.'));
  });
});
