'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const ToastContainer = dynamic(() => import('react-toastify').then(m => m.ToastContainer), { ssr: false });

/** The contact form reports through toasts, painted with the look's tokens (globals.css). */
export default function PageToasts() {
  useEffect(() => {
    // @ts-expect-error -- CSS import has no type declarations
    import('react-toastify/dist/ReactToastify.css');
  }, []);
  return <ToastContainer autoClose={3000} closeOnClick />;
}
