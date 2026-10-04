import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';

/** Same families as the website: Sora (display), Manrope (body), JetBrains Mono (labels). */
export const FONTS = {
  display: loadSora('normal', { weights: ['600', '700'], subsets: ['latin'] }).fontFamily,
  body: loadManrope('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily,
  mono: loadMono('normal', { weights: ['500'], subsets: ['latin'] }).fontFamily,
} as const;
