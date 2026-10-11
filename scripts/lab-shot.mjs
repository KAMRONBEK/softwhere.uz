#!/usr/bin/env node
/**
 * Screenshots of the hidden homepage prototype (/<locale>/lab/home) for the
 * section agents. Needs a running dev server: `yarn dev -p 3100`.
 *
 *   node scripts/lab-shot.mjs --only xray --viewport mobile
 *   node scripts/lab-shot.mjs --only process --steps 6            # scroll sequence
 *   node scripts/lab-shot.mjs --scroll 0.5 --style B --logo 2
 *   node scripts/lab-shot.mjs --only hero --reduced --q low        # reduced-motion path
 *
 * Options
 *   --url <base>          dev server origin            (default http://localhost:3100)
 *   --locale <uz|ru|en>   route locale                 (default en)
 *   --path <p>            path after the locale        (default /lab/home; '/' = the real
 *                         homepage, which ignores --only/--style/--logo/--lc/--q URL params
 *                         except ?style=, and always renders every section)
 *   --only <sectionId>    render a single section (?only=)
 *   --style <A-D>         style direction (?style=)
 *   --logo <1-2>          logo: 1 Original, 2 Refined (?logo=)
 *   --lc <brand|accent>   logo colour: brand orange (default) or the style accent (?lc=)
 *   --q <auto|high|mid|low>  quality override (default: high on desktop, mid on
 *                         mobile — headless Chrome renders WebGL in software, which
 *                         auto-detection would correctly call 'low')
 *   --viewport <desktop|mobile>  1440x900 @1x, or 390x844 @2x touch   (default desktop)
 *   --dpr <n>             override the device scale factor
 *   --scroll <v>          0..1 = fraction of the scrollable height, >1 = px, or '640px'
 *   --steps <n>           take n shots from --from to --to (fractions, default 0 → 1)
 *   --from <v> --to <v>   range for --steps (same units as --scroll)
 *   --settle <ms>         wait after load/scroll before each shot  (default 1200)
 *   --full                full-page screenshot
 *   --panel               keep the control panel visible (hidden by default)
 *   --reduced             emulate prefers-reduced-motion: reduce
 *   --out <path.png>      output file (sequence: _sNN is appended). Relative paths
 *                         resolve inside the shots dir.  (default: auto-named)
 *
 * Writes PNGs under /tmp/claude-1000/lab-shots/ and prints one JSON line per
 * shot ({ file, url, scrollY, maxScroll }). Page errors are echoed as
 * "[page error]" lines so a broken section is visible in the output.
 *
 * Browser: LAB_SHOT_CHROME=<path> if set, else Playwright's bundled Chromium,
 * else the system Google Chrome (Playwright cannot download its Chromium on
 * every distro).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SHOTS_DIR = '/tmp/claude-1000/lab-shots';
const NETWORK_IDLE_MS = 500;
const NETWORK_IDLE_TIMEOUT_MS = 15000;
const NAV_TIMEOUT_MS = 60000;
const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA },
};

function parseArgs(argv) {
  const flags = new Set(['full', 'panel', 'reduced', 'help']);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (flags.has(key)) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

function fail(message) {
  console.error(`lab-shot: ${message}`);
  process.exit(1);
}

function buildUrl(args, viewportName) {
  const base = (args.url ?? 'http://localhost:3100').replace(/\/$/, '');
  const routePath = args.path === undefined ? '/lab/home' : `/${String(args.path).replace(/^\/+/, '')}`.replace(/\/$/, '');
  const url = new URL(`${base}/${args.locale ?? 'en'}${routePath}`);
  const quality = args.q ?? (viewportName === 'mobile' ? 'mid' : 'high');
  if (args.only) url.searchParams.set('only', args.only);
  if (args.style) url.searchParams.set('style', args.style);
  if (args.logo) url.searchParams.set('logo', args.logo);
  if (args.lc) url.searchParams.set('lc', args.lc);
  url.searchParams.set('q', quality);
  return url.toString();
}

/** '0.5' → fraction, '640' or '640px' → px. */
function parseScroll(value) {
  if (value === undefined) return { kind: 'fraction', value: 0 };
  const text = String(value).trim();
  const number = Number.parseFloat(text);
  if (Number.isNaN(number) || number < 0) fail(`invalid scroll value "${value}"`);
  if (text.endsWith('px') || number > 1) return { kind: 'px', value: number };
  return { kind: 'fraction', value: number };
}

