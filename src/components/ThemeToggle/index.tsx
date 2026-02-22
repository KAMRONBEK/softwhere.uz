'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { LuMoon, LuSun } from 'react-icons/lu';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return <div style={{ width: 36, height: 36 }} />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--glass-shadow), var(--glass-highlight)',
        color: 'var(--gray-700)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {isDark ? <LuSun size={18} /> : <LuMoon size={18} />}
    </button>
  );
}
