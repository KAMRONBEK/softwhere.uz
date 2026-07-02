import { JetBrains_Mono } from 'next/font/google';

/**
 * Code font, deliberately NOT in the root layout: only blog posts (code
 * blocks) and the admin area use `font-mono`, so marketing pages shouldn't
 * pay its ~30KB preload. Apply `jetbrainsMono.variable` on the outermost
 * element of the routes that need it; Tailwind's mono stack falls back to
 * ui-monospace wherever the variable is absent.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
});
