// Kar Savaşı: the rules, shared by the page (lab/kar-savasi/index.html) and the room server
// (fish/sunucu/src/kar-oda.js imports this file). Keep it free of DOM and Node APIs.
//
// An endless snowy forest built from a seed. Kids come in waves from every side and the players
// knock them over with snowballs. With friends it is co-op: one team score, and a player who falls
// in the snow gets up when a teammate stands next to them for a moment, or when the wave is over.
// The game ends when everyone is down at the same time.
//
// The page drives its own player (walk) and owns its snowball pocket (ammo). Everything else is
// decided here: waves, the kids and their throws, hits, falls, snow piles and cocoa.

// Bump when the world generator or the rules change in a way the page and the server must agree on.
export const VERSION = 1;

export const K = {
  R: 13,              // a player's radius
  SPEED: 172,         // walking speed
  HP: 5,              // hearts
  AMMO: 6,            // snowballs you make by yourself, one every MAKE seconds
  MAKE: 0.9,
  PILE_AMMO: 9,       // a snow pile fills your pocket to this
  BALL_SPEED: 560,
  COOLDOWN: 0.16,     // seconds between throws
  RANGE_MIN: 120,
  RANGE_MAX: 470,
  SAFE: 1.3,          // after a hit you can't be hit again for this long
  PILE_BACK: 30,      // a taken snow pile comes back after this long
  LIFT: 1.6,          // seconds a teammate stands next to you to get you up
  LIFT_R: 44,
  LIFT_HP: 2,         // hearts you get up with (a finished wave gives them all back)
  CALM: 5,            // the break between waves
  FIRST_CALM: 2.6,
  VIEW: 620,          // how far a player sees (kids appear just outside this)
  MAX_PLAYERS: 8,
  MAX_ENEMIES: 40,
  COCOA_LIFE: 14
};

// The kids who attack. score: points for knocking one over (times the thrower's streak, up to 5).
export const KINDS = {
  runner:  { r: 12, k: 0.95, hp: 1, speed: 76, score: 10 },
  thrower: { r: 12, k: 0.95, hp: 1, speed: 72, score: 20 },
  big:     { r: 18, k: 1.4,  hp: 3, speed: 50, score: 40 }
};
export const KIND_LIST = ['runner', 'thrower', 'big'];

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------- the world ---------- */
export const CELL = 110, POND_CELL = 640, CABIN_CELL = 900;

export function hash3(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, s), b = hash3(xi + 1, yi, s), c = hash3(xi, yi + 1, s), d = hash3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Trees, rocks, snow piles, frozen ponds and cabins, all from the seed: every page and the server
// build the same forest. The clearing around (0, 0) is where the game starts.
export class World {
  constructor(seed) {
    this.seed = seed | 0;
    this.cells = new Map();
    this.ponds = new Map();
    this.cabins = new Map();
    this.taken = new Map(); // snow pile key -> when it comes back (in the owner's clock)
  }

