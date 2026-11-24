import { ImageResponse } from 'next/og';

import { verifyOgSignature } from '@/core/og';
import { BRAND_ORANGE } from '@/modules/home/logos/brand';
import { MARKS } from '@/modules/home/logos/marks';
import { WORDMARK } from '@/modules/home/logos/wordmark';
import { LAB_STYLES } from '@/modules/home/theme/styles';

export const runtime = 'edge';

/** The card wears the site's default look (A · Observatory). */
const { bg, bg2, fg, muted, accent } = LAB_STYLES.A.colors;
const DISPLAY = 'Science Gothic';
const BODY = 'Onest';
/** Any glyph the two lack (Satori falls through the loaded fonts per glyph). */
const FALLBACK = 'Noto Sans';

/** Title size by length: Science Gothic runs wide, and Russian titles run long. */
function titleSize(title: string): number {
  if (title.length > 90) return 42;
  if (title.length > 60) return 50;
  return title.length > 32 ? 60 : 72;
}

function BrandMark({ size, opacity = 1 }: { size: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 64 64' style={{ opacity }}>
      <path d={MARKS.refined.d} fill={BRAND_ORANGE} />
    </svg>
  );
}

/** The header's lockup (logos/index.tsx), outlined, so it needs no font. */
function Lockup() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <BrandMark size={58} />
      <svg width={203} height={44} viewBox='0 -38 250 54' style={{ marginLeft: 12 }}>
        {WORDMARK.letters.map(d => (
          <path key={d} d={d} fill={fg} />
        ))}
      </svg>
    </div>
  );
}

/**
 * Load a subset of a Google font containing exactly the glyphs we render, via the
 * Google Fonts CSS API. Without an explicit font, ImageResponse embeds a
 * Latin-only default and Cyrillic (RU) titles render as tofu boxes — and the
 * broken image would be cached immutable for a year. The legacy User-Agent
 * makes the API return TTF (Satori can't read woff2). Best-effort: on any
 * failure we fall back to the default font rather than erroring the image.
 */
async function loadFontSubset(family: string, weight: 400 | 500, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.30 (KHTML, like Gecko)' },
    }).then(res => (res.ok ? res.text() : ''));
    const fontUrl = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/)?.[1];
    if (!fontUrl) return null;
    const font = await fetch(fontUrl);
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawTitle = url.searchParams.get('title');
    const title = rawTitle || 'SoftWhere.uz - Mobile App & Web Development';
    const localeParam = url.searchParams.get('locale');
    const locale = localeParam && ['en', 'ru', 'uz'].includes(localeParam) ? localeParam : 'en';
    const rawImageParam = url.searchParams.get('image');

    // Every UNIQUE URL is a fresh ~2.6s satori render, so free-form params are
    // an unbounded CPU surface. Only URLs signed by our metadata builders (see
    // core/og.ts) get a custom render; anything else 308s to the locale's
    // default brand image — one cacheable URL instead of infinitely many.
    // Bare/locale-only requests need no signature (3 bounded URLs).
    if (rawTitle !== null || rawImageParam !== null) {
      const valid = await verifyOgSignature(
        { title: rawTitle ?? '', locale: localeParam ?? '', image: rawImageParam ?? undefined },
        url.searchParams.get('sig')
      );
      if (!valid) {
        return new Response(null, {
          status: 308,
          headers: {
            Location: `${url.origin}/api/og?locale=${locale}`,
            'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
          },
        });
      }
    }

    // Only allow background images from hosts we control / trust. The param is
    // fetched server-side by Satori, so an arbitrary URL would turn this into an
    // open proxy / SSRF vector. Anything else falls back to the gradient.
    const ALLOWED_IMAGE_HOSTS = ['images.unsplash.com'];
    const rawImage = rawImageParam;
    let imageUrl: string | null = null;
    if (rawImage) {
      try {
        const parsed = new URL(rawImage);
        if (parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.includes(parsed.hostname)) {
          imageUrl = parsed.toString();
        }
      } catch {
        imageUrl = null;
      }
    }

    const localizedSubtitle = {
      en: 'Mobile Apps • Web Development • Telegram Bots',
      ru: 'Мобильные приложения • Веб-разработка • Telegram боты',
      uz: 'Mobil ilovalar • Veb ishlab chiqish • Telegram botlar',
    };

    // Subset covers every string the image renders.
    const subtitle = localizedSubtitle[locale as keyof typeof localizedSubtitle];
    const renderedText = `${title} SoftWhere.uz ${subtitle}`;
    const [display, body, fallback] = await Promise.all([
      loadFontSubset(DISPLAY, 500, renderedText),
      loadFontSubset(BODY, 400, renderedText),
      loadFontSubset(FALLBACK, 400, renderedText),
    ]);
    const fonts = [
      ...(display ? [{ name: DISPLAY, data: display, weight: 500 as const, style: 'normal' as const }] : []),
      ...(body ? [{ name: BODY, data: body, weight: 400 as const, style: 'normal' as const }] : []),
      ...(fallback ? [{ name: FALLBACK, data: fallback, weight: 400 as const, style: 'normal' as const }] : []),
    ];

    const ground = imageUrl
      ? `linear-gradient(90deg, ${bg} 0%, ${bg}f2 42%, ${bg}8c 72%, ${bg}40 100%), linear-gradient(0deg, ${bg}cc 0%, ${bg}00 55%)`
      : `radial-gradient(circle at 84% 46%, ${accent}40 0%, ${bg}00 46%), linear-gradient(120deg, ${bg} 55%, ${bg2} 100%)`;

    return new ImageResponse(
      (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: bg,
            color: fg,
            fontFamily: `${BODY}, ${FALLBACK}`,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={imageUrl} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }} />
          ) : null}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', backgroundImage: ground }} />
          {imageUrl ? null : (
            <div style={{ position: 'absolute', top: 85, left: 800, display: 'flex' }}>
              <BrandMark size={460} opacity={0.28} />
            </div>
          )}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: '60px 72px 58px',
            }}
          >
            <Lockup />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'block',
                  maxWidth: 900,
                  fontFamily: `${DISPLAY}, ${FALLBACK}`,
                  fontSize: titleSize(title),
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.12,
                  lineClamp: 4,
                }}
              >
                {title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 34, fontSize: 25, color: muted }}>
                <div style={{ width: 44, height: 4, marginRight: 20, backgroundColor: accent }} />
                {imageUrl ? 'SoftWhere.uz' : subtitle}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        ...(fonts.length > 0 && { fonts }),
        headers: {
          // Cache aggressively only when the proper font loaded — a tofu
          // fallback render must not be pinned in caches for a year.
          'Cache-Control': fonts.length > 0 ? 'public, immutable, no-transform, max-age=31536000' : 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);

    return new Response('Failed to generate image', { status: 500 });
  }
}
