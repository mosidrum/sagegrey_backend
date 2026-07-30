export type TransactionType = 'funding' | 'withdrawal' | 'transfer_debit' | 'transfer_credit';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  account_id: string;
  counterparty_account_id: string | null;
  amount_minor: string;
  balance_after_minor: string;
  description: string | null;
  status: TransactionStatus;
  transfer_group_id: string | null;
  created_at: Date;
}

export type NewTransaction = Pick<
  Transaction,
  | 'type'
  | 'account_id'
  | 'counterparty_account_id'
  | 'amount_minor'
  | 'balance_after_minor'
  | 'description'
  | 'status'
  | 'transfer_group_id'
>;
