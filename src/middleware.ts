import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const nextIntlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
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
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|txt|xml|json)$/)
  ) {
    return NextResponse.next();
  }

  // Handle llms.txt files directly without locale processing
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return NextResponse.rewrite(new URL(pathname, req.url));
  }

  // Handle robots.txt and sitemap.xml
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next();
  }

  return nextIntlMiddleware(req);
}

export const config = {
  matcher: [
    // Match all routes except excluded ones
    '/((?!api|_next|.*\\..*|llms.*\\.txt|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)',
    // Include home page
    '/',
  ],
};
