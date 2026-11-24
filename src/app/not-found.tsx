import { LAB_FONTS, FALLBACK_FACES_CSS } from '@/modules/home/theme/fonts';
import { LAB_STYLES } from '@/modules/home/theme/styles';
import ThemeScript, { ThemeGroundScript } from '@/modules/home/theme/ThemeScript';
import { STYLE_IDS, type StyleId } from '@/modules/home/types';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';

const LOCALES = [
  ['en', en.notFound],
  ['ru', ru.notFound],
  ['uz', uz.notFound],
] as const;

function styleRule(id: StyleId): string {
  const { colors, fonts, radius, scheme, type } = LAB_STYLES[id];
  const body = LAB_FONTS[fonts.body].family;
  // On <html> too: the canvas, scrollbar and overscroll areas.
  return `[data-style='${id}'],html:has([data-style='${id}']){color-scheme:${scheme};--bg:${colors.bg};--fg:${colors.fg};--muted:${colors.muted};--accent:${colors.accent};--on-accent:${colors.onAccent};--radius:${radius};--body:${body},system-ui,sans-serif;--display:${type.displayWeight} calc(clamp(2.1rem,5.2vw,4.5rem)*${type.displayScale})/1.02 ${LAB_FONTS[fonts.display].family},${body},system-ui,sans-serif;--tracking:${type.displayTracking}}`;
}

const CSS = `${FALLBACK_FACES_CSS}${STYLE_IDS.map(styleRule).join('')}
body{margin:0;transition:none}
[data-lab-root]{display:flex;min-height:100svh;box-sizing:border-box;flex-direction:column;justify-content:center;padding:48px clamp(20px,5.5vw,96px);background:var(--bg);color:var(--fg);font-family:var(--body)}
main{width:100%;max-width:1320px;margin:0 auto}
main>div{display:none}
${LOCALES.map(([locale]) => `html:lang(${locale}) main>:lang(${locale})`).join(',')}{display:block}
b{display:flex;align-items:center;gap:10px;font:500 14px/1.3 var(--body)}
b::before{content:'';width:7px;height:7px;border-radius:min(var(--radius),50%);background:var(--accent)}
h1{margin:16px 0 0;max-width:20ch;font:var(--display);letter-spacing:var(--tracking);text-wrap:balance}
p{margin:24px 0 32px;max-width:58ch;color:var(--muted);font-size:1.125rem;line-height:1.55}
nav{display:flex;flex-wrap:wrap;gap:12px}
a{display:inline-flex;align-items:center;min-height:52px;padding:0 26px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--fg) 28%,transparent);border-radius:var(--radius);color:var(--fg);font:500 1rem/1.2 var(--body);text-decoration:none}
a:first-child{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
a:first-child:hover{background:color-mix(in srgb,var(--accent) 84%,var(--fg))}
a:last-child:hover{border-color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}`;

const LANG_SCRIPT = `(function(){var m=/^\\/(uz|ru|en)(\\/|$)/.exec(location.pathname);if(m)document.documentElement.lang=m[1]})()`;

// Paths no route matches. One prerendered page for every language and look: a
// catch-all page under [locale] would be rendered per probed URL (src/proxy.ts
// sends scanner junk here on purpose), so the language comes from the path and
// the look from storage, both before paint. No site chrome: this tree rides in
// every page's payload. notFound() inside a site page gets
// [locale]/(site)/not-found.tsx instead. The root layout is a passthrough, so
// the document is this page's own.
export default function NotFound() {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <ThemeGroundScript />
      </head>
      <body>
        <meta name='theme-color' content={LAB_STYLES.A.colors.bg} />
        <title>404 — SoftWhere</title>
        <style>{CSS}</style>
        <div data-lab-root='' data-style='A' suppressHydrationWarning>
          <ThemeScript />
          <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
          <main>
            {LOCALES.map(([locale, t]) => (
              <div key={locale} lang={locale}>
                <b>404</b>
                <h1>{t.title}</h1>
                <p>{t.body}</p>
                <nav>
                  {/* Plain links: this document is outside the app's. */}
                  <a href={`/${locale}`}>{t.home}</a>
                  <a href={`/${locale}/services`}>{t.services}</a>
                </nav>
              </div>
            ))}
          </main>
        </div>
      </body>
    </html>
  );
}
