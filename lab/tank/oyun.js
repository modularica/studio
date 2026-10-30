// Tank Arenası: the rules, shared by the page (lab/tank/index.html) and the room server
// (fish/sunucu/src/tank-oda.js imports this file). Keep it free of DOM and Node APIs.
//
// The arena is a rectangle (0..w, 0..h) with wooden walls. Every tank takes CAN hits; each hit
// is one point for the shooter. A painted-out tank comes back after DOGMA seconds with a short
// shield. A round lasts TUR seconds.

// Bump when the map generator or the rules change in a way the page and the server must agree on.
export const SURUM = 1;

export const K = {
  TUR: 180,          // seconds in a round
  CAN: 3,            // hits a tank takes before it is painted out
  R: 22,             // tank radius
  HIZ: 200,          // top speed (units a second)
  IVME: 10,          // how fast speed follows the stick (1/s)
  GOVDE_DONUS: 9,    // body turn speed (rad/s)
  TARET_DONUS: 7,    // a bot's turret turn speed (rad/s); players aim instantly
  NAMLU: 30,         // barrel length: a shot starts this far from the tank's centre
  MERMI_HIZ: 560,
  MERMI_R: 6,
  MERMI_OMUR: 1.4,   // seconds a shot flies (range ≈ 780)
  BEKLEME: 0.5,      // seconds between shots
  DOGMA: 3,          // seconds until a painted-out tank comes back
  KORUMA: 2,         // seconds of shield after coming back (firing ends it)
  EN_COK: 8,         // tanks in an arena
  HUCRE: 24          // path-finding grid cell
};

export const ZORLUK_ADI = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
export const BOT_ADLARI = ['Paletli', 'Fırtına', 'Tosun', 'Zıpzıp', 'Bulut', 'Pıtırcık', 'Kaplan', 'Mermer', 'Şimşek', 'Fıstık'];
export const RENKLER = ['#e4572e', '#2e86ab', '#f3a712', '#6a994e', '#8e5fbf', '#e07a9b', '#2a9d8f', '#5c6b7a', '#9c6644', '#1d3557', '#c6d63a', '#f2efe6'];

