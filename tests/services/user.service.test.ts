import { AppError } from '../../src/common/errors';
import { HTTP } from '../../src/common/http';
import * as authService from '../../src/services/auth.service';
import * as userService from '../../src/services/user.service';
import { db, resetDb } from '../setup/testDb';

async function createUser(): Promise<string> {
  const { user } = await authService.signup('Test User', 'test@example.com', 'password123');
  return user.id;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.destroy();
});

describe('verifyPin', () => {
  it('throws a 400 when the user has not set a PIN yet', async () => {
    const userId = await createUser();

    await expect(userService.verifyPin(userId, '1234')).rejects.toEqual(
      new AppError(
        HTTP.BAD_REQUEST,
        'Please set your transaction PIN before performing this action.',
      ),
    );
  });

  it('throws a 401 when the PIN is incorrect', async () => {
    const userId = await createUser();
    await userService.setPin(userId, '1234');

    await expect(userService.verifyPin(userId, '0000')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Incorrect transaction PIN.'),
    );
  });

  it('resolves without throwing when the PIN is correct', async () => {
    const userId = await createUser();
    await userService.setPin(userId, '1234');

    await expect(userService.verifyPin(userId, '1234')).resolves.toBeUndefined();
  });
});

describe('setPin', () => {
  it('sets the PIN for the first time without requiring a current PIN', async () => {
    const userId = await createUser();

    await userService.setPin(userId, '1234');

    await expect(userService.verifyPin(userId, '1234')).resolves.toBeUndefined();
  });

  it('requires the current PIN to change an already-set PIN', async () => {
    const userId = await createUser();
    await userService.setPin(userId, '1234');

    await expect(userService.setPin(userId, '5678')).rejects.toEqual(
      new AppError(HTTP.BAD_REQUEST, 'Your current transaction PIN is required to change it.'),
    );
  });

  it('rejects an incorrect current PIN when changing the PIN', async () => {
    const userId = await createUser();
    await userService.setPin(userId, '1234');

    await expect(userService.setPin(userId, '5678', '0000')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Your current transaction PIN is incorrect.'),
    );
  });

  it('changes the PIN when the correct current PIN is provided', async () => {
    const userId = await createUser();
    await userService.setPin(userId, '1234');

    await userService.setPin(userId, '5678', '1234');

    await expect(userService.verifyPin(userId, '5678')).resolves.toBeUndefined();
  });
});
