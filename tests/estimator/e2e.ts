/**
 * Estimator end-to-end user stories — a real browser, the real wizard.
 *
 *   yarn dev                      # in another terminal
 *   yarn test:estimator:e2e       # headless
 *   yarn test:estimator:e2e --headed --slow
 *
 * Flags: --headed · --slow · --live-ai (hit the real paid /api/estimate)
 *        --live-lead (really POST a lead — writes to the DB and pings Telegram)
 *        --only=result-ai,lead-submit (run only the matching story ids)
 *        --base=http://localhost:3000
 *
 * By default `/api/estimate` and `/api/estimate/lead` are intercepted, so the
 * suite is fast, deterministic, and never writes a test lead into the owner's
 * inbox. One story (`api-parity`) always calls the real estimate endpoint once
 * to prove the server quotes what the browser shows.
 *
 * Screenshots for every story land in test-results/screenshots/.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Suite, RESULTS_DIR } from './harness';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string, fallback: string) => argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const BASE = value('base', process.env.ESTIMATOR_BASE_URL ?? 'http://localhost:3000');
const HEADED = flag('headed');
const SLOW = flag('slow') ? 400 : 0;
const LIVE_AI = flag('live-ai');
const LIVE_LEAD = flag('live-lead');
/** `--only=lead-submit,result-ai` — run just the matching story ids. */
const ONLY = (value('only', '') || '')
  .split(',')
  .map(part => part.trim())
  .filter(Boolean);
const SHOTS = path.join(RESULTS_DIR, 'screenshots');

const DESKTOP = { width: 1440, height: 950 };
const MOBILE = { width: 390, height: 844 };

const STORAGE_KEY = 'estimator-state-v2';

const CANNED_AI = {
  cost: { min: 4200, max: 7000 },
  weeks: { min: 8, max: 12 },
  summary: 'Canned refinement used by the E2E suite so the AI block renders deterministically.',
  risks: ['Payment provider onboarding can add two weeks.'],
  suggestions: ['Ship iOS first, add Android after launch.'],
  confidence: 'medium',
  provider: 'test',
};

const s = new Suite('estimator-e2e');
const shots: string[] = [];

/* ------------------------------------------------------------------ */
/* Page object                                                        */
/* ------------------------------------------------------------------ */

type EstimatorState = {
  projectType: string;
  subtype: string;
  platforms: string[];
  approach: string;
  tier: string;
  screens: number;
  features: string[];
  integrations: string[];
  techStack: string[];
  autoTech: boolean;
  design: string;
  languages: number;
  urgency: string;
  description?: string;
};

/** "$4,000 – $6,500" → [4000, 6500]; also handles "50 600 000 UZS". */
function parseRange(text: string): [number, number] {
  const numbers = text
    .replace(/ /g, ' ')
    .split(/[–—-]/)
    .map(part => Number(part.replace(/[^\d]/g, '')))
    .filter(n => Number.isFinite(n) && n > 0);
  return [numbers[0] ?? NaN, numbers[numbers.length - 1] ?? NaN];
}

class Estimator {
  constructor(readonly page: Page) {}

  step() {
    return this.page.getByTestId('step-body');
  }

  /** A control inside the current step, matched on its visible text. */
  control(text: string | RegExp) {
    return this.step().getByRole('button').filter({ hasText: text }).first();
  }

  async open(locale = 'en'): Promise<void> {
    await this.page.goto(`${BASE}/${locale}/estimator`, { waitUntil: 'domcontentloaded' });
    await this.page.getByTestId('step-body').waitFor({ state: 'visible', timeout: 20_000 });
    await this.settle();
  }

  async settle(): Promise<void> {
    await this.page.waitForTimeout(SLOW || 140);
  }

