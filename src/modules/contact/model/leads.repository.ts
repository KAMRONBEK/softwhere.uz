import { desc, eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { leads, type NewLead } from './Lead';

/** Persist a contact-form lead (the durable system of record). Returns the new id. */
export async function createLead(input: Pick<NewLead, 'name' | 'phone' | 'message' | 'source'>): Promise<string> {
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

/** Persist a lead under a caller-made id; an id that exists is left alone, so a repeated submit is one lead. */
export async function createLeadOnce(
  input: Pick<NewLead, 'name' | 'phone' | 'message' | 'source'> & { id: string }
): Promise<{ isNew: boolean; notified: LeadSummary['notifiedTelegram'] }> {
  const inserted = await db
    .insert(leads)
    .values({ id: input.id, name: input.name, phone: input.phone, message: input.message ?? null, source: input.source ?? null })
    .onConflictDoNothing({ target: leads.id })
    .returning({ id: leads.id });
  if (inserted.length > 0) return { isNew: true, notified: 'pending' };
  const [row] = await db.select({ notified: leads.notifiedTelegram }).from(leads).where(eq(leads.id, input.id));
  return { isNew: false, notified: row?.notified ?? 'pending' };
}

/** Record whether the Telegram notification for a stored lead succeeded. */
export async function markLeadNotified(id: string, ok: boolean): Promise<void> {
  await db
    .update(leads)
    .set({ notifiedTelegram: ok ? 'sent' : 'failed' })
    .where(eq(leads.id, id));
}

export interface LeadSummary {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string | null;
  notifiedTelegram: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

/** List recent leads for the admin viewer, newest first. */
export async function listLeads(limit = 200): Promise<LeadSummary[]> {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    message: r.message,
    source: r.source,
    notifiedTelegram: r.notifiedTelegram,
    createdAt: r.createdAt.toISOString(),
  }));
}
