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

export function getById(id: string): Promise<User | undefined> {
  return db<User>(TABLE).where({ id }).first();
}

export function findByEmail(email: string): Promise<User | undefined> {
  return db<User>(TABLE).where({ email }).first();
}

export function update(id: string, data: Partial<Pick<User, 'pin_hash'>>): Promise<number> {
  return db<User>(TABLE).where({ id }).update(data);
}

export function remove(id: string): Promise<number> {
  return db<User>(TABLE).where({ id }).del();
}

export async function save(id: string, data: Partial<User>): Promise<User | undefined> {
  await db<User>(TABLE).where({ id }).update(data);
  return getById(id);
}
