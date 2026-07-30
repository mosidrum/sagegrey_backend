export interface Account {
  id: number;
  user_id: number;
  account_number: string;
  balance_minor: string;
  is_locked: boolean;
  created_at: Date;
}

export type NewAccount = Pick<Account, 'user_id' | 'account_number'>;
