'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global critical error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className='min-h-screen flex items-center justify-center bg-red-50'>
          <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center border border-red-200'>
            <div className='mb-4'>
              <svg className='mx-auto h-16 w-16 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
            </div>

            <h2 className='text-xl font-semibold text-gray-900 mb-2'>Critical Error</h2>

            <p className='text-gray-600 mb-6'>A critical error occurred. The application needs to be restarted.</p>

            <div className='space-y-3'>
              <button
                onClick={reset}
                className='w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200'
              >
                Restart Application
              </button>

              <button
                onClick={() => window.location.reload()}
                className='w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200'
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className='mt-6 text-left'>
                <summary className='cursor-pointer text-sm text-gray-500 hover:text-gray-700'>Error details (development only)</summary>
                <pre className='mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto'>
                  {error.message}
                  {error.stack && `\n\nStack trace:\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
