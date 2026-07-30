export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  full_name: string;
  pin_hash: string | null;
}

export type SafeUser = Pick<User, 'id' | 'email' | 'full_name' | 'created_at'>;

export type AuthUser = Pick<User, 'id' | 'email' | 'full_name'>;

export type NewUser = Pick<User, 'email' | 'password_hash' | 'full_name' | 'pin_hash'>;
