'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';
import { authClient } from '@/modules/admin/utils/authClient';
import AdminButton from './AdminButton';
import AdminInput from './AdminInput';

/**
 * Neon Auth sign-in for the admin panel: email + password, or Google OAuth.
 * On success the Neon-managed session cookie is set; router.refresh() re-runs
 * the server admin layout gate, which sees the session (role 'admin') and
 * renders the app. Google links to the existing admin user by matching email.
 */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message || 'Invalid email or password');
      } else {
        setPassword('');
        router.refresh();
      }
    } catch (err) {
      // The client throws the server's refusal (4xx, with its message) as well as network failures.
      const status = err instanceof Error && 'status' in err ? Number(err.status) : 0;
      setError(err instanceof Error && status >= 400 && status < 500 ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      // Redirects to Google, then back to callbackURL; the session cookie is set
      // on return and the server layout gate renders the admin app.
      await authClient.signIn.social({ provider: 'google', callbackURL: window.location.pathname });
    } catch {
      setError('Could not start Google sign-in');
      setGoogleLoading(false);
    }
  }

  return (
    <div className='min-h-[70svh] bg-ember-bg flex items-center justify-center px-5 py-12'>
      <div className='bg-ember-surface p-8 rounded-[var(--radius)] border border-ember-border w-full max-w-sm space-y-4'>
        <h2 className='text-[length:calc(1.75rem*var(--display-scale,1))] leading-tight [font-weight:var(--display-weight)] tracking-[var(--display-tracking)] font-display text-ember-text'>
          Admin Access
        </h2>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <AdminInput
            label='Email'
            type='email'
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder='you@softwhere.uz'
          />
          <AdminInput
            label='Password'
            type='password'
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder='Enter password...'
          />
          {error && (
            <p role='alert' className='text-sm text-ember-text border-l-2 border-[color:var(--accent)] pl-3'>
              {error}
            </p>
          )}
          <AdminButton type='submit' variant='primary' className='w-full' disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </AdminButton>
        </form>

        <div className='flex items-center gap-3'>
          <span className='h-px flex-1 bg-ember-border' />
          <span className='text-xs text-ember-muted'>or</span>
          <span className='h-px flex-1 bg-ember-border' />
        </div>

        <button
          type='button'
          onClick={handleGoogle}
          disabled={googleLoading}
          className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium rounded-[calc(var(--radius)*0.7)] bg-ember-surface2 border border-ember-border text-ember-text hover:border-ember-accent transition-colors disabled:opacity-50'
        >
          <FcGoogle className='w-5 h-5' />
          {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
