import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
});

export default function middleware(req: NextRequest): NextResponse {
  const host = req.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const newUrl = new URL(req.url);
    newUrl.host = host.replace(/^www\./, '');
    return NextResponse.redirect(newUrl, 301);
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: ['/', '/(en|uz|ru)/:path*'],
};
