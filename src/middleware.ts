import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
});

export default function middleware(req: NextRequest): NextResponse {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;

  if (host.startsWith('www.')) {
    const newUrl = new URL(req.url);
    newUrl.host = host.replace(/^www\./, '');
    return NextResponse.redirect(newUrl, 308);
  }

  if (pathname === '/') {
    const newUrl = req.nextUrl.clone();
    newUrl.pathname = '/uz';
    return NextResponse.redirect(newUrl, 308);
  }

  const isLocalePath = /^\/(en|ru|uz)(\/|$)/.test(pathname);
  if (!isLocalePath) {
    return NextResponse.next();
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!_next).*)'],
};