function scrollTargets(args) {
  const steps = args.steps ? Number.parseInt(args.steps, 10) : 1;
  if (!Number.isInteger(steps) || steps < 1) fail(`invalid --steps "${args.steps}"`);
  if (steps === 1) return [parseScroll(args.scroll)];
  const from = parseScroll(args.from ?? '0');
  const to = parseScroll(args.to ?? '1');
  if (from.kind !== to.kind) fail('--from and --to must use the same unit');
  return Array.from({ length: steps }, (_, i) => ({ kind: from.kind, value: from.value + ((to.value - from.value) * i) / (steps - 1) }));
}

function outputPath(args, viewportName, index, total) {
  const suffix = total > 1 ? `_s${String(index + 1).padStart(2, '0')}` : '';
  if (args.out) {
    const resolved = path.isAbsolute(args.out) ? args.out : path.join(SHOTS_DIR, args.out);
    return `${resolved.replace(/\.png$/i, '')}${suffix}.png`;
  }
  const name = [
    args.only ?? 'page',
    viewportName,
    `${args.style ?? 'A'}${args.logo ?? '2'}${args.lc === 'accent' ? 'a' : ''}`,
    args.scroll ? `at${args.scroll}` : '',
  ]
    .filter(Boolean)
    .join('_');
  return path.join(SHOTS_DIR, `${name}${suffix}.png`);
}

async function launchBrowser() {
  const attempts = [...(process.env.LAB_SHOT_CHROME ? [{ executablePath: process.env.LAB_SHOT_CHROME }] : []), {}, { channel: 'chrome' }];
  let lastError;
  for (const options of attempts) {
    try {
      return await chromium.launch({ headless: true, args: WEBGL_ARGS, ...options });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Resolves once no non-media request has been in flight for NETWORK_IDLE_MS (or on timeout). */
function trackNetwork(page) {
  const inFlight = new Set();
  const isTracked = request => !['media', 'websocket', 'eventsource'].includes(request.resourceType());
  page.on('request', request => isTracked(request) && inFlight.add(request));
  page.on('requestfinished', request => inFlight.delete(request));
  page.on('requestfailed', request => inFlight.delete(request));
  return async () => {
    const deadline = Date.now() + NETWORK_IDLE_TIMEOUT_MS;
    let quietSince = Date.now();
    while (Date.now() < deadline) {
      if (inFlight.size > 0) quietSince = Date.now();
      else if (Date.now() - quietSince >= NETWORK_IDLE_MS) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };
}

async function scrollTo(page, target) {
  return page.evaluate(({ kind, value }) => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.round(kind === 'px' ? Math.min(value, maxScroll) : value * maxScroll);
    const lab = window.__LAB__;
    if (lab) lab.scrollTo(y);
    else window.scrollTo(0, y);
    return { scrollY: y, maxScroll };
  }, target);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('See the header of scripts/lab-shot.mjs for options.');
    return;
  }
  const viewportName = args.viewport ?? 'desktop';
  const device = VIEWPORTS[viewportName];
  if (!device) fail(`unknown --viewport "${viewportName}" (desktop|mobile)`);
  const settle = Number.parseInt(args.settle ?? '1200', 10);
  const targets = scrollTargets(args);
  const url = buildUrl(args, viewportName);
  mkdirSync(SHOTS_DIR, { recursive: true });

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      ...device,
      ...(args.dpr ? { deviceScaleFactor: Number.parseFloat(args.dpr) } : {}),
      reducedMotion: args.reduced ? 'reduce' : 'no-preference',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    page.on('pageerror', error => console.error(`[page error] ${error.message}`));
    page.on('console', message => message.type() === 'error' && console.error(`[console error] ${message.text()}`));
    const waitForNetworkIdle = trackNetwork(page);

    const response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (!response || !response.ok()) fail(`GET ${url} → ${response ? response.status() : 'no response'}`);
    await waitForNetworkIdle();
    // Founder tooling and the Next dev indicator are not part of the design.
    const hidden = ['nextjs-portal', ...(args.panel ? [] : ['[data-lab-panel]'])].join(',');
    await page.addStyleTag({ content: `${hidden}{display:none!important}` });

    for (const [index, target] of targets.entries()) {
      const position = await scrollTo(page, target);
      await waitForNetworkIdle();
      await page.waitForTimeout(settle);
      const file = outputPath(args, viewportName, index, targets.length);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: Boolean(args.full) });
      console.log(JSON.stringify({ file, url, ...position }));
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
