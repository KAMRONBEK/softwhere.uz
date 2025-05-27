import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'SoftWhere.uz - Mobile App & Web Development';
    const locale = searchParams.get('locale') || 'en';
    
    const localizedSubtitle = {
      en: 'Mobile Apps • Web Development • Telegram Bots',
      ru: 'Мобильные приложения • Веб-разработка • Telegram боты',
      uz: 'Mobil ilovalar • Veb ishlab chiqish • Telegram botlar'
    };

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1f2937',
            backgroundImage: 'linear-gradient(45deg, #fe4502, #ff5f24)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              textAlign: 'center',
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
                textAlign: 'center',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: '24px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '30px',
                fontWeight: '600',
              }}
            >
              SoftWhere.uz
            </p>
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