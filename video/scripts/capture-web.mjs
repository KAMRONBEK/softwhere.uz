#!/usr/bin/env node
// Captures website screenshots with Playwright (system Chrome) from a JSON spec.
// Usage: node scripts/capture-web.mjs specs/<slug>.json
//
// Spec: {
//   "slug": "nestegg",
//   "mobile": false,                       // true = iPhone 13 emulation, saved at mobile width
//   "reducedMotion": false,                // true = prefers-reduced-motion, so looping headline animations settle
//   "viewport": { "width": 1440, "height": 900 },
//   "shots": [{
//     "name": "home", "url": "https://…", "fullPage": true, "maxHeight": 4200, "waitMs": 1500,
//     "actions": [{ "click": "text=Reject all" }, { "hide": ".cookie-banner" }, { "scroll": 900 }, { "wait": 500 },
//                 { "hover": "css=button.primary" }, { "press": "Escape" }]
//   }]
// }
// Never submit forms or log in on production sites — navigation, scrolling and hovering only.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { MAX_WIDTH, parseArgs, printSaved, projectDir, saveWebp } from './lib/images.mjs';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT_MS = 45_000;
const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 120;

/** Scrolls to the bottom and back so lazy images and scroll-triggered animations (AOS etc.) render. */
const primeLazyContent = async page => {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += SCROLL_STEP_PX) {
    await page.evaluate(top => window.scrollTo(0, top), y);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
};

const runAction = async (page, action) => {
  if (action.click)
    return page.click(action.click, { timeout: 5000 }).catch(() => console.warn(`  (click target not found: ${action.click})`));
  if (action.hover)
    return page.hover(action.hover, { timeout: 5000 }).catch(() => console.warn(`  (hover target not found: ${action.hover})`));
  if (action.hide) return page.addStyleTag({ content: `${action.hide} { display: none !important; }` });
  if ('scroll' in action) return page.evaluate(top => window.scrollTo(0, top), action.scroll);
  if (action.press) return page.keyboard.press(action.press);
  if (action.wait) return page.waitForTimeout(action.wait);
  throw new Error(`Unknown action ${JSON.stringify(action)}`);
};

const captureShot = async (page, shot, dir, maxWidth) => {
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }).catch(async () => {
    console.warn(`  (networkidle timed out for ${shot.url}; continuing after load)`);
  });
  await page.waitForTimeout(shot.waitMs ?? 1200);
  for (const action of shot.actions ?? []) await runAction(page, action);
  if (shot.fullPage) await primeLazyContent(page);

  const buffer = await page.screenshot({ fullPage: Boolean(shot.fullPage) });
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  const cropped =
    shot.maxHeight && height > shot.maxHeight
      ? await sharp(buffer).extract({ left: 0, top: 0, width, height: shot.maxHeight }).toBuffer()
      : buffer;
  return saveWebp(cropped, path.join(dir, `web-${shot.name}.webp`), maxWidth);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const specPath = args._[0];
  if (!specPath) throw new Error('Usage: node scripts/capture-web.mjs specs/<slug>.json');
  const spec = JSON.parse(await readFile(specPath, 'utf8'));
  if (!Array.isArray(spec.shots) || spec.shots.length === 0) throw new Error('Spec needs a non-empty "shots" array');

  const dir = await projectDir(spec.slug);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const reducedMotion = spec.reducedMotion ? 'reduce' : 'no-preference';
    const context = spec.mobile
      ? await browser.newContext({ ...devices['iPhone 13'], reducedMotion })
      : await browser.newContext({ viewport: spec.viewport ?? DEFAULT_VIEWPORT, deviceScaleFactor: 1, reducedMotion });
    const page = await context.newPage();
    const saved = [];
    for (const shot of spec.shots) {
      console.log(`→ ${shot.name}: ${shot.url}`);
      saved.push(await captureShot(page, shot, dir, spec.mobile ? MAX_WIDTH.mobile : MAX_WIDTH.web));
    }
    printSaved(saved);
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error(`capture-web failed: ${error.message}`);
  process.exit(1);
});
