import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * Load a subset of Noto Sans containing exactly the glyphs we render, via the
 * Google Fonts CSS API. Without an explicit font, ImageResponse embeds a
 * Latin-only default and Cyrillic (RU) titles render as tofu boxes — and the
 * broken image would be cached immutable for a year. The legacy User-Agent
 * makes the API return TTF (Satori can't read woff2). Best-effort: on any
 * failure we fall back to the default font rather than erroring the image.
 */
async function loadFontSubset(text: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans:wght@${weight}&text=${encodeURIComponent(text)}`;
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
    const title = url.searchParams.get('title') || 'SoftWhere.uz - Mobile App & Web Development';
    const localeParam = url.searchParams.get('locale');
    const locale = localeParam && ['en', 'ru', 'uz'].includes(localeParam) ? localeParam : 'en';

    // Only allow background images from hosts we control / trust. The param is
    // fetched server-side by Satori, so an arbitrary URL would turn this into an
    // open proxy / SSRF vector. Anything else falls back to the gradient.
    const ALLOWED_IMAGE_HOSTS = ['images.unsplash.com'];
    const rawImage = url.searchParams.get('image');
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

    // Subset covers every string the image renders (title + subtitle + brand).
    const renderedText = `${title} SoftWhere.uz ${localizedSubtitle[locale as keyof typeof localizedSubtitle]}`;
    const [fontRegular, fontBold] = await Promise.all([loadFontSubset(renderedText, 400), loadFontSubset(renderedText, 700)]);
    const fonts = [
      ...(fontRegular ? [{ name: 'Noto Sans', data: fontRegular, weight: 400 as const, style: 'normal' as const }] : []),
      ...(fontBold ? [{ name: 'Noto Sans', data: fontBold, weight: 700 as const, style: 'normal' as const }] : []),
    ];

    const backgroundStyle: React.CSSProperties = imageUrl
      ? {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1f2937',
          backgroundImage: 'linear-gradient(45deg, #fe4502, #ff5f24)',
        };

    return new ImageResponse(
      (
        <div style={backgroundStyle}>
          {imageUrl && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.1) 100%)',
                display: 'flex',
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: imageUrl ? 'flex-start' : 'center',
              justifyContent: 'center',
              padding: imageUrl ? '40px 60px' : '40px',
              textAlign: imageUrl ? 'left' : 'center',
              position: 'relative',
              width: '100%',
            }}
          >
            <h1
              style={{
                fontSize: title.length > 50 ? '36px' : '48px',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '20px',
                maxWidth: '900px',
                lineHeight: 1.2,
                textShadow: imageUrl ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: '24px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: imageUrl ? '10px' : '30px',
                fontWeight: '600',
              }}
            >
              SoftWhere.uz
            </p>
            {!imageUrl && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '18px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: '500',
                }}
              >
                {localizedSubtitle[locale as keyof typeof localizedSubtitle]}
              </div>
            )}
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
