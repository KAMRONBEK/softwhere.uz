'use client';

import React, { useEffect, useState } from 'react';
import { getAdminSecret, setAdminSecret } from '@/modules/admin/utils/adminFetch';
import AdminButton from './AdminButton';
import AdminInput from './AdminInput';

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = getAdminSecret();
    if (stored) {
      verifySecret(stored);
    } else {
      setChecking(false);
    }
  }, []);

  async function verifySecret(value: string) {
    try {
      const res = await fetch('/api/admin/posts', {
        headers: { Authorization: `Bearer ${value}` },
      });
      if (res.ok) {
        setAdminSecret(value);
        setAuthenticated(true);
      } else {
        setError('Invalid secret');
      }
    } catch {
      setError('Connection error');
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setChecking(true);
    await verifySecret(secret);
  }

  if (checking) {
    return (
      <div className='min-h-screen bg-ember-bg flex items-center justify-center'>
        <p className='text-ember-muted'>Verifying access...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className='min-h-screen bg-ember-bg flex items-center justify-center'>
        <form
          onSubmit={handleSubmit}
          className='bg-ember-surface p-8 rounded-xl shadow-sm border border-ember-border w-full max-w-sm space-y-4'
        >
          <h2 className='text-xl font-bold font-display text-ember-text'>Admin Access</h2>
          <AdminInput
            label='API Secret'
            type='password'
            value={secret}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecret(e.target.value)}
            placeholder='Enter API secret...'
          />
          {error && <p className='text-sm text-red-400'>{error}</p>}
          <AdminButton type='submit' variant='primary' className='w-full'>
            Sign In
          </AdminButton>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
