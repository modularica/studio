// ---------------------------------------------------------------------------
// Drawing. A cross-section of a snowy hill: a red cabin on top (reception and
// stove), burrow rooms below. Flat Nordic shapes, no outlines, muted colours.
// ---------------------------------------------------------------------------

const FONT = '"Fredoka", ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif';

const PAL = {
  ink: '#2C2A27', inkSoft: '#5B5650',
  snow: '#F4F4F0', snowBlue: '#DDE6EB',
  falu: '#A9473B', faluDark: '#86362D', trim: '#F1ECE2',
  roof: '#3D3B39', roofSnow: '#F2F3F0',
  pine: '#3E5A4B', pineDark: '#2E4539', pineLight: '#577564',
  birch: '#EFEBE3', birchMark: '#3A3733',
  soil: ['#C3AB8C', '#B59D80', '#A68F74', '#977F68', '#88715D'],
  soilTop: '#CDB698', pebble: 'rgba(70,50,35,0.14)',
  hollow: '#B9A184', hollowDark: '#A68D71',
  room: '#F3E2C1', roomFloor: '#E2CBA2', roomGlow: 'rgba(255,214,140,0.55)',
  mustard: '#D7A23F', nut: '#A86F3A', nutCap: '#7C5030',
  good: '#6F9468', warn: '#D7A23F', bad: '#C2553D', cold: '#6F95B5',
  heart: '#C9523F',
  blankets: [['#AE4639', '#F1E9DC'], ['#4E6E8A', '#F1E9DC'], ['#C08A3A', '#F7F0E2'], ['#5E7E5C', '#F1E9DC']],
};

const SEASON_LOOK = {
  autumn: { skyTop: '#E5C6A3', skyBot: '#F5E8D6', hill1: '#D4B396', hill2: '#C29E80', ground: '#B8834F', groundTop: '#C9934F', crown: ['#D08A3B', '#C2672F', '#DDA54A'], dark: 0 },
  winter: { skyTop: '#1F2B43', skyBot: '#4A5B78', hill1: '#3B4A63', hill2: '#33405A', ground: '#EEF1F2', groundTop: '#F8F8F5', crown: null, dark: 1 },
  spring: { skyTop: '#BCD7D8', skyBot: '#EEF2E3', hill1: '#B3C8B4', hill2: '#9DB79F', ground: '#8DAE68', groundTop: '#9FBE75', crown: ['#A9C77A', '#93B867', '#C3D98E'], dark: 0 },
  summer: { skyTop: '#A7CBDD', skyBot: '#F2EEDD', hill1: '#A6BEA8', hill2: '#8EAA92', ground: '#7C9F5C', groundTop: '#8DB06A', crown: ['#6E9858', '#5D8A4C', '#86AC66'], dark: 0 },
};

// ---- small helpers --------------------------------------------------------

function rrPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function archPath(ctx, x, y, w, h, rTop, rBot) {
  const rt = Math.min(rTop, w / 2, h / 2), rb = Math.min(rBot, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rt, y);
  ctx.arcTo(x + w, y, x + w, y + h, rt);
  ctx.arcTo(x + w, y + h, x, y + h, rb);
  ctx.arcTo(x, y + h, x, y, rb);
  ctx.arcTo(x, y, x + w, y, rt);
  ctx.closePath();
}
function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
function fillEll(ctx, x, y, rx, ry, col, rot) { ctx.fillStyle = col; ell(ctx, x, y, rx, ry, rot); ctx.fill(); }
function fillCirc(ctx, x, y, r, col) { ctx.fillStyle = col; circ(ctx, x, y, r); ctx.fill(); }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);

// ---- layout ---------------------------------------------------------------

const LAY = {};
function computeLayout(w, h, inset) {
  const top = inset.top + 66, bottom = inset.bottom + 84;
  const pad = Math.max(12, inset.left + 8, inset.right + 8);
  const availW = w - pad * 2, availH = h - top - bottom;
  let surfH = Math.max(120, Math.min(250, availH * 0.25));
  let cellH = (availH - surfH) / (ROWS + 0.2);
  let cellW = Math.min(availW / COLS, cellH * 1.6);
  if (cellW < cellH * 0.82) { cellH = cellW / 0.82; }
  // Give spare height back to the sky so the hill sits on the bottom bar.
  const gridH = cellH * (ROWS + 0.2);
  surfH = Math.max(surfH, availH - gridH);
  Object.assign(LAY, {
    w, h, top, bottom, pad, cellW, cellH, surfH, inset,
    gridW: cellW * COLS,
    gridX: Math.round((w - cellW * COLS) / 2),
    groundY: Math.round(top + surfH),
  });
  LAY.gridY = LAY.groundY + cellH * 0.2;
  const cabW = Math.min(cellW * 1.25, surfH * 0.95, 190);
  const cabH = Math.min(surfH * 0.62, cabW * 0.8);
  LAY.cabin = { x: LAY.gridX + cellW * 3.5 - cabW / 2 + Math.min(cellW * 0.12, 18), y: LAY.groundY - cabH, w: cabW, h: cabH };
  const maxX = w - 4 - cabW * 1.1;
  if (LAY.cabin.x > maxX) LAY.cabin.x = maxX;
  LAY.slotW = Math.min(cellW * 0.66, Math.max(36, (LAY.cabin.x - 10) / TUNE.queueMax));
  LAY.guestS = Math.min(LAY.slotW * 0.92, cellW * 0.6);
  LAY.treeH = Math.min(surfH * 0.86, cellW * 2.0);
}
function cellRect(i) {
  const { r, c } = cellRC(i);
  return { x: LAY.gridX + c * LAY.cellW, y: LAY.gridY + r * LAY.cellH, w: LAY.cellW, h: LAY.cellH };
}
function innerRect(i) {
  const R = cellRect(i), ix = R.w * 0.07, iy = R.h * 0.1;
  return { x: R.x + ix, y: R.y + iy, w: R.w - ix * 2, h: R.h - iy * 2 };
}
function cellAt(x, y) {
  const c = Math.floor((x - LAY.gridX) / LAY.cellW), r = Math.floor((y - LAY.gridY) / LAY.cellH);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return cellIdx(r, c);
}
function queueSlot(k) {
  return { x: LAY.cabin.x - LAY.slotW * (k + 0.55), y: LAY.groundY - 2 };
}
function treeX(c) { return LAY.gridX + (c + 0.5) * LAY.cellW - (c === 2 ? LAY.cellW * 0.08 : 0); }
function wpPos(col) {
  if (col === 3) { const C = LAY.cabin; return { x: C.x + C.w * 0.08, y: C.y + C.h * 0.38, side: -1 }; }
  return { x: treeX(col) + Math.max(3, LAY.treeH * 0.035), y: LAY.groundY - LAY.treeH * 0.3, side: 1 };
}
function gridToPx(x, y) { return { x: LAY.gridX + (x + 0.5) * LAY.cellW, y: LAY.gridY + (y + 0.82) * LAY.cellH }; }

// ---- background (cached per season and size) -----------------------------

const bgCache = { key: '', canvas: null };
function drawBackground(ctx, season, dpr) {
  const key = season + '|' + LAY.w + '|' + LAY.h + '|' + dpr;
  if (bgCache.key !== key) {
    const cv = bgCache.canvas || document.createElement('canvas');
    cv.width = Math.round(LAY.w * dpr); cv.height = Math.round(LAY.h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(c, season);
    bgCache.canvas = cv; bgCache.key = key;
  }
  ctx.drawImage(bgCache.canvas, 0, 0, LAY.w, LAY.h);
}

function paintBackground(ctx, season) {
  const L = SEASON_LOOK[season], { w, h, groundY } = LAY;
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, L.skyTop); g.addColorStop(1, L.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, groundY + 2);

  if (season === 'winter') {
    for (let k = 0; k < 90; k++) {
      const x = hash(k) * w, y = hash(k + 50) * groundY * 0.8, r = 0.5 + hash(k + 99) * 1.1;
      fillCirc(ctx, x, y, r, `rgba(255,255,240,${0.35 + hash(k + 7) * 0.5})`);
    }
    // moon
    const mx = w * 0.16, my = LAY.top + (groundY - LAY.top) * 0.12, mr = Math.min(22, LAY.surfH * 0.12);
    fillCirc(ctx, mx, my, mr * 1.9, 'rgba(240,235,210,0.08)');
    fillCirc(ctx, mx, my, mr, '#EFE9D2');
    fillCirc(ctx, mx + mr * 0.42, my - mr * 0.18, mr * 0.86, L.skyTop);
  } else if (season === 'summer' || season === 'spring') {
    const sx = w * 0.84, sy = LAY.top + LAY.surfH * 0.18, sr = Math.min(26, LAY.surfH * 0.13);
    fillCirc(ctx, sx, sy, sr * 1.8, 'rgba(255,240,200,0.35)');
    fillCirc(ctx, sx, sy, sr, season === 'summer' ? '#F3D27A' : '#F2DFA0');
  } else {
    const sx = w * 0.82, sy = groundY - LAY.surfH * 0.55, sr = Math.min(30, LAY.surfH * 0.15);
    fillCirc(ctx, sx, sy, sr * 1.9, 'rgba(240,170,110,0.25)');
    fillCirc(ctx, sx, sy, sr, '#EBA36A');
  }

  // distant hills with tiny pines
  const hills = (base, amp, col, seed) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, groundY + 1);
    for (let x = 0; x <= w + 20; x += 20) {
      const y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seed) * Math.cos(x * 0.0023 + seed * 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, groundY + 1); ctx.closePath(); ctx.fill();
  };
  hills(groundY - LAY.surfH * 0.18, LAY.surfH * 0.28, L.hill1, 1.3);
  for (let k = 0; k < Math.floor(w / 26); k++) {
    const x = k * 26 + hash(k + 3) * 14, ph = 8 + hash(k + 11) * 10;
    const base = groundY - LAY.surfH * 0.12 - hash(k + 21) * LAY.surfH * 0.05;
    ctx.fillStyle = L.hill2;
    ctx.beginPath(); ctx.moveTo(x - ph * 0.32, base); ctx.lineTo(x, base - ph); ctx.lineTo(x + ph * 0.32, base); ctx.fill();
  }
  hills(groundY - LAY.surfH * 0.06, LAY.surfH * 0.1, L.hill2, 4.1);

  // soil
  const soilTop = groundY;
  ctx.fillStyle = PAL.soilTop; ctx.fillRect(0, soilTop, w, LAY.gridY - soilTop + 1);
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = PAL.soil[r];
    const y0 = LAY.gridY + r * LAY.cellH;
    ctx.fillRect(0, y0, w, LAY.cellH + 1);
  }
  ctx.fillStyle = PAL.soil[ROWS - 1];
  ctx.fillRect(0, LAY.gridY + ROWS * LAY.cellH, w, h);
  // pebbles
  const n = Math.floor(w * (h - soilTop) / 1400);
  for (let k = 0; k < n; k++) {
    const x = hash(k * 3.1) * w, y = soilTop + 6 + hash(k * 7.7) * (h - soilTop);
    const rx = 1.5 + hash(k * 1.9) * 3.5;
    fillEll(ctx, x, y, rx, rx * 0.65, PAL.pebble);
  }
}

