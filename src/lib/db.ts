import mongoose, { Mongoose } from 'mongoose';
import { logger } from '@/utils/logger';
import { ENV } from '@/constants';

declare global {
    // allow global `var` declarations
    // eslint-disable-next-line no-var
    var mongoose: {
        conn: Mongoose | null;
        promise: Promise<Mongoose> | null;
    };
}

const MONGODB_URI: string = ENV.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env or .env.local'
    );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<Mongoose> {
    if (cached.conn) {
        logger.debug("Using cached MongoDB connection", undefined, 'DB');
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000, // 45 seconds
            connectTimeoutMS: 10000, // 10 seconds
            maxPoolSize: 10, // Maintain up to 10 socket connections
            minPoolSize: 5, // Maintain a minimum of 5 socket connections
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        };

        logger.info("Creating new MongoDB connection", undefined, 'DB');
        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            logger.info("MongoDB connection established", undefined, 'DB');
            return mongooseInstance;
        });
    }
    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        logger.error("MongoDB connection error", e, 'DB');
        throw e;
    }

    return cached.conn;
}

export default dbConnect; 