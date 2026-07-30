import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('account_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('RESTRICT');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table
      .enu('type', ['debit', 'credit'], { useNative: false, enumName: 'account_history_type' })
      .notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('account_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('account_history');
}
