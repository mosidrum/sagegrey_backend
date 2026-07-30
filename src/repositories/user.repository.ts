import db from '../database/connection';
import { NewUser, User } from '../models/user.model';

const TABLE = 'users';

export async function create(data: NewUser): Promise<User | undefined> {
  const [user] = await db<User>(TABLE).insert(data).returning('*');
  return user;
}

export function get(): Promise<User[]> {
  return db<User>(TABLE).select('*');
}

export function getById(id: number): Promise<User | undefined> {
  return db<User>(TABLE).where({ id }).first();
}

export function findByEmail(email: string): Promise<User | undefined> {
  return db<User>(TABLE).where({ email }).first();
}

export function findByToken(token: string): Promise<User | undefined> {
  return db<User>(TABLE).where({ token }).first();
}

export function update(
  id: number,
  data: Partial<Pick<User, 'token' | 'pin_hash'>>,
): Promise<number> {
  return db<User>(TABLE).where({ id }).update(data);
}

export function remove(id: number): Promise<number> {
  return db<User>(TABLE).where({ id }).del();
}

export async function save(id: number, data: Partial<User>): Promise<User | undefined> {
  await db<User>(TABLE).where({ id }).update(data);
  return getById(id);
}
