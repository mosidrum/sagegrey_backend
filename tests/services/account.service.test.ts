import { AppError } from '../../src/common/errors';
import * as accountNumberModule from '../../src/common/accountNumber';
import { HTTP } from '../../src/common/http';
import * as accountRepository from '../../src/repositories/account.repository';
import * as accountService from '../../src/services/account.service';
import * as authService from '../../src/services/auth.service';
import { db, resetDb } from '../setup/testDb';

async function createUser(email: string): Promise<number> {
  const { user } = await authService.signup('Test User', email, 'password123');
  return user.id;
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

describe('createAccount', () => {
  it('creates an account with a 10-digit account number and a zero balance', async () => {
    const userId = await createUser('owner@example.com');

    const account = await accountService.createAccount(userId);

    expect(account.accountNumber).toMatch(/^\d{10}$/);
    expect(account.balance).toBe('0.00');
    expect(account.isLocked).toBe(false);
  });

  it('retries with a new account number when the generated one already exists', async () => {
    const userId = await createUser('owner@example.com');
    await accountRepository.create({ user_id: userId, account_number: '1111111111' });

    const generateAccountNumberSpy = jest.spyOn(accountNumberModule, 'generateAccountNumber');
    generateAccountNumberSpy.mockReturnValueOnce('1111111111').mockReturnValueOnce('2222222222');

    const account = await accountService.createAccount(userId);

    expect(account.accountNumber).toBe('2222222222');
    expect(generateAccountNumberSpy).toHaveBeenCalledTimes(2);
  });
});

describe('ownership checks', () => {
  it('throws a 404 when the account does not exist', async () => {
    const userId = await createUser('owner@example.com');

    await expect(accountService.getBalance(userId, 999999)).rejects.toEqual(
      new AppError(HTTP.NOT_FOUND, 'Account not found.'),
    );
  });

  it('throws a 403 when the account belongs to another user', async () => {
    const ownerId = await createUser('owner@example.com');
    const otherUserId = await createUser('other@example.com');
    const account = await accountService.createAccount(ownerId);

    await expect(accountService.getBalance(otherUserId, account.id)).rejects.toEqual(
      new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.'),
    );
  });
});

describe('lockAccount / unlockAccount', () => {
  it('locks and unlocks an owned account idempotently', async () => {
    const userId = await createUser('owner@example.com');
    const account = await accountService.createAccount(userId);

    const locked = await accountService.lockAccount(userId, account.id);
    expect(locked.isLocked).toBe(true);

    const lockedAgain = await accountService.lockAccount(userId, account.id);
    expect(lockedAgain.isLocked).toBe(true);

    const unlocked = await accountService.unlockAccount(userId, account.id);
    expect(unlocked.isLocked).toBe(false);
  });
});