// n bot colours, each as far as possible from the colours already in the arena.
export function renkSec(kullanilan, n) {
  const rgb = h => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  const uzak = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const var_ = kullanilan.filter(r => /^#[0-9a-f]{6}$/i.test(r || ''));
  const out = [];
  for (let i = 0; i < n; i++) {
    let en = null, ep = -1;
    for (const r of RENKLER) {
      if (out.includes(r)) continue;
      const d = Math.min(1e9, ...var_.concat(out).map(k => uzak(k, r)));
      if (d > ep) { ep = d; en = r; }
    }
    out.push(en || RENKLER[i % RENKLER.length]);
  }
  return out;
}

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const aci = a => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
export function don(a, hedef, hiz) { return aci(a + clamp(aci(hedef - a), -hiz, hiz)); }
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

export function rastgele(tohum) {
  let s = tohum >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- the map ---------- */

// Arena size for n tanks.
export function boyut(n) {
  return n <= 2 ? [1000, 740] : n <= 4 ? [1240, 900] : n <= 6 ? [1460, 1060] : [1680, 1200];
}

// Spawn points, far apart first: corners, then the middles of the sides.
function dogmaNoktalari(w, h) {
  const p = 84;
  return [[p, p], [w - p, h - p], [w - p, p], [p, h - p], [w / 2, p], [w / 2, h - p], [p, h / 2], [w - p, h / 2]];
}

function kutuMesafe(a, b) {
  const dx = Math.max(0, a[0] - (b[0] + b[2]), b[0] - (a[0] + a[2]));
  const dy = Math.max(0, a[1] - (b[1] + b[3]), b[1] - (a[1] + a[3]));
  return Math.hypot(dx, dy);
}
function noktaKutu(x, y, d) {
  const cx = clamp(x, d[0], d[0] + d[2]), cy = clamp(y, d[1], d[1] + d[3]);
  return Math.hypot(x - cx, y - cy);
}

// A seeded, four-way symmetric arena (fair for everyone). Pieces are kept at least BOSLUK apart
// and away from the edges, so a tank can always drive between them and every spot is reachable.
const KALIN = 34, BOSLUK = 74, KENAR = 84;
function haritaDene(w, h, rnd) {
  const yw = w / 2, yh = h / 2, dogma = dogmaNoktalari(w, h);
  const parcalar = [];  // pieces in the top-left quarter (each a list of rects)
  const sigar = p => p.every(d => d[0] >= KENAR && d[1] >= KENAR && d[0] + d[2] <= yw - BOSLUK / 2 && d[1] + d[3] <= yh - BOSLUK / 2);
  const uzak = p => p.every(d => dogma.every(s => noktaKutu(s[0], s[1], d) > 96)) &&
    parcalar.every(q => q.every(e => p.every(d => kutuMesafe(d, e) >= BOSLUK)));
  // the middle: nothing, a block or a plus
  const orta = [];
  const tur = rnd();
  if (tur < .35) { const s = 70 + rnd() * 30; orta.push([yw - s / 2, yh - s / 2, s, s]); }
  else if (tur < .7) {
    const a = 150 + rnd() * 90, b = 110 + rnd() * 70;
    orta.push([yw - a / 2, yh - KALIN / 2, a, KALIN], [yw - KALIN / 2, yh - b / 2, KALIN, b]);
  }
  const ortaUzak = p => orta.every(e => p.every(d => {
    // the quarter's piece and its three mirrors must all keep their distance from the middle
    const ay = [d, [w - d[0] - d[2], d[1], d[2], d[3]], [d[0], h - d[1] - d[3], d[2], d[3]], [w - d[0] - d[2], h - d[1] - d[3], d[2], d[3]]];
    return ay.every(x => kutuMesafe(x, e) >= BOSLUK);
  }));
  const hedef = 3 + Math.round((w * h) / (1000 * 740) * 1.4);
  for (let t = 0; t < 260 && parcalar.length < hedef; t++) {
    const x = KENAR + rnd() * (yw - KENAR), y = KENAR + rnd() * (yh - KENAR), k = rnd();
    let p;
    if (k < .38) { const L = 110 + rnd() * 130; p = [[x, y, L, KALIN]]; }
    else if (k < .7) { const L = 110 + rnd() * 110; p = [[x, y, KALIN, L]]; }
    else if (k < .88) {
      const a = 100 + rnd() * 90, b = 90 + rnd() * 80, sag = rnd() < .5, alt = rnd() < .5;
      p = [[x, alt ? y + b - KALIN : y, a, KALIN], [sag ? x + a - KALIN : x, y, KALIN, b]];
    } else { const s = 56 + rnd() * 28; p = [[x, y, s, s]]; }
    if (sigar(p) && uzak(p) && ortaUzak(p)) parcalar.push(p);
  }
  if (parcalar.length < (w * h < 1e6 ? 2 : 3)) return null;
  const duvar = [];
  for (const p of parcalar) for (const d of p) {
    duvar.push(d, [w - d[0] - d[2], d[1], d[2], d[3]], [d[0], h - d[1] - d[3], d[2], d[3]], [w - d[0] - d[2], h - d[1] - d[3], d[2], d[3]]);
  }
  duvar.push(...orta);
  return { w, h, duvar: duvar.map(d => d.map(v => Math.round(v))), dogma };
}

export function harita(n, tohum) {
  const [w, h] = boyut(n);
  let m = null;
  for (let t = 0; t < 40 && !m; t++) m = haritaDene(w, h, rastgele((tohum >>> 0) + t * 7919));
  if (!m) m = { w, h, duvar: [], dogma: dogmaNoktalari(w, h) };
  m.tohum = tohum >>> 0;
  izgaraKur(m);
  return m;
}

// Which path-finding cells a tank's centre can be in.
function izgaraKur(m) {
  const H = K.HUCRE, gw = Math.ceil(m.w / H), gh = Math.ceil(m.h / H), bos = new Uint8Array(gw * gh), pay = K.R + 1;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = (i + .5) * H, y = (j + .5) * H;
    let ok = x > pay && y > pay && x < m.w - pay && y < m.h - pay;
    if (ok) for (const d of m.duvar) if (noktaKutu(x, y, d) < pay) { ok = false; break; }
    bos[j * gw + i] = ok ? 1 : 0;
  }
  m.izgara = { gw, gh, bos };
}

/* ---------- geometry ---------- */

// Pushes a tank (circle of radius K.R) out of the walls and back inside the arena.
export function itDuvar(t, m) {
  const R = K.R;
  for (let gec = 0; gec < 2; gec++) {
    for (const d of m.duvar) {
      if (t.x < d[0] - R || t.x > d[0] + d[2] + R || t.y < d[1] - R || t.y > d[1] + d[3] + R) continue;
      const cx = clamp(t.x, d[0], d[0] + d[2]), cy = clamp(t.y, d[1], d[1] + d[3]);
      const dx = t.x - cx, dy = t.y - cy, q = dx * dx + dy * dy;
      if (q >= R * R) continue;
      if (q > 1e-6) { const dd = Math.sqrt(q); t.x = cx + dx / dd * R; t.y = cy + dy / dd * R; }
      else {
        const l = t.x - d[0], r = d[0] + d[2] - t.x, u = t.y - d[1], b = d[1] + d[3] - t.y, en = Math.min(l, r, u, b);
        if (en === l) t.x = d[0] - R; else if (en === r) t.x = d[0] + d[2] + R; else if (en === u) t.y = d[1] - R; else t.y = d[1] + d[3] + R;
      }
    }
  }
  t.x = clamp(t.x, R, m.w - R); t.y = clamp(t.y, R, m.h - R);
}

export function duvardaMi(x, y, m, r) {
  if (x < r || y < r || x > m.w - r || y > m.h - r) return true;
  for (const d of m.duvar) if (noktaKutu(x, y, d) < r) return true;
  return false;
}

function kesitKutu(x0, y0, dx, dy, ax, ay, bx, by) {
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < ax || x0 > bx) return 2; }
  else {
    let a = (ax - x0) / dx, b = (bx - x0) / dx;
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return 2;
  }
  if (Math.abs(dy) < 1e-9) { if (y0 < ay || y0 > by) return 2; }
  else {
    let a = (ay - y0) / dy, b = (by - y0) / dy;
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return 2;
  }
  return t0;
}
function sinirdan(p, d, lo, hi) {
  if (p < lo || p > hi) return 0;
  if (d < 0) { const t = (lo - p) / d; return t <= 1 ? t : 2; }
  if (d > 0) { const t = (hi - p) / d; return t <= 1 ? t : 2; }
  return 2;
}