  /** Poll until a condition holds — for waiting on hydration after a reload. */
  async until(label: string, condition: () => Promise<boolean>, timeout = 8000): Promise<boolean> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await condition().catch(() => false)) return true;
      await this.page.waitForTimeout(120);
    }
    void label;
    return false;
  }

  async click(text: string | RegExp): Promise<void> {
    await this.control(text).click();
    await this.settle();
  }

  /** Jump to a step via the desktop rail, or walk there with Next on mobile. */
  async goStep(name: string): Promise<void> {
    const rail = this.page.getByTestId('step-rail');
    if (await rail.isVisible()) {
      await rail.getByRole('button').filter({ hasText: name }).first().click();
    } else {
      for (let i = 0; i < 8; i++) {
        if (await this.step().getByText(name, { exact: false }).first().isVisible()) break;
        await this.next();
      }
    }
    await this.settle();
  }

  async next(): Promise<void> {
    await this.page
      .getByRole('button', { name: /Next|See estimate/ })
      .filter({ visible: true })
      .first()
      .click();
    await this.settle();
  }

  async back(): Promise<void> {
    await this.page
      .getByRole('button', { name: /^←?\s*Back$/ })
      .filter({ visible: true })
      .first()
      .click();
    await this.settle();
  }

  async state(): Promise<EstimatorState> {
    // The wizard persists from an effect, so on a cold route compile the first
    // read can land before React has committed.
    for (let attempt = 0; attempt < 20; attempt++) {
      const raw = await this.page.evaluate(key => sessionStorage.getItem(key), STORAGE_KEY);
      const input = raw ? (JSON.parse(raw).input as EstimatorState | undefined) : undefined;
      if (input?.projectType) return input;
      await this.page.waitForTimeout(150);
    }
    throw new Error('the wizard never persisted its state to sessionStorage');
  }

  /** The live range — sidebar on desktop, sticky bar on mobile. */
  async liveRange(): Promise<[number, number]> {
    const node = this.page.getByTestId('live-range').filter({ visible: true }).first();
    return parseRange(await node.innerText());
  }

  async resultRange(): Promise<[number, number]> {
    return parseRange(await this.page.getByTestId('result-range').innerText());
  }

  async chip(label: string | RegExp) {
    return this.step().getByRole('button').filter({ hasText: label }).first();
  }

  /** The "+$140"-style hint baked into a chip's own text. */
  async chipHint(label: string | RegExp): Promise<number> {
    const text = await (await this.chip(label)).innerText();
    const match = text.replace(/ /g, ' ').match(/\+\s*([^\n]+)$/);
    return Number((match?.[1] ?? '').replace(/[^\d]/g, ''));
  }

  async shot(name: string): Promise<void> {
    const file = path.join(SHOTS, `${name}.png`);
    await this.page.screenshot({ path: file, fullPage: false });
    shots.push(path.relative(process.cwd(), file));
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

type ContextOptions = { ai?: unknown; leadStatus?: number; realEstimateApi?: boolean; expectServerError?: boolean };

async function newContext(browser: Browser, viewport = DESKTOP, options: ContextOptions = {}): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport, locale: 'en-US' });
  // Fresh wizard every time — but only on the tab's FIRST load, or the
  // persistence stories would be clearing the state they came to check.
  await context.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__e2e_started')) {
        sessionStorage.clear();
        localStorage.removeItem('estimator-currency');
        sessionStorage.setItem('__e2e_started', '1');
      }
    } catch {
      /* storage blocked */
    }
  });

  if (!LIVE_AI && !options.realEstimateApi) {
    await context.route('**/api/estimate', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      const ai = 'ai' in options ? options.ai : CANNED_AI;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { formula: null, ai } }),
      });
    });
  }
  if (!LIVE_LEAD) {
    await context.route('**/api/estimate/lead', async route => {
      const status = options.leadStatus ?? 200;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200 ? { success: true, data: { id: 'test' } } : { success: false, error: 'Test failure' }),
      });
    });
  }
  return context;
}

type StoryBody = (page: Page, est: Estimator) => Promise<void>;

