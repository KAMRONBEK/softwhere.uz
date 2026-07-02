import type { NextRequest } from 'next/server';
import { getAuth } from '@/core/neonAuth';

// Neon Auth mounts its endpoints here (sign-in/out, session, OAuth, etc.).
// The browser client (createAuthClient) targets /api/auth by default.
export const dynamic = 'force-dynamic';

type Handlers = ReturnType<ReturnType<typeof getAuth>['handler']>;
let handlers: Handlers | null = null;
function getHandlers(): Handlers {
  if (!handlers) handlers = getAuth().handler();
  return handlers;
}

// Wrapped (not `export const { GET, POST } = getAuth().handler()`) so a missing
// NEON_AUTH_* env doesn't throw at import time — it 500s per request instead.
export function GET(request: NextRequest, context: unknown) {
  return getHandlers().GET(request, context as never);
}

export function POST(request: NextRequest, context: unknown) {
  return getHandlers().POST(request, context as never);
}