// First moment (0..1) a circle of radius r moving from (x0,y0) to (x1,y1) touches a wall or
// the arena's edge; 2 if it doesn't.
export function engel(m, x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0;
  let t = Math.min(sinirdan(x0, dx, r, m.w - r), sinirdan(y0, dy, r, m.h - r));
  const minx = Math.min(x0, x1) - r, maxx = Math.max(x0, x1) + r, miny = Math.min(y0, y1) - r, maxy = Math.max(y0, y1) + r;
  for (const d of m.duvar) {
    if (d[0] > maxx || d[0] + d[2] < minx || d[1] > maxy || d[1] + d[3] < miny) continue;
    const k = kesitKutu(x0, y0, dx, dy, d[0] - r, d[1] - r, d[0] + d[2] + r, d[1] + d[3] + r);
    if (k < t) t = k;
  }
  return t;
}
export const gorur = (m, x0, y0, x1, y1, r) => engel(m, x0, y0, x1, y1, r == null ? K.MERMI_R : r) > 1;

// First moment (0..1) a point moving by (dx,dy) from (x0,y0) comes within rr of (cx,cy); 2 if never.
export function cembereCarp(x0, y0, dx, dy, cx, cy, rr) {
  const fx = x0 - cx, fy = y0 - cy, c = fx * fx + fy * fy - rr * rr;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return 2;
  const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
  if (disc < 0) return 2;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : 2;
}

/* ---------- moving ---------- */

