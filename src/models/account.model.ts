export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  balance_minor: string;
  is_locked: boolean;
  created_at: Date;
}

export type NewAccount = Pick<Account, 'user_id' | 'account_number'>;
