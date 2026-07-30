import { AppError } from '../../src/common/errors';
import { HTTP } from '../../src/common/http';
import * as authService from '../../src/services/auth.service';
import * as userService from '../../src/services/user.service';
import { db, resetDb } from '../setup/testDb';

const DEFAULT_PIN = '0000';

async function createUser(): Promise<string> {
  const { user } = await authService.signup('Test User', 'test@example.com', 'password123');
  return user.id;
}

async function createUserWithPin(pin: string): Promise<string> {
  const userId = await createUser();
  await userService.setPin(userId, pin, DEFAULT_PIN);
  return userId;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.destroy();
});

describe('verifyPin', () => {
  it('throws a 400 when the PIN is still the default 0000', async () => {
    const userId = await createUser();

    await expect(userService.verifyPin(userId, DEFAULT_PIN)).rejects.toEqual(
      new AppError(
        HTTP.BAD_REQUEST,
        'Please set your transaction PIN before performing this action.',
      ),
    );
  });

  it('throws a 401 when the PIN is incorrect', async () => {
    const userId = await createUserWithPin('1234');

    await expect(userService.verifyPin(userId, '9999')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Incorrect transaction PIN.'),
    );
  });

  it('resolves without throwing when the PIN is correct', async () => {
    const userId = await createUserWithPin('1234');

    await expect(userService.verifyPin(userId, '1234')).resolves.toBeUndefined();
  });
});

describe('setPin', () => {
  it('every new user starts with the default PIN 0000', async () => {
    const userId = await createUser();

    await expect(userService.setPin(userId, '1234', DEFAULT_PIN)).resolves.toBeUndefined();
  });

  it('requires the current PIN to change it, even on the first change from the default', async () => {
    const userId = await createUser();

    await expect(userService.setPin(userId, '1234')).rejects.toEqual(
      new AppError(HTTP.BAD_REQUEST, 'Your current transaction PIN is required to change it.'),
    );
  });

  it('rejects an incorrect current PIN', async () => {
    const userId = await createUser();

    await expect(userService.setPin(userId, '1234', '9999')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Your current transaction PIN is incorrect.'),
    );
  });

  it('changes the PIN when the correct current PIN is provided', async () => {
    const userId = await createUserWithPin('1234');

    await userService.setPin(userId, '5678', '1234');

    await expect(userService.verifyPin(userId, '5678')).resolves.toBeUndefined();
  });
});
