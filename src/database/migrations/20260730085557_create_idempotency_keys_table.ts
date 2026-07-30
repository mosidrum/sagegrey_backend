import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('key', 255).notNullable();
    table.string('request_hash', 64).notNullable();
    table
      .enu('status', ['processing', 'completed'], {
        useNative: false,
        enumName: 'idempotency_status',
      })
      .notNullable()
      .defaultTo('processing');
    table.integer('response_status');
    table.jsonb('response_body');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['user_id', 'key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('idempotency_keys');
}
