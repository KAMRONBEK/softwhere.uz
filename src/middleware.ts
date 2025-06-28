import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const nextIntlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
});

export default function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

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
    // Match all paths that need locale handling
    '/',
    '/(en|uz|ru)/:path*',

    // Explicitly match llms.txt files at root
    '/llms.txt',
    '/llms-full.txt',

    // Exclude static files and api routes from middleware processing
    '!/(api|_next|.*\\..*)/:path*'
  ],
};
