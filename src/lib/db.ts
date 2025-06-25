import { ENV } from '@/constants';
import { logger } from '@/core/logger';
import _mongoose, { Mongoose } from 'mongoose';

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var _mongoose: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  };
}

const MONGODB_URI: string = ENV.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env or .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<Mongoose> {
  if (cached.conn) {
    logger.debug('Using cached MongoDB connection', undefined, 'DB');

    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Reduced to 5 seconds for Vercel
      socketTimeoutMS: 20000, // Reduced to 20 seconds for Vercel
      connectTimeoutMS: 5000, // Reduced to 5 seconds for Vercel
      maxPoolSize: 5, // Reduced pool size for serverless
      minPoolSize: 1, // Reduced minimum pool size
      maxIdleTimeMS: 10000, // Reduced idle time for serverless
      heartbeatFrequencyMS: 10000, // Add heartbeat for connection health
      retryWrites: true,
      retryReads: true,
    };

    logger.info('Creating new MongoDB connection', undefined, 'DB');

    // Add timeout wrapper for the entire connection process
    const connectionTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('MongoDB connection timeout after 8 seconds'));
      }, 8000);
    });

    cached.promise = Promise.race([
      _mongoose.connect(MONGODB_URI, opts).then(mongooseInstance => {
        logger.info('MongoDB connection established', undefined, 'DB');

        return mongooseInstance;
      }),
      connectionTimeout,
    ]);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    logger.error('MongoDB connection error', e, 'DB');
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