// ---- sky life: aurora, weather particles ---------------------------------

function drawAurora(ctx, t, k) {
  const { w, top, surfH } = LAY;
  const y0 = top + surfH * 0.05;
  k = k == null ? 1 : k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, k);
  const bands = k > 1.5 ? 4 : 2;
  for (let band = 0; band < bands; band++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = y0 + surfH * (0.16 + band * 0.1) + Math.sin(x * 0.008 + t * 0.35 + band * 2) * surfH * 0.07 + Math.sin(x * 0.021 - t * 0.2) * surfH * 0.03;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = surfH * Math.max(0.03, 0.09 - (band % 2) * 0.03) * (k > 1.5 ? 1.4 : 1);
    const boost = k > 1.5 ? 3.2 : 1 + k * 0.6;
    ctx.strokeStyle = ['rgba(120,210,170,', 'rgba(130,190,200,', 'rgba(180,150,230,', 'rgba(140,230,190,'][band] + (0.11 * boost).toFixed(3) + ')';
    ctx.stroke();
  }
  ctx.restore();
}

const weather = [];
function updateWeather(season, dt) {
  const target = season === 'winter' ? 70 : season === 'autumn' ? 16 : season === 'spring' ? 10 : 6;
  while (weather.length < target) weather.push(newFlake(season, true));
  if (weather.length > target) weather.length = target;
  for (const f of weather) {
    f.t += dt;
    f.x += (f.vx + Math.sin(f.t * f.wob) * f.sway) * dt;
    f.y += f.vy * dt;
    if (f.y > LAY.groundY + 4 || f.x < -20 || f.x > LAY.w + 20 || f.season !== season) Object.assign(f, newFlake(season, false));
  }
}
function newFlake(season, anywhere) {
  const s = LAY.surfH;
  return {
    season, t: Math.random() * 10,
    x: Math.random() * LAY.w, y: anywhere ? Math.random() * LAY.groundY : -10,
    vx: season === 'autumn' ? -8 - Math.random() * 10 : 0,
    vy: season === 'winter' ? 14 + Math.random() * 18 : season === 'autumn' ? 20 + Math.random() * 16 : 10 + Math.random() * 8,
    sway: season === 'winter' ? 8 : 18, wob: 1 + Math.random() * 2,
    r: season === 'winter' ? 1 + Math.random() * 1.8 : 2.5 + Math.random() * 2.5,
    col: season === 'autumn' ? ['#C9733A', '#D9A148', '#B05A34'][Math.floor(Math.random() * 3)] : season === 'spring' ? '#F3E6EA' : '#FBF3C8',
    rot: Math.random() * 6, big: s,
  };
}
function drawWeather(ctx, season) {
  for (const f of weather) {
    if (season === 'winter') fillCirc(ctx, f.x, f.y, f.r, 'rgba(250,252,255,0.85)');
    else if (season === 'summer') {
      if (f.y > LAY.groundY - LAY.surfH * 0.7) fillCirc(ctx, f.x, f.y, 1.6, 'rgba(255,248,200,0.8)');
    } else fillEll(ctx, f.x, f.y, f.r, f.r * 0.5, f.col, f.rot + f.t);
  }
}

// ---- ground, trees ----------------------------------------------------------

function drawGround(ctx, season) {
  const L = SEASON_LOOK[season], { w, groundY } = LAY;
  const th = season === 'winter' ? 9 : 6;
  ctx.fillStyle = L.ground;
  ctx.beginPath(); ctx.moveTo(0, groundY + th);
  for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, groundY - 2 - Math.sin(x * 0.07) * 1.5 - (season === 'winter' ? 2 : 0));
  ctx.lineTo(w, groundY + th); ctx.closePath(); ctx.fill();
  ctx.fillStyle = L.groundTop;
  ctx.fillRect(0, groundY - 3, w, 3);
  if (season === 'spring') {
    for (let k = 0; k < w / 40; k++) fillEll(ctx, hash(k + 4) * w, groundY + 1, 10 + hash(k) * 14, 3, 'rgba(245,245,240,0.8)');
  }
}

function drawPine(ctx, x, base, H, season) {
  const W = H * 0.42;
  ctx.fillStyle = '#5B4636'; ctx.fillRect(x - H * 0.03, base - H * 0.2, H * 0.06, H * 0.2);
  for (let k = 0; k < 4; k++) {
    const yb = base - H * (0.12 + k * 0.2), wk = W * (1 - k * 0.2);
    ctx.fillStyle = k % 2 ? PAL.pine : PAL.pineDark;
    ctx.beginPath(); ctx.moveTo(x - wk / 2, yb); ctx.lineTo(x, yb - H * 0.34); ctx.lineTo(x + wk / 2, yb); ctx.closePath(); ctx.fill();
    if (season === 'winter') {
      ctx.fillStyle = PAL.roofSnow;
      ctx.beginPath(); ctx.moveTo(x - wk * 0.18, yb - H * 0.22); ctx.lineTo(x, yb - H * 0.34); ctx.lineTo(x + wk * 0.18, yb - H * 0.22); ctx.quadraticCurveTo(x, yb - H * 0.2, x - wk * 0.18, yb - H * 0.22); ctx.fill();
    }
  }
}

function drawBirch(ctx, x, base, H, season, seed) {
  const tw = Math.max(4, H * 0.07);
  const L = SEASON_LOOK[season];
  // bare branches
  ctx.strokeStyle = '#4A4440'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, tw * 0.28);
  for (let k = 0; k < 5; k++) {
    const by = base - H * (0.45 + k * 0.1), dir = k % 2 ? 1 : -1, len = H * (0.2 - k * 0.025);
    ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + dir * len, by - len * 0.7); ctx.stroke();
    if (season === 'winter') { ctx.strokeStyle = PAL.roofSnow; ctx.lineWidth = Math.max(1, tw * 0.18); ctx.beginPath(); ctx.moveTo(x + dir * len * 0.3, by - len * 0.26); ctx.lineTo(x + dir * len, by - len * 0.75); ctx.stroke(); ctx.strokeStyle = '#4A4440'; ctx.lineWidth = Math.max(1.2, tw * 0.28); }
  }
  if (L.crown) {
    for (let k = 0; k < 7; k++) {
      const a = hash(seed * 9 + k), b = hash(seed * 5 + k + 2);
      fillEll(ctx, x + (a - 0.5) * H * 0.42, base - H * (0.62 + b * 0.3), H * 0.13, H * 0.1, L.crown[k % 3]);
    }
  }
  ctx.fillStyle = PAL.birch;
  rrPath(ctx, x - tw / 2, base - H * 0.95, tw, H * 0.95, tw / 2); ctx.fill();
  ctx.fillStyle = PAL.birchMark;
  for (let k = 0; k < 7; k++) {
    const y = base - H * (0.1 + k * 0.12) - hash(seed + k) * H * 0.04;
    ctx.fillRect(x - tw / 2 + (k % 2 ? tw * 0.45 : 0), y, tw * 0.55, Math.max(1.2, H * 0.012));
  }
}

function drawTrees(ctx, season) {
  const H = LAY.treeH, base = LAY.groundY;
  // decoration outside the hotel, wide screens only
  for (let k = 1; k < 6; k++) {
    const xl = LAY.gridX - k * LAY.cellW * 0.75, xr = LAY.cabin.x + LAY.cabin.w + k * LAY.cellW * 0.7;
    const hh = H * (0.7 + hash(k) * 0.3);
    if (xl > -40) (k % 2 ? drawPine : (c, a, b, d, e) => drawBirch(c, a, b, d, e, k + 10))(ctx, xl, base, hh, season);
    if (xr < LAY.w + 40) (k % 2 ? (c, a, b, d, e) => drawBirch(c, a, b, d, e, k + 20) : drawPine)(ctx, xr, base, hh, season);
  }
  drawPine(ctx, treeX(0), base, H, season);
  drawBirch(ctx, treeX(1), base, H * 1.02, season, 1);
  drawPine(ctx, treeX(2), base, H * 0.92, season);
}

// ---- cabin, stove and thermometer -------------------------------------------

