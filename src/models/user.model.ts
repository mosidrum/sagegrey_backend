export interface User {
  id: number;
  email: string;
  password_hash: string;
  token: string | null;
  created_at: Date;
  full_name: string;
  pin_hash: string | null;
}

export type SafeUser = Pick<User, 'id' | 'email' | 'full_name' | 'created_at'>;

export type NewUser = Pick<User, 'email' | 'password_hash' | 'token' | 'full_name'>;
