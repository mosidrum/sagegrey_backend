import request from 'supertest';
import app from '../src/app';
import { AppError } from '../src/common/errors';
import { HTTP } from '../src/common/http';
import * as accountService from '../src/services/account.service';
import * as authService from '../src/services/auth.service';

jest.mock('../src/services/auth.service');
jest.mock('../src/services/account.service');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedAccountService = accountService as jest.Mocked<typeof accountService>;

const authUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'test@example.com',
  full_name: 'Test User',
};

const accountSummary = {
  id: '22222222-2222-4222-8222-222222222222',
  accountNumber: '1234567890',
  balance: '0.00',
  isLocked: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockedAuthService.verifyToken.mockReturnValue(authUser);
});

describe('POST /api/accounts', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/accounts');
    expect(response.status).toBe(HTTP.UNAUTHORIZED);
  });

  it('creates an account and returns 201', async () => {
    mockedAccountService.createAccount.mockResolvedValue(accountSummary);

    const response = await request(app)
      .post('/api/accounts')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.CREATED);
    expect(response.body.message).toBe('Account created successfully');
    expect(mockedAccountService.createAccount).toHaveBeenCalledWith(authUser.id);
  });
});

describe('GET /api/accounts', () => {
  it('lists the caller-owned accounts', async () => {
    mockedAccountService.getAccountsForUser.mockResolvedValue([accountSummary]);

    const response = await request(app)
      .get('/api/accounts')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(mockedAccountService.getAccountsForUser).toHaveBeenCalledWith(authUser.id);
  });
});

describe('GET /api/accounts/:id/balance', () => {
  it('returns 400 without calling the service for a non-uuid id', async () => {
    const response = await request(app)
      .get('/api/accounts/not-a-uuid/balance')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedAccountService.getBalance).not.toHaveBeenCalled();
  });

  it('returns the balance for an owned account', async () => {
    mockedAccountService.getBalance.mockResolvedValue(accountSummary);

    const response = await request(app)
      .get(`/api/accounts/${accountSummary.id}/balance`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Balance retrieved successfully');
    expect(mockedAccountService.getBalance).toHaveBeenCalledWith(authUser.id, accountSummary.id);
  });

  it('propagates a 403 when the account is not owned by the caller', async () => {
    mockedAccountService.getBalance.mockRejectedValue(
      new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.'),
    );

    const response = await request(app)
      .get(`/api/accounts/${accountSummary.id}/balance`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.FORBIDDEN);
  });

  it('propagates a 404 when the account does not exist', async () => {
    mockedAccountService.getBalance.mockRejectedValue(
      new AppError(HTTP.NOT_FOUND, 'Account not found.'),
    );

    const response = await request(app)
      .get('/api/accounts/33333333-3333-4333-8333-333333333333/balance')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.NOT_FOUND);
  });
});

describe('POST /api/accounts/:id/lock', () => {
  it('locks the account and returns 200', async () => {
    mockedAccountService.lockAccount.mockResolvedValue({ ...accountSummary, isLocked: true });

    const response = await request(app)
      .post(`/api/accounts/${accountSummary.id}/lock`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Account locked successfully');
    expect(mockedAccountService.lockAccount).toHaveBeenCalledWith(authUser.id, accountSummary.id);
  });
});

describe('POST /api/accounts/:id/unlock', () => {
  it('unlocks the account and returns 200', async () => {
    mockedAccountService.unlockAccount.mockResolvedValue(accountSummary);

    const response = await request(app)
      .post(`/api/accounts/${accountSummary.id}/unlock`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Account unlocked successfully');
    expect(mockedAccountService.unlockAccount).toHaveBeenCalledWith(authUser.id, accountSummary.id);
  });
});