function drawCabin(ctx, season, st) {
  const C = LAY.cabin, { x, y, w, h } = C, t = st.t;
  const winter = season === 'winter';
  // chimney + smoke
  const chx = x + w * 0.7, chy = y - h * 0.32;
  ctx.fillStyle = '#5A514B'; ctx.fillRect(chx - w * 0.05, chy, w * 0.1, h * 0.3);
  const fire = st.fire;
  for (let k = 0; k < 5; k++) {
    const p = ((t * 0.35 + k / 5) % 1);
    const a = (1 - p) * (0.15 + fire * 0.35);
    fillCirc(ctx, chx + Math.sin(p * 5 + k) * w * 0.06 + p * w * 0.12, chy - p * h * 0.9, w * (0.04 + p * 0.07), `rgba(235,235,235,${a})`);
  }
  // body
  ctx.fillStyle = PAL.falu; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let k = 1; k < 9; k++) ctx.fillRect(x + (w / 9) * k, y, 1, h);
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(x, y, w * 0.045, h); ctx.fillRect(x + w * 0.955, y, w * 0.045, h);
  // roof (sod roof with snow in winter)
  const ov = w * 0.1, rh = h * 0.42;
  ctx.fillStyle = PAL.roof;
  ctx.beginPath(); ctx.moveTo(x - ov, y + 2); ctx.lineTo(x + w / 2, y - rh); ctx.lineTo(x + w + ov, y + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = winter ? PAL.roofSnow : season === 'autumn' ? '#8E8A4E' : '#7E9B57';
  ctx.beginPath(); ctx.moveTo(x - ov, y + 1); ctx.lineTo(x + w / 2, y - rh - 4); ctx.lineTo(x + w + ov, y + 1); ctx.lineTo(x + w + ov - 4, y - 4); ctx.lineTo(x + w / 2, y - rh + 3); ctx.lineTo(x - ov + 4, y - 4); ctx.closePath(); ctx.fill();
  // window with the stove
  const wx = x + w * 0.4, wy = y + h * 0.18, ww = w * 0.48, wh = h * 0.56;
  ctx.fillStyle = PAL.trim; ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  ctx.fillStyle = winter ? '#F6DFB0' : '#EEDCB9'; ctx.fillRect(wx, wy, ww, wh);
  const glow = ctx.createRadialGradient(wx + ww / 2, wy + wh * 0.75, 2, wx + ww / 2, wy + wh * 0.75, ww * 0.8);
  glow.addColorStop(0, `rgba(255,150,60,${0.25 + fire * 0.45})`); glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(wx, wy, ww, wh);
  // stove
  const sw = ww * 0.46, sh = wh * 0.62, sx = wx + ww / 2 - sw / 2, sy = wy + wh - sh;
  ctx.fillStyle = '#2F2D2B'; rrPath(ctx, sx, sy, sw, sh, sw * 0.12); ctx.fill();
  ctx.fillRect(sx + sw * 0.4, wy, sw * 0.2, sy - wy);
  const fx = sx + sw * 0.2, fy = sy + sh * 0.3, fw = sw * 0.6, fh = sh * 0.48;
  ctx.fillStyle = '#4A2A1C'; rrPath(ctx, fx, fy, fw, fh, 3); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const fl = (0.35 + fire * 0.75) * (0.8 + 0.2 * Math.sin(t * 9 + k * 2));
    ctx.fillStyle = k === 1 ? '#F5C659' : '#E7743A';
    ctx.beginPath();
    const cx = fx + fw * (0.25 + k * 0.25), bot = fy + fh - 1;
    ctx.moveTo(cx - fw * 0.13, bot); ctx.quadraticCurveTo(cx, bot - fh * fl * 1.1, cx + fw * 0.13, bot); ctx.fill();
  }
  // window cross
  ctx.fillStyle = PAL.trim; ctx.fillRect(wx, wy + wh * 0.28 - 1.5, ww, 3);
  // door
  const dw = w * 0.2, dh = h * 0.62;
  ctx.fillStyle = PAL.faluDark; rrPath(ctx, x + w * 0.1, y + h - dh, dw, dh, dw * 0.25); ctx.fill();
  fillCirc(ctx, x + w * 0.1 + dw * 0.78, y + h - dh * 0.45, Math.max(1.5, w * 0.012), PAL.mustard);
  // sign with a moon
  const gx = x + w * 0.2, gy = y - h * 0.06, gr = Math.max(7, w * 0.07);
  fillCirc(ctx, gx, gy, gr, PAL.trim);
  fillCirc(ctx, gx - gr * 0.12, gy, gr * 0.55, PAL.mustard);
  fillCirc(ctx, gx + gr * 0.12, gy - gr * 0.14, gr * 0.48, PAL.trim);
  // woodpile
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) {
    const lx = x + w + ov * 0.2 + j * w * 0.07 + k * w * 0.035, ly = y + h - w * 0.035 - k * w * 0.06;
    if (lx + w * 0.04 < LAY.w) { fillCirc(ctx, lx, ly, w * 0.033, '#8C6440'); fillCirc(ctx, lx, ly, w * 0.016, '#C8A276'); }
  }
  if (winter) drawThermometer(ctx, st);
}

function drawThermometer(ctx, st) {
  const C = LAY.cabin;
  const th = C.h * 0.95, tw = Math.max(9, C.w * 0.085);
  const x = C.x - tw * 1.35, y = C.y + C.h - th - 2;
  const z0 = TUNE.ZONE[0] / 100, z1 = TUNE.ZONE[1] / 100;
  const bulb = tw * 0.95, tubeH = th - bulb * 1.4, ty = y;
  ctx.fillStyle = PAL.trim; rrPath(ctx, x - 3, ty - 3, tw + 6, tubeH + bulb * 1.2 + 6, (tw + 6) / 2); ctx.fill();
  const yAt = (v) => ty + tubeH * (1 - v);
  ctx.fillStyle = 'rgba(111,149,181,0.35)'; ctx.fillRect(x, yAt(z0), tw, tubeH * z0);
  ctx.fillStyle = 'rgba(111,148,104,0.45)'; ctx.fillRect(x, yAt(z1), tw, tubeH * (z1 - z0));
  ctx.fillStyle = 'rgba(194,85,61,0.32)'; rrPath(ctx, x, ty, tw, tubeH * (1 - z1), tw / 2); ctx.fill();
  const v = st.temp / 100;
  const col = st.temp < TUNE.ZONE[0] ? PAL.cold : st.temp > TUNE.ZONE[1] ? PAL.bad : PAL.good;
  ctx.fillStyle = col;
  ctx.fillRect(x + tw * 0.28, yAt(v), tw * 0.44, tubeH * v + bulb * 0.3);
  fillCirc(ctx, x + tw / 2, ty + tubeH + bulb * 0.45, bulb * 0.62, col);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x - 2, yAt(z0) - 0.75, tw + 4, 1.5);
  ctx.fillRect(x - 2, yAt(z1) - 0.75, tw + 4, 1.5);
}

// ---- rooms ------------------------------------------------------------------

function drawTunnels(ctx, save) {
  const G = save.grid, cw = LAY.cellW, ch = LAY.cellH;
  ctx.fillStyle = PAL.hollowDark;
  for (let i = 0; i < G.length; i++) {
    if (!G[i].dug) continue;
    const { r, c } = cellRC(i), R = cellRect(i);
    if (c < COLS - 1 && G[i + 1].dug) ctx.fillRect(R.x + R.w * 0.8, R.y + R.h * 0.56, R.w * 0.4, R.h * 0.3);
    if (r < ROWS - 1 && G[i + COLS].dug) {
      ctx.fillRect(R.x + R.w * 0.72, R.y + R.h * 0.7, R.w * 0.13, R.h * 0.5);
    }
  }
  // entrance from the cabin
  const ex = LAY.gridX + cw * 3.5;
  ctx.fillRect(ex - cw * 0.07, LAY.groundY - 2, cw * 0.14, LAY.gridY - LAY.groundY + ch * 0.32);
  if (!G[3].dug) ctx.fillRect(LAY.gridX + cw * 2.8, LAY.gridY + ch * 0.56, cw * 0.77, ch * 0.3);
  // ladder rungs
  ctx.fillStyle = 'rgba(120,85,55,0.45)';
  for (let i = 0; i < G.length; i++) {
    const { r } = cellRC(i), R = cellRect(i);
    if (G[i].dug && r < ROWS - 1 && G[i + COLS].dug) for (let k = 0; k < 4; k++) ctx.fillRect(R.x + R.w * 0.72, R.y + R.h * (0.8 + k * 0.1), R.w * 0.13, 1.5);
  }
}

function drawCell(ctx, save, i, st) {
  const g = save.grid[i], R = cellRect(i), I = innerRect(i);
  const winter = st.season === 'winter';
  if (!g.dug) {
    drawSoilDecor(ctx, i);
    if (st.season === 'summer' && st.canDig[i]) {
      ctx.save();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,40,25,0.35)';
      archPath(ctx, I.x + 4, I.y + 4, I.w - 8, I.h - 8, I.w * 0.3, 10); ctx.stroke();
      ctx.restore();
      drawShovel(ctx, I.x + I.w / 2, I.y + I.h * 0.45, Math.min(I.w, I.h) * 0.3);
    }
    return;
  }
  const rTop = Math.min(I.w, I.h) * 0.45, rBot = Math.min(I.w, I.h) * 0.14;
  if (!g.room) {
    ctx.fillStyle = PAL.hollow; archPath(ctx, I.x, I.y, I.w, I.h, rTop, rBot); ctx.fill();
    ctx.fillStyle = PAL.hollowDark; ctx.fillRect(I.x + rBot * 0.5, I.y + I.h * 0.84, I.w - rBot, I.h * 0.16 - rBot * 0.3);
    if (st.season === 'summer') drawPlus(ctx, I.x + I.w / 2, I.y + I.h * 0.48, Math.min(I.w, I.h) * 0.2);
    return;
  }
  // lit room
  ctx.save();
  archPath(ctx, I.x, I.y, I.w, I.h, rTop, rBot); ctx.clip();
  ctx.fillStyle = PAL.room; ctx.fillRect(I.x, I.y, I.w, I.h);
  if (winter || g.lvl >= 2) {
    const gl = ctx.createRadialGradient(I.x + I.w / 2, I.y + I.h * 0.45, 2, I.x + I.w / 2, I.y + I.h * 0.45, I.w * 0.7);
    gl.addColorStop(0, winter ? 'rgba(255,220,150,0.55)' : 'rgba(255,225,165,0.35)'); gl.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = gl; ctx.fillRect(I.x, I.y, I.w, I.h);
  }
  ctx.fillStyle = PAL.roomFloor; ctx.fillRect(I.x, I.y + I.h * 0.82, I.w, I.h * 0.2);
  drawRoomFurniture(ctx, g, I, i);
  ctx.restore();
}

