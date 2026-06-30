import Link from 'next/link';

// The root layout is a passthrough with no <html>/<body>, so this global
// not-found page must provide its own minimal document.
export default function NotFound() {
  return (
    <html lang='en'>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#0b0b0c',
          color: '#f5f5f5',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <main>
          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem', fontWeight: 700 }}>404</h1>
          <p style={{ fontSize: '1.125rem', margin: '0 0 1.5rem', opacity: 0.8 }}>Page not found</p>
          <Link
            href='/'
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              background: '#fe4502',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Go to homepage
          </Link>
        </main>
      </body>
    </html>
  );
}
