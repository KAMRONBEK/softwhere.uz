// node fit2.js <kind> <tol> <margin> <lo> <hi> <extendTo> files...
// Fits a from-below piecewise function of the width (see seg.js), emits a CSS max(), verifies on a 1px grid.
const fs = require('fs');
const { fit } = require('./seg');
const cl = (a, v, b) => Math.min(Math.max(a, v), b);
const [kind, tol, margin, lo, hi, ext, ...files] = process.argv.slice(2);
const L = files
  .flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n'))
  .map(l => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(r => r && !r.err && r.W >= +lo && r.W <= +hi);
const val = r => {
  const s = r.H / 100;
  const fin = r.nat - 120 * s;
  if (kind === 'finale-phone') return fin <= 100 * s + 1 ? null : fin - cl(36, 6 * s, 72) - cl(20, 3 * s, 32);
  if (kind === 'finale-desk') return fin <= 100 * s + 1 ? null : fin - cl(36, 6 * s, 72) - cl(20, 3 * s, 32) - cl(28, 5 * s, 52);
  if (kind === 'rag-desk') return r.H > 860 && r.W > 1225 ? null : r.nat;
  if (kind === 'rag-motion') return r.nat - 5.5 * r.H;
  if (kind.startsWith('svh:')) return r.nat - (+kind.slice(4) * r.H) / 100;
  if (kind === 'stack') return r.nat - Math.min(Math.max(360, r.H - 300), 600);
  if (kind === 'mobr') return r.nat - Math.min(r.H - 120, 680);
  if (kind === 'webr') return r.nat - Math.min(0.74 * r.H, 640);
  if (kind === 'tgr') return r.nat - 51 * Math.min(Math.max(9, Math.min((r.H - 56) / 48, (0.82 * r.W) / 23)), 15.5);
  if (kind === 'crm') return r.nat - Math.max(640, Math.min(r.H, 900));
  return r.nat;
};
const m = {};
for (const r of L) {
  const v = val(r);
  if (v == null) continue;
  m[r.W] = Math.min(m[r.W] ?? 1e9, v);
}
let pts = Object.entries(m)
  .map(([w, v]) => [+w, v])
  .sort((a, b) => a[0] - b[0]);
if (+ext > pts[pts.length - 1][0]) pts.push([+ext, pts[pts.length - 1][1]]);
const raw = pts;
const aug = [];
for (let i = 0; i < raw.length; i++) {
  aug.push(raw[i]);
  const n = raw[i + 1];
  if (n && n[0] - raw[i][0] > 1 && n[1] !== raw[i][1]) {
    const v = Math.min(raw[i][1], n[1]);
    aug.push([raw[i][0] + 1, v]);
    if (n[0] - raw[i][0] > 2) aug.push([n[0] - 1, v]);
  }
}
const segs = fit(aug, +tol);
const M = +margin;
const f = n => +n.toFixed(2);
const at = (s, w) => s.a - M + (s.s * w) / 100;
const safe = w => {
  if (m[w] != null) return m[w];
  let i = pts.findIndex(p => p[0] > w);
  if (i <= 0) return pts[i < 0 ? pts.length - 1 : 0][1];
  return Math.min(pts[i - 1][1], pts[i][1]);
};
const g = w => Math.max(...segs.map(s => at(s, w) - (s.rc ? Math.max(0, w - s.rx) * 1000 : 0) - (s.lc ? Math.max(0, s.lx - w) * 1000 : 0)));
const W0 = +lo,
  W1 = Math.max(+hi, +ext);
const ok = () => {
  for (let w = W0; w <= W1; w++) if (g(w) > safe(w) - M + 0.5) return false;
  return true;
};
segs.forEach((s, k) => {
  s.lc = k > 0;
  s.rc = k < segs.length - 1;
  s.rx = s.r;
  s.lx = s.l;
});
for (let k = 0; k + 1 < segs.length; k++) {
  const a = segs[k],
    b = segs[k + 1];
  if (b.l - a.r <= 1) continue;
  a.rx = b.l - 1;
  if (ok()) continue;
  a.rx = a.r;
  b.lx = a.r + 1;
  if (ok()) continue;
  b.lx = b.l;
}
for (const s of segs)
  for (const c of ['lc', 'rc']) {
    if (!s[c]) continue;
    s[c] = false;
    if (!ok()) s[c] = true;
  }
let worst = 1e9,
  worstAt = 0,
  slackMax = 0,
  slackAt = 0;
for (let w = +lo; w <= Math.max(+hi, +ext); w++) {
  const d = safe(w) - g(w);
  if (d < worst) {
    worst = d;
    worstAt = w;
  }
  if (d > slackMax) {
    slackMax = d;
    slackAt = w;
  }
}
const d = pts.map(([w, v]) => v - g(w));
const css = segs.map(s => {
  let t = `${Math.floor(s.a - M)}px${s.s ? (s.s > 0 ? ' + ' : ' - ') + f(Math.abs(s.s)) + 'vw' : ''}`;
  if (s.rc) t += ` - max(0px, 100vw - ${s.rx}px) * 1000`;
  if (s.lc) t += ` - max(0px, ${s.lx}px - 100vw) * 1000`;
  return t;
});
console.log(
  JSON.stringify({
    file: files.join(','),
    n: pts.length,
    segs: segs.length,
    gridMinSlack: f(worst),
    wat: worstAt,
    gridMaxSlack: f(slackMax),
    at: slackAt,
    sampleSlack: [f(Math.min(...d)), f(Math.max(...d))],
  })
);
console.log(css.length === 1 ? css[0] : 'max(' + css.join(', ') + ')');