function drawRoomFurniture(ctx, g, I, i) {
  const fx = I.x + I.w / 2, fy = I.y + I.h * 0.86, s = Math.min(I.w, I.h);
  if (g.lvl >= 3) {
    // framed picture of a fjord
    const pw = s * 0.24, ph = s * 0.17, px = I.x + I.w * 0.66, py = I.y + I.h * 0.24;
    ctx.fillStyle = '#8A6A4A'; ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    ctx.fillStyle = '#CFE0E6'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#6E8D7A'; ctx.beginPath(); ctx.moveTo(px, py + ph); ctx.lineTo(px + pw * 0.35, py + ph * 0.35); ctx.lineTo(px + pw * 0.6, py + ph * 0.75); ctx.lineTo(px + pw * 0.8, py + ph * 0.5); ctx.lineTo(px + pw, py + ph); ctx.fill();
    // rug
    ctx.fillStyle = '#C9B7D0'; rrPath(ctx, I.x + I.w * 0.12, fy - 1, I.w * 0.76, s * 0.07, 3); ctx.fill();
    ctx.fillStyle = '#F4EFE6'; for (let k = 0; k < 6; k++) ctx.fillRect(I.x + I.w * (0.17 + k * 0.12), fy, I.w * 0.05, s * 0.05);
  }
  if (g.lvl >= 2) {
    const lx = I.x + I.w * 0.2, ly = I.y + I.h * 0.18;
    ctx.strokeStyle = '#5A4A3E'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, I.y); ctx.lineTo(lx, ly); ctx.stroke();
    fillCirc(ctx, lx, ly + s * 0.05, s * 0.14, 'rgba(255,210,130,0.35)');
    ctx.fillStyle = '#3E3A36'; rrPath(ctx, lx - s * 0.035, ly, s * 0.07, s * 0.1, 2); ctx.fill();
    fillCirc(ctx, lx, ly + s * 0.05, s * 0.022, '#F7CD6B');
  }
  switch (g.room) {
    case 'yuva':
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (k / 8), rx = s * 0.36;
        fillEll(ctx, fx - Math.cos(a) * rx, fy - Math.sin(a) * s * 0.05, s * 0.09, s * 0.04, ['#C58A44', '#B46A38', '#D3A253'][k % 3], -Math.cos(a) * 0.6);
      }
      fillEll(ctx, fx, fy, s * 0.38, s * 0.07, '#B98447');
      break;
    case 'havuz':
      fillEll(ctx, fx, fy, s * 0.42, s * 0.11, '#7D6250');
      fillEll(ctx, fx, fy - s * 0.01, s * 0.36, s * 0.07, '#6A5244');
      fillEll(ctx, fx + s * 0.3, fy - s * 0.02, s * 0.08, s * 0.03, '#7E9C5E');
      break;
    case 'magara':
      ctx.fillStyle = '#B3ABA0';
      for (let k = 0; k < 7; k++) {
        const side = k % 2 ? I.x + I.w * 0.04 : I.x + I.w * 0.96;
        fillEll(ctx, side, I.y + I.h * (0.3 + (k >> 1) * 0.18), s * 0.09, s * 0.07, k % 3 ? '#B8B0A5' : '#A69E93');
      }
      fillEll(ctx, fx, fy + s * 0.01, s * 0.44, s * 0.07, '#E8DCC6');
      break;
    case 'oda':
      fillEll(ctx, fx, fy, s * 0.4, s * 0.08, '#D9B75C');
      ctx.strokeStyle = '#B9963F'; ctx.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const xx = fx - s * 0.32 + k * s * 0.08; ctx.beginPath(); ctx.moveTo(xx, fy + s * 0.03); ctx.lineTo(xx + s * 0.04, fy - s * 0.05); ctx.stroke(); }
      break;
    case 'tunek':
      ctx.fillStyle = '#8A6646'; ctx.fillRect(I.x + I.w * 0.12, I.y + I.h * 0.24, I.w * 0.76, Math.max(3, s * 0.05));
      fillEll(ctx, fx, fy, s * 0.24, s * 0.05, '#8FA06C');
      break;
  }
}

// Little things buried in the soil, so the empty hill is worth looking at.
function drawSoilDecor(ctx, i) {
  const R = cellRect(i), { r } = cellRC(i), s = Math.min(R.w, R.h);
  const kind = Math.floor(hash(i * 13.7 + 1) * 7);
  const cx = R.x + R.w * (0.3 + hash(i * 3.3) * 0.4), cy = R.y + R.h * (0.38 + hash(i * 5.1) * 0.3);
  ctx.save();
  if (kind <= 1 || r === ROWS - 1) {
    const n = 2 + (r >> 1);
    for (let k = 0; k < n; k++) fillEll(ctx, cx + (k - n / 2) * s * 0.13, cy + (k % 2) * s * 0.07, s * (0.07 + hash(i + k) * 0.05), s * 0.05, k % 2 ? 'rgba(120,105,95,0.45)' : 'rgba(140,125,112,0.45)');
  } else if (kind === 2) {
    ctx.strokeStyle = 'rgba(205,140,130,0.85)'; ctx.lineWidth = Math.max(2, s * 0.035); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.14, cy);
    ctx.bezierCurveTo(cx - s * 0.08, cy - s * 0.07, cx - s * 0.02, cy + s * 0.07, cx + s * 0.05, cy);
    ctx.bezierCurveTo(cx + s * 0.09, cy - s * 0.05, cx + s * 0.13, cy - s * 0.02, cx + s * 0.15, cy - s * 0.04); ctx.stroke();
    fillCirc(ctx, cx + s * 0.155, cy - s * 0.045, Math.max(1.2, s * 0.022), 'rgba(185,115,105,0.9)');
  } else if (kind === 3) {
    fillEll(ctx, cx, cy + s * 0.04, s * 0.16, s * 0.07, 'rgba(90,65,45,0.3)');
    drawNut(ctx, cx - s * 0.07, cy + s * 0.02, s * 0.045); drawNut(ctx, cx + s * 0.05, cy + s * 0.03, s * 0.045); drawNut(ctx, cx - s * 0.01, cy - s * 0.03, s * 0.045);
  } else if (kind === 4) {
    ctx.strokeStyle = 'rgba(235,225,205,0.55)'; ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.beginPath();
    for (let a = 0; a < 14; a += 0.3) { const rr = s * 0.012 * a; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  } else if (kind === 5 && r < 2) {
    ctx.strokeStyle = 'rgba(95,70,50,0.3)'; ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, R.y); ctx.quadraticCurveTo(cx - s * 0.15, R.y + R.h * 0.35, cx + s * 0.05, R.y + R.h * 0.65);
    ctx.moveTo(cx - s * 0.06, R.y + R.h * 0.28); ctx.quadraticCurveTo(cx + s * 0.1, R.y + R.h * 0.36, cx + s * 0.2, R.y + R.h * 0.3); ctx.stroke();
  }
  ctx.restore();
}

function drawShovel(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
  ctx.fillStyle = 'rgba(60,40,25,0.45)';
  ctx.fillRect(-s * 0.06, -s * 0.7, s * 0.12, s * 0.9);
  ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.15); ctx.lineTo(s * 0.28, s * 0.15); ctx.lineTo(s * 0.2, s * 0.55); ctx.quadraticCurveTo(0, s * 0.75, -s * 0.2, s * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillRect(-s * 0.2, -s * 0.8, s * 0.4, s * 0.1);
  ctx.restore();
}
function drawPlus(ctx, x, y, s) {
  fillCirc(ctx, x, y, s, 'rgba(255,250,240,0.55)');
  ctx.fillStyle = 'rgba(60,40,25,0.55)';
  ctx.fillRect(x - s * 0.5, y - s * 0.09, s, s * 0.18);
  ctx.fillRect(x - s * 0.09, y - s * 0.5, s * 0.18, s);
}

// ---- animals ----------------------------------------------------------------
// drawAnimal(ctx, sp, x, base, s, o): x = centre, base = floor line, s = size.
// o: { awake, grumpy, t, shiver, snore, blanket (true/false/undefined),
//      bcol (blanket colours), walk, scale }

const SP_SCALE = { fare: 0.74, kirpi: 0.8, kurbaga: 0.78, ayi: 1.0, porsuk: 0.88, yarasa: 0.7 };

function eye(ctx, x, y, s, o) {
  if (o.awake && !o.grumpy) {
    fillCirc(ctx, x, y, s * 0.045, PAL.ink);
    fillCirc(ctx, x + s * 0.015, y - s * 0.015, s * 0.015, '#fff');
  } else {
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.2, s * 0.028); ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.grumpy) { ctx.moveTo(x - s * 0.05, y - s * 0.02); ctx.lineTo(x + s * 0.05, y + s * 0.01); }
    else ctx.arc(x, y - s * 0.01, s * 0.045, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}
function cheek(ctx, x, y, s) { fillEll(ctx, x, y, s * 0.05, s * 0.03, 'rgba(225,120,110,0.35)'); }

