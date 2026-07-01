import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { ENV } from '@/core/constants';
import { logger } from '@/core/logger';
import * as schema from '@/modules/blog/model/BlogPost';

/**
 * Neon (serverless Postgres) via Drizzle's HTTP driver. The HTTP driver is
 * stateless — every query is a fetch — so there is no connection pool to tune
 * and nothing to keep warm across serverless invocations. That replaces the
 * whole hand-tuned Mongoose pool/timeout/`Promise.race` dance we used before.
 *
 * The client is created lazily on first use so that importing this module stays
 * side-effect-free: `next build` can collect page data without `DATABASE_URL`
 * set, and any route that actually queries gets a clear error at call time.
 */
let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached) return cached;

  const url = ENV.DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — provision a Neon database and set it in the environment.');
  }

  logger.info('Initializing Neon/Drizzle client', undefined, 'DB');
  cached = drizzle({ client: neon(url), schema });
  return cached;
}

/**
 * A proxy that defers client creation until the first query. Repository code can
 * `import { db }` and use it like a normal Drizzle instance without triggering
 * `neon()` at module-eval time.
 */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export default db;
