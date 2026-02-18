import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const title = url.searchParams.get('title') || 'SoftWhere.uz - Mobile App & Web Development';
    const localeParam = url.searchParams.get('locale');
    const locale = localeParam && ['en', 'ru', 'uz'].includes(localeParam) ? localeParam : 'en';
    const imageUrl = url.searchParams.get('image');

    const localizedSubtitle = {
      en: 'Mobile Apps • Web Development • Telegram Bots',
      ru: 'Мобильные приложения • Веб-разработка • Telegram боты',
      uz: 'Mobil ilovalar • Veb ishlab chiqish • Telegram botlar',
    };

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
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);

    return new Response('Failed to generate image', { status: 500 });
  }
}
