import request from 'supertest';
import app from '../src/app';
import { db, resetDb } from './setup/testDb';

async function signupAndCreateAccount(
  email: string,
): Promise<{ token: string; accountId: string }> {
  const signupResponse = await request(app)
    .post('/api/auth/signup')
    .send({ fullName: 'Test User', email, password: 'password123' });

  const token = signupResponse.body.data.token as string;

  const accountResponse = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`);

  const accountId = accountResponse.body.data.id as string;

  return { token, accountId };
}

async function getBalance(token: string, accountId: string): Promise<string> {
  const response = await request(app)
    .get(`/api/accounts/${accountId}/balance`)
    .set('Authorization', `Bearer ${token}`);

  return response.body.data.balance as string;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.destroy();
});

describe('Idempotency-Key on POST /api/transactions/:id/fund', () => {
  it('replays the stored response for a repeated request with the same key', async () => {
    const { token, accountId } = await signupAndCreateAccount('owner@example.com');

    const first = await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'fund-key-1')
      .send({ amount: '50.00' });

    const second = await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'fund-key-1')
      .send({ amount: '50.00' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await getBalance(token, accountId)).toBe('50.00');
  });

  it('executes the request again each time when no idempotency key is sent', async () => {
    const { token, accountId } = await signupAndCreateAccount('owner@example.com');

    await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '50.00' });

    await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '50.00' });

    expect(await getBalance(token, accountId)).toBe('100.00');
  });

  it('rejects a reused idempotency key sent with a different request body', async () => {
    const { token, accountId } = await signupAndCreateAccount('owner@example.com');

    await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'reused-key')
      .send({ amount: '50.00' });

    const response = await request(app)
      .post(`/api/transactions/${accountId}/fund`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'reused-key')
      .send({ amount: '75.00' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: 'This idempotency key was already used with a different request.',
    });
    expect(await getBalance(token, accountId)).toBe('50.00');
  });

  it('scopes idempotency keys per user, so two users may reuse the same key value', async () => {
    const owner = await signupAndCreateAccount('owner@example.com');
    const other = await signupAndCreateAccount('other@example.com');

    await request(app)
      .post(`/api/transactions/${owner.accountId}/fund`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', 'shared-key')
      .send({ amount: '50.00' });

    const response = await request(app)
      .post(`/api/transactions/${other.accountId}/fund`)
      .set('Authorization', `Bearer ${other.token}`)
      .set('Idempotency-Key', 'shared-key')
      .send({ amount: '50.00' });

    expect(response.status).toBe(201);
    expect(await getBalance(other.token, other.accountId)).toBe('50.00');
  });

  it('only allows one of two concurrent requests with the same key to actually fund the account', async () => {
    const { token, accountId } = await signupAndCreateAccount('owner@example.com');

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/transactions/${accountId}/fund`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'concurrent-key')
        .send({ amount: '50.00' }),
      request(app)
        .post(`/api/transactions/${accountId}/fund`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'concurrent-key')
        .send({ amount: '50.00' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    expect(await getBalance(token, accountId)).toBe('50.00');
  });
});
