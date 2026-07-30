import { RequestHandler, Response } from 'express';
import { asyncHandler } from '../common/asyncHandler';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import * as idempotencyService from '../services/idempotency.service';

const MAX_KEY_LENGTH = 255;

export const idempotency: RequestHandler = asyncHandler(async (req, res, next) => {
  const header = req.headers['idempotency-key'];
  if (!header) {
    next();
    return;
  }

  const rawKey = Array.isArray(header) ? header[0] : header;
  const key = rawKey?.trim();
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new AppError(HTTP.BAD_REQUEST, 'A valid Idempotency-Key header is required.');
  }

  const reservation = await idempotencyService.reserve(
    req.user!.id,
    key,
    req.method,
    req.originalUrl,
    req.body,
  );

  if (reservation.outcome === 'replay') {
    res.status(reservation.statusCode).json(reservation.body);
    return;
  }

  const { recordId } = reservation;
  const originalJson = res.json.bind(res);

  // Persist the response before it reaches the client, not after (e.g. via a
  // `res.on('finish')` hook) — otherwise a fast retry could race the write and
  // see the reservation as still "processing" instead of the completed reply.
  res.json = ((body?: unknown) => {
    idempotencyService
      .complete(recordId, res.statusCode, body)
      .catch((error: Error) =>
        logger.ERROR(`Failed to persist idempotency record: ${error.message}`, { recordId }),
      )
      .finally(() => originalJson(body));
    return res;
  }) as Response['json'];

  next();
});
