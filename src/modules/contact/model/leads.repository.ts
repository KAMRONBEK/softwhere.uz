import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { leads, type NewLead } from './Lead';

/** Persist a contact-form lead (the durable system of record). Returns the new id. */
export async function createLead(
  input: Pick<NewLead, 'name' | 'phone' | 'message' | 'source'>
): Promise<string> {
  const [row] = await db
    .insert(leads)
    .values({
      name: input.name,
      phone: input.phone,
      message: input.message ?? null,
      source: input.source ?? null,
    })
    .returning({ id: leads.id });
  return row.id;
}

/** Record whether the Telegram notification for a stored lead succeeded. */
export async function markLeadNotified(id: string, ok: boolean): Promise<void> {
  await db
    .update(leads)
    .set({ notifiedTelegram: ok ? 'sent' : 'failed' })
    .where(eq(leads.id, id));
}
