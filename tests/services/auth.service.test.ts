import jwt from 'jsonwebtoken';
import { AppError } from '../../src/common/errors';
import { HTTP } from '../../src/common/http';
import * as authService from '../../src/services/auth.service';
import { db, resetDb } from '../setup/testDb';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.destroy();
});

describe('signup', () => {
  it('issues a token whose payload decodes back to the created user', async () => {
    const { user, token } = await authService.signup(
      'Test User',
      'test@example.com',
      'password123',
    );

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/i);

    const authUser = authService.verifyToken(token);

    expect(authUser).toEqual({
      id: user.id,
      email: 'test@example.com',
      full_name: 'Test User',
    });
  });
});

describe('login', () => {
  it('issues a token whose payload decodes back to the logged-in user', async () => {
    await authService.signup('Test User', 'test@example.com', 'password123');

    const { user, token } = await authService.login('test@example.com', 'password123');
    const authUser = authService.verifyToken(token);

    expect(authUser).toEqual({
      id: user.id,
      email: 'test@example.com',
      full_name: 'Test User',
    });
  });

  it('rejects an incorrect password', async () => {
    await authService.signup('Test User', 'test@example.com', 'password123');

    await expect(authService.login('test@example.com', 'wrong-password')).rejects.toEqual(
      new AppError(HTTP.UNAUTHORIZED, 'Invalid email or password'),
    );
  });
});

describe('verifyToken', () => {
  it('rejects a malformed token', () => {
    expect(() => authService.verifyToken('not-a-jwt')).toThrow(
      new AppError(HTTP.UNAUTHORIZED, 'Invalid or expired token'),
    );
  });

  it('rejects a token signed with a different secret', () => {
    const forgedToken = jwt.sign(
      { email: 'attacker@example.com', name: 'Attacker' },
      'a-different-secret',
      { subject: '11111111-1111-4111-8111-111111111111', expiresIn: '1h' },
    );

    expect(() => authService.verifyToken(forgedToken)).toThrow(
      new AppError(HTTP.UNAUTHORIZED, 'Invalid or expired token'),
    );
  });

  it('rejects an expired token', async () => {
    const { token } = await authService.signup('Test User', 'test@example.com', 'password123');
    const decoded = jwt.decode(token) as { sub: string; email: string; name: string };

    const expiredToken = jwt.sign(
      { email: decoded.email, name: decoded.name },
      process.env.JWT_SECRET as string,
      { subject: decoded.sub, expiresIn: -1 },
    );

    expect(() => authService.verifyToken(expiredToken)).toThrow(
      new AppError(HTTP.UNAUTHORIZED, 'Invalid or expired token'),
    );
  });
});
