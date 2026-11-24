'use client';

import React, { useState } from 'react';
import { authClient } from '@/modules/admin/utils/authClient';

/** Ends the Neon Auth session, then hard-reloads so the server layout gate re-reads cookies and returns to login. */
export function AdminLogout() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await authClient.signOut();
    } catch {
      // Ignore — still force a reload below so the gate re-evaluates.
    }
    // Hard navigation (not router.refresh) so the server re-reads cookies fresh
    // and bypasses any cached RSC payload; the gate then shows the login screen.
    window.location.assign(window.location.pathname);
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className='inline-flex items-center px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-[calc(var(--radius)*0.7)] bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent hover:underline decoration-[color:var(--accent)] underline-offset-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    >
      {loading ? 'Signing out…' : 'Log out'}
    </button>
  );
}
