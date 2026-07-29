import request from 'supertest';
import app from '../src/app';

describe('GET /', () => {
  it('returns 200 OK with Hello World', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });
});

describe('GET /unknown-route', () => {
  it('returns a 404 with a consistent error response shape', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'Route not found: GET /unknown-route',
      data: null,
    });
  });
});
