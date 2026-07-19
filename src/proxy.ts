import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'uz'],
  defaultLocale: 'uz',
  // Blog slugs differ per locale, so the middleware's same-path hreflang Link
  // header advertised wrong alternates (and a 404ing unprefixed x-default),
  // contradicting the correct per-page HTML hreflang from generateMetadata.
  alternateLinks: false,
});

export default function proxy(req: NextRequest): NextResponse {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;
  const isWww = host.startsWith('www.');
  const isLocalePath = /^\/(en|ru|uz)(\/|$)/.test(pathname);

  // Collapse www-stripping and default-locale prefixing into a SINGLE 308.
  // Locale-less paths (/, /blog/<slug>, /privacy-policy, ...) 308 to /uz/...
  // instead of falling through to the app router's 404. (On Vercel the www
  // strip usually happens in the platform's domain redirect before middleware
  // runs; this branch still covers local/dev and non-Vercel hosting.)
  if (isWww || !isLocalePath) {
    const newUrl = new URL(req.url);
    if (isWww) newUrl.host = host.replace(/^www\./, '');
    if (!isLocalePath) newUrl.pathname = pathname === '/' ? '/uz' : `/uz${pathname}`;
    return NextResponse.redirect(newUrl, 308);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|robots\\.txt|sitemap\\.xml|favicon|icons|images|.*\\..*).*)'],
};
