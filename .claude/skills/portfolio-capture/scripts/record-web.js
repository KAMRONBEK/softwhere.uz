#!/usr/bin/env node
// Record a scripted walkthrough of a website as a video, plus named screenshots.
//
// Usage: node record-web.js <scenario.json> [--out <dir>]
//
// The scenario lists the steps (see assets/web-scenario.example.json). The script
// moves a visible cursor smoothly before every click, scrolls smoothly, and writes
//   <out>/clip.webm       the recording (Playwright, VP8)
//   <out>/timeline.json   when each step started, in seconds from the start of the clip
//   <out>/<name>.png      every { "screenshot": "<name>" } step
// Then run build.py with that clip to frame it, caption it and add a voice.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_PATH) return require(process.env.PLAYWRIGHT_PATH);
  try {
    return require('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return require(path.join(root, 'playwright'));
  }
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, isMobile: false },
  mobile: { width: 390, height: 844, isMobile: true },
};

// A visible cursor, because Playwright recordings don't show the real one.
const CURSOR = `
(() => {
  if (window.__cursor) return;
  const add = () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'background:rgba(254,69,2,.35);border:2px solid #FE4502;z-index:2147483647;pointer-events:none;' +
      'transition:transform .12s ease;transform:translate(-100px,-100px)';
    document.documentElement.appendChild(c);
    window.__cursor = c;
    let x = -100, y = -100;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(.7)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }, true);
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();`;

(async () => {
  const scenario = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = path.resolve(arg('out', scenario.out || 'rec'));
  fs.mkdirSync(out, { recursive: true });
  const vp = typeof scenario.viewport === 'object' ? scenario.viewport : VIEWPORTS[scenario.viewport || 'desktop'];
  const { chromium } = loadPlaywright();
  let browser;
  if (process.env.CHROMIUM) browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
  else {
    try {
      browser = await chromium.launch();
    } catch (e) {
      // A project's own playwright can expect a browser build that isn't downloaded.
      if (!fs.existsSync('/opt/pw-browsers/chromium')) throw e;
      browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    }
  }
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    colorScheme: scenario.colorScheme || 'light',
    recordVideo: { dir: out, size: { width: vp.width, height: vp.height } },
  });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => +((Date.now() - t0) / 1000).toFixed(2);
  const timeline = [];
  const base = scenario.url ? new URL(scenario.url) : null;
  let mouse = { x: vp.width / 2, y: vp.height / 2 };

  async function moveTo(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('element not visible');
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y, { steps: 25 });
    mouse = { x, y };
    await page.waitForTimeout(250);
  }

  for (const step of scenario.steps) {
    const at = now();
    const [kind] = Object.keys(step).filter(k => !['label', 'pause'].includes(k));
    const v = step[kind];
    if (kind === 'goto') {
      await page.goto(base ? new URL(v, base).href : v, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await page.mouse.move(mouse.x, mouse.y);
    } else if (kind === 'click') {
      const loc = page.locator(v).first();
      await moveTo(loc);
      await page.mouse.down();
      await page.mouse.up();
    } else if (kind === 'hover') {
      await moveTo(page.locator(v).first());
    } else if (kind === 'type') {
      const [selector, text] = v;
      const loc = page.locator(selector).first();
      await moveTo(loc);
      await loc.click();
      await loc.pressSequentially(text, { delay: 70 });
    } else if (kind === 'press') {
      await page.keyboard.press(v);
    } else if (kind === 'scroll') {
      // Smooth scroll by v pixels (negative scrolls up), in small steps.
      const steps = Math.max(10, Math.round(Math.abs(v) / 40));
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, v / steps);
        await page.waitForTimeout(16);
      }
    } else if (kind === 'scrollTo') {
      await page
        .locator(v)
        .first()
        .evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.waitForTimeout(900);
    } else if (kind === 'wait') {
      await page.waitForTimeout(v);
    } else if (kind === 'waitFor') {
      await page.locator(v).first().waitFor({ timeout: 30000 });
    } else if (kind === 'screenshot') {
      await page.screenshot({ path: path.join(out, `${v}.png`) });
    } else {
      throw new Error(`Unknown step: ${JSON.stringify(step)}`);
    }
    timeline.push({ at, step: kind, value: v, label: step.label || null });
    console.log(`${String(at).padStart(6)}s  ${kind} ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    await page.waitForTimeout(step.pause ?? scenario.pause ?? 600);
  }

  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video.path();
  fs.renameSync(src, path.join(out, 'clip.webm'));
  fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ duration: now(), viewport: vp, steps: timeline }, null, 2));
  console.log(`\nSaved ${path.join(out, 'clip.webm')} (${now()}s) and timeline.json`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
