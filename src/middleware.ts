import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const nextIntlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
});

export default function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Skip middleware for API routes, static files, and special files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Handle llms.txt and llms-full.txt files
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    const response = NextResponse.next();

    // Add the recommended X-Robots-Tag header for llms.txt files
    response.headers.set('X-Robots-Tag', 'llms-txt');
    response.headers.set('Content-Type', 'text/markdown; charset=UTF-8');

    return response;
  }

  return nextIntlMiddleware(req);
}

export const config = {
  matcher: [
    // Match all paths except API routes, static files, and special files
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Include root path
    '/',
  ],
};
