// usage: node cls.js <locale> <w> <h> [startId|full] [reduce]
const { chromium } = require('playwright');
const [locale = 'uz', W = '390', H = '844', start = 'full', reduce = ''] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const mobile = +W < 900 && !process.env.DESK;
  const ctx = await browser.newContext({
    viewport: { width: +W, height: +H },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  await page.route('**/api/estimate/brief', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/contact', r => r.fulfill({ status: 200, body: '{}' }));
  const DELAY = +(process.env.DELAY || 0);
  let armed = false;
  if (DELAY)
    await page.route(
      u => u.pathname.startsWith('/_next/static/chunks/') || u.pathname.startsWith('/_next/static/'),
      async r => {
        if (armed) await new Promise(s => setTimeout(s, DELAY));
        r.continue();
      }
    );
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          v: e.value,
          y: scrollY,
          t: e.startTime,
          sec: (() => {
            const vis = [...document.querySelectorAll('[data-mounted]')]
              .filter(b => {
                const r = b.getBoundingClientRect();
                return r.bottom > 0 && r.top < innerHeight;
              })
              .map(b => (b.closest('[id]') || {}).id + ':' + b.dataset.mounted);
            return vis.join(',');
          })(),
          src: e.sources.map(s => {
            const n = s.node;
            let id = '';
            let el = n;
            while (el && el.nodeType === 1 && !id) {
              id = el.id || (el.dataset && el.dataset.section) || '';
              el = el.parentElement;
            }
            return {
              id,
              tag: n && n.nodeName,
              cls: n && n.className && String(n.className).slice(0, 60),
              prev: [s.previousRect.y | 0, s.previousRect.height | 0],
              cur: [s.currentRect.y | 0, s.currentRect.height | 0],
            };
          }),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`http://localhost:3100/${locale}${process.env.ST ? '?style=' + process.env.ST : ''}`, {
    waitUntil: 'load',
    timeout: 120000,
  });
  await page.waitForTimeout(+(process.env.SETTLE ?? 3000));
  await page.evaluate(() => {
    window.__shifts = [];
  });
  armed = true;
  let y0 = 0;
  if (start !== 'full')
    y0 = await page.evaluate(id => {
      const el = document.getElementById(id);
      return Math.max(0, el.getBoundingClientRect().top + scrollY - innerHeight * 1.5);
    }, start);
  let y = y0,
    last = -1;
  for (let i = 0; i < 4000; i++) {
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(16);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (y >= max) {
      if (last === max) break;
      last = max;
    }
    y = Math.min(y + 40, max);
    if (start !== 'full' && y > y0 + 25000) break;
  }
  await page.waitForTimeout(1500);
  const shifts = await page.evaluate(() => window.__shifts);
  // session windows: gap<1s, max 5s
  let best = 0,
    cur = 0,
    ws = 0,
    prev = -1e9,
    bestWin = [];
  let win = [];
  for (const s of shifts) {
    if (s.t - prev > 1000 || s.t - ws > 5000) {
      cur = 0;
      ws = s.t;
      win = [];
    }
    cur += s.v;
    win.push(s);
    prev = s.t;
    if (cur > best) {
      best = cur;
      bestWin = [...win];
    }
  }
  const total = shifts.reduce((a, s) => a + s.v, 0);
  console.log(JSON.stringify({ locale, W, H, reduce: !!reduce, CLS: +best.toFixed(4), total: +total.toFixed(4), n: shifts.length }));
  const top = [...shifts].sort((a, b) => b.v - a.v).slice(0, 8);
  for (const s of top) console.log(s.v.toFixed(4), 'y=' + s.y, s.sec, JSON.stringify(s.src.slice(0, 3)));
  await browser.close();
})();
