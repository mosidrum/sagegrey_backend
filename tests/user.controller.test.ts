import request from 'supertest';
import app from '../src/app';
import { AppError } from '../src/common/errors';
import { HTTP } from '../src/common/http';
import * as authService from '../src/services/auth.service';
import * as userService from '../src/services/user.service';

jest.mock('../src/services/auth.service');
jest.mock('../src/services/user.service');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedUserService = userService as jest.Mocked<typeof userService>;

const authUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'test@example.com',
  full_name: 'Test User',
};

describe('PUT /api/users/pin', () => {
  it('requires authentication', async () => {
    const response = await request(app).put('/api/users/pin').send({ pin: '1234' });
    expect(response.status).toBe(HTTP.UNAUTHORIZED);
    expect(mockedUserService.setPin).not.toHaveBeenCalled();
  });

  it('returns 400 without calling the service when the PIN is not 4 digits', async () => {
    mockedAuthService.verifyToken.mockReturnValue(authUser);

    const response = await request(app)
      .put('/api/users/pin')
      .set('Authorization', 'Bearer valid-token')
      .send({ pin: '12' });

    expect(response.status).toBe(HTTP.BAD_REQUEST);
    expect(mockedUserService.setPin).not.toHaveBeenCalled();
  });

  it('sets the PIN and returns 200 on success', async () => {
    mockedAuthService.verifyToken.mockReturnValue(authUser);
    mockedUserService.setPin.mockResolvedValue(undefined);

    const response = await request(app)
      .put('/api/users/pin')
      .set('Authorization', 'Bearer valid-token')
      .send({ pin: '5678', currentPin: '1234' });

    expect(response.status).toBe(HTTP.OK);
    expect(response.body.message).toBe('Transaction PIN set successfully');
    expect(mockedUserService.setPin).toHaveBeenCalledWith(authUser.id, '5678', '1234');
  });

  it('propagates a 401 from the service when the current PIN is incorrect', async () => {
    mockedAuthService.verifyToken.mockReturnValue(authUser);
    mockedUserService.setPin.mockRejectedValue(
      new AppError(HTTP.UNAUTHORIZED, 'Your current transaction PIN is incorrect.'),
    );

    const response = await request(app)
      .put('/api/users/pin')
      .set('Authorization', 'Bearer valid-token')
      .send({ pin: '5678', currentPin: '0000' });

    expect(response.status).toBe(HTTP.UNAUTHORIZED);
    expect(response.body).toEqual({
      message: 'Your current transaction PIN is incorrect.',
    });
  });
});