// A knitted blanket draped over the body like a dome, tucked in at the floor.
function drawBlanket(ctx, cx, base, rx, ry, cols, breathe) {
  const [c1, c2] = cols;
  const k = 1 + (breathe || 0);
  ctx.fillStyle = c1;
  ctx.beginPath(); ctx.ellipse(cx, base, rx * 1.02, ry * k, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  // hem along the top and a row of Nordic stitches
  ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1.5, ry * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(cx, base, rx * 0.86, ry * k * 0.84, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  ctx.fillStyle = c2;
  const n = Math.max(3, Math.round(rx / 7)), d = Math.max(1.6, ry * 0.08);
  for (let j = 0; j < n; j++) {
    const a = Math.PI * (1.2 + 0.6 * j / Math.max(1, n - 1));
    const xx = cx + Math.cos(a) * rx * 0.62, yy = base + Math.sin(a) * ry * k * 0.56;
    ctx.beginPath(); ctx.moveTo(xx, yy - d); ctx.lineTo(xx + d, yy); ctx.lineTo(xx, yy + d); ctx.lineTo(xx - d, yy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(cx - rx, base - Math.max(1.5, ry * 0.08), rx * 2, Math.max(1.5, ry * 0.08));
}
const BLANKET = { fare: [0.13, 0.36, 0.44], kirpi: [0.15, 0.37, 0.36], ayi: [0.15, 0.43, 0.38], porsuk: [0.15, 0.41, 0.35] };
function drawFallenBlanket(ctx, x, base, w, cols) {
  ctx.fillStyle = cols[0];
  rrPath(ctx, x, base - w * 0.16, w, w * 0.16, w * 0.07); ctx.fill();
  ctx.fillStyle = cols[1]; ctx.fillRect(x + w * 0.1, base - w * 0.11, w * 0.8, Math.max(1, w * 0.035));
}

function drawAnimal(ctx, sp, x, base, s, o) {
  o = o || {};
  const t = o.t || 0;
  ctx.save();
  let jx = 0, sy = 1;
  if (o.shiver) jx = Math.sin(t * 60) * s * 0.018;
  if (o.snore) sy = 1 + Math.sin(t * 5) * 0.05;
  else if (!o.awake) sy = 1 + Math.sin(t * 1.6 + x) * 0.02;
  if (o.walk) { base -= Math.abs(Math.sin(t * 9)) * s * 0.06; }
  ctx.translate(x + jx, base);
  if (o.flip) ctx.scale(-1, 1);
  ctx.scale(1, sy);
  // soft shadow
  if (sp !== 'yarasa') fillEll(ctx, 0, 0, s * 0.42, s * 0.05, 'rgba(60,40,25,0.16)');
  ANIMALS[sp](ctx, s, o);
  ctx.restore();
}

const ANIMALS = {
  fare(ctx, s, o) {
    const r = s * 0.34, cy = -r * 0.98;
    // tail wraps round the front
    ctx.strokeStyle = '#B97E3E'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, cy + r * 0.15, r * 0.95, -0.15 * Math.PI, 0.55 * Math.PI); ctx.stroke();
    fillCirc(ctx, 0, cy, r, '#D49B57');
    fillEll(ctx, -r * 0.25, cy + r * 0.35, r * 0.55, r * 0.4, '#EBD2A6');
    // tail front
    ctx.strokeStyle = '#C98D47'; ctx.lineWidth = s * 0.15;
    ctx.beginPath(); ctx.arc(0, cy + r * 0.2, r * 0.92, 0.5 * Math.PI, 0.95 * Math.PI); ctx.stroke();
    // ears
    fillCirc(ctx, -r * 0.35, cy - r * 0.85, r * 0.26, '#C88E4C');
    fillCirc(ctx, -r * 0.35, cy - r * 0.85, r * 0.14, '#E9B8A6');
    fillCirc(ctx, r * 0.1, cy - r * 0.95, r * 0.22, '#C88E4C');
    eye(ctx, -r * 0.42, cy - r * 0.2, s, o);
    fillCirc(ctx, -r * 0.92, cy + r * 0.02, s * 0.035, '#C96E6A');
    cheek(ctx, -r * 0.55, cy + r * 0.1, s);
    if (o.awake) { fillEll(ctx, -r * 0.4, -s * 0.02, s * 0.06, s * 0.03, '#B97E3E'); fillEll(ctx, r * 0.3, -s * 0.02, s * 0.06, s * 0.03, '#B97E3E'); }
  },
  kirpi(ctx, s, o) {
    const w = s * 0.92, h = s * 0.5, cy = -h * 0.5;
    // spikes
    ctx.fillStyle = '#6F5D4E';
    ctx.beginPath();
    const n = 13;
    for (let k = 0; k <= n; k++) {
      const a = Math.PI + (k / n) * Math.PI, rr = (k % 2 ? 1.12 : 0.92);
      const px = Math.cos(a) * w * 0.5 * rr + w * 0.06, py = cy + Math.sin(a) * h * 0.95 * rr;
      if (k === 0) ctx.moveTo(px, py + h * 0.4); ctx.lineTo(px, py);
    }
    ctx.lineTo(w * 0.56, 0); ctx.lineTo(-w * 0.4, 0); ctx.closePath(); ctx.fill();
    fillEll(ctx, w * 0.06, cy + h * 0.1, w * 0.46, h * 0.62, '#8A7563');
    for (let k = 0; k < 6; k++) fillEll(ctx, w * (-0.15 + k * 0.08), cy - h * 0.2 + (k % 2) * h * 0.12, w * 0.02, h * 0.12, '#5E4E42', 0.4);
    // face
    ctx.fillStyle = '#E6D2B5';
    ctx.beginPath(); ctx.moveTo(-w * 0.22, cy - h * 0.3); ctx.quadraticCurveTo(-w * 0.62, cy + h * 0.05, -w * 0.58, cy + h * 0.38); ctx.quadraticCurveTo(-w * 0.3, -h * 0.02, -w * 0.12, cy + h * 0.6); ctx.closePath(); ctx.fill();
    fillCirc(ctx, -w * 0.6, cy + h * 0.35, s * 0.04, PAL.ink);
    eye(ctx, -w * 0.33, cy + h * 0.05, s, o);
    cheek(ctx, -w * 0.36, cy + h * 0.32, s);
    if (o.awake) { fillEll(ctx, -w * 0.2, -s * 0.015, s * 0.05, s * 0.025, '#5E4E42'); fillEll(ctx, w * 0.25, -s * 0.015, s * 0.05, s * 0.025, '#5E4E42'); }
  },
  kurbaga(ctx, s, o) {
    const w = s * 0.86, h = s * 0.44, cy = -h * 0.52;
    fillEll(ctx, 0, cy, w * 0.5, h * 0.55, '#86A568');
    fillEll(ctx, 0, cy + h * 0.22, w * 0.36, h * 0.3, '#C3D39A');
    for (const sx of [-1, 1]) {
      fillCirc(ctx, sx * w * 0.24, cy - h * 0.42, s * 0.11, '#86A568');
      if (o.awake && !o.grumpy) { fillCirc(ctx, sx * w * 0.24, cy - h * 0.44, s * 0.07, '#F7F3E6'); fillCirc(ctx, sx * w * 0.24, cy - h * 0.44, s * 0.04, PAL.ink); }
      else eye(ctx, sx * w * 0.24, cy - h * 0.42, s, o);
    }
    ctx.strokeStyle = '#4E6A3E'; ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.beginPath(); ctx.arc(0, cy - h * 0.05, w * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    cheek(ctx, -w * 0.28, cy - h * 0.02, s); cheek(ctx, w * 0.28, cy - h * 0.02, s);
    fillEll(ctx, -w * 0.42, -s * 0.02, s * 0.09, s * 0.035, '#7A9A5D'); fillEll(ctx, w * 0.42, -s * 0.02, s * 0.09, s * 0.035, '#7A9A5D');
  },
  ayi(ctx, s, o) {
    const w = s, h = s * 0.5, cy = -h * 0.5;
    fillEll(ctx, w * 0.1, cy, w * 0.46, h * 0.52, '#8A5B3D');
    fillEll(ctx, w * 0.42, -h * 0.12, w * 0.12, h * 0.15, '#7A4E33');
    // head
    const hx = -w * 0.32, hy = cy - h * 0.12, hr = s * 0.24;
    fillCirc(ctx, hx - hr * 0.6, hy - hr * 0.72, hr * 0.32, '#7A4E33');
    fillCirc(ctx, hx + hr * 0.62, hy - hr * 0.72, hr * 0.32, '#7A4E33');
    fillCirc(ctx, hx - hr * 0.6, hy - hr * 0.72, hr * 0.15, '#C9967A');
    fillCirc(ctx, hx, hy, hr, '#8F5F40');
    fillEll(ctx, hx - hr * 0.3, hy + hr * 0.35, hr * 0.52, hr * 0.38, '#CFA67F');
    fillEll(ctx, hx - hr * 0.42, hy + hr * 0.18, hr * 0.17, hr * 0.12, PAL.ink);
    eye(ctx, hx - hr * 0.2, hy - hr * 0.25, s, o);
    eye(ctx, hx + hr * 0.38, hy - hr * 0.22, s, o);
    cheek(ctx, hx + hr * 0.3, hy + hr * 0.25, s);
    fillEll(ctx, -w * 0.18, -h * 0.08, w * 0.12, h * 0.13, '#7A4E33');
    if (o.snore) fillEll(ctx, hx - hr * 0.3, hy + hr * 0.62, hr * 0.12, hr * (0.08 + 0.06 * Math.abs(Math.sin((o.t || 0) * 5))), '#5A3526');
  },
  porsuk(ctx, s, o) {
    const w = s * 0.92, h = s * 0.46, cy = -h * 0.5;
    fillEll(ctx, w * 0.1, cy, w * 0.46, h * 0.52, '#8E8C87');
    fillEll(ctx, w * 0.1, cy + h * 0.3, w * 0.4, h * 0.22, '#6F6D69');
    const hx = -w * 0.34, hy = cy - h * 0.02;
    ctx.fillStyle = '#F2EFE8';
    ctx.beginPath(); ctx.moveTo(hx + w * 0.2, hy - h * 0.42); ctx.quadraticCurveTo(hx - w * 0.3, hy - h * 0.1, hx - w * 0.24, hy + h * 0.28); ctx.quadraticCurveTo(hx, hy + h * 0.5, hx + w * 0.22, hy + h * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2F2D2B';
    ctx.beginPath(); ctx.moveTo(hx + w * 0.18, hy - h * 0.28); ctx.quadraticCurveTo(hx - w * 0.04, hy - h * 0.12, hx - w * 0.16, hy + h * 0.12); ctx.lineTo(hx - w * 0.1, hy + h * 0.16); ctx.quadraticCurveTo(hx + w * 0.02, hy, hx + w * 0.22, hy - h * 0.12); ctx.closePath(); ctx.fill();
    fillCirc(ctx, hx + w * 0.16, hy - h * 0.38, s * 0.05, '#55524E');
    fillCirc(ctx, hx - w * 0.24, hy + h * 0.26, s * 0.04, PAL.ink);
    ctx.save(); ctx.translate(hx - w * 0.04, hy + h * 0.02);
    if (o.awake && !o.grumpy) { fillCirc(ctx, 0, 0, s * 0.04, '#F2EFE8'); fillCirc(ctx, 0, 0, s * 0.028, PAL.ink); }
    else { ctx.strokeStyle = '#F2EFE8'; ctx.lineWidth = Math.max(1.2, s * 0.026); ctx.beginPath(); ctx.arc(0, -s * 0.01, s * 0.04, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.restore();
    cheek(ctx, hx - w * 0.06, hy + h * 0.32, s);
  },
  yarasa(ctx, s, o) {
    if (o.awake) {
      // flying: wings flap
      const f = Math.sin((o.t || 0) * 14);
      const cy = -s * 0.5;
      ctx.fillStyle = '#4E4250';
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, cy);
        ctx.quadraticCurveTo(sx * s * 0.3, cy - s * (0.25 + f * 0.15), sx * s * 0.5, cy - s * (0.05 + f * 0.2));
        ctx.quadraticCurveTo(sx * s * 0.35, cy + s * 0.05, sx * s * 0.25, cy + s * 0.12);
        ctx.quadraticCurveTo(sx * s * 0.12, cy + s * 0.05, 0, cy + s * 0.1); ctx.fill();
      }
      fillEll(ctx, 0, cy + s * 0.02, s * 0.13, s * 0.16, '#6E5C67');
      ctx.fillStyle = '#6E5C67';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.04, cy - s * 0.1); ctx.lineTo(sx * s * 0.11, cy - s * 0.24); ctx.lineTo(sx * s * 0.12, cy - s * 0.06); ctx.fill(); }
      eye(ctx, -s * 0.05, cy - s * 0.02, s, o); eye(ctx, s * 0.05, cy - s * 0.02, s, o);
      return;
    }
    // hanging upside down from the beam, wrapped in its wings
    const top = o.hangTop != null ? o.hangTop : -s * 0.95;
    ctx.strokeStyle = '#3B3238'; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(-s * 0.05, top); ctx.lineTo(-s * 0.04, top + s * 0.1); ctx.moveTo(s * 0.05, top); ctx.lineTo(s * 0.04, top + s * 0.1); ctx.stroke();
    const cy = top + s * 0.42, sw = 1 + Math.sin((o.t || 0) * 1.6) * 0.02;
    ctx.fillStyle = '#4E4250';
    ctx.beginPath(); ctx.moveTo(0, top + s * 0.08);
    ctx.bezierCurveTo(s * 0.32 * sw, top + s * 0.12, s * 0.3 * sw, cy + s * 0.25, 0, cy + s * 0.3);
    ctx.bezierCurveTo(-s * 0.3 * sw, cy + s * 0.25, -s * 0.32 * sw, top + s * 0.12, 0, top + s * 0.08); ctx.fill();
    ctx.strokeStyle = '#3E333F'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, top + s * 0.12); ctx.lineTo(0, cy + s * 0.2); ctx.stroke();
    // face at the bottom, upside down
    const fy = cy + s * 0.3;
    fillCirc(ctx, 0, fy, s * 0.12, '#6E5C67');
    ctx.fillStyle = '#6E5C67';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.05, fy + s * 0.06); ctx.lineTo(sx * s * 0.11, fy + s * 0.2); ctx.lineTo(sx * s * 0.12, fy + s * 0.02); ctx.fill(); }
    ctx.save(); ctx.translate(0, fy); ctx.scale(1, -1);
    eye(ctx, -s * 0.045, s * 0.0, s, o); eye(ctx, s * 0.045, s * 0.0, s, o);
    ctx.restore();
  },
};