export function yeniTank(o) {
  return {
    no: o.no, ad: o.ad, renk: o.renk, bot: o.bot || 0,
    x: 0, y: 0, vx: 0, vy: 0, g: 0, tr: 0, can: K.CAN, durum: 'yok', olumT: 0, koruma: 0, bekleme: 0,
    puan: 0, boyadi: 0, boyandi: 0, hayat: 0, iz: 0, seq: 0, uzak: false, rapor: 0, kim: 0,
    girdi: { mx: 0, my: 0, nisan: null, ates: false }, ai: null
  };
}

// Drives a tank with a stick (mx, my in -1..1). The body turns to the way it moves; a tank can
// also back up, so the nearer end of the body leads.
export function sur(t, mx, my, dt, m, carpan) {
  let mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
  const hiz = K.HIZ * (carpan || 1), k = 1 - Math.exp(-K.IVME * dt);
  t.vx += (mx * hiz - t.vx) * k; t.vy += (my * hiz - t.vy) * k;
  const ox = t.x, oy = t.y;
  t.x += t.vx * dt; t.y += t.vy * dt;
  itDuvar(t, m);
  if (dt > 0) {
    // what is left after sliding along a wall
    const gx = (t.x - ox) / dt, gy = (t.y - oy) / dt;
    if (Math.abs(gx) < Math.abs(t.vx)) t.vx = gx;
    if (Math.abs(gy) < Math.abs(t.vy)) t.vy = gy;
  }
  const sp = Math.hypot(t.vx, t.vy);
  if (sp > 18 && mag > .05) {
    let a = Math.atan2(t.vy, t.vx);
    if (Math.abs(aci(a - t.g)) > Math.PI / 2 + .35) a = aci(a + Math.PI);
    t.g = don(t.g, a, K.GOVDE_DONUS * dt);
  }
  t.iz += sp * dt;
}

// Where a shot starts: the barrel's tip, or the wall it is pressed against.
export function namlu(m, x, y, a) {
  const ux = Math.cos(a), uy = Math.sin(a), tx = x + ux * K.NAMLU, ty = y + uy * K.NAMLU;
  const k = engel(m, x, y, tx, ty, K.MERMI_R);
  if (k <= 1) return { x: x + (tx - x) * k, y: y + (ty - y) * k, dur: true };
  return { x: tx, y: ty, dur: false };
}

// Moves a shot for dt seconds. Returns { t, x, y, hedef } when it stops (hit or wall), else null.
// tanklar: what it can hit (not its owner). pay: extra hit radius (the server allows for lag).
export function mermiIlerle(b, dt, m, tanklar, pay) {
  const sure = Math.max(0, Math.min(dt, K.MERMI_OMUR - b.t));
  b.t += dt;
  const dx = b.vx * sure, dy = b.vy * sure;
  const tw = engel(m, b.x, b.y, b.x + dx, b.y + dy, K.MERMI_R);
  let th = 2, hedef = null;
  for (const t of tanklar) {
    if (t.no === b.o) continue;
    const k = cembereCarp(b.x, b.y, dx, dy, t.x, t.y, K.R + K.MERMI_R + (pay || 0));
    if (k < th) { th = k; hedef = t; }
  }
  if (hedef && th <= tw) { b.x += dx * th; b.y += dy * th; return { hedef, x: b.x, y: b.y }; }
  if (tw <= 1) { b.x += dx * tw; b.y += dy * tw; return { hedef: null, x: b.x, y: b.y }; }
  b.x += dx; b.y += dy;
  if (b.t >= K.MERMI_OMUR) return { hedef: null, x: b.x, y: b.y, sondu: true };
  return null;
}

/* ---------- path finding (bots) ---------- */

function hucreBul(m, x, y) {
  const { gw, gh, bos } = m.izgara, H = K.HUCRE;
  const i0 = clamp(Math.floor(x / H), 0, gw - 1), j0 = clamp(Math.floor(y / H), 0, gh - 1);
  if (bos[j0 * gw + i0]) return j0 * gw + i0;
  for (let r = 1; r <= 4; r++) {
    let en = -1, ed = Infinity;
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 0 || j < 0 || i >= gw || j >= gh || !bos[j * gw + i]) continue;
      const d = Math.hypot((i + .5) * H - x, (j + .5) * H - y);
      if (d < ed) { ed = d; en = j * gw + i; }
    }
    if (en >= 0) return en;
  }
  return -1;
}

