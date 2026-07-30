import db from '../database/connection';
import { IdempotencyKey, NewIdempotencyKey } from '../models/idempotencyKey.model';

const TABLE = 'idempotency_keys';

export async function create(data: NewIdempotencyKey): Promise<IdempotencyKey | undefined> {
  const [record] = await db<IdempotencyKey>(TABLE).insert(data).returning('*');
  return record;
}

export function findByUserIdAndKey(
  userId: string,
  key: string,
): Promise<IdempotencyKey | undefined> {
  return db<IdempotencyKey>(TABLE).where({ user_id: userId, key }).first();
}

export function markCompleted(
  id: string,
  responseStatus: number,
  responseBody: unknown,
): Promise<number> {
  return db<IdempotencyKey>(TABLE).where({ id }).update({
    status: 'completed',
    response_status: responseStatus,
    response_body: responseBody,
    updated_at: db.fn.now(),
  });
}
