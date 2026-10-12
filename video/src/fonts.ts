import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';

/**
 * Same families as the website: Sora (display), Manrope (body), JetBrains Mono (labels). Sora has no
 * Cyrillic, so Russian display text falls back to Inter, as on the site ((site)/layout.tsx).
 */
const inter = loadInter('normal', { weights: ['600', '700'], subsets: ['latin', 'cyrillic'] }).fontFamily;

export const FONTS = {
  display: `${loadSora('normal', { weights: ['600', '700'], subsets: ['latin'] }).fontFamily}, ${inter}`,
  body: loadManrope('normal', { weights: ['400', '500', '700'], subsets: ['latin', 'cyrillic'] }).fontFamily,
  mono: loadMono('normal', { weights: ['500'], subsets: ['latin', 'cyrillic'] }).fontFamily,
} as const;