// Cell centres from near (x0,y0) to (x1,y1), breadth first on the grid; [] if there's no way.
export function yolBul(m, x0, y0, x1, y1) {
  const { gw, gh, bos } = m.izgara, H = K.HUCRE;
  const a = hucreBul(m, x0, y0), b = hucreBul(m, x1, y1);
  if (a < 0 || b < 0) return [];
  if (a === b) return [[x1, y1]];
  const onceki = new Int32Array(gw * gh).fill(-1), kuyruk = new Int32Array(gw * gh);
  let bas = 0, son = 0;
  kuyruk[son++] = a; onceki[a] = a;
  const komsu = [1, -1, gw, -gw];
  while (bas < son) {
    const c = kuyruk[bas++];
    if (c === b) break;
    const ci = c % gw;
    for (const k of komsu) {
      const n = c + k;
      if (n < 0 || n >= gw * gh || onceki[n] >= 0 || !bos[n]) continue;
      if ((k === 1 && ci === gw - 1) || (k === -1 && ci === 0)) continue;
      onceki[n] = c; kuyruk[son++] = n;
    }
  }
  if (onceki[b] < 0) return [];
  const yol = [];
  for (let c = b; c !== a; c = onceki[c]) yol.push([(c % gw + .5) * H, (Math.floor(c / gw) + .5) * H]);
  yol.reverse();
  yol[yol.length - 1] = [x1, y1];
  return yol;
}

/* ---------- bots ---------- */

const ZORLUK = {
  1: { tepki: .55, hata: .2, atesBekle: .6, kacinma: .2, gorus: 560, hiz: .72, onle: .4 },
  2: { tepki: .3, hata: .1, atesBekle: .28, kacinma: .5, gorus: 720, hiz: .88, onle: .75 },
  3: { tepki: .16, hata: .045, atesBekle: .06, kacinma: .8, gorus: 860, hiz: 1, onle: 1 }
};

function botBaslat(t) {
  t.ai = { hedef: 0, dusunT: 0, yol: [], yolT: 0, yolHedef: null, yan: Math.random() < .5 ? 1 : -1, yanT: 1, kacT: 0, kx: 0, ky: 0,
    nisanT: 0, atesT: 0, hataA: 0, hataT: 0, gordu: new Set(), takilT: 0, kacisT: 0, kacisA: 0, gezT: 0, gez: null };
}

