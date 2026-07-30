import request from 'supertest';
import app from '../src/app';
import { AppError } from '../src/common/errors';
import { HTTP } from '../src/common/http';
import * as authService from '../src/services/auth.service';
import * as transactionService from '../src/services/transaction.service';

jest.mock('../src/services/auth.service');
jest.mock('../src/services/transaction.service');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;

const authUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'test@example.com',
  full_name: 'Test User',
};

const accountId = '22222222-2222-4222-8222-222222222222';

const transactionRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  type: 'funding' as const,
  accountId,
  counterpartyAccountId: null,
  amount: '50.00',
  balanceAfter: '50.00',
  description: null,
  status: 'completed' as const,
  transferGroupId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockedAuthService.verifyToken.mockReturnValue(authUser);
});

describe('POST /api/transactions/:id/fund', () => {
  it('returns 400 without calling the service for an invalid amount', async () => {
    const response = await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: 'not-a-number' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedTransactionService.fund).not.toHaveBeenCalled();
  });

  it('funds the account and returns 201', async () => {
    mockedTransactionService.fund.mockResolvedValue(transactionRecord);

    const response = await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '50.00', description: 'top up' });

    expect(response.status).toBe(HTTP.CREATED);
    expect(response.body.message).toBe('Account funded successfully');
    expect(mockedTransactionService.fund).toHaveBeenCalledWith(
      authUser.id,
      accountId,
      '50.00',
      'top up',
    );
  });
});

describe('POST /api/transactions/:id/withdraw', () => {
  it('returns 400 without calling the service when the PIN is missing', async () => {
    const response = await request(app)
      .post(`/api/transactions/${accountId}/withdraw`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '10.00' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedTransactionService.withdraw).not.toHaveBeenCalled();
  });

  it('withdraws and returns 201', async () => {
    mockedTransactionService.withdraw.mockResolvedValue({
      ...transactionRecord,
      type: 'withdrawal',
    });

    const response = await request(app)
      .post(`/api/transactions/${accountId}/withdraw`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '10.00', pin: '1234' });

    expect(response.status).toBe(HTTP.CREATED);
    expect(response.body.message).toBe('Withdrawal completed successfully');
    expect(mockedTransactionService.withdraw).toHaveBeenCalledWith(
      authUser.id,
      accountId,
      '10.00',
      '1234',
      undefined,
    );
  });

  it('propagates a 400 insufficient funds error from the service', async () => {
    mockedTransactionService.withdraw.mockRejectedValue(
      new AppError(HTTP.BAD_REQUEST, 'Insufficient funds to complete this transaction.'),
    );

    const response = await request(app)
      .post(`/api/transactions/${accountId}/withdraw`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '10000.00', pin: '1234' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(response.body).toEqual({
      message: 'Insufficient funds to complete this transaction.',
    });
  });
});

describe('POST /api/transactions/:id/transfer', () => {
  it('returns 400 without calling the service for an invalid destination account number', async () => {
    const response = await request(app)
      .post(`/api/transactions/${accountId}/transfer`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '10.00', pin: '1234', destinationAccountNumber: '123' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedTransactionService.transfer).not.toHaveBeenCalled();
  });

  it('transfers and returns 201', async () => {
    mockedTransactionService.transfer.mockResolvedValue({
      debit: { ...transactionRecord, type: 'transfer_debit' },
      credit: { ...transactionRecord, type: 'transfer_credit' },
    });

    const response = await request(app)
      .post(`/api/transactions/${accountId}/transfer`)
      .set('Authorization', 'Bearer valid-token')
      .send({ amount: '10.00', pin: '1234', destinationAccountNumber: '9876543210' });

    expect(response.status).toBe(HTTP.CREATED);
    expect(response.body.message).toBe('Funds transferred successfully');
    expect(mockedTransactionService.transfer).toHaveBeenCalledWith(
      authUser.id,
      accountId,
      '9876543210',
      '10.00',
      '1234',
      undefined,
    );
  });
});

describe('GET /api/transactions/:id', () => {
  it('lists transactions for an owned account', async () => {
    mockedTransactionService.listTransactions.mockResolvedValue([transactionRecord]);

    const response = await request(app)
      .get(`/api/transactions/${accountId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Transactions retrieved successfully');
    expect(mockedTransactionService.listTransactions).toHaveBeenCalledWith(authUser.id, accountId);
  });
});