  pondAt(bx, by) {
    const key = bx + ',' + by, S = this.seed;
    if (this.ponds.has(key)) return this.ponds.get(key);
    let p = null;
    if (hash3(bx, by, S + 7) < 0.22) {
      const rx = 110 + hash3(bx, by, S + 71) * 120, ry = 70 + hash3(bx, by, S + 72) * 70;
      const x = bx * POND_CELL + rx + 20 + hash3(bx, by, S + 73) * (POND_CELL - 2 * rx - 40);
      const y = by * POND_CELL + ry + 20 + hash3(bx, by, S + 74) * (POND_CELL - 2 * ry - 40);
      if (Math.hypot(x, y) > rx + 260) p = { x, y, rx, ry, c1: hash3(bx, by, S + 75), c2: hash3(bx, by, S + 76), c3: hash3(bx, by, S + 77) };
    }
    this.ponds.set(key, p);
    return p;
  }
  pondsNear(x, y, n = 1) {
    const bx = Math.floor(x / POND_CELL), by = Math.floor(y / POND_CELL), out = [];
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const p = this.pondAt(bx + i, by + j); if (p) out.push(p); }
    return out;
  }
  inPond(x, y, m = 1) {
    for (const p of this.pondsNear(x, y)) {
      const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry;
      if (dx * dx + dy * dy < m) return true;
    }
    return false;
  }

  cabinAt(bx, by) {
    const key = bx + ',' + by, S = this.seed;
    if (this.cabins.has(key)) return this.cabins.get(key);
    let k = null;
    if (hash3(bx, by, S + 9) < 0.2) {
      const w = 150 + Math.round(hash3(bx, by, S + 91) * 50), h = 96 + Math.round(hash3(bx, by, S + 92) * 24);
      const x = bx * CABIN_CELL + 80 + hash3(bx, by, S + 93) * (CABIN_CELL - 160 - w);
      const y = by * CABIN_CELL + 80 + hash3(bx, by, S + 94) * (CABIN_CELL - 160 - h);
      let clash = Math.hypot(x + w / 2, y + h / 2) < 380;
      if (!clash) for (const p of this.pondsNear(x + w / 2, y + h / 2)) {
        const nx = clamp(p.x, x - 40, x + w + 40), ny = clamp(p.y, y - 60, y + h + 40);
        const dx = (nx - p.x) / p.rx, dy = (ny - p.y) / p.ry;
        if (dx * dx + dy * dy < 1.2) { clash = true; break; }
      }
      if (!clash) k = { t: 'cabin', x, y, w, h, door: hash3(bx, by, S + 95) };
    }
    this.cabins.set(key, k);
    return k;
  }
  cabinsNear(x, y, n = 1) {
    const bx = Math.floor(x / CABIN_CELL), by = Math.floor(y / CABIN_CELL), out = [];
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const k = this.cabinAt(bx + i, by + j); if (k) out.push(k); }
    return out;
  }

  blocked(x, y, m) {
    if (x * x + y * y < 170 * 170) return true;
    if (this.inPond(x, y, 1.3)) return true;
    for (const k of this.cabinsNear(x, y)) if (x > k.x - m && x < k.x + k.w + m && y > k.y - m - 40 && y < k.y + k.h + m) return true;
    return false;
  }

  // What stands in one cell: trees, a rock, sometimes a snow pile.
  cellAt(cx, cy) {
    const key = cx + ',' + cy, S = this.seed;
    let L = this.cells.get(key);
    if (L) return L;
    L = [];
    const forest = vnoise(cx / 6.5, cy / 6.5, S + 3);
    const p = 0.03 + 0.72 * Math.pow(forest, 2.3);
    for (let i = 0; i < 3; i++) {
      if (hash3(cx, cy, S + 11 + i * 7) < p * (i === 0 ? 1 : i === 1 ? 0.6 : 0.3)) {
        const s = 0.78 + hash3(cx, cy, S + 12 + i * 7) * 0.55;
        const x = cx * CELL + 16 + hash3(cx, cy, S + 13 + i * 7) * (CELL - 32);
        const y = cy * CELL + 16 + hash3(cx, cy, S + 14 + i * 7) * (CELL - 32);
        if (this.blocked(x, y, 36)) continue;
        if (L.some((o) => Math.hypot(o.x - x, o.y - y) < 42 * s)) continue;
        L.push({ t: 'tree', x, y, s, r: 10 * s, v: hash3(cx, cy, S + 15 + i * 7) });
      }
    }
    if (hash3(cx, cy, S + 31) < 0.045) {
      const s = 0.8 + hash3(cx, cy, S + 32) * 0.6;
      const x = cx * CELL + 20 + hash3(cx, cy, S + 33) * (CELL - 40), y = cy * CELL + 20 + hash3(cx, cy, S + 34) * (CELL - 40);
      if (!this.blocked(x, y, 30) && !L.some((o) => Math.hypot(o.x - x, o.y - y) < 44)) L.push({ t: 'rock', x, y, s, r: 13 * s });
    }
    if (hash3(cx, cy, S + 41) < 0.03) {
      const x = cx * CELL + 22 + hash3(cx, cy, S + 42) * (CELL - 44), y = cy * CELL + 22 + hash3(cx, cy, S + 43) * (CELL - 44);
      if (!this.blocked(x, y, 24) && !L.some((o) => Math.hypot(o.x - x, o.y - y) < 46)) L.push({ t: 'pile', x, y, key: key + 'p' });
    }
    if (cx === 1 && cy === 0) L.push({ t: 'pile', x: 150, y: 60, key: 'f1' });
    if (cx === -2 && cy === -1) L.push({ t: 'pile', x: -150, y: -70, key: 'f2' });
    if (this.cells.size > 9000) this.cells.clear();
    this.cells.set(key, L);
    return L;
  }

  eachSolid(x, y, fn) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const L = this.cellAt(cx + i, cy + j);
      for (let n = 0; n < L.length; n++) if (L[n].t !== 'pile') fn(L[n]);
    }
  }
  // Snow piles within one cell of (x, y).
  eachPile(x, y, fn) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const L = this.cellAt(cx + i, cy + j);
      for (let n = 0; n < L.length; n++) if (L[n].t === 'pile') fn(L[n]);
    }
  }

  // Pushes a walker (x, y, r) out of trees, rocks and cabins.
  collide(e) {
    this.eachSolid(e.x, e.y, (o) => {
      const dx = e.x - o.x, dy = e.y - o.y, m = e.r + o.r, d2 = dx * dx + dy * dy;
      if (d2 < m * m) { const d = Math.sqrt(d2) || 0.01, p = (m - d) / d; e.x += dx * p; e.y += dy * p; }
    });
    for (const k of this.cabinsNear(e.x, e.y)) pushOutRect(e, k);
  }
  solidAt(x, y, r) {
    let hit = false;
    this.eachSolid(x, y, (o) => { if (!hit && Math.hypot(x - o.x, y - o.y) < r + o.r) hit = true; });
    if (!hit) for (const k of this.cabinsNear(x, y)) if (x > k.x - r && x < k.x + k.w + r && y > k.y - r - 40 && y < k.y + k.h + r) hit = true;
    return hit;
  }
  // A flying snowball stops at trees and cabins; high balls fly over rocks.
  ballBlocked(b) {
    let hit = false;
    this.eachSolid(b.x, b.y, (o) => {
      if (hit) return;
      if (o.t === 'rock' && b.z > 14) return;
      if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + 4) hit = true;
    });
    if (!hit) for (const k of this.cabinsNear(b.x, b.y)) if (b.x > k.x && b.x < k.x + k.w && b.y > k.y - 30 && b.y < k.y + k.h) hit = true;
    return hit;
  }
}

