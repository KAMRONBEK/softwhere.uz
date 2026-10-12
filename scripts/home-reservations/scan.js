// node scan.js <id> <loc> <style> <reduce:0|1> <mobile:0|1> "WxH,WxH,..."
const { chromium } = require('playwright');
const [id, loc, st, red, mob, vps] = process.argv.slice(2);
const list = vps.split(',').map(v => v.split('x').map(Number));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const mobile = mob === '1';
  const [W0, H0] = list[0];
  const ctx = await browser.newContext({
    viewport: { width: W0, height: H0 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: red === '1' ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  await page.route('**/api/**', r => (r.request().method() === 'POST' ? r.fulfill({ status: 200, body: '{}' }) : r.continue()));
  await page.goto(`http://localhost:3100/${loc}?style=${st}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(800);
  const realSt = await page.evaluate(() => document.querySelector('[data-lab-root]').dataset.style);
  for (const [W, H] of list) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(250);
    let ok = false;
    for (let k = 0; k < 3 && !ok; k++) {
      await page.evaluate(
        ([id, k]) => {
          const s = document.getElementById(id);
          const y = s.getBoundingClientRect().top + scrollY;
          window.scrollTo(0, y - 400 - k * 300);
        },
        [id, k]
      );
      await page.waitForTimeout(150);
      await page.evaluate(id => {
        const s = document.getElementById(id);
        window.scrollTo(0, s.getBoundingClientRect().top + scrollY + 10);
      }, id);
      try {
        await page.waitForFunction(
          id => {
            const b = document.querySelector(`#${id} [data-mounted="true"]`);
            return b && b.children.length && !b.querySelector('[data-lab-standin]');
          },
          id,
          { timeout: 10000 }
        );
        ok = true;
      } catch {}
    }
    if (!ok) {
      console.log(JSON.stringify({ id, loc, st, W, H, err: 'nomount' }));
      continue;
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const r = await page.evaluate(id => {
      const box = document.querySelector(`#${id} [data-mounted]`);
      const ot0 = box.style.transition;
      box.style.transition = 'none';
      const res = parseFloat(getComputedStyle(box).minHeight);
      box.style.transition = ot0;
      const root = document.querySelector('[data-lab-root]');
      const v = '--lab-h-' + id;
      root.style.setProperty(v, '0px');
      const o = box.style.minHeight,
        ot = box.style.transition;
      box.style.transition = 'none';
      box.style.minHeight = '0px';
      const nat = box.getBoundingClientRect().height;
      box.style.minHeight = o;
      box.style.transition = ot;
      root.style.removeProperty(v);
      return { res: Math.round(res), nat: Math.round(nat), ih: innerHeight, iw: innerWidth };
    }, id);
    console.log(JSON.stringify({ id, loc, st: realSt, red: red === '1', W, H, ...r, diff: r.nat - r.res }));
  }
  await browser.close();
})();
