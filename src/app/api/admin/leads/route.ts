import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/core/auth';
import { listLeads } from '@/modules/contact/model/leads.repository';
import { logger } from '@/core/logger';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const leads = await listLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    logger.error('Failed to fetch leads', error, 'API');
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