function pushOutRect(e, k) {
  const nx = clamp(e.x, k.x, k.x + k.w), ny = clamp(e.y, k.y, k.y + k.h);
  const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= e.r * e.r) return;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2), p = (e.r - d) / d;
    e.x += dx * p; e.y += dy * p;
  } else {
    const l = e.x - k.x, r = k.x + k.w - e.x, t = e.y - k.y, b = k.y + k.h - e.y, m = Math.min(l, r, t, b);
    if (m === l) e.x = k.x - e.r; else if (m === r) e.x = k.x + k.w + e.r; else if (m === t) e.y = k.y - e.r; else e.y = k.y + k.h + e.r;
  }
}

/* ---------- moving ---------- */
// One step of a player walking towards (mx, my) (a stick, length 0..1). Ice is slippery; kx/ky is
// knock-back from a hit. Returns true on ice (no footprints there).
export function walk(p, mx, my, dt, world) {
  const ice = world.inPond(p.x, p.y);
  const acc = ice ? 1.6 : 13;
  p.vx += (mx * K.SPEED - p.vx) * Math.min(1, dt * acc);
  p.vy += (my * K.SPEED - p.vy) * Math.min(1, dt * acc);
  p.x += (p.vx + (p.kx || 0)) * dt;
  p.y += (p.vy + (p.ky || 0)) * dt;
  const kd = Math.exp(-dt * 7);
  p.kx = (p.kx || 0) * kd; p.ky = (p.ky || 0) * kd;
  world.collide(p);
  return ice;
}

// Where a player's snowball leaves the hand.
export function ballStart(x, y, ux, uy) { return { x: x + ux * 12, y: y + uy * 8 }; }

// Moves a snowball; z is its height (a little arc from the hand down to the snow).
export function moveBall(b, dt) {
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.d += Math.hypot(b.vx, b.vy) * dt;
  const t = Math.min(1, b.d / b.max);
  b.z = Math.sin(Math.PI * t) * b.max * 0.1 + b.h0 * (1 - t);
}
// Does a snowball touch a kid standing at (x, y)? (k: the kid's size)
export function ballTouchesKid(b, x, y, r, k) {
  const dx = x - b.x, dy = (y - 6 * k) - b.y, m = r + 7;
  return dx * dx + dy * dy < m * m;
}
export function ballTouchesPlayer(b, x, y) {
  const dx = x - b.x, dy = (y - 6) - b.y, m = K.R + 6;
  return dx * dx + dy * dy < m * m;
}

