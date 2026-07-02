import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `leads` — contact-form submissions. Stored FIRST as the durable system of
 * record, THEN a Telegram notification is fired. `notifiedTelegram` tracks that
 * side-channel so a Telegram outage/misconfig can never lose a lead — `failed`
 * rows are the review/retry queue.
 */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    message: text('message'),
    source: text('source'), // the contact form's `from` field (which form/section)
    notifiedTelegram: text('notified_telegram', { enum: ['pending', 'sent', 'failed'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('leads_created_idx').on(table.createdAt)]
);

/** A full row exactly as Drizzle returns it. */
export type LeadRow = typeof leads.$inferSelect;
/** Insert shape (id + timestamp + status optional). */
export type NewLead = typeof leads.$inferInsert;
