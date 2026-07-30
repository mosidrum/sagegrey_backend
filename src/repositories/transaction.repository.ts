import { Knex } from 'knex';
import db from '../database/connection';
import { NewTransaction, Transaction } from '../models/transaction.model';

const TABLE = 'transactions';

type Executor = Knex | Knex.Transaction;

export async function create(
  data: NewTransaction,
  executor: Executor = db,
): Promise<Transaction | undefined> {
  const [transaction] = await executor<Transaction>(TABLE).insert(data).returning('*');
  return transaction;
}

export function getById(id: string, executor: Executor = db): Promise<Transaction | undefined> {
  return executor<Transaction>(TABLE).where({ id }).first();
}

export function findByAccountId(
  accountId: string,
  executor: Executor = db,
): Promise<Transaction[]> {
  return executor<Transaction>(TABLE)
    .where({ account_id: accountId })
    .orderBy('created_at', 'desc');
}

export function findByTransferGroupId(
  transferGroupId: string,
  executor: Executor = db,
): Promise<Transaction[]> {
  return executor<Transaction>(TABLE).where({ transfer_group_id: transferGroupId });
}
