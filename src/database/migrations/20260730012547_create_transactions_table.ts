import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').primary();
    table
      .enu('type', ['funding', 'withdrawal', 'transfer_debit', 'transfer_credit'], {
        useNative: false,
        enumName: 'transaction_type',
      })
      .notNullable();
    table
      .integer('account_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('RESTRICT');
    table
      .integer('counterparty_account_id')
      .unsigned()
      .references('id')
      .inTable('accounts')
      .onDelete('RESTRICT');
    table.bigInteger('amount_minor').notNullable();
    table.bigInteger('balance_after_minor').notNullable();
    table.string('description');
    table
      .enu('status', ['pending', 'completed', 'failed'], {
        useNative: false,
        enumName: 'transaction_status',
      })
      .notNullable()
      .defaultTo('completed');
    table.uuid('transfer_group_id');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('account_id');
    table.index('transfer_group_id');
    table.check('amount_minor > 0', [], 'transactions_amount_minor_positive');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
}