function botDusun(ar, t, dt) {
  if (!t.ai) botBaslat(t);
  const ai = t.ai, z = ZORLUK[t.bot] || ZORLUK[2], m = ar.m, rnd = Math.random;
  ai.dusunT -= dt; ai.yolT -= dt; ai.yanT -= dt; ai.kacT -= dt; ai.atesT -= dt; ai.hataT -= dt; ai.kacisT -= dt; ai.gezT -= dt;

  // pick a target now and then: the nearest tank, a little farther if a wall is in the way
  let hedef = ar.tank(ai.hedef);
  if (ai.dusunT <= 0 || !hedef || hedef.durum !== 'canli') {
    ai.dusunT = .4 + rnd() * .3;
    let en = null, ep = Infinity;
    for (const o of ar.tanklar) {
      if (o === t || o.durum !== 'canli') continue;
      let p = Math.hypot(o.x - t.x, o.y - t.y);
      if (!gorur(m, t.x, t.y, o.x, o.y)) p *= 1.5;
      if (o.koruma > 0) p *= 1.6;
      if (o.no === ai.hedef) p *= .8;
      if (p < ep) { ep = p; en = o; }
    }
    if (!en || en.no !== ai.hedef) ai.nisanT = 0;
    hedef = en; ai.hedef = en ? en.no : 0;
  }

  // dodge shots coming this way (each shot is noticed once)
  if (ai.kacT <= 0) {
    for (const b of ar.mermiler) {
      if (b.o === t.no || b.olu || ai.gordu.has(b.k)) continue;
      const rx = t.x - b.x, ry = t.y - b.y, v2 = b.vx * b.vx + b.vy * b.vy;
      const tc = (rx * b.vx + ry * b.vy) / v2;
      if (tc < 0 || tc > .6) continue;
      const px = b.x + b.vx * tc - t.x, py = b.y + b.vy * tc - t.y;
      if (px * px + py * py > (K.R + K.MERMI_R + 10) ** 2) continue;
      ai.gordu.add(b.k);
      if (rnd() > z.kacinma) continue;
      let nx = -b.vy, ny = b.vx;
      if (nx * -px + ny * -py < 0) { nx = -nx; ny = -ny; }  // away from where it passes
      const n = Math.hypot(nx, ny) || 1;
      ai.kx = nx / n; ai.ky = ny / n; ai.kacT = .32;
      break;
    }
    if (ai.gordu.size > 60) ai.gordu.clear();
  }

  let mx = 0, my = 0;
  const gor = hedef ? gorur(m, t.x, t.y, hedef.x, hedef.y) : false;
  const d = hedef ? Math.hypot(hedef.x - t.x, hedef.y - t.y) : 0;
  if (ai.kacT > 0) { mx = ai.kx; my = ai.ky; }
  else if (ai.kacisT > 0) { mx = Math.cos(ai.kacisA); my = Math.sin(ai.kacisA); }
  else if (hedef && gor && d < z.gorus) {
    // in sight: keep a fighting distance and circle around
    const ux = (hedef.x - t.x) / (d || 1), uy = (hedef.y - t.y) / (d || 1);
    if (ai.yanT <= 0) { ai.yanT = 1 + rnd() * 1.8; if (rnd() < .45) ai.yan = -ai.yan; }
    const ileri = d > 420 ? .9 : d < 230 ? -.7 : (rnd() < .5 ? .1 : -.1);
    mx = ux * ileri - uy * ai.yan * .85; my = uy * ileri + ux * ai.yan * .85;
    ai.yol = [];
  } else {
    // go around the walls toward the target (or somewhere, if there's nobody)
    let gx, gy;
    if (hedef) { gx = hedef.x; gy = hedef.y; }
    else {
      if (!ai.gez || ai.gezT <= 0) { ai.gez = m.dogma[(rnd() * m.dogma.length) | 0]; ai.gezT = 6; }
      gx = ai.gez[0]; gy = ai.gez[1];
    }
    if (ai.yolT <= 0 || !ai.yol.length) { ai.yol = yolBul(m, t.x, t.y, gx, gy); ai.yolT = .6 + rnd() * .3; }
    // head for the farthest of the next few points that is in plain view
    let hx = gx, hy = gy;
    while (ai.yol.length > 1 && Math.hypot(ai.yol[0][0] - t.x, ai.yol[0][1] - t.y) < 26) ai.yol.shift();
    for (let i = Math.min(ai.yol.length - 1, 6); i >= 0; i--) {
      const p = ai.yol[i];
      if (i === 0 || engel(m, t.x, t.y, p[0], p[1], K.R - 3) > 1) { hx = p[0]; hy = p[1]; ai.yol.splice(0, i); break; }
    }
    const dx = hx - t.x, dy = hy - t.y, n = Math.hypot(dx, dy) || 1;
    mx = dx / n; my = dy / n;
  }
  // stuck against something: back off a moment in a random direction
  const sp = Math.hypot(t.vx, t.vy);
  if ((mx || my) && sp < 25 && ai.kacisT <= 0) { ai.takilT += dt; if (ai.takilT > .45) { ai.takilT = 0; ai.kacisT = .45; ai.kacisA = rnd() * TAU; ai.yolT = 0; } }
  else ai.takilT = 0;
  t.girdi.mx = mx * z.hiz; t.girdi.my = my * z.hiz;

  // aim (leading the target a little) and shoot
  t.girdi.ates = false;
  let nisan = t.g;
  if (hedef && gor && d < z.gorus) {
    if (ai.hataT <= 0) { ai.hataT = .5; ai.hataA = (rnd() * 2 - 1) * z.hata; }
    const ucus = d / K.MERMI_HIZ * z.onle;
    const px = hedef.x + hedef.vx * ucus, py = hedef.y + hedef.vy * ucus;
    nisan = Math.atan2(py - t.y, px - t.x) + ai.hataA;
    ai.nisanT += dt;
    if (ai.nisanT > z.tepki && ai.atesT <= 0 && t.bekleme <= 0 && Math.abs(aci(nisan - t.tr)) < .12 && hedef.koruma <= .25) {
      t.girdi.ates = true;
      ai.atesT = z.atesBekle * (.6 + rnd() * .8);
    }
  } else {
    ai.nisanT = Math.max(0, ai.nisanT - dt);
    if (sp > 30) nisan = Math.atan2(t.vy, t.vx);
  }
  t.tr = don(t.tr, nisan, K.TARET_DONUS * dt);
}

