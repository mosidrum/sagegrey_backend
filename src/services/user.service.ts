import bcrypt from 'bcryptjs';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import * as userRepository from '../repositories/user.repository';

const SALT_ROUNDS = 10;

export async function setPin(userId: string, pin: string, currentPin?: string): Promise<void> {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new AppError(HTTP.NOT_FOUND, 'User not found.');
  }

  if (user.pin_hash) {
    if (!currentPin) {
      throw new AppError(
        HTTP.BAD_REQUEST,
        'Your current transaction PIN is required to change it.',
      );
    }

    const currentPinMatches = await bcrypt.compare(currentPin, user.pin_hash);
    if (!currentPinMatches) {
      logger.WARN('Failed transaction PIN change: current PIN incorrect', { userId });
      throw new AppError(HTTP.UNAUTHORIZED, 'Your current transaction PIN is incorrect.');
    }
  }

  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
  await userRepository.update(userId, { pin_hash: pinHash });

  logger.INFO('Transaction PIN set', { userId });
}

export async function verifyPin(userId: string, pin: string): Promise<void> {
  const user = await userRepository.getById(userId);
  if (!user?.pin_hash) {
    throw new AppError(
      HTTP.BAD_REQUEST,
      'Please set your transaction PIN before performing this action.',
    );
  }

  const pinMatches = await bcrypt.compare(pin, user.pin_hash);
  if (!pinMatches) {
    logger.WARN('Failed transaction PIN verification', { userId });
    throw new AppError(HTTP.UNAUTHORIZED, 'Incorrect transaction PIN.');
  }
}
