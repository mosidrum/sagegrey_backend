import 'dotenv/config';
import path from 'path';
import type { Knex } from 'knex';

export const connection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const config: Knex.Config = {
  client: 'pg',
  connection,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
};

export default config;
