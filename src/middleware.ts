import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const nextIntlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
});

export default function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Skip middleware for static files, API routes, and special files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    pathname.startsWith('/llms') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Apply internationalization middleware
  return nextIntlMiddleware(req);
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, etc.)
    '/((?!api|_next|.*\\..*|robots\\.txt|sitemap\\.xml|favicon|icons|images|llms).*)',
  ],
};
