export type IdempotencyStatus = 'processing' | 'completed';

export interface IdempotencyKey {
  id: string;
  user_id: string;
  key: string;
  request_hash: string;
  status: IdempotencyStatus;
  response_status: number | null;
  response_body: unknown;
  created_at: Date;
  updated_at: Date;
}

export type NewIdempotencyKey = Pick<IdempotencyKey, 'user_id' | 'key' | 'request_hash' | 'status'>;
