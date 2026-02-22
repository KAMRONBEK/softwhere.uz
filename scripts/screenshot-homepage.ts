/**
 * Captures screenshots of the homepage at different scroll positions.
 * Run: npx tsx scripts/screenshot-homepage.ts [--dark]
 * Requires: dev server running on http://localhost:3000
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const DARK = process.argv.includes('--dark');
const OUT_DIR = path.join(process.cwd(), 'screenshots-homepage', DARK ? 'dark' : 'light');

const SECTIONS = [
  { name: '01-hero', selector: 'main', scrollTo: 'top' },
  { name: '02-estimator-cta', selector: '#estimator-cta', scrollTo: 'selector' },
  { name: '03-services', selector: '#services', scrollTo: 'selector' },
  { name: '04-discuss', selector: 'section:nth-of-type(4)', scrollTo: 'selector' },
  { name: '05-projects', selector: '#portfolio', scrollTo: 'selector' },
  { name: '06-contact', selector: '#contact', scrollTo: 'selector' },
  { name: '07-faq', selector: '#faq', scrollTo: 'selector' },
] as const;

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    colorScheme: DARK ? 'dark' : 'light',
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.error('Failed to load', BASE_URL, '- is the dev server running? (yarn dev)');
    await browser.close();
    process.exit(1);
  }

  if (DARK) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
  }

  // Wait for AOS and dynamic content
  await page.waitForTimeout(1500);

  for (const section of SECTIONS) {
    if (section.scrollTo === 'top') {
      await page.evaluate(() => window.scrollTo(0, 0));
    } else {
      const el = await page.$(section.selector);
      if (el) {
        await el.scrollIntoViewIfNeeded();
      }
    }
    await page.waitForTimeout(400);

    const file = path.join(OUT_DIR, `${section.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log('Saved', file);
  }

  // Full page screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const fullPath = path.join(OUT_DIR, '00-full-page.png');
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log('Saved', fullPath);

  await browser.close();
  console.log('Done. Screenshots in', OUT_DIR);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