/* ---------- the arena ---------- */

// Runs a round: the page uses it for games with bots, the server for rooms. A tank with
// uzak = true is driven by a player somewhere else: its position comes from outside.
export class Arena {
  constructor(n, tohum, secenek) {
    secenek = secenek || {};
    this.n = n;
    this.m = harita(n, tohum);
    this.tanklar = [];
    this.mermiler = [];
    this.olay = [];
    this.saat = 0;
    this.kalan = secenek.sure || K.TUR;
    this.pay = secenek.pay || 0;     // extra hit radius (lag)
    this.dogmaNo = 0;
  }

  tank(no) { for (const t of this.tanklar) if (t.no === no) return t; return null; }

  ekle(o) {
    const t = yeniTank(o);
    this.tanklar.push(t);
    return t;
  }

  // Takes a tank out (it left); its score stays until it is removed with sil().
  cikar(t) {
    if (t.durum === 'yok') return;
    t.durum = 'yok'; t.vx = t.vy = 0;
    this.olay.push(['c', t.no]);
  }
  sil(t) {
    this.cikar(t);
    this.tanklar = this.tanklar.filter(x => x !== t);
  }

  // The spawn point farthest from the tanks that are out there.
  dogmaYeri() {
    let en = null, ep = -1;
    const pts = this.m.dogma;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[(i + this.dogmaNo) % pts.length];
      let d = 1e9;
      for (const o of this.tanklar) if (o.durum === 'canli') d = Math.min(d, Math.hypot(o.x - p[0], o.y - p[1]));
      if (d > ep + 1) { ep = d; en = p; }
    }
    this.dogmaNo++;
    return en;
  }

  dogur(t, yer) {
    const p = yer || this.dogmaYeri();
    t.x = p[0]; t.y = p[1]; t.vx = t.vy = 0;
    t.g = t.tr = Math.atan2(this.m.h / 2 - t.y, this.m.w / 2 - t.x);
    t.can = K.CAN; t.durum = 'canli'; t.koruma = K.KORUMA; t.olumT = 0; t.bekleme = 0; t.hayat++; t.rapor = 0;
    if (t.ai) { t.ai.yol = []; t.ai.hedef = 0; }
    this.olay.push(['d', t.no, r1(t.x), r1(t.y), r2(t.g), t.hayat]);
  }

  // Everyone starts at their own corner.
  baslat() {
    this.tanklar.forEach((t, i) => this.dogur(t, this.m.dogma[i % this.m.dogma.length]));
  }

  // A shot from tank t at angle a. x, y: where the player's page had the tank (server); s: shot number.
  ates(t, a, x, y, s) {
    if (t.durum !== 'canli' || t.bekleme > (t.uzak ? K.BEKLEME * .25 : 0)) return null;
    if (!Number.isFinite(a)) return null;
    t.bekleme = K.BEKLEME; t.koruma = 0;
    const ox = Number.isFinite(x) ? x : t.x, oy = Number.isFinite(y) ? y : t.y;
    const s2 = Number.isFinite(s) ? s : ++t.seq;
    const n = namlu(this.m, ox, oy, a);
    const b = { o: t.no, s: s2, k: t.no + ':' + s2, x: n.x, y: n.y, vx: Math.cos(a) * K.MERMI_HIZ, vy: Math.sin(a) * K.MERMI_HIZ, t: 0, olu: false };
    this.olay.push(['m', t.no, s2, r1(n.x), r1(n.y), r2(a), this.saat]);
    if (n.dur) { b.olu = true; this.olay.push(['x', t.no, s2, r1(n.x), r1(n.y)]); return b; }
    this.mermiler.push(b);
    return b;
  }

  adim(dt) {
    this.saat += dt;
    this.kalan -= dt;
    const m = this.m;
    for (const t of this.tanklar) {
      if (t.durum === 'yok') continue;
      if (t.durum === 'olu') {
        t.olumT -= dt;
        if (t.olumT <= 0) this.dogur(t);
        continue;
      }
      t.koruma = Math.max(0, t.koruma - dt);
      t.bekleme = Math.max(0, t.bekleme - dt);
      if (t.uzak) {
        // reports come 15 times a second: keep it rolling in between
        if (t.rapor < .12) { t.x += t.vx * dt; t.y += t.vy * dt; itDuvar(t, m); }
        t.rapor += dt;
        continue;
      }
      if (t.bot) botDusun(this, t, dt);
      else if (t.girdi.nisan != null) t.tr = t.girdi.nisan;
      sur(t, t.girdi.mx, t.girdi.my, dt, m);
      if (t.girdi.ates) this.ates(t, t.tr);
    }
    this.ayir();
    this.mermiAdim(dt);
  }

  // Tanks don't drive through each other.
  ayir() {
    const ts = this.tanklar, R2 = K.R * 2;
    for (let i = 0; i < ts.length; i++) {
      const a = ts[i];
      if (a.durum !== 'canli') continue;
      for (let j = i + 1; j < ts.length; j++) {
        const b = ts[j];
        if (b.durum !== 'canli' || (a.uzak && b.uzak)) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= R2) continue;
        if (d < .01) { dx = 1; dy = 0; d = 1; }
        const it = R2 - d, ax = dx / d * it, ay = dy / d * it;
        const wa = a.uzak ? 0 : b.uzak ? 1 : .5, wb = 1 - wa;
        a.x -= ax * wa; a.y -= ay * wa; b.x += ax * wb; b.y += ay * wb;
        itDuvar(a, this.m); itDuvar(b, this.m);
      }
    }
  }

  mermiAdim(dt) {
    const canli = this.tanklar.filter(t => t.durum === 'canli');
    for (const b of this.mermiler) {
      if (b.olu) continue;
      const r = mermiIlerle(b, dt, this.m, canli, this.pay);
      if (!r) continue;
      b.olu = true;
      if (!r.hedef) { this.olay.push(['x', b.o, b.s, r1(r.x), r1(r.y)]); continue; }
      const h = r.hedef;
      if (h.koruma > 0) { this.olay.push(['k', b.o, b.s, h.no, r1(r.x), r1(r.y)]); continue; }
      this.vur(b, h, r.x, r.y);
      if (h.durum !== 'canli') { const i = canli.indexOf(h); if (i >= 0) canli.splice(i, 1); }
    }
    this.mermiler = this.mermiler.filter(b => !b.olu);
  }

  // A hit: one point for the shooter; the third hit paints the tank out.
  vur(b, h, x, y) {
    const atan = this.tank(b.o);
    h.can--;
    if (atan) atan.puan++;
    this.olay.push(['v', b.o, b.s, h.no, r1(x), r1(y), h.can, atan ? atan.puan : 0]);
    if (h.can <= 0) {
      h.durum = 'olu'; h.olumT = K.DOGMA; h.vx = h.vy = 0; h.boyandi++; h.kim = b.o;
      if (atan) atan.boyadi++;
      this.olay.push(['o', h.no, b.o, r1(h.x), r1(h.y)]);
    }
  }

  // Final standings: most hits first, then fewest times painted out.
  sonuc() {
    return [...this.tanklar]
      .sort((a, b) => b.puan - a.puan || a.boyandi - b.boyandi || b.boyadi - a.boyadi)
      .map(t => ({ no: t.no, ad: t.ad, renk: t.renk, bot: t.bot, puan: t.puan, boyadi: t.boyadi, boyandi: t.boyandi }));
  }

  olaylariAl() { const o = this.olay; this.olay = []; return o; }
}