/* ---------- the battle ---------- */
// Events (taken with takeEvents(); the page turns them into sounds and snow):
//   ['w', wave]                                     a wave starts
//   ['c', wave]                                     a wave is over (the break starts)
//   ['t', owner, seq, x, y, vx, vy, max, born, kid] a snowball is thrown (owner 0: one of the kids; kid: its id)
//   ['s', key, x, y, z, how]                        a snowball stopped (how 0: tree/cabin, 1: the snow, 2: it hit a player)
//   ['v', key, id, ux, uy, hp]                      a kid is hit
//   ['d', id, fall, points, streak, owner, x, y, ux, uy]  a kid is knocked over
//   ['h', no, key, ux, uy, hp]                      a player is hit (key '' when a kid ran into them)
//   ['o', no, fall]                                 a player fell in the snow
//   ['u', no, x, y, hp]                             a player got up
//   ['y', key, no, x, y]                            a player took a snow pile
//   ['k', id, x, y]                                 a cup of cocoa appeared
//   ['K', id, no, heart, x, y]                      a player drank it (heart 1: one heart back, 0: 25 points)
//   ['n']                                           everyone is down: the game is over
export class Battle {
  constructor(seed, opt = {}) {
    this.seed = seed >>> 0;
    this.world = new World(this.seed);
    this.players = [];
    this.enemies = [];
    this.balls = [];
    this.cocoa = [];
    this.events = [];
    this.clock = 0;
    this.wave = 0;
    this.toSpawn = 0;
    this.spawnT = 0;
    this.calm = opt.calm != null ? opt.calm : K.FIRST_CALM;
    this.score = 0;
    this.kills = 0;
    this.over = false;
    this.overT = 0;
    this.nextId = 1;
    this.kidSeq = 0;
  }

  emit(e) { this.events.push(e); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  player(no) { for (const p of this.players) if (p.no === no) return p; return null; }
  // Players who are here (a player who lost the connection is "away").
  present() { return this.players.filter((p) => !p.away); }
  aliveCount() { let n = 0; for (const e of this.enemies) if (!e.down) n++; return n; }
  left() { return this.toSpawn + this.aliveCount(); }

  addPlayer(o) {
    const p = {
      t: 'player', no: o.no, name: o.name || '', color: o.color || '',
      x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: K.R,
      hp: K.HP, state: 'alive', inv: 0, lift: 0, cool: 0,
      kills: 0, falls: 0, combo: 0, comboT: 0, view: K.VIEW, life: 0, away: false, seq: 0
    };
    this.players.push(p);
    this.place(p, o.x, o.y);
    return p;
  }

  // Puts a player at (x, y), or next to a teammate who is up (or in the starting clearing).
  place(p, x, y) {
    if (x == null || y == null) {
      const mate = this.players.find((q) => q !== p && !q.away && q.state === 'alive');
      const cx = mate ? mate.x : 0, cy = mate ? mate.y : 0;
      x = cx; y = cy;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + p.no * 0.9, r = mate ? 46 : 34 + 12 * (i % 3);
        const tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r;
        if (!this.world.solidAt(tx, ty, K.R + 2) && !this.world.inPond(tx, ty)) { x = tx; y = ty; break; }
      }
    }
    p.x = x; p.y = y; p.vx = p.vy = p.kx = p.ky = 0;
    p.life++;
  }

  // A player throws (the page checked the pocket). (x, y): where the player stands.
  throwBall(p, x, y, ux, uy, dist, seq) {
    if (!p || p.away || p.state !== 'alive' || this.over) return null;
    const L = Math.hypot(ux, uy) || 1;
    ux /= L; uy /= L;
    const s = ballStart(x, y, ux, uy);
    p.cool = K.COOLDOWN;
    return this.addBall(p.no, seq, s.x, s.y, ux * K.BALL_SPEED, uy * K.BALL_SPEED, clamp(dist, K.RANGE_MIN, K.RANGE_MAX), 18, 6, 0);
  }

  addBall(owner, seq, x, y, vx, vy, max, h0, r, kid) {
    const b = { key: owner + ':' + seq, owner, seq, x, y, vx, vy, d: 0, max, h0, z: h0, r, born: this.clock };
    this.balls.push(b);
    this.emit(['t', owner, seq, r1(x), r1(y), Math.round(vx), Math.round(vy), Math.round(max), this.clock, kid || 0]);
    return b;
  }

