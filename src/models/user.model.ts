export interface User {
  id: number;
  email: string;
  password_hash: string;
  token: string | null;
  created_at: Date;
}

export type SafeUser = Pick<User, 'id' | 'email' | 'created_at'>;

export type NewUser = Pick<User, 'email' | 'password_hash' | 'token'>;
