// lower convex hull of [w, v] points, returns segments and residuals
exports.hull = pts => {
  pts = [...pts].sort((a, b) => a[0] - b[0]);
  const h = [];
  for (const p of pts) {
    while (h.length >= 2) {
      const [a, b] = h.slice(-2);
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= 0) h.pop();
      else break;
    }
    h.push(p);
  }
  return h;
};
exports.evalHull = (h, w) => {
  if (w <= h[0][0]) return h.length > 1 ? h[0][1] + ((h[1][1] - h[0][1]) / (h[1][0] - h[0][0])) * (w - h[0][0]) : h[0][1];
  for (let i = 0; i + 1 < h.length; i++) {
    const [[x1, y1], [x2, y2]] = [h[i], h[i + 1]];
    if (w <= x2) return y1 + ((y2 - y1) * (w - x1)) / (x2 - x1);
  }
  return h[h.length - 1][1];
};
exports.lines = h => {
  const out = [];
  for (let i = 0; i + 1 < h.length; i++) {
    const [[x1, y1], [x2, y2]] = [h[i], h[i + 1]];
    const s = ((y2 - y1) / (x2 - x1)) * 100;
    out.push({ a: y1 - (s * x1) / 100, s, x1, x2 });
  }
  return out;
};
