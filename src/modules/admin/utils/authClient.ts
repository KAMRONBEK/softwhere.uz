'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Browser-side Neon Auth client. Defaults to the /api/auth catch-all route.
export const authClient = createAuthClient();
