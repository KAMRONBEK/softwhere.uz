import uz from './src/messages/uz.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof uz;
    Locale: 'en' | 'uz' | 'ru';
  }
}
