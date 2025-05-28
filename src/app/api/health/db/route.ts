import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function GET() {
  const startTime = Date.now();

  try {
    // Add timeout for database health check
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database health check timeout after 10 seconds'));
      }, 10000);
    });

    const healthCheckPromise = async () => {
      await dbConnect();

      // Simple ping to check if database is responsive
      const adminDb = mongoose.connection.db?.admin();
      const result = await adminDb?.ping();

      return result;
    };

    await Promise.race([healthCheckPromise(), timeoutPromise]);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      connectionState: mongoose.connection.readyState,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
