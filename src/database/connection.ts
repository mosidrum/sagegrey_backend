import knex from 'knex';
import { Client } from 'pg';
import knexConfig, { connection } from './knexfile';

const db = knex(knexConfig);

export async function verifyConnection(): Promise<void> {
  const client = new Client(connection);
  await client.connect();
  await client.end();
}

export default db;