// Size and placement of a guest inside its room.
function guestGeom(sp, I) {
  const s = Math.min(I.w * 0.78, I.h * 1.02) * SP_SCALE[sp];
  const base = I.y + I.h * (sp === 'kurbaga' ? 0.9 : 0.87);
  return { s, x: I.x + I.w * 0.5 + (sp === 'ayi' ? I.w * 0.02 : 0), base };
}

function drawRoomGuest(ctx, save, g, I, t, extra) {
  const sp = g.sp, G = guestGeom(sp, I), s = G.s;
  const cols = PAL.blankets[g.cell % PAL.blankets.length];
  const o = { t, shiver: !g.blanket && SPECIES[sp].blanket && !extra.awake, snore: g.snore > 0, awake: extra.awake, grumpy: extra.grumpy };
  if (sp === 'yarasa') o.hangTop = I.y + I.h * 0.24 + Math.max(3, Math.min(I.w, I.h) * 0.05) - G.base;
  ctx.save();
  if (extra.alpha != null) ctx.globalAlpha = extra.alpha;
  if (extra.stretch) { ctx.translate(G.x, G.base); ctx.scale(1 - extra.stretch * 0.05, 1 + extra.stretch * 0.12); ctx.translate(-G.x, -G.base); }
  if (!g.blanket && SPECIES[sp].blanket && sp !== 'kurbaga') drawFallenBlanket(ctx, I.x + I.w * 0.08, I.y + I.h * 0.9, I.w * 0.3, cols);
  drawAnimal(ctx, sp, G.x, G.base, s, o);
  if (sp === 'kurbaga') {
    fillEll(ctx, G.x, G.base - s * 0.02, s * 0.5, s * 0.08, '#6A5244');
    if (g.blanket) fillEll(ctx, G.x + s * 0.05, G.base - s * 0.2, s * 0.36, s * 0.13, '#6F9150', -0.15);
    else fillEll(ctx, I.x + I.w * 0.18, G.base, s * 0.2, s * 0.06, '#6F9150');
  } else if (g.blanket && SPECIES[sp].blanket && !extra.awake && BLANKET[sp]) {
    const B = BLANKET[sp];
    drawBlanket(ctx, G.x + s * B[0], G.base + 1, s * B[1], s * B[2], cols, Math.sin(t * 1.6 + G.x) * 0.025);
  }
  ctx.restore();
  if (o.shiver) {
    ctx.strokeStyle = PAL.cold; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const yy = G.base - s * (0.3 + k * 0.15), xx = G.x + s * 0.48 + Math.sin(t * 30 + k) * 1.5;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + s * 0.08, yy - s * 0.02); ctx.stroke();
    }
  }
}

// ---- small sprites: woodpecker, helpers ----------------------------------------

function drawWoodpecker(ctx, x, y, s, t, side) {
  ctx.save(); ctx.translate(x, y); ctx.scale(side, 1);
  const peck = Math.max(0, Math.sin(t * 22)) > 0.6;
  fillEll(ctx, s * 0.25, s * 0.15, s * 0.22, s * 0.4, '#2F2D2B', 0.2);
  fillEll(ctx, s * 0.3, s * 0.25, s * 0.1, s * 0.22, '#F1ECE2', 0.2);
  ctx.fillStyle = '#2F2D2B'; ctx.beginPath(); ctx.moveTo(s * 0.18, s * 0.45); ctx.lineTo(s * 0.12, s * 0.8); ctx.lineTo(s * 0.3, s * 0.5); ctx.fill();
  ctx.save(); ctx.translate(s * 0.2, -s * 0.22); ctx.rotate(peck ? -0.35 : 0);
  fillCirc(ctx, 0, 0, s * 0.18, '#2F2D2B');
  fillCirc(ctx, s * 0.02, -s * 0.06, s * 0.12, '#C2453A');
  fillEll(ctx, -s * 0.02, s * 0.05, s * 0.1, s * 0.06, '#F1ECE2');
  ctx.fillStyle = '#C9A35A'; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.02); ctx.lineTo(-s * 0.42, s * 0.02); ctx.lineTo(-s * 0.15, s * 0.06); ctx.fill();
  fillCirc(ctx, -s * 0.05, -s * 0.03, s * 0.03, '#fff');
  ctx.restore();
  ctx.restore();
}

function drawSquirrel(ctx, x, base, s, t, moving, dir) {
  ctx.save(); ctx.translate(x, base); if (dir < 0) ctx.scale(-1, 1);
  const hop = moving ? Math.abs(Math.sin(t * 14)) * s * 0.12 : 0;
  ctx.translate(0, -hop);
  ctx.strokeStyle = '#B4683A'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.15); ctx.quadraticCurveTo(-s * 0.65, -s * 0.4, -s * 0.35, -s * 0.85); ctx.stroke();
  fillEll(ctx, 0, -s * 0.25, s * 0.22, s * 0.25, '#C27A43');
  fillEll(ctx, s * 0.06, -s * 0.18, s * 0.11, s * 0.14, '#EBCFA8');
  fillCirc(ctx, s * 0.15, -s * 0.55, s * 0.16, '#C27A43');
  ctx.fillStyle = '#C27A43'; ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.66); ctx.lineTo(s * 0.08, -s * 0.84); ctx.lineTo(s * 0.17, -s * 0.68); ctx.fill();
  fillCirc(ctx, s * 0.21, -s * 0.58, s * 0.03, PAL.ink);
  // little white cap: housekeeper
  ctx.fillStyle = '#F1ECE2'; rrPath(ctx, s * 0.02, -s * 0.76, s * 0.24, s * 0.07, 2); ctx.fill();
  ctx.restore();
}

function drawOwl(ctx, x, y, s, t, flying) {
  ctx.save(); ctx.translate(x, y);
  if (flying) {
    const f = Math.sin(t * 16);
    ctx.fillStyle = '#7A6552';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.quadraticCurveTo(sx * s * 0.5, -s * (0.6 + f * 0.25), sx * s * 0.75, -s * (0.25 + f * 0.25)); ctx.quadraticCurveTo(sx * s * 0.4, -s * 0.1, 0, -s * 0.12); ctx.fill(); }
  }
  fillEll(ctx, 0, -s * 0.3, s * 0.24, s * 0.3, '#8A7460');
  fillEll(ctx, 0, -s * 0.22, s * 0.15, s * 0.18, '#D9C7A8');
  ctx.fillStyle = '#8A7460';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.08, -s * 0.52); ctx.lineTo(sx * s * 0.2, -s * 0.66); ctx.lineTo(sx * s * 0.22, -s * 0.48); ctx.fill(); }
  for (const sx of [-1, 1]) { fillCirc(ctx, sx * s * 0.09, -s * 0.42, s * 0.075, '#F4EDDC'); fillCirc(ctx, sx * s * 0.09, -s * 0.42, s * 0.04, PAL.ink); }
  ctx.fillStyle = PAL.mustard; ctx.beginPath(); ctx.moveTo(-s * 0.03, -s * 0.36); ctx.lineTo(s * 0.03, -s * 0.36); ctx.lineTo(0, -s * 0.3); ctx.fill();
  // guard hat
  ctx.fillStyle = '#4E6E8A'; rrPath(ctx, -s * 0.16, -s * 0.66, s * 0.32, s * 0.08, 2); ctx.fill();
  ctx.restore();
}

