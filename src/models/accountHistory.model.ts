export type AccountHistoryType = 'debit' | 'credit';

export interface AccountHistory {
  id: string;
  account_id: string;
  user_id: string;
  type: AccountHistoryType;
  created_at: Date;
  updated_at: Date;
}

export type NewAccountHistory = Pick<AccountHistory, 'account_id' | 'user_id' | 'type'>;
