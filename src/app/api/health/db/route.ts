import { NextResponse } from 'next/server';
import { pingDb } from '@/modules/blog/model/posts.repository';

export async function GET() {
  const startTime = Date.now();

  try {
    await pingDb();

    return NextResponse.json({
      status: 'healthy',
      duration: `${Date.now() - startTime}ms`,
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}
