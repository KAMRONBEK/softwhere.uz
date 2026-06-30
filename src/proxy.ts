import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
});

export default function proxy(req: NextRequest): NextResponse {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;
  const isWww = host.startsWith('www.');
  const isRoot = pathname === '/';

  // Collapse www-stripping and root->/uz into a SINGLE 308 so that
  // www.softwhere.uz/ doesn't redirect twice (www->apex, then /->/uz).
  if (isWww || isRoot) {
    const newUrl = new URL(req.url);
    if (isWww) newUrl.host = host.replace(/^www\./, '');
    if (isRoot) newUrl.pathname = '/uz';
    return NextResponse.redirect(newUrl, 308);
  }

  const isLocalePath = /^\/(en|ru|uz)(\/|$)/.test(pathname);
  if (!isLocalePath) {
    return NextResponse.next();
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|robots\\.txt|sitemap\\.xml|favicon|icons|images|.*\\..*).*)'],
};
