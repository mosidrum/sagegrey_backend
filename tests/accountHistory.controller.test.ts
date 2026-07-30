import request from 'supertest';
import app from '../src/app';
import { AppError } from '../src/common/errors';
import { HTTP } from '../src/common/http';
import * as accountHistoryService from '../src/services/accountHistory.service';
import * as authService from '../src/services/auth.service';

jest.mock('../src/services/auth.service');
jest.mock('../src/services/accountHistory.service');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedAccountHistoryService = accountHistoryService as jest.Mocked<
  typeof accountHistoryService
>;

const authUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'test@example.com',
  full_name: 'Test User',
};

const accountId = '22222222-2222-4222-8222-222222222222';

const historyRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  accountId,
  userId: authUser.id,
  type: 'credit' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockedAuthService.verifyToken.mockReturnValue(authUser);
});

describe('GET /api/history/:id', () => {
  it('requires authentication', async () => {
    const response = await request(app).get(`/api/history/${accountId}`);
    expect(response.status).toBe(HTTP.UNAUTHORIZED);
  });

  it('returns 400 without calling the service for a non-uuid id', async () => {
    const response = await request(app)
      .get('/api/history/not-a-uuid')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedAccountHistoryService.getHistoryForAccount).not.toHaveBeenCalled();
  });

  it('returns the history for an owned account', async () => {
    mockedAccountHistoryService.getHistoryForAccount.mockResolvedValue([historyRecord]);

    const response = await request(app)
      .get(`/api/history/${accountId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Account history retrieved successfully');
    expect(response.body.data).toEqual([
      {
        ...historyRecord,
        createdAt: historyRecord.createdAt.toISOString(),
        updatedAt: historyRecord.updatedAt.toISOString(),
      },
    ]);
    expect(mockedAccountHistoryService.getHistoryForAccount).toHaveBeenCalledWith(
      authUser.id,
      accountId,
    );
  });

  it('propagates a 403 when the account is not owned by the caller', async () => {
    mockedAccountHistoryService.getHistoryForAccount.mockRejectedValue(
      new AppError(HTTP.FORBIDDEN, 'You are not authorised to access this account.'),
    );

    const response = await request(app)
      .get(`/api/history/${accountId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.FORBIDDEN);
  });

  it('propagates a 404 when the account does not exist', async () => {
    mockedAccountHistoryService.getHistoryForAccount.mockRejectedValue(
      new AppError(HTTP.NOT_FOUND, 'Account not found.'),
    );

    const response = await request(app)
      .get('/api/history/44444444-4444-4444-8444-444444444444')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.NOT_FOUND);
  });
});
