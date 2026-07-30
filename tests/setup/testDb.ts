import db from '../../src/database/connection';

export { db };

export async function resetDb(): Promise<void> {
  await db.raw('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');
}
