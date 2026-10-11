'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

const ToastContainer = dynamic(() => import('react-toastify').then(m => m.ToastContainer), { ssr: false });

/** The contact form reports through toasts; the homepage mounts them in HomeClientLayer, this page here. */
export default function PageToasts() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    // @ts-expect-error -- CSS import has no type declarations
    import('react-toastify/dist/ReactToastify.css');
  }, []);
  return <ToastContainer autoClose={3000} closeOnClick theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}
