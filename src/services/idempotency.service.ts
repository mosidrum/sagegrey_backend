import crypto from 'crypto';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import * as idempotencyKeyRepository from '../repositories/idempotencyKey.repository';

const UNIQUE_VIOLATION = '23505';

export type IdempotencyReservation =
  | { outcome: 'proceed'; recordId: string }
  | { outcome: 'replay'; statusCode: number; body: unknown };

function hashRequest(method: string, path: string, body: unknown): string {
  const payload = JSON.stringify({ method, path, body });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export async function reserve(
  userId: string,
  key: string,
  method: string,
  path: string,
  body: unknown,
): Promise<IdempotencyReservation> {
  const requestHash = hashRequest(method, path, body);

  try {
    const record = await idempotencyKeyRepository.create({
      user_id: userId,
      key,
      request_hash: requestHash,
      status: 'processing',
    });

    if (!record) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to reserve the idempotency key.');
    }

    logger.DEBUG('Idempotency key reserved', { userId, key });
    return { outcome: 'proceed', recordId: record.id };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await idempotencyKeyRepository.findByUserIdAndKey(userId, key);
    if (!existing) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to reserve the idempotency key.');
    }

    if (existing.request_hash !== requestHash) {
      logger.WARN('Idempotency key reused with a different request', { userId, key });
      throw new AppError(
        HTTP.CONFLICT,
        'This idempotency key was already used with a different request.',
      );
    }

    if (existing.status === 'processing') {
      logger.WARN('Idempotency key request already in progress', { userId, key });
      throw new AppError(
        HTTP.CONFLICT,
        'A request with this idempotency key is already being processed.',
      );
    }

    logger.INFO('Idempotency key replayed a stored response', { userId, key });
    return {
      outcome: 'replay',
      statusCode: existing.response_status ?? HTTP.OK,
      body: existing.response_body,
    };
  }
}

export async function complete(recordId: string, statusCode: number, body: unknown): Promise<void> {
  await idempotencyKeyRepository.markCompleted(recordId, statusCode, body);
}
