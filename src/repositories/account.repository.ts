import { Knex } from 'knex';
import db from '../database/connection';
import { Account, NewAccount } from '../models/account.model';

const TABLE = 'accounts';

type Executor = Knex | Knex.Transaction;

export async function create(
  data: NewAccount,
  executor: Executor = db,
): Promise<Account | undefined> {
  const [account] = await executor<Account>(TABLE).insert(data).returning('*');
  return account;
}

export function getById(id: string, executor: Executor = db): Promise<Account | undefined> {
  return executor<Account>(TABLE).where({ id }).first();
}

export function getByIdForUpdate(id: string, trx: Knex.Transaction): Promise<Account | undefined> {
  return trx<Account>(TABLE).where({ id }).forUpdate().first();
}

export function getManyByIdsForUpdate(ids: string[], trx: Knex.Transaction): Promise<Account[]> {
  return trx<Account>(TABLE).whereIn('id', ids).orderBy('id', 'asc').forUpdate();
}

export function findByAccountNumber(
  accountNumber: string,
  executor: Executor = db,
): Promise<Account | undefined> {
  return executor<Account>(TABLE).where({ account_number: accountNumber }).first();
}

export function findByUserId(userId: string, executor: Executor = db): Promise<Account[]> {
  return executor<Account>(TABLE).where({ user_id: userId }).select('*');
}

export function updateBalance(
  id: string,
  balanceMinor: string,
  executor: Executor = db,
): Promise<number> {
  return executor<Account>(TABLE).where({ id }).update({ balance_minor: balanceMinor });
}

export function setLock(id: string, isLocked: boolean, executor: Executor = db): Promise<number> {
  return executor<Account>(TABLE).where({ id }).update({ is_locked: isLocked });
}
