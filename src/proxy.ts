import { NextRequest, NextResponse } from 'next/server';

// Redirect-only middleware. next-intl's middleware is intentionally NOT used:
// every page under [locale] calls setRequestLocale (locale comes from the URL
// segment), locale detection is unwanted (unprefixed paths always 308 to the
// uz default, never cookie/Accept-Language), and hreflang Link headers were
// already disabled (blog slugs differ per locale, so same-path alternates were
// wrong — per-page HTML hreflang from generateMetadata is authoritative).
//
// The matcher below EXCLUDES locale-prefixed paths, so middleware never runs
// for real page traffic — on Vercel middleware executes on Fluid compute for
// every request (even CDN cache hits), which made it a per-request Active CPU
// tax. This function only ever sees paths that need a redirect.
export default function proxy(req: NextRequest): NextResponse {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;

  // Collapse www-stripping and default-locale prefixing into a SINGLE 308.
  // Locale-less paths (/, /blog/<slug>, /privacy-policy, ...) 308 to /uz/...
  // instead of falling through to the app router's 404. Dotted scanner junk
  // (/wp-login.php, /.env) lands here too and ends at the prerendered 404 —
  // previously each probe paid a full [locale]-page render on Fluid CPU.
  // (On Vercel the www strip usually happens in the platform's domain redirect
  // before middleware runs — and for locale-prefixed www URLs, which skip the
  // matcher, the platform redirect is the ONLY strip; that covers Vercel, and
  // local/dev is unprefixed-first anyway.)
  const newUrl = new URL(req.url);
  if (host.startsWith('www.')) newUrl.host = host.replace(/^www\./, '');
  if (!/^\/(en|ru|uz)(\/|$)/.test(pathname)) newUrl.pathname = pathname === '/' ? '/uz' : `/uz${pathname}`;
  return NextResponse.redirect(newUrl, 308);
}

export const config = {
  // Middleware runs ONLY for paths that need a redirect: everything except
  // locale-prefixed pages (/en|/ru|/uz — served straight from the CDN/router)
  // and real static content. No blanket `.*\..*` exclusion: dotted scanner
  // probes must flow through the redirect instead of 404-rendering the
  // [locale] page (~320 invocations/12h observed). The flip side: every REAL
  // dotted root file must be excluded explicitly here, or the 308-to-/uz
  // rewrite breaks it — keep this list in sync with public/ root files (plus
  // the robots/sitemap route handlers).
  matcher: [
    '/((?!(?:en|ru|uz)(?:/|$)|api|_next|_vercel|robots\\.txt|sitemap\\.xml|favicon|icons|images|\\.well-known|46b87b7e04b9d4a6adb8fc722995bde5\\.txt|yandex_f08533a1b0b3541d\\.html).*)',
  ],
};
