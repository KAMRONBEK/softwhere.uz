import { BROWSER_BAR_HEIGHT } from '../components/BrowserFrame';
import type { Side } from '../components/Caption';
import { SAFE, STAGE_HEIGHT, VIDEO } from '../theme';

/** Browser window width; captures are taken at 1440×900 so the viewport is 16:10. */
export const BROWSER_WIDTH = 1200;
export const VIEWPORT_ASPECT = 900 / 1440;
export const WEB_CAPTION = { width: 470, gutter: 100 } as const;

const MAX_CONTENT_HEIGHT = STAGE_HEIGHT - BROWSER_BAR_HEIGHT;

export const browserContentHeight = (aspect = VIEWPORT_ASPECT): number => Math.min(MAX_CONTENT_HEIGHT, Math.round(BROWSER_WIDTH * aspect));

export const browserLeft = (captionSide: Side): number =>
  captionSide === 'left' ? VIDEO.width - WEB_CAPTION.gutter - BROWSER_WIDTH : WEB_CAPTION.gutter;

export const browserTop = (contentHeight: number): number => SAFE.top + (STAGE_HEIGHT - contentHeight - BROWSER_BAR_HEIGHT) / 2;
