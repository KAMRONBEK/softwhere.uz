import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config for `yarn db:push` / `db:generate` against Neon.
// Reads DATABASE_URL from the environment (loaded from .env via dotenv above).
export default defineConfig({
  schema: ['./src/modules/blog/model/BlogPost.ts', './src/modules/contact/model/Lead.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