  step(dt) {
    this.clock += dt;
    const w = this.world;
    for (const [k, t] of w.taken) if (this.clock >= t) w.taken.delete(k);
    for (const p of this.players) {
      p.inv -= dt; p.cool -= dt;
      if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    }
    this.stepWaves(dt);
    this.stepEnemies(dt);
    this.stepBalls(dt);
    this.stepPickups(dt);
    this.stepLift(dt);
    if (!this.over) {
      const here = this.present();
      if (here.length && here.every((p) => p.state === 'down')) { this.over = true; this.emit(['n']); }
    } else this.overT += dt;
  }

  /* waves */
  pickKind() {
    const w = this.wave, r = Math.random();
    const pBig = w >= 3 ? Math.min(0.22, 0.07 * (w - 2)) : 0;
    const pThr = w >= 2 ? Math.min(0.34, 0.16 + 0.05 * (w - 2)) : 0;
    if (r < pBig) return 'big';
    if (r < pBig + pThr) return 'thrower';
    return 'runner';
  }
  stepWaves(dt) {
    if (this.over) return;
    const n = Math.max(1, this.present().length);
    if (this.calm > 0) {
      this.calm -= dt;
      if (this.calm <= 0) {
        this.calm = 0;
        this.wave++;
        this.toSpawn = Math.round((4 + this.wave * 3) * (1 + 0.6 * (n - 1)));
        this.spawnT = 0.2;
        this.emit(['w', this.wave]);
      }
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      const cap = Math.min(K.MAX_ENEMIES, Math.round(Math.min(26, 3 + this.wave * 2) * (1 + 0.5 * (n - 1))));
      if (this.spawnT <= 0 && this.aliveCount() < cap) {
        if (this.spawn()) this.toSpawn--;
        this.spawnT = Math.max(0.35, 1.5 - this.wave * 0.1) * rand(0.6, 1.4) / (1 + 0.35 * (n - 1));
      }
    } else if (this.enemies.every((e) => e.down)) {
      this.calm = K.CALM;
      this.emit(['c', this.wave]);
      // whoever fell gets up for the next wave
      for (const p of this.players) if (p.state === 'down' && !p.away) this.getUp(p, K.HP);
    }
  }
  // A kid appears just outside a player's view (and, if possible, outside everyone's).
  spawn() {
    const up = this.players.filter((p) => !p.away && p.state === 'alive');
    if (!up.length) return false;
    const kind = this.pickKind(), D = KINDS[kind];
    const p = up[(Math.random() * up.length) | 0];
    const R = (p.view || K.VIEW) + 50;
    let x = p.x, y = p.y;
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      x = p.x + Math.cos(a) * R; y = p.y + Math.sin(a) * R;
      if (this.world.solidAt(x, y, D.r + 4)) continue;
      if (up.every((q) => q === p || Math.hypot(q.x - x, q.y - y) > (q.view || K.VIEW) * 0.9)) break;
    }
    const ramp = 1 + Math.min(0.6, (this.wave - 1) * 0.06);
    this.enemies.push({
      t: 'enemy', id: this.nextId++, kind, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: D.r, k: D.k, hp: D.hp, maxHp: D.hp,
      spd: D.speed * ramp * rand(0.9, 1.1), side: Math.random() < 0.5 ? -1 : 1, cd: rand(1.2, 2.4), wind: 0, stun: 0,
      fx: 0, fy: 1, down: false, downT: 0, fall: 1
    });
    return true;
  }

  /* the kids */
  nearestUp(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.players) {
      if (p.away || p.state !== 'alive') continue;
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  stepEnemies(dt) {
    const w = this.world;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.down) {
        e.downT += dt;
        e.x += e.kx * dt; e.y += e.ky * dt;
        const kd = Math.exp(-dt * 6); e.kx *= kd; e.ky *= kd;
        if (e.downT > 1.15) this.enemies.splice(i, 1);
        continue;
      }
      e.stun -= dt;
      const p = this.nearestUp(e.x, e.y);
      let dx = 0, dy = 1, d = 1;
      if (p) { dx = p.x - e.x; dy = p.y - e.y; d = Math.hypot(dx, dy) || 1; }
      let tx = dx / d, ty = dy / d, want = 1;
      if (this.over || !p) { want = 0; e.wind = 0; }
      else if (e.kind === 'thrower') {
        if (d < 185) { tx = -tx; ty = -ty; }
        else if (d < 290) { const sx = -ty * e.side, sy = tx * e.side; tx = sx; ty = sy; want = 0.6; }
        e.cd -= dt;
        if (e.wind > 0) { e.wind -= dt; want = 0; if (e.wind <= 0) { e.wind = 0; this.kidThrow(e, p, d); } }
        else if (e.cd <= 0 && d < 440) e.wind = 0.55;
        if (Math.random() < dt * 0.25) e.side *= -1;
      }
      if (e.stun > 0) want = 0;

      // steer around trees, rocks and cabins
      let ax = 0, ay = 0;
      const avoid = (ox, oy, or) => {
        const odx = ox - e.x, ody = oy - e.y, od = Math.hypot(odx, ody), m = or + e.r + 26;
        if (od > m || od < 0.01) return;
        const ux = odx / od, uy = ody / od, proj = ux * tx + uy * ty;
        if (proj <= 0.1) return;
        let px = ux - proj * tx, py = uy - proj * ty;
        const pl = Math.hypot(px, py);
        if (pl < 0.15) { px = -ty * e.side; py = tx * e.side; } else { px = -px / pl; py = -py / pl; }
        const wgt = (1 - od / m) * 2.2 * proj;
        ax += px * wgt; ay += py * wgt;
      };
      w.eachSolid(e.x, e.y, (o) => avoid(o.x, o.y, o.r));
      for (const k of w.cabinsNear(e.x, e.y)) avoid(clamp(e.x, k.x, k.x + k.w), clamp(e.y, k.y, k.y + k.h), 4);
      tx += ax; ty += ay;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;

      const acc = w.inPond(e.x, e.y) ? 1.4 : 7;
      const sp = e.spd * want;
      e.vx += (tx * sp - e.vx) * Math.min(1, dt * acc);
      e.vy += (ty * sp - e.vy) * Math.min(1, dt * acc);
      for (const o of this.enemies) {
        if (o === e || o.down) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), m = e.r + o.r + 3;
        if (od < m && od > 0.01) { const push = ((m - od) / od) * 0.5; e.x += ox * push; e.y += oy * push; }
      }
      e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
      const kd = Math.exp(-dt * 6); e.kx *= kd; e.ky *= kd;
      w.collide(e);
      if (p) { e.fx = dx / d; e.fy = dy / d; }

      // running into a player
      if (!this.over) {
        for (const q of this.players) {
          if (q.away || q.state !== 'alive') continue;
          const qx = q.x - e.x, qy = q.y - e.y, qd = Math.hypot(qx, qy) || 1, qm = e.r + q.r + 1;
          if (qd >= qm) continue;
          if (q.inv <= 0 && e.stun <= 0) {
            this.hurt(q, qx / qd, qy / qd, '');
            e.kx -= (qx / qd) * 220; e.ky -= (qy / qd) * 220; e.stun = 0.6;
          }
          const ov = (qm - qd) / qd;
          e.x -= qx * ov * 0.6; e.y -= qy * ov * 0.6;
        }
      }
      if (p && d > 1800) { this.enemies.splice(i, 1); if (!this.over) this.toSpawn++; }
    }
  }
  kidThrow(e, p, d) {
    const sp = Math.min(330, 255 + this.wave * 7), t = d / sp;
    const tx = p.x + p.vx * t * 0.55, ty = p.y + p.vy * t * 0.55;
    const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy) || 1;
    this.addBall(0, ++this.kidSeq, e.x + (dx / L) * 10, e.y + (dy / L) * 6, (dx / L) * sp, (dy / L) * sp, Math.min(520, L + 70), 20, 5.5, e.id);
    e.cd = rand(2.1, 3.4);
  }

  /* snowballs */
  stepBalls(dt) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      let dead = false;
      for (let s = 0; s < 2 && !dead; s++) {
        moveBall(b, dt / 2);
        const sp = Math.hypot(b.vx, b.vy) || 1;
        if (b.owner) {
          for (const e of this.enemies) {
            if (e.down || !ballTouchesKid(b, e.x, e.y, e.r, e.k)) continue;
            this.hitKid(e, b, b.vx / sp, b.vy / sp);
            dead = true;
            break;
          }
        } else if (!this.over) {
          for (const p of this.players) {
            if (p.away || p.state !== 'alive' || !ballTouchesPlayer(b, p.x, p.y)) continue;
            this.emit(['s', b.key, r1(b.x), r1(b.y), r1(b.z), 2]);
            this.hurt(p, b.vx / sp, b.vy / sp, b.key);
            dead = true;
            break;
          }
        }
        if (!dead && this.world.ballBlocked(b)) { this.emit(['s', b.key, r1(b.x), r1(b.y), r1(b.z), 0]); dead = true; }
        if (!dead && b.d >= b.max) { this.emit(['s', b.key, r1(b.x), r1(b.y), 0, 1]); dead = true; }
      }
      if (dead) this.balls.splice(i, 1);
    }
  }
  hitKid(e, b, ux, uy) {
    e.hp--;
    e.kx += ux * 250; e.ky += uy * 250;
    this.emit(['v', b.key, e.id, r2(ux), r2(uy), e.hp]);
    if (e.hp > 0) return;
    e.down = true; e.downT = 0; e.fall = ux >= 0 ? 1 : -1; e.wind = 0;
    const p = this.player(b.owner);
    let streak = 1;
    if (p) { p.combo++; p.comboT = 2.6; streak = Math.min(5, p.combo); p.kills++; }
    const pts = KINDS[e.kind].score * streak;
    this.score += pts;
    this.kills++;
    this.emit(['d', e.id, e.fall, pts, streak, b.owner, r1(e.x), r1(e.y), r2(ux), r2(uy)]);
    if (Math.random() < 0.08 + (p && p.hp <= 2 ? 0.07 : 0)) {
      const c = { id: this.nextId++, x: e.x, y: e.y, life: K.COCOA_LIFE };
      this.cocoa.push(c);
      this.emit(['k', c.id, r1(c.x), r1(c.y)]);
    }
  }
  hurt(p, ux, uy, key) {
    if (p.inv > 0 || this.over || p.state !== 'alive') return;
    p.hp--;
    p.inv = K.SAFE;
    this.emit(['h', p.no, key || '', r2(ux), r2(uy), p.hp]);
    if (p.hp <= 0) {
      p.state = 'down'; p.lift = 0; p.falls++; p.combo = 0; p.comboT = 0;
      this.emit(['o', p.no, ux >= 0 ? 1 : -1]);
    }
  }

  /* snow piles, cocoa, getting up */
  stepPickups(dt) {
    const w = this.world;
    for (let i = this.cocoa.length - 1; i >= 0; i--) { this.cocoa[i].life -= dt; if (this.cocoa[i].life <= 0) this.cocoa.splice(i, 1); }
    for (const p of this.players) {
      if (p.away || p.state !== 'alive') continue;
      w.eachPile(p.x, p.y, (o) => {
        if (w.taken.has(o.key) || Math.hypot(o.x - p.x, o.y - p.y) >= 28) return;
        w.taken.set(o.key, this.clock + K.PILE_BACK);
        this.emit(['y', o.key, p.no, r1(o.x), r1(o.y)]);
      });
      for (let i = this.cocoa.length - 1; i >= 0; i--) {
        const c = this.cocoa[i];
        if (Math.hypot(c.x - p.x, c.y - p.y) >= 26) continue;
        let heart = 0;
        if (p.hp < K.HP) { p.hp++; heart = 1; } else this.score += 25;
        this.emit(['K', c.id, p.no, heart, r1(c.x), r1(c.y)]);
        this.cocoa.splice(i, 1);
      }
    }
  }
  stepLift(dt) {
    for (const p of this.players) {
      if (p.state !== 'down' || p.away) continue;
      let near = false;
      for (const q of this.players) {
        if (q === p || q.away || q.state !== 'alive') continue;
        if (Math.hypot(q.x - p.x, q.y - p.y) < K.LIFT_R) { near = true; break; }
      }
      p.lift = near ? p.lift + dt : Math.max(0, p.lift - dt);
      if (p.lift >= K.LIFT) this.getUp(p, K.LIFT_HP);
    }
  }
  getUp(p, hp) {
    p.state = 'alive'; p.hp = hp; p.inv = 1.5; p.lift = 0;
    this.emit(['u', p.no, r1(p.x), r1(p.y), hp]);
  }

  result() {
    return {
      score: this.score, wave: Math.max(1, this.wave), kills: this.kills,
      players: this.players.map((p) => ({ no: p.no, name: p.name, color: p.color, kills: p.kills, falls: p.falls }))
        .sort((a, b) => b.kills - a.kills || a.falls - b.falls)
    };
  }
}
