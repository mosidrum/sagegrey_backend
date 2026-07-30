import { Knex } from 'knex';
import db from '../database/connection';
import { AccountHistory, NewAccountHistory } from '../models/accountHistory.model';

const TABLE = 'account_history';

type Executor = Knex | Knex.Transaction;

export async function create(
  data: NewAccountHistory,
  executor: Executor = db,
): Promise<AccountHistory | undefined> {
  const [record] = await executor<AccountHistory>(TABLE).insert(data).returning('*');
  return record;
}

export function findByAccountId(
  accountId: string,
  executor: Executor = db,
): Promise<AccountHistory[]> {
  return executor<AccountHistory>(TABLE)
    .where({ account_id: accountId })
    .orderBy('created_at', 'desc');
}