function drawDeer(ctx, x, base, s, t, busy) {
  ctx.save(); ctx.translate(x, base);
  const nod = busy ? Math.sin(Math.min(1, t * 3) * Math.PI) * 0.25 : Math.sin(t * 1.2) * 0.03;
  ctx.fillStyle = '#7A5A43';
  for (const lx of [-0.22, -0.1, 0.16, 0.26]) ctx.fillRect(lx * s, -s * 0.36, s * 0.05, s * 0.36);
  fillEll(ctx, 0, -s * 0.45, s * 0.33, s * 0.17, '#8E6B50');
  fillEll(ctx, 0, -s * 0.38, s * 0.24, s * 0.08, '#C9B49A');
  ctx.save(); ctx.translate(-s * 0.26, -s * 0.55); ctx.rotate(nod);
  fillEll(ctx, -s * 0.02, -s * 0.12, s * 0.07, s * 0.16, '#8E6B50', -0.3);
  ctx.translate(-s * 0.08, -s * 0.26);
  ctx.strokeStyle = '#C8B08F'; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * s * 0.03, -s * 0.06); ctx.lineTo(sx * s * 0.1, -s * 0.24); ctx.lineTo(sx * s * 0.18, -s * 0.3);
    ctx.moveTo(sx * s * 0.07, -s * 0.16); ctx.lineTo(sx * s * 0.15, -s * 0.18); ctx.stroke();
  }
  fillEll(ctx, -s * 0.05, 0, s * 0.11, s * 0.08, '#8E6B50');
  fillCirc(ctx, -s * 0.15, s * 0.01, s * 0.03, '#C9523F');
  fillCirc(ctx, -s * 0.03, -s * 0.03, s * 0.022, PAL.ink);
  ctx.restore();
  // scarf
  ctx.fillStyle = PAL.falu; rrPath(ctx, -s * 0.34, -s * 0.6, s * 0.14, s * 0.07, 2); ctx.fill();
  ctx.restore();
}

// ---- icons and effects --------------------------------------------------------

function drawNut(ctx, x, y, r) {
  fillEll(ctx, x, y + r * 0.15, r * 0.85, r * 0.8, PAL.nut);
  ctx.fillStyle = PAL.nutCap;
  ctx.beginPath(); ctx.ellipse(x, y - r * 0.2, r * 0.9, r * 0.5, 0, Math.PI, 0); ctx.fill();
  fillEll(ctx, x - r * 0.3, y + r * 0.2, r * 0.18, r * 0.28, 'rgba(255,255,255,0.25)');
}
function drawHeart(ctx, x, y, r, col) {
  ctx.fillStyle = col || PAL.heart;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.fill();
}
function drawLog(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.fillStyle = '#8C6440'; rrPath(ctx, -r, -r * 0.4, r * 2, r * 0.8, r * 0.4); ctx.fill();
  fillEll(ctx, r * 0.85, 0, r * 0.25, r * 0.38, '#C8A276');
  ctx.restore();
}

// Alert bubble above a room or the cabin: tells a kid where to tap.
function drawBubble(ctx, x, y, s, kind, t, urgent) {
  const p = 1 + Math.sin(t * 6) * (urgent ? 0.08 : 0.04);
  const r = s * p;
  ctx.save();
  ctx.fillStyle = 'rgba(44,42,39,0.18)'; circ(ctx, x + 1, y + 2, r); ctx.fill();
  ctx.fillStyle = '#FBF8F2'; circ(ctx, x, y, r); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.8); ctx.lineTo(x, y + r * 1.35); ctx.lineTo(x + r * 0.3, y + r * 0.8); ctx.fill();
  if (urgent) { ctx.strokeStyle = PAL.bad; ctx.lineWidth = 2; circ(ctx, x, y, r); ctx.stroke(); }
  if (kind === 'blanket') {
    drawBlanket(ctx, x, y + r * 0.42, r * 0.62, r * 0.72, PAL.blankets[0], 0);
    ctx.strokeStyle = PAL.cold; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * (0.1 + k * 0.3)); ctx.lineTo(x + r * 0.72, y - r * (0.16 + k * 0.3)); ctx.stroke(); }
  } else if (kind === 'snore') {
    ctx.fillStyle = PAL.ink; ctx.font = `700 ${Math.round(r * 0.95)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Zzz', x, y + r * 0.05);
  } else if (kind === 'log') {
    drawLog(ctx, x, y + r * 0.05, r * 0.48, -0.3);
    ctx.fillStyle = PAL.cold; ctx.font = `700 ${Math.round(r * 0.7)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  } else if (kind === 'hot') {
    fillCirc(ctx, x, y, r * 0.42, '#E5A13F');
    ctx.strokeStyle = '#E5A13F'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); ctx.stroke(); }
  }
  ctx.restore();
}

