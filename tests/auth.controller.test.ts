import request from 'supertest';
import app from '../src/app';
import { AppError } from '../src/common/errors';
import { HTTP } from '../src/common/http';
import * as authService from '../src/services/auth.service';

jest.mock('../src/services/auth.service');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

const safeUser = {
  id: 1,
  email: 'test@example.com',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('POST /api/auth/signup', () => {
  it('returns 201 with the created user and token', async () => {
    mockedAuthService.signup.mockResolvedValue({ user: safeUser, token: 'abc123' });

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'supersecret' });

    expect(response.status).toBe(HTTP.CREATED);
    expect(response.body).toEqual({
      message: 'Signed up successfully',
      data: {
        user: { ...safeUser, created_at: safeUser.created_at.toISOString() },
        token: 'abc123',
      },
    });
    expect(mockedAuthService.signup).toHaveBeenCalledWith('test@example.com', 'supersecret');
  });

  it('returns 400 without calling the service when the password is too short', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'short' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedAuthService.signup).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with a token on success', async () => {
    mockedAuthService.login.mockResolvedValue({ user: safeUser, token: 'xyz789' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'supersecret' });

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.data.token).toBe('xyz789');
  });

  it('propagates a 401 from the service on invalid credentials', async () => {
    mockedAuthService.login.mockRejectedValue(
      new AppError(HTTP.UNAUTHORIZED, 'Invalid email or password'),
    );

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(response.status).toBe(HTTP.UNAUTHORIZED);
    expect(response.body).toEqual({ message: 'Invalid email or password', data: null });
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(HTTP.UNAUTHORIZED);
  });

  it('returns 200 with the current user for a valid token', async () => {
    mockedAuthService.findByToken.mockResolvedValue(safeUser);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.data.email).toBe(safeUser.email);
  });

  it('returns 401 for an unrecognized token', async () => {
    mockedAuthService.findByToken.mockResolvedValue(undefined);

    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer bogus');

    expect(response.status).toBe(HTTP.UNAUTHORIZED);
  });
});

describe('POST /api/auth/logout', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(HTTP.UNAUTHORIZED);
  });

  it('returns 200 and calls the service when authenticated', async () => {
    mockedAuthService.findByToken.mockResolvedValue(safeUser);
    mockedAuthService.logout.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(HTTP.OK);
    expect(mockedAuthService.logout).toHaveBeenCalledWith(safeUser.id);
  });
});
