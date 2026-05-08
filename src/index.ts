import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const TRAITS = ['愛', '欲', '嘘', '楽', '悩', '食', '夢', '悪', '休', '金', '酒', '猫'];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    s = (s ^ (s >>> 16)) >>> 0;
    return s / 0xffffffff;
  };
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type Item = { t: string; cx: number; cy: number; fs: number };

// 楕円内に収まり、既存項目と重ならない位置を探して配置する
function placeItems(name: string): Item[] {
  const r = rng(hash(name));
  const target = 8 + Math.floor(r() * 5);

  // 先に文字とフォントサイズだけ決め、大きい順に置く (大きい字ほど詰みにくくなる)
  const candidates = Array.from({ length: target }, () => ({
    t: TRAITS[Math.floor(r() * TRAITS.length)],
    fs: 16 + Math.floor(r() * 32),
  })).sort((a, b) => b.fs - a.fs);

  // 配置可能領域 (描画楕円より少し内側)
  const ex = 200, ey = 160, erx = 165, ery = 115;
  const pad = 4;
  const maxAttempts = 120;
  // CJK 1文字の bbox 概算 (dominant-baseline=central 前提で cy が視覚中心)
  const halfW = (fs: number) => fs * 0.55 + pad;
  const halfH = (fs: number) => fs * 0.55 + pad;

  const placed: Item[] = [];
  for (const cand of candidates) {
    const hw = halfW(cand.fs);
    const hh = halfH(cand.fs);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cx = ex - erx + r() * 2 * erx;
      const cy = ey - ery + r() * 2 * ery;
      // 楕円内チェック (4 隅すべてが内側)
      const insideEllipse =
        [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh]].every(
          ([x, y]) => {
            const dx = (x - ex) / erx;
            const dy = (y - ey) / ery;
            return dx * dx + dy * dy <= 1;
          }
        );
      if (!insideEllipse) continue;
      // 既存項目との衝突チェック (AABB)
      const overlap = placed.some(
        (p) => Math.abs(cx - p.cx) < hw + halfW(p.fs) && Math.abs(cy - p.cy) < hh + halfH(p.fs)
      );
      if (overlap) continue;
      placed.push({ t: cand.t, cx, cy, fs: cand.fs });
      break;
    }
    // 置けなければスキップ (= 表示数が target より少なくなる)
  }
  return placed;
}

function buildSvg(name: string): string {
  const items = placeItems(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
  <ellipse cx="200" cy="160" rx="180" ry="130" fill="#ffe4ec" stroke="#c0566f" stroke-width="3"/>
  ${items
    .map(
      (i) =>
        `<text x="${i.cx.toFixed(1)}" y="${i.cy.toFixed(1)}" font-size="${i.fs}" font-family="'Noto Sans JP', sans-serif" fill="#3b1f24" text-anchor="middle" dominant-baseline="central">${escapeXml(i.t)}</text>`
    )
    .join('\n  ')}
  <text x="200" y="310" font-size="14" font-family="'Noto Sans JP', sans-serif" fill="#777" text-anchor="middle">${escapeXml(name)} の脳内</text>
</svg>`;
}

const app = new Hono();

app.get('/', (c) => {
  const raw = c.req.query('name') ?? '';
  const name = raw.slice(0, 32);
  return c.html(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>脳内メーカー (PoC)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Noto Sans JP', sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
    input, button { font-size: 1rem; padding: .5rem; }
    svg { display: block; margin: 1.5rem auto; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>脳内メーカー</h1>
  <form method="get">
    <input name="name" value="${escapeXml(name)}" placeholder="名前を入力" maxlength="32" required>
    <button type="submit">生成</button>
  </form>
  ${name ? buildSvg(name) : ''}
  ${name ? `<p><a href="/brain.svg?name=${encodeURIComponent(name)}">SVG だけ見る</a></p>` : ''}
</body>
</html>`);
});

app.get('/brain.svg', (c) => {
  const name = (c.req.query('name') ?? '名無し').slice(0, 32);
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.body(buildSvg(name));
});

app.get('/healthz', (c) => c.text('ok'));

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
console.log(`nounai listening on :${port}`);