async function story(
  browser: Browser,
  id: string,
  title: string,
  body: StoryBody,
  options: ContextOptions = {},
  viewport = DESKTOP
): Promise<void> {
  // `--only=` keeps the live-path runs cheap: hitting the real (paid) estimate
  // endpoint from all 33 stories would also trip its own 10/60s rate limit.
  if (ONLY.length && !ONLY.some(pattern => id.includes(pattern))) return;
  s.group(`${id} — ${title}`);
  const context = await newContext(browser, viewport, options);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const est = new Estimator(page);
  try {
    await body(page, est);
    await est.shot(id);
    // A story that renders a React error is not a passing story.
    const real = errors.filter(
      e => !/favicon|net::ERR_|Failed to load resource/i.test(e) && !(options.expectServerError && /HTTP 500|- 500/.test(e))
    );
    s.ok('no console or page errors', real.length === 0, real.slice(0, 3).join('\n'));
  } catch (error) {
    s.ok(`story completes`, false, error instanceof Error ? error.message : String(error));
    await est.shot(`${id}-FAILED`).catch(() => undefined);
  } finally {
    await context.close();
  }
}

/* ------------------------------------------------------------------ */
/* Stories                                                            */
/* ------------------------------------------------------------------ */

async function main(): Promise<number> {
  fs.mkdirSync(SHOTS, { recursive: true });

  const reachable = await fetch(`${BASE}/en/estimator`)
    .then(r => r.ok)
    .catch(() => false);
  if (!reachable) {
    s.group('preflight');
    s.ok(`dev server reachable at ${BASE}`, false, 'start it with `yarn dev` (or pass --base=…)');
    return s.report();
  }

  const browser = await chromium.launch({ headless: !HEADED, slowMo: SLOW });

  /* ---- smoke ---------------------------------------------------- */

  for (const locale of ['en', 'ru', 'uz']) {
    await story(browser, `smoke-${locale}`, `/${locale}/estimator loads and quotes a price`, async (page, est) => {
      await est.open(locale);
      s.ok('page has a heading', (await page.getByRole('heading', { level: 1 }).count()) === 1);
      const [min, max] = await est.liveRange();
      s.ok(`live estimate is a real range (${min}–${max})`, min > 0 && max > min, `${min}–${max}`);
      const body = await page.getByTestId('step-body').innerText();
      s.ok(
        'no untranslated message keys leak into the UI',
        !/estimator\.[a-zA-Z]/.test(body),
        body.match(/estimator\.[a-zA-Z.]+/)?.[0] ?? ''
      );
      const state = await est.state();
      s.eq('defaults to a mobile e-commerce app', [state.projectType, state.subtype], ['mobile', 'ecommerce']);
    });
  }

  /* ---- the reported bug ----------------------------------------- */

  await story(browser, 'regression-subtype-roundtrip', 'browsing subtypes and coming back keeps the price', async (page, est) => {
    await est.open();
    const before = await est.liveRange();
    const featuresBefore = (await est.state()).features.length;
    await est.shot('regression-subtype-roundtrip-before');

    for (const subtype of ['Fintech', 'Education', 'Social', 'Delivery', 'E-commerce']) {
      await est.click(subtype);
    }

    const after = await est.liveRange();
    const state = await est.state();
    s.eq('back on E-commerce', state.subtype, 'ecommerce');
    s.eq('feature count is unchanged', state.features.length, featuresBefore);
    s.eq('price is unchanged', after, before);
  });

  await story(browser, 'regression-type-detour', 'a detour through another service keeps the configuration', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    await est.click('Standard');
    await est.goStep('Integrations');
    await est.click('Payme');
    await est.goStep('Technology');
    await est.click('Node.js'); // offered for both services, unlike Flutter
    await est.click('Flutter'); // mobile-only: must be dropped, not carried to a website
    await est.goStep('Project');
    const before = await est.state();
    const priceBefore = await est.liveRange();

    await est.click('Website');
    const onWeb = await est.state();
    s.ok('a mobile-only technology is not carried onto a website', !onWeb.techStack.includes('flutter'), onWeb.techStack.join(','));
    s.ok('a technology both services offer is kept', onWeb.techStack.includes('nodejs'), onWeb.techStack.join(','));
    s.eq('the tier the user chose is kept', onWeb.tier, before.tier);

    await est.click('Mobile app');
    const after = await est.state();
    s.eq('tier survives the round trip', after.tier, before.tier);
    s.eq('integrations survive the round trip', after.integrations, before.integrations);
    s.eq('features survive the round trip', after.features, before.features);
    s.eq('price is unchanged', await est.liveRange(), priceBefore);
  });

  await story(browser, 'regression-reselect-subtype', 're-tapping the selected card changes nothing', async (page, est) => {
    await est.open();
    await est.goStep('Features');
    await est.click('Push notifications');
    const before = await est.state();
    const priceBefore = await est.liveRange();
    await est.goStep('Project');
    await est.click('E-commerce');
    await est.click('Mobile app');
    s.eq('state is untouched', await est.state(), before);
    s.eq('price is untouched', await est.liveRange(), priceBefore);
  });

  await story(browser, 'regression-platform-toggle', 'platform toggling is reversible and consistent', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    const both = await est.liveRange();
    await est.click('iOS');
    const single = await est.liveRange();
    s.ok('one platform costs less than two', single[0] < both[0], `${single} vs ${both}`);
    s.eq('android remains selected', (await est.state()).platforms, ['android']);
    await est.click('Android');
    s.eq('the last platform cannot be removed', (await est.state()).platforms, ['android']);
    await est.click('iOS');
    s.eq('re-adding iOS restores the original price', await est.liveRange(), both);

    // "Cross-platform (Flutter / React Native)" also contains the word Native.
    await est.click('Native (Swift');
    const native = await est.liveRange();
    s.ok('native costs more than cross-platform', native[0] > both[0], `${native} vs ${both}`);
    await est.click('Cross-platform');
    s.eq('switching back restores the price', await est.liveRange(), both);

    // The card advertises a percentage — it has to be the one the user gets.
    const advertised = Number((await (await est.chip('Native (Swift')).innerText()).match(/\+(\d+)%/)?.[1] ?? '0');
    const actual = Math.round((native[0] / both[0] - 1) * 100);
    s.ok(`the native card's +${advertised}% matches the real +${actual}%`, Math.abs(advertised - actual) <= 6, `${both} → ${native}`);
  });

  await story(browser, 'regression-tech-is-free', 'technology picks never move the price', async (page, est) => {
    await est.open();
    await est.goStep('Technology');
    const before = await est.liveRange();
    for (const tech of ['Flutter', 'Node.js', 'PostgreSQL']) await est.click(tech);
    s.eq('price is unchanged by the stack', await est.liveRange(), before);
    s.eq('picks are recorded', (await est.state()).techStack.length, 3);
    const copy = await est.step().innerText();
    s.ok('the step says so in the copy', /doesn't change the price/i.test(copy), copy.slice(0, 200));
    await est.click('Let SoftWhere choose');
    s.eq('handing the choice back clears the stack', (await est.state()).techStack, []);
    s.eq('price still unchanged', await est.liveRange(), before);
  });

  await story(browser, 'regression-feature-hint-honest', 'a chip moves the price by roughly what it promises', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    await est.click('Enterprise'); // multipliers the old hint ignored
    await est.goStep('Features');

    for (const label of ['Video/voice chat', 'Roles & permissions', 'Loyalty / bonuses']) {
      const chip = await est.chip(label);
      if (!(await chip.count())) continue;
      const hint = await est.chipHint(label);
      const before = await est.liveRange();
      await est.click(label);
      const after = await est.liveRange();
      const moved = (after[0] - before[0] + (after[1] - before[1])) / 2;
      // Outward rounding to $50/$100/$250 steps is the only slack allowed.
      const slack = Math.max(260, hint * 0.35);
      s.ok(`${label}: promised ${hint}, moved ${Math.round(moved)}`, Math.abs(moved - hint) <= slack, `before ${before} after ${after}`);
    }
  });

  await story(browser, 'regression-integration-hint-honest', 'integration chips quote their real effect', async (page, est) => {
    await est.open();
    await est.goStep('Details');
    await est.click('ASAP'); // urgency scales integrations too
    await est.goStep('Integrations');
    const hint = await est.chipHint('Payme');
    const before = await est.liveRange();
    await est.click('Payme');
    const after = await est.liveRange();
    const moved = (after[0] - before[0] + (after[1] - before[1])) / 2;
    s.ok(
      `Payme: promised ${hint}, moved ${Math.round(moved)}`,
      Math.abs(moved - hint) <= Math.max(260, hint * 0.35),
      `${before} → ${after}`
    );
  });

  /* ---- every control on every step -------------------------------- */

  await story(browser, 'controls-scope', 'scope controls all move the price the right way', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    const mvp = await est.liveRange();
    await est.click('Standard');
    const standard = await est.liveRange();
    await est.click('Enterprise');
    const enterprise = await est.liveRange();
    s.ok('mvp < standard < enterprise', mvp[0] < standard[0] && standard[0] < enterprise[0], `${mvp} ${standard} ${enterprise}`);
    await est.click('MVP');
    s.eq('returning to MVP restores the price', await est.liveRange(), mvp);

    const slider = est.step().locator('input[type=range]');
    const min = Number(await slider.getAttribute('min'));
    const max = Number(await slider.getAttribute('max'));
    s.ok('the slider starts at the included screens, not at 1', min > 1, `min=${min}`);
    await slider.fill(String(max));
    await est.settle();
    const wide = await est.liveRange();
    s.ok('more screens costs more', wide[0] > mvp[0], `${wide} vs ${mvp}`);
    await slider.fill(String(min));
    await est.settle();
    s.eq('dragging back restores the price', await est.liveRange(), mvp);
  });

  await story(browser, 'controls-details', 'design, languages and urgency behave', async (page, est) => {
    await est.open();
    await est.goStep('Details');
    const custom = await est.liveRange();
    await est.click('I have designs');
    const ready = await est.liveRange();
    s.ok('client-provided designs cost less', ready[0] < custom[0], `${ready} vs ${custom}`);
    await est.click('Custom design');
    s.eq('back to custom restores the price', await est.liveRange(), custom);

    await est.click('One');
    const one = await est.liveRange();
    await est.click('Three');
    const three = await est.liveRange();
    s.ok('more languages costs more', three[0] > one[0], `${three} vs ${one}`);

    await est.click('ASAP');
    const rush = await est.liveRange();
    s.ok('rush costs more', rush[0] > three[0], `${rush} vs ${three}`);

    const description = est.step().locator('textarea');
    await description.fill('Testing the description field.');
    await est.settle();
    s.eq('the description is stored', (await est.state()).description, 'Testing the description field.');
    s.eq('free text does not change the price', await est.liveRange(), rush);
  });

  /* ---- every service type ---------------------------------------- */

  const SERVICE_CARDS = ['Mobile app', 'Website', 'Telegram bot', 'AI solution', 'Desktop app', 'Other / Not sure'];
  for (const service of SERVICE_CARDS) {
    const id = `service-${service
      .toLowerCase()
      .replace(/[^a-z]+/g, '-')
      .replace(/^-|-$/g, '')}`;
    await story(browser, id, `${service}: full walk-through to the estimate`, async (page, est) => {
      await est.open();
      await est.click(service);
      for (const step of ['Scope', 'Features', 'Integrations', 'Technology', 'Details']) {
        await est.goStep(step);
        const body = await est.step().innerText();
        s.ok(`${step} step renders content`, body.trim().length > 40, body.slice(0, 80));
      }
      await est.goStep('Estimate');
      const [min, max] = await est.resultRange();
      s.ok(`result quotes a range (${min}–${max})`, min > 0 && max > min, `${min}–${max}`);
      const weeks = await page.getByTestId('result-weeks').innerText();
      s.ok('result quotes a timeline', /\d/.test(weeks), weeks);
      s.eq('the result matches the live estimate', await est.resultRange(), await est.liveRange());
    });
  }

  /* ---- result step ------------------------------------------------ */

  await story(browser, 'result-breakdown', 'the breakdown accounts for everything selected', async (page, est) => {
    await est.open();
    await est.goStep('Integrations');
    await est.click('Payme');
    await est.click('Click');
    await est.goStep('Estimate');
    await page.getByRole('button', { name: /How we calculated/i }).click();
    await est.settle();
    const body = await page.getByTestId('step-body').innerText();
    s.ok('Payme appears in the breakdown', /Payme/i.test(body));
    s.ok('Click appears in the breakdown', /Click/i.test(body));
    s.ok('the multiplier is shown', /×\s*[\d.]+/.test(body), body.slice(0, 200));
  });

  await story(browser, 'result-back', 'the estimate is not a one-way door', async (page, est) => {
    await est.open();
    await est.goStep('Estimate');
    const before = await est.state();
    await est.back();
    const body = await est.step().innerText();
    s.ok('Back returns to the last input step', /language|Timeline|Design/i.test(body), body.slice(0, 120));
    s.eq('the configuration is intact', await est.state(), before);
  });

  await story(browser, 'result-reset', 'Start over really starts over', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    await est.click('Enterprise');
    await est.goStep('Estimate');
    await page.getByRole('button', { name: /Start over/i }).click();
    await est.settle();
    const state = await est.state();
    s.eq('back to the default project', [state.projectType, state.subtype, state.tier], ['mobile', 'ecommerce', 'mvp']);
    s.ok('back on the first step', await est.step().getByText('What are we building?').isVisible());
  });

  await story(browser, 'result-ai-block', 'the AI second opinion renders and agrees with the formula', async (page, est) => {
    await est.open();
    await est.goStep('Estimate');
    await page.getByTestId('ai-range').waitFor({ timeout: LIVE_AI ? 70_000 : 15_000 });
    // The same node carries "· 8–12 weeks" after the money.
    const ai = parseRange((await page.getByTestId('ai-range').innerText()).split('·')[0]);
    const formula = await est.resultRange();
    s.ok(`AI range ${ai} is a real range`, ai[0] < ai[1], String(ai));
    s.ok('AI range overlaps the formula range', ai[0] <= formula[1] && ai[1] >= formula[0], `${ai} vs ${formula}`);
  });

  await story(
    browser,
    'result-ai-unavailable',
    'with no AI answer the estimate still stands',
    async (page, est) => {
      await est.open();
      await est.goStep('Estimate');
      await est.settle();
      s.ok('the AI card is hidden, not broken', (await page.getByTestId('ai-block').count()) === 0);
      const [min] = await est.resultRange();
      s.ok('the formula range is still quoted', min > 0, String(min));
    },
    { ai: null }
  );

  await story(browser, 'result-ai-stable', 'the same configuration keeps the same AI answer', async (page, est) => {
    let calls = 0;
    await page.route('**/api/estimate', async route => {
      calls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { formula: null, ai: { ...CANNED_AI, cost: { min: 1000 * calls, max: 2000 * calls } } },
        }),
      });
    });
    await est.open();
    await est.goStep('Estimate');
    await page.getByTestId('ai-range').waitFor({ timeout: 15_000 });
    const first = await page.getByTestId('ai-range').innerText();
    await est.back();
    await est.goStep('Estimate');
    await page.getByTestId('ai-range').waitFor({ timeout: 15_000 });
    await est.settle();
    s.eq('re-entering the result shows the same AI figures', await page.getByTestId('ai-range').innerText(), first);
    s.eq('and does not pay for a second call', calls, 1);
  });

  /* ---- currency --------------------------------------------------- */

  await story(browser, 'currency-switch', 'currency applies to every number on the page', async (page, est) => {
    await est.open();
    await est.goStep('Estimate');
    const usd = await est.resultRange();
    const uzs = page.getByRole('button', { name: 'UZS', exact: true }).filter({ visible: true }).first();
    if (!(await uzs.count())) {
      s.skip('UZS conversion', 'no FX rates available in this environment');
      return;
    }
    await uzs.click();
    await est.settle();
    const converted = await est.resultRange();
    s.ok('the amount is converted, not relabelled', converted[0] > usd[0] * 100, `${usd} → ${converted}`);
    const hero = await page.getByTestId('result-range').innerText();
    s.ok('the hero shows the new currency', /UZS|сум/i.test(hero), hero);
    const rateLine = await page
      .getByTestId('result-range')
      .locator('xpath=../div[last()]')
      .innerText()
      .catch(() => '');
    s.ok('the hourly rate is not left in dollars', !/\$/.test(rateLine), rateLine);

    await est.back();
    await est.goStep('Features');
    const chipText = await est.step().getByRole('button').filter({ hasText: '+' }).first().innerText();
    s.ok('chip hints follow the currency too', !/\$/.test(chipText), chipText);

    await page.getByRole('button', { name: 'USD', exact: true }).filter({ visible: true }).first().click();
    await est.settle();
    await est.goStep('Estimate');
    s.eq('switching back restores the USD figures', await est.resultRange(), usd);
  });

  /* ---- persistence ------------------------------------------------ */

  await story(browser, 'persistence-reload', 'a reload keeps the configuration and the step', async (page, est) => {
    await est.open();
    await est.goStep('Scope');
    await est.click('Enterprise');
    await est.goStep('Features');
    const before = await est.state();
    const price = await est.liveRange();
    await page.reload({ waitUntil: 'domcontentloaded' });
    // The restore happens in an effect after hydration, so wait for it rather
    // than reading the server-rendered defaults.
    const restored = await est.until('price restored', async () => JSON.stringify(await est.liveRange()) === JSON.stringify(price));
    s.ok('price restored', restored, `expected ${price}, still showing ${await est.liveRange()}`);
    s.eq('configuration restored', await est.state(), before);
    s.ok('still on the Features step', await est.step().getByText('What should it do?').isVisible());
  });

  await story(browser, 'persistence-reload-on-result', 'reloading while reading the estimate keeps the estimate', async (page, est) => {
    await est.open();
    await est.goStep('Estimate');
    const before = await est.resultRange();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('result-range').waitFor({ timeout: 15_000 });
    s.eq('still on the result, same numbers', await est.resultRange(), before);
  });

  /* ---- lead form -------------------------------------------------- */

  await story(browser, 'lead-validation', 'the lead form refuses incomplete contact details', async (page, est) => {
    let posted = false;
    page.on('request', request => {
      if (request.url().includes('/api/estimate/lead')) posted = true;
    });
    await est.open();
    await est.goStep('Estimate');
    const submit = page.locator('form button[type=submit]');
    s.ok('the submit button exists', (await submit.count()) > 0);

    await submit.click();
    await est.settle();
    s.ok('an empty form is rejected with a visible message', await page.locator('form [role=alert]').isVisible(), 'no alert shown');
    s.ok('and nothing is sent', !posted, 'a lead was posted from an empty form');

    await page.locator('#lead-name').fill('QA Bot');
    await submit.click();
    await est.settle();
    s.ok('a missing phone number is rejected too', await page.locator('form [role=alert]').isVisible(), 'no alert for a missing phone');
    s.ok('still nothing sent', !posted, 'a lead was posted without a phone number');

    await page.locator('#lead-phone').click();
    await page.locator('#lead-phone').pressSequentially('901', { delay: 30 });
    await submit.click();
    await est.settle();
    s.ok('a half-typed phone number is rejected', await page.locator('form [role=alert]').isVisible(), 'no alert for a partial phone');
    s.ok('and still nothing sent', !posted, 'a lead was posted with an incomplete phone number');
  });

  await story(browser, 'lead-submit', 'a complete lead submits and is acknowledged', async (page, est) => {
    let payload: Record<string, unknown> | null = null;
    page.on('request', request => {
      if (request.url().includes('/api/estimate/lead') && request.method() === 'POST') {
        try {
          payload = JSON.parse(request.postData() ?? '{}');
        } catch {
          /* ignore */
        }
      }
    });
    await est.open();
    await est.goStep('Estimate');
    await page.locator('#lead-name').fill(LIVE_LEAD ? 'AUTOMATED TEST — please ignore' : 'QA Bot');
    await page.locator('#lead-phone').click();
    await page.locator('#lead-phone').pressSequentially('901234567', { delay: 30 });
    await page.locator('#lead-comment').fill('Sent by the estimator smoke suite.');
    await est.settle();
    const submit = page.locator('form button[type=submit]');
    s.ok('submit is enabled once the form is complete', await submit.isEnabled(), 'submit still disabled');
    await submit.click();
    await page.waitForTimeout(1200);
    s.ok('the lead was posted', payload !== null, 'no POST to /api/estimate/lead');
    if (payload) {
      const input = (payload as { input?: EstimatorState }).input;
      s.eq('the posted configuration matches the wizard', input?.subtype, (await est.state()).subtype);
    }
    s.ok(
      'the form is replaced by a confirmation',
      await page.getByText('Estimate sent!').isVisible(),
      (await page.getByTestId('step-body').innerText()).slice(-300)
    );
    s.ok('and the form is gone, so nobody submits twice', (await page.locator('#lead-name').count()) === 0);
  });

  await story(
    browser,
    'lead-server-error',
    'a failing submit tells the user instead of pretending',
    async (page, est) => {
      await est.open();
      await est.goStep('Estimate');
      await page.locator('#lead-name').fill('QA Bot');
      await page.locator('#lead-phone').click();
      await page.locator('#lead-phone').pressSequentially('901234567', { delay: 30 });
      await est.settle();
      await page.locator('form button[type=submit]').click();
      await page.waitForTimeout(1500);
      s.ok(
        'an error is surfaced',
        await page.locator('form [role=alert]').isVisible(),
        await page
          .getByTestId('step-body')
          .innerText()
          .then(b => b.slice(-200))
      );
      s.ok('and the form is still there to retry', (await page.locator('#lead-name').count()) === 1);
    },
    { leadStatus: 500, expectServerError: true }
  );

  /* ---- mobile ------------------------------------------------------ */

  await story(
    browser,
    'mobile-flow',
    'the whole wizard works on a phone',
    async (page, est) => {
      await est.open();
      s.ok('the sticky bar shows the live estimate', await page.getByTestId('mobile-bar').isVisible());
      const [min] = await est.liveRange();
      s.ok('with a real number', min > 0, String(min));
      s.ok('the desktop rail is hidden', !(await page.getByTestId('step-rail').isVisible()));
      for (let i = 0; i < 6; i++) await est.next();
      const [rmin] = await est.resultRange();
      s.ok('reaching the estimate by tapping Next', rmin > 0, String(rmin));
      const back = page.getByRole('button', { name: /Back/i }).filter({ visible: true });
      s.ok('there is a way back that is not "Start over"', (await back.count()) > 0, 'no Back control on the result step');
      await back.first().click();
      await est.settle();
      s.ok(
        'and it works',
        await est
          .step()
          .getByText(/language|Timeline|Design/i)
          .first()
          .isVisible()
      );
    },
    {},
    MOBILE
  );

  await story(
    browser,
    'tablet-currency',
    'the currency switcher exists on tablet-width screens',
    async (page, est) => {
      await est.open();
      await est.goStep('Estimate');
      const pills = page.getByRole('button', { name: 'USD', exact: true }).filter({ visible: true });
      s.ok('a currency switcher is reachable at 1200px', (await pills.count()) > 0, 'no visible currency control');
    },
    {},
    { width: 1200, height: 900 }
  );

  /* ---- server agreement -------------------------------------------- */

  await story(
    browser,
    'api-parity',
    'the API quotes exactly what the browser shows',
    async (page, est) => {
      await est.open();
      await est.goStep('Scope');
      await est.click('Standard');
      await est.goStep('Integrations');
      await est.click('Payme');
      const onScreen = await est.liveRange();
      const input = await est.state();
      const formula = await page.evaluate(
        async ([body, base]) => {
          const res = await fetch(`${base}/api/estimate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          return json?.data?.formula ?? json?.formula ?? null;
        },
        [{ input, locale: 'en' }, BASE] as const
      );
      if (!formula) {
        s.ok('the estimate endpoint answered', false, 'no formula in the response');
        return;
      }
      const server = formula as { cost: { min: number; max: number }; weeks: { min: number; max: number } };
      s.eq('server and browser agree on the price', [server.cost.min, server.cost.max], onScreen);
      const onScreenWeeks = (await page.getByTestId('live-preview').innerText()).match(/(\d+)[–-](\d+)/);
      s.eq(
        'server and browser agree on the timeline',
        [server.weeks.min, server.weeks.max],
        [Number(onScreenWeeks?.[1]), Number(onScreenWeeks?.[2])]
      );
    },
    { realEstimateApi: true }
  );

  await browser.close();
  s.artifacts.screenshots = shots;
  return s.report();
}

main().then(
  code => process.exit(code),
  error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  }
);
