// Piecewise from-below fit. pts: [[w, v]] sorted, values already include nothing; returns segments
// {l, r, a, s} with line a + s*w/100 (s in px per vw) and max residual <= tol, line <= every point in [l, r].
const { hull } = require('./hull');
function bestLine(P) {
  if (P.length === 1) return { a: P[0][1], s: 0, res: 0 };
  const h = hull(P);
  let best = null;
  const cand = [];
  for (let i = 0; i + 1 < h.length; i++) {
    const [[x1, y1], [x2, y2]] = [h[i], h[i + 1]];
    const k = (y2 - y1) / (x2 - x1);
    cand.push({ k, b: y1 - k * x1 });
  }
  // also flat line through the min
  const mn = Math.min(...P.map(p => p[1]));
  cand.push({ k: 0, b: mn });
  for (const c of cand) {
    if (Math.abs(c.k) > 2.5) continue;
    let ok = true,
      res = 0;
    for (const [x, y] of P) {
      const d = y - (c.b + c.k * x);
      if (d < -1e-6) {
        ok = false;
        break;
      }
      res = Math.max(res, d);
    }
    if (ok && (!best || res < best.res)) best = { a: c.b, s: c.k * 100, res };
  }
  return best;
}
exports.fit = (pts, tol) => {
  const segs = [];
  let i = 0;
  while (i < pts.length) {
    let j = i,
      line = bestLine([pts[i]]);
    while (j + 1 < pts.length) {
      const l2 = bestLine(pts.slice(i, j + 2));
      if (l2.res > tol) break;
      j++;
      line = l2;
    }
    segs.push({ l: pts[i][0], r: pts[j][0], ...line });
    i = j + 1;
  }
  return segs;
};
