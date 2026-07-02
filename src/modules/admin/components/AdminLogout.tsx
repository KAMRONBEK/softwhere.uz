'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/modules/admin/utils/authClient';

/** Ends the Neon Auth session, then refreshes so the layout gate returns to login. */
export function AdminLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await authClient.signOut();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className='inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-ember-surface border border-ember-border text-ember-muted hover:text-ember-text hover:border-ember-accent transition-colors disabled:opacity-50'
    >
      {loading ? 'Signing out…' : 'Log out'}
    </button>
  );
}
