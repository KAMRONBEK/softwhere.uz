import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';

export async function GET() {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 10000);
    });

    await Promise.race([dbConnect(), timeoutPromise]);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      duration: `${duration}ms`,
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}
