import request from 'supertest';
import app from '../src/app';
import { HTTP } from '../src/common/http';

describe('GET /', () => {
  it('returns 200 OK with a JSON Hello World response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(HTTP.OK);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ message: 'Hello World' });
  });
});

describe('GET /unknown-route', () => {
  it('returns a 404 with a consistent error response shape', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(HTTP.NOT_FOUND);
    expect(response.body).toEqual({
      message: 'Route not found: GET /unknown-route',
    });
  });
});

describe('security middleware', () => {
  it('sets helmet security headers and hides X-Powered-By', async () => {
    const response = await request(app).get('/');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('reflects the request origin when CORS_ORIGIN is not set', async () => {
    const response = await request(app).get('/').set('Origin', 'http://example.com');

    expect(response.headers['access-control-allow-origin']).toBe('http://example.com');
  });
});
