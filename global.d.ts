import uz from './src/messages/uz.json';
import type { HomeMessages } from './src/messages/home/schema';

declare module 'next-intl' {
  interface AppConfig {
    // `home` is merged in by src/core/i18n.ts from src/messages/home/<part>/<locale>.json.
    Messages: typeof uz & { home: HomeMessages };
    Locale: 'en' | 'uz' | 'ru';
  }
}
