import { AccountHistory, AccountHistoryType } from '../models/accountHistory.model';
import * as accountHistoryRepository from '../repositories/accountHistory.repository';
import * as accountService from './account.service';

export interface AccountHistoryRecord {
  id: string;
  accountId: string;
  userId: string;
  type: AccountHistoryType;
  createdAt: Date;
  updatedAt: Date;
}

function toAccountHistoryRecord(row: AccountHistory): AccountHistoryRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getHistoryForAccount(
  userId: string,
  accountId: string,
): Promise<AccountHistoryRecord[]> {
  const account = await accountService.getOwnedAccount(userId, accountId);
  const rows = await accountHistoryRepository.findByAccountId(account.id);
  return rows.map(toAccountHistoryRecord);
}