function drawSleepBar(ctx, I, sleep) {
  const bw = I.w * 0.56, bh = Math.max(4, I.h * 0.05), bx = I.x + (I.w - bw) / 2 + I.w * 0.04, by = I.y + I.h + Math.max(2, I.h * 0.02);
  ctx.fillStyle = 'rgba(44,42,39,0.25)'; rrPath(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
  const col = sleep >= 55 ? PAL.good : sleep >= 30 ? PAL.warn : PAL.bad;
  ctx.fillStyle = col; rrPath(ctx, bx, by, Math.max(bh, bw * sleep / 100), bh, bh / 2); ctx.fill();
  // moon
  const mx = bx - bh * 1.6, my = by + bh / 2, mr = bh * 1.05;
  fillCirc(ctx, mx, my, mr, '#F3E2B0');
  fillCirc(ctx, mx + mr * 0.45, my - mr * 0.2, mr * 0.85, PAL.soil[Math.min(ROWS - 1, cellRC(cellAt(I.x + 2, I.y + 2)).r)]);
}

const fx = [];
function addFx(o) { fx.push(Object.assign({ t: 0, life: 1 }, o)); }
function updateFx(dt) {
  for (let k = fx.length - 1; k >= 0; k--) {
    const f = fx[k];
    f.t += dt;
    if (f.update) f.update(f, dt);
    else { f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; if (f.g) f.vy += f.g * dt; }
    if (f.t >= f.life) { fx.splice(k, 1); if (f.done) f.done(f); }
  }
}
function drawFx(ctx) {
  for (const f of fx) {
    const p = f.t / f.life, a = f.fade === false ? 1 : 1 - p * p;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    switch (f.kind) {
      case 'z': ctx.fillStyle = f.col || 'rgba(44,42,39,0.55)'; ctx.font = `600 ${Math.round(f.size * (0.7 + p * 0.5))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('z', f.x + Math.sin(f.t * 3) * 3, f.y); break;
      case 'Z': ctx.fillStyle = f.col || PAL.ink; ctx.font = `700 ${Math.round(f.size * (0.8 + p * 0.6))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Z', f.x + Math.sin(f.t * 5) * 4, f.y); break;
      case 'text': ctx.fillStyle = f.col || PAL.ink; ctx.font = `700 ${Math.round(f.size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.text, f.x, f.y); break;
      case 'puff': fillCirc(ctx, f.x, f.y, f.size * (0.4 + p), f.col || 'rgba(255,255,255,0.8)'); break;
      case 'heart': drawHeart(ctx, f.x, f.y, f.size * (p < 0.15 ? p / 0.15 : 1)); break;
      case 'nut': drawNut(ctx, f.x, f.y, f.size); break;
      case 'log': drawLog(ctx, f.x, f.y, f.size, f.t * 8); break;
      case 'ring': ctx.strokeStyle = f.col || 'rgba(44,42,39,0.4)'; ctx.lineWidth = 2; circ(ctx, f.x, f.y, f.size * (0.3 + p)); ctx.stroke(); break;
      case 'cloud': {
        const s = f.size;
        fillCirc(ctx, f.x - s * 0.4, f.y, s * 0.4, '#5E5A57'); fillCirc(ctx, f.x + s * 0.1, f.y - s * 0.15, s * 0.5, '#5E5A57'); fillCirc(ctx, f.x + s * 0.55, f.y + s * 0.02, s * 0.35, '#5E5A57');
        ctx.strokeStyle = '#F3E2B0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x - s * 0.1, f.y + s * 0.3); ctx.lineTo(f.x + s * 0.1, f.y + s * 0.6); ctx.lineTo(f.x, f.y + s * 0.6); ctx.lineTo(f.x + s * 0.18, f.y + s * 0.9); ctx.stroke();
        break;
      }
      case 'guest': drawAnimal(ctx, f.sp, f.x, f.y, f.size, { awake: true, grumpy: f.grumpy, t: f.t, walk: true, flip: f.flip }); break;
    }
    ctx.restore();
  }
}

// Paint one species to a small canvas for menus.
function animalIcon(sp, size, awake) {
  const cv = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  if (sp === 'yarasa' && !awake) drawAnimal(c, sp, size / 2, size * 0.95, size * 0.8, { hangTop: -size * 0.85 });
  else drawAnimal(c, sp, size / 2, size * 0.86, size * (sp === 'ayi' ? 0.92 : 0.84), { awake: !!awake });
  return cv;
}
function spriteIcon(kind, size) {
  const cv = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  if (kind === 'sincap') drawSquirrel(c, size * 0.55, size * 0.92, size * 0.95, 0, false, 1);
  else if (kind === 'baykus') drawOwl(c, size / 2, size * 0.98, size * 1.25, 0, false);
  else if (kind === 'geyik') drawDeer(c, size * 0.6, size * 0.98, size * 0.95, 0, false);
  return cv;
}

// ---- winter fun: food, dreams, falling nuts, the northern lights -------------

function drawFood(ctx, item, x, y, r) {
  ctx.save();
  switch (item) {
    case 'findik': drawNut(ctx, x, y, r * 0.78); break;
    case 'bal': {
      ctx.fillStyle = '#D9A13A'; rrPath(ctx, x - r * 0.58, y - r * 0.42, r * 1.16, r * 1.12, r * 0.3); ctx.fill();
      ctx.fillStyle = '#7C5030'; rrPath(ctx, x - r * 0.64, y - r * 0.68, r * 1.28, r * 0.32, r * 0.1); ctx.fill();
      ctx.fillStyle = '#F4EAD2'; rrPath(ctx, x - r * 0.42, y - r * 0.12, r * 0.84, r * 0.4, r * 0.08); ctx.fill();
      ctx.fillStyle = '#E9B44C'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.36, r * 0.12, 0, Math.PI); ctx.fill();
      break;
    }
    case 'balik': {
      ctx.fillStyle = '#6F95B5';
      ctx.beginPath(); ctx.moveTo(x + r * 0.45, y); ctx.lineTo(x + r * 0.9, y - r * 0.4); ctx.lineTo(x + r * 0.9, y + r * 0.4); ctx.closePath(); ctx.fill();
      fillEll(ctx, x - r * 0.08, y, r * 0.62, r * 0.36, '#6F95B5');
      fillEll(ctx, x - r * 0.12, y + r * 0.12, r * 0.42, r * 0.14, '#BFD3E0');
      fillCirc(ctx, x - r * 0.42, y - r * 0.08, r * 0.08, PAL.ink);
      break;
    }
    case 'bocek': {
      ctx.strokeStyle = '#3A2A22'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.lineCap = 'round';
      for (const s of [-1, 1]) for (const k of [-0.25, 0.05, 0.35]) { ctx.beginPath(); ctx.moveTo(x, y + r * k); ctx.lineTo(x + s * r * 0.62, y + r * (k + 0.12)); ctx.stroke(); }
      fillEll(ctx, x, y + r * 0.08, r * 0.46, r * 0.56, '#7A4A34');
      fillCirc(ctx, x, y - r * 0.5, r * 0.24, '#3A2A22');
      ctx.strokeStyle = '#5A3626'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.28); ctx.lineTo(x, y + r * 0.62); ctx.stroke();
      fillEll(ctx, x - r * 0.18, y - r * 0.06, r * 0.1, r * 0.16, 'rgba(255,255,255,0.3)');
      break;
    }
    case 'solucan': {
      ctx.strokeStyle = '#D98C86'; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.1);
      ctx.bezierCurveTo(x - r * 0.4, y - r * 0.5, x - r * 0.1, y + r * 0.5, x + r * 0.2, y - r * 0.05);
      ctx.bezierCurveTo(x + r * 0.35, y - r * 0.3, x + r * 0.55, y - r * 0.25, x + r * 0.7, y - r * 0.15); ctx.stroke();
      fillCirc(ctx, x + r * 0.64, y - r * 0.2, r * 0.05, PAL.ink);
      break;
    }
    case 'sinek': {
      fillEll(ctx, x - r * 0.22, y - r * 0.3, r * 0.34, r * 0.22, 'rgba(190,215,230,0.85)', -0.5);
      fillEll(ctx, x + r * 0.22, y - r * 0.3, r * 0.34, r * 0.22, 'rgba(190,215,230,0.85)', 0.5);
      fillEll(ctx, x, y + r * 0.08, r * 0.24, r * 0.38, '#3A3A3E');
      fillCirc(ctx, x, y - r * 0.34, r * 0.2, '#3A3A3E');
      fillCirc(ctx, x - r * 0.1, y - r * 0.38, r * 0.08, '#C2553D'); fillCirc(ctx, x + r * 0.1, y - r * 0.38, r * 0.08, '#C2553D');
      break;
    }
    case 'guve': {
      for (const s of [-1, 1]) {
        fillEll(ctx, x + s * r * 0.38, y - r * 0.12, r * 0.42, r * 0.34, '#D8C7A3', s * 0.4);
        fillEll(ctx, x + s * r * 0.3, y + r * 0.3, r * 0.26, r * 0.22, '#C9B48C', -s * 0.4);
        fillCirc(ctx, x + s * r * 0.4, y - r * 0.12, r * 0.09, '#8C7556');
      }
      fillEll(ctx, x, y + r * 0.05, r * 0.12, r * 0.42, '#7C6448');
      ctx.strokeStyle = '#7C6448'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.moveTo(x - r * 0.05, y - r * 0.35); ctx.lineTo(x - r * 0.25, y - r * 0.7); ctx.moveTo(x + r * 0.05, y - r * 0.35); ctx.lineTo(x + r * 0.25, y - r * 0.7); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// A cloud-shaped dream bubble with the dreamed food inside.
function drawDreamBubble(ctx, x, y, r, item, t, left, toX, toY) {
  const blink = left < 2.5 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 6)) : 1;
  const bob = Math.sin(t * 2) * r * 0.06;
  ctx.save();
  ctx.globalAlpha = blink;
  for (let k = 1; k <= 2; k++) fillCirc(ctx, lerp(x, toX, 0.35 + k * 0.22), lerp(y + r * 0.8, toY, 0.35 + k * 0.22), r * (0.2 - k * 0.05), 'rgba(250,247,255,0.95)');
  ctx.fillStyle = 'rgba(250,247,255,0.97)';
  for (const [dx, dy, rr] of [[-0.55, 0.15, 0.55], [0.55, 0.15, 0.55], [0, -0.3, 0.65], [-0.25, 0.35, 0.5], [0.3, 0.38, 0.5]]) { circ(ctx, x + dx * r, y + dy * r + bob, rr * r); ctx.fill(); }
  ctx.strokeStyle = 'rgba(150,130,190,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y + bob, r * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(left / TUNE.dreamLen)); ctx.stroke();
  drawFood(ctx, item, x, y + r * 0.05 + bob, r * 0.62);
  ctx.restore();
}

function dropPos(d, t) {
  const y0 = LAY.top + 12, y1 = LAY.groundY - 8;
  return { x: d.x * LAY.w + Math.sin(t * 1.7 + d.ph) * Math.min(18, LAY.w * 0.03), y: lerp(y0, y1, d.p) };
}
function dropR() { return Math.max(9, Math.min(15, LAY.cellW * 0.12)); }
function drawDrop(ctx, d, t) {
  const p = dropPos(d, t), r = dropR();
  ctx.save();
  ctx.globalAlpha = d.p > 0.9 ? Math.max(0, 1 - (d.p - 0.9) / 0.1) : 1;
  fillCirc(ctx, p.x, p.y, r * 1.7, d.gold ? 'rgba(247,205,107,0.32)' : 'rgba(255,245,225,0.22)');
  // a little leaf it rides on
  ctx.save(); ctx.translate(p.x, p.y - r * 1.05); ctx.rotate(Math.sin(t * 1.7 + d.ph) * 0.35);
  fillEll(ctx, 0, 0, r * 0.95, r * 0.3, d.gold ? '#E9B44C' : '#9DB37A');
  ctx.strokeStyle = 'rgba(60,50,30,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
  ctx.restore();
  if (d.gold) {
    fillEll(ctx, p.x, p.y + r * 0.15, r * 0.85, r * 0.8, '#E0A93A');
    ctx.fillStyle = '#B9822C'; ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.2, r * 0.9, r * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#FBE7A6'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const a = t * 2 + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 1.2); ctx.lineTo(p.x + Math.cos(a) * r * 1.6, p.y + Math.sin(a) * r * 1.6); ctx.stroke(); }
  } else drawNut(ctx, p.x, p.y, r);
  ctx.restore();
}

// The northern-lights bar under the HUD: fills while everybody sleeps well.
function drawPeaceMeter(ctx, peace, aurora, t) {
  const w = Math.min(230, LAY.w * 0.5), h = 10, x = LAY.w / 2 - w / 2 + 12, y = LAY.inset.top + 70;
  ctx.save();
  // icon: three little waves of light
  ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
  const cols = ['#8FE0B8', '#7CC9D6', '#B7A3E8'];
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = cols[k]; ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const xx = x - 26 + i * 2.2, yy = y + 1 + k * 4 + Math.sin(i * 0.9 + t * 3 + k) * 1.6; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(15,22,38,0.55)'; rrPath(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.fill();
  const v = aurora > 0 ? aurora / TUNE.auroraLen : peace / 100;
  if (v > 0.01) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#7FD6A8'); g.addColorStop(0.6, '#7CC9D6'); g.addColorStop(1, '#B7A3E8');
    ctx.fillStyle = g; rrPath(ctx, x, y, Math.max(h, w * v), h, h / 2); ctx.fill();
    if (aurora > 0 || v > 0.8) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 8); fillCirc(ctx, x + w * v, y + h / 2, h * 1.1, '#FFFFFF'); }
  }
  ctx.restore();
}

function trayLayout(n) {
  const r = Math.max(16, Math.min(24, (LAY.w - 48) / (n * 2.5)));
  const gap = r * 2.5, w = n * gap + r * 0.5;
  const cy = LAY.h - LAY.inset.bottom - 12 - r * 1.3;
  const x0 = LAY.w / 2 - w / 2 + r * 0.25 + gap / 2;
  return { r, cy, w, slots: Array.from({ length: n }, (_, k) => ({ x: x0 + k * gap, y: cy })) };
}
function drawTray(ctx, foods, t, wanted, selected) {
  if (!foods.length) return;
  const T = trayLayout(foods.length);
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,30,0.18)'; rrPath(ctx, LAY.w / 2 - T.w / 2 + 2, T.cy - T.r * 1.3 + 3, T.w, T.r * 2.6, T.r * 1.3); ctx.fill();
  ctx.fillStyle = 'rgba(251,248,242,0.94)'; rrPath(ctx, LAY.w / 2 - T.w / 2, T.cy - T.r * 1.3, T.w, T.r * 2.6, T.r * 1.3); ctx.fill();
  foods.forEach((f, k) => {
    const s = T.slots[k], want = wanted.has(f);
    const pulse = want ? 1 + Math.sin(t * 6) * 0.06 : 1;
    fillCirc(ctx, s.x, s.y, T.r * pulse, want ? '#EDE6F7' : '#F2ECE1');
    if (want || selected === f) { ctx.strokeStyle = selected === f ? PAL.good : 'rgba(150,130,190,0.8)'; ctx.lineWidth = selected === f ? 3 : 2; circ(ctx, s.x, s.y, T.r * pulse); ctx.stroke(); }
    drawFood(ctx, f, s.x, s.y, T.r * 0.72);
  });
  ctx.restore();
}
