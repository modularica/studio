// ---------------------------------------------------------------------------
// Simulation. Pure logic, no DOM: the page and the balance tests both run it.
// One year = autumn (guests arrive) -> winter (they sleep, you keep them
// asleep) -> spring (they pay) -> summer (you build).
// ---------------------------------------------------------------------------

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cellRC = (i) => ({ r: Math.floor(i / COLS), c: i % COLS });
const cellIdx = (r, c) => r * COLS + c;
function neighbours(i) {
  const { r, c } = cellRC(i), out = [];
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  return out;
}

function newSave() {
  const grid = [];
  for (let i = 0; i < COLS * ROWS; i++) grid.push({ dug: false, room: null, lvl: 1 });
  for (const c of [0, 1, 2]) { grid[c].dug = true; grid[c].room = 'yuva'; }
  return {
    v: 1, year: 1, money: 20, fame: 0, grid,
    upgrades: {}, staff: { sincap: 0, baykus: 0, geyik: 0 },
    seen: {}, total: { guests: 0, hearts: 0, nuts: 0, woke: 0 },
  };
}

// Repairs a save loaded from storage so a broken or old one never crashes.
function cleanSave(s) {
  const d = newSave();
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.grid) || s.grid.length !== COLS * ROWS) return d;
  const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
  const out = {
    v: 1,
    year: Math.max(1, Math.floor(num(s.year, 1))),
    money: Math.max(0, Math.floor(num(s.money, 20))),
    fame: Math.max(0, Math.floor(num(s.fame, 0))),
    grid: s.grid.map((g) => {
      const dug = !!(g && g.dug);
      const room = dug && g && ROOMS[g.room] ? g.room : null;
      const lvl = room ? Math.min(3, Math.max(1, Math.floor(num(g.lvl, 1)))) : 1;
      return { dug, room, lvl };
    }),
    upgrades: {}, staff: { sincap: 0, baykus: 0, geyik: 0 },
    seen: s.seen && typeof s.seen === 'object' ? { ...s.seen } : {},
    total: { ...d.total, ...(s.total && typeof s.total === 'object' ? s.total : {}) },
  };
  for (const k of UPGRADE_ORDER) if (s.upgrades && s.upgrades[k]) out.upgrades[k] = true;
  for (const k of STAFF_ORDER) out.staff[k] = Math.min(STAFF[k].max, Math.max(0, Math.floor(num(s.staff && s.staff[k], 0))));
  return out;
}

// Where squirrel k waits: on the snow by the cabin door (grid units; y -1.02 is the ground line).
const SQ_HOME = (k) => ({ x: 2.72 - k * 0.24, y: -1.02 });

const dugCount = (save) => save.grid.filter((g) => g.dug).length;
function canDig(save, i) {
  const g = save.grid[i];
  if (g.dug) return false;
  if (cellRC(i).r === 0) return true;
  return neighbours(i).some((n) => save.grid[n].dug);
}
const roomUnlocked = (save, type) => save.fame >= ROOMS[type].fame;

class Game {
  constructor(save, seed) {
    this.save = save;
    this.rand = makeRng(seed == null ? (Date.now() & 0xffffffff) : seed);
    this.events = [];
    this.phase = 'summer';
    this.run = null;
  }

  emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }

  unlockedSpecies() {
    return SPECIES_ORDER.filter((sp) => roomUnlocked(this.save, SPECIES[sp].room));
  }

  // ---- autumn -------------------------------------------------------------

  startAutumn() {
    const s = this.save;
    const count = {};
    let rooms = 0;
    for (const g of s.grid) if (g.room) { count[g.room] = (count[g.room] || 0) + 1; rooms++; }
    const n = Math.min(guestsWanted(s), rooms + 1);
    const left = { ...count };
    const plan = [];
    const unl = this.unlockedSpecies();
    const missing = unl.filter((sp) => !count[SPECIES[sp].room]);
    if (s.year === 1) plan.push('fare', 'kirpi', 'fare');
    else {
      for (let k = 0; k < n; k++) {
        const types = Object.keys(left).filter((t) => left[t] > 0);
        if (missing.length && k > 0 && (types.length === 0 || this.rand() < 0.12)) {
          plan.push(this.pick(missing));
          continue;
        }
        if (!types.length) break;
        let roll = this.rand() * types.reduce((a, t) => a + left[t], 0), t = types[0];
        for (const x of types) { roll -= left[x]; if (roll < 0) { t = x; break; } }
        left[t]--;
        plan.push(this.pick(ROOMS[t].species));
      }
    }
    this.phase = 'autumn';
    this.run = {
      year: s.year, t: 0, plan, nextAt: 1.0, queue: [], guests: [], nextId: 1,
      left: 0, endT: 0,
    };
    this.emit('autumn', { count: plan.length });
  }

  roomGuest(i) { return this.run ? this.run.guests.find((g) => g.cell === i && !g.gone) : null; }

  freeRoomFor(sp) {
    const type = SPECIES[sp].room;
    return this.save.grid.findIndex((g, i) => g.room === type && !this.roomGuest(i));
  }

  placeGuest(id, cell) {
    if (this.phase !== 'autumn') return 'phase';
    const run = this.run, q = run.queue.find((x) => x.id === id);
    if (!q) return 'gone';
    const g = this.save.grid[cell];
    if (!g || !g.room) return 'noRoomHere';
    if (g.room !== SPECIES[q.sp].room) return 'wrongRoom';
    if (this.roomGuest(cell)) return 'occupied';
    run.queue.splice(run.queue.indexOf(q), 1);
    run.guests.push({
      id: q.id, sp: q.sp, cell, sleep: 100, blanket: true, offT: 0,
      snore: 0, rest: 6 + this.rand() * 8, woke: false, gone: false, drain: 0, by: null,
    });
    this.emit('placed', { id, cell, sp: q.sp });
    return 'ok';
  }

  leaveQueue(q, why) {
    const run = this.run;
    run.queue.splice(run.queue.indexOf(q), 1);
    run.left++;
    this.emit('left', { id: q.id, sp: q.sp, why });
  }

  updateAutumn(dt) {
    const run = this.run, s = this.save;
    run.t += dt;
    if (run.plan.length && run.t >= run.nextAt && run.queue.length < TUNE.queueMax) {
      const sp = run.plan.shift();
      const patience = TUNE.patience + (s.upgrades.ilan ? TUNE.patienceIlan : 0) + (s.year === 1 ? 20 : 0);
      run.queue.push({ id: run.nextId++, sp, wait: 0, patience, noRoomT: 0 });
      run.nextAt = run.t + TUNE.autumnGap;
      this.emit('arrive', { id: run.nextId - 1, sp });
    }
    for (const q of run.queue.slice()) {
      q.wait += dt;
      if (this.freeRoomFor(q.sp) < 0) {
        q.noRoomT += dt;
        if (q.noRoomT > TUNE.noRoomWait) { this.leaveQueue(q, 'noRoom'); continue; }
      } else q.noRoomT = 0;
      if (q.wait > q.patience) this.leaveQueue(q, 'patience');
    }
    if (!run.plan.length && !run.queue.length) {
      run.endT += dt;
      if (run.endT > 1.0) this.startWinter();
    }
  }

  // ---- winter -------------------------------------------------------------

  startWinter() {
    const run = this.run, s = this.save;
    this.phase = 'winter';
    run.t = 0;
    run.len = TUNE.winterLen(s.year);
    run.temp = TUNE.tempStart;
    run.heat = [];
    run.logCd = 0;
    run.wps = [];
    run.wpId = 1;
    run.nextWp = s.year >= TUNE.wpFrom ? 6 + this.rand() * 6 : Infinity;
    run.ayazAt = s.year >= TUNE.ayazFrom ? 22 + this.rand() * 25 : Infinity;
    run.ayaz = 0;
    run.coldFlag = false;
    run.hotFlag = false;
    run.squirrels = [];
    for (let k = 0; k < s.staff.sincap; k++) run.squirrels.push({ x: SQ_HOME(k).x, y: SQ_HOME(k).y, state: 'idle', target: null, t: 0, k });
    run.owl = s.staff.baykus ? { state: 'perch', target: null, t: 0, col: 3 } : null;
    run.deer = s.staff.geyik ? { cd: 0, t: 0 } : null;
    this.emit('winter', { len: run.len });
    if (!run.guests.length) run.t = run.len;
  }

  noiseMult() { return this.save.upgrades.yosun ? TUNE.yosunNoise : 1; }

  addLog(by) {
    if (this.phase !== 'winter') return false;
    const run = this.run;
    if (by !== 'geyik') {
      if (run.logCd > 0) return false;
      run.logCd = TUNE.logCooldown;
    }
    run.heat.push(TUNE.logHeat);
    this.emit('log', { by: by || 'player' });
    return true;
  }

  pendingHeat() { return this.run.heat.reduce((a, b) => a + b, 0); }

  tapRoom(cell) {
    if (this.phase !== 'winter') return false;
    const g = this.roomGuest(cell);
    if (!g || g.woke) return false;
    let did = false;
    if (!g.blanket) { g.blanket = true; g.offT = 0; this.emit('tucked', { cell, by: 'player' }); did = true; }
    if (g.snore > 0) { g.snore = 0; g.rest = TUNE.snoreRest; this.emit('rolled', { cell }); did = true; }
    return did;
  }

  shoo(id, by) {
    const run = this.run;
    if (this.phase !== 'winter') return false;
    const wp = run.wps.find((w) => w.id === id);
    if (!wp) return false;
    run.wps.splice(run.wps.indexOf(wp), 1);
    this.emit('shoo', { id, col: wp.col, by: by || 'player' });
    return true;
  }

  updateWinter(dt) {
    const run = this.run, s = this.save, T = TUNE;
    run.t += dt;
    run.logCd = Math.max(0, run.logCd - dt);

    // Stove.
    if (run.t >= run.ayazAt && !run.ayazDone) {
      run.ayaz = T.ayazLen; run.ayazDone = true; this.emit('ayaz');
    } else if (!run.ayazDone && run.ayazAt - run.t < 3 && !run.ayazWarned) {
      run.ayazWarned = true; this.emit('ayazWarn');
    }
    if (run.ayaz > 0) { run.ayaz -= dt; if (run.ayaz <= 0) this.emit('ayazEnd'); }
    const decay = T.decay * (s.year === 1 ? 0.75 : 1) * (s.upgrades.duvar ? T.decayDuvar : 1) * (run.ayaz > 0 ? T.ayazDecay : 1);
    run.temp -= decay * dt;
    for (let k = run.heat.length - 1; k >= 0; k--) {
      const add = Math.min(run.heat[k], T.logHeat * dt / T.logTime);
      run.temp += add;
      run.heat[k] -= add;
      if (run.heat[k] <= 0.001) run.heat.splice(k, 1);
    }
    run.temp = Math.max(0, Math.min(100, run.temp));
    if (run.temp < T.ZONE[0] && !run.coldFlag) { run.coldFlag = true; this.emit('cold'); }
    if (run.temp > T.ZONE[0] + 3) run.coldFlag = false;
    if (run.temp > T.ZONE[1] && !run.hotFlag) { run.hotFlag = true; this.emit('hot'); }
    if (run.temp < T.ZONE[1] - 3) run.hotFlag = false;

    // Woodpeckers.
    const awake = run.guests.filter((g) => !g.gone);
    if (s.year >= T.wpFrom && awake.length) {
      run.nextWp -= dt;
      const maxWp = 1 + Math.floor(s.year / 5);
      if (run.nextWp <= 0 && run.t < run.len - 4) {
        run.nextWp = T.wpGap(s.year) * (0.7 + 0.6 * this.rand());
        if (run.wps.length < maxWp) {
          const used = new Set(run.wps.map((w) => w.col));
          let cols = [...new Set(awake.map((g) => cellRC(g.cell).c))].filter((c) => !used.has(c));
          if (!cols.length) cols = [0, 1, 2, 3].filter((c) => !used.has(c));
          if (cols.length) {
            const wp = { id: run.wpId++, col: this.pick(cols), t: 0 };
            run.wps.push(wp);
            this.emit('wp', { id: wp.id, col: wp.col });
          }
        }
      }
    }
    for (const wp of run.wps.slice()) {
      wp.t += dt;
      if (wp.t > T.wpLen) { run.wps.splice(run.wps.indexOf(wp), 1); this.emit('wpGone', { id: wp.id, col: wp.col }); }
    }

    // Guests: blankets slip, some start snoring.
    const bRate = s.year === 1 ? T.blanketRateY1 : T.blanketRate;
    for (const g of awake) {
      const sp = SPECIES[g.sp];
      g.rest -= dt;
      if (sp.blanket && g.blanket && this.rand() < bRate * sp.toss * dt) {
        g.blanket = false; g.offT = 0; this.emit('blanket', { cell: g.cell, sp: g.sp });
      }
      if (!g.blanket) g.offT += dt;
      if (sp.snore && g.snore <= 0 && g.rest <= 0 && this.rand() < T.snoreRate * sp.snore * dt) {
        g.snore = T.snoreLen; this.emit('snore', { cell: g.cell, sp: g.sp });
      }
      if (g.snore > 0) {
        g.snore -= dt;
        if (g.snore <= 0) { g.snore = 0; g.rest = T.snoreRest * 0.5; }
      }
    }

    // Sleep.
    const nm = this.noiseMult();
    const ninni = !!s.upgrades.ninni;
    for (const g of awake) {
      const sp = SPECIES[g.sp], { r, c } = cellRC(g.cell);
      let d = 0;
      if (run.temp < T.ZONE[0]) d += T.coldDrain * (T.ZONE[0] - run.temp) / T.ZONE[0] * sp.cold;
      if (run.temp > T.ZONE[1]) d += T.heatDrain * (run.temp - T.ZONE[1]) / (100 - T.ZONE[1]) * sp.heat;
      if (!g.blanket && sp.blanket) d += T.blanketDrain * (0.5 + 0.5 * sp.cold);
      for (const wp of run.wps) if (wp.col === c) d += T.woodDrain * T.wpFalloff[r] * sp.noise * nm;
      for (const n of neighbours(g.cell)) {
        const o = this.roomGuest(n);
        if (o && o.snore > 0 && !o.woke) d += T.snoreDrain * sp.noise * nm;
      }
      d *= LEVELS[s.grid[g.cell].lvl].drain * (ninni ? T.ninniDrain : 1);
      g.drain = d;
      if (d > 0.05) g.sleep -= d * dt;
      else g.sleep += (T.regen + (ninni ? T.regenNinni : 0)) * dt;
      g.sleep = Math.max(0, Math.min(100, g.sleep));
      if (g.sleep <= 0) {
        g.woke = true; g.gone = true; g.snore = 0;
        this.emit('woke', { cell: g.cell, sp: g.sp, id: g.id });
      }
    }

    this.updateStaff(dt);
    if (run.t >= run.len) this.startSpring();
  }

  updateStaff(dt) {
    const run = this.run, T = TUNE;
    // Squirrels tuck in fallen blankets.
    for (const sq of run.squirrels) {
      if (sq.state === 'idle' || sq.state === 'home') {
        let best = null, bd = Infinity;
        for (const g of run.guests) {
          if (g.gone || g.blanket || g.offT < T.sincapDelay || g.by != null) continue;
          const { r, c } = cellRC(g.cell), dd = Math.abs(c - sq.x) + Math.abs(r - sq.y);
          if (dd < bd) { bd = dd; best = g; }
        }
        if (best) { best.by = sq.k; sq.target = best.id; sq.state = 'go'; }
        else if (sq.state === 'idle') sq.state = 'home';
      }
      if (sq.state === 'go') {
        const g = run.guests.find((x) => x.id === sq.target);
        if (!g || g.gone) { sq.state = 'idle'; sq.target = null; continue; }
        const { r, c } = cellRC(g.cell);
        if (this.moveTo(sq, c, r, T.sincapSpeed * dt)) {
          if (!g.blanket) { sq.state = 'tuck'; sq.t = 0; } else { g.by = null; sq.state = 'idle'; sq.target = null; }
        }
      } else if (sq.state === 'tuck') {
        sq.t += dt;
        if (sq.t >= T.sincapTuck) {
          const g = run.guests.find((x) => x.id === sq.target);
          if (g && !g.gone && !g.blanket) { g.blanket = true; g.offT = 0; this.emit('tucked', { cell: g.cell, by: 'sincap' }); }
          if (g) g.by = null;
          sq.state = 'idle'; sq.target = null;
        }
      } else if (sq.state === 'home') {
        if (this.moveTo(sq, SQ_HOME(sq.k).x, SQ_HOME(sq.k).y, T.sincapSpeed * dt)) sq.state = 'rest';
      }
      if (sq.state === 'rest') {
        // Resting at the entrance until a blanket needs tucking.
        if (run.guests.some((g) => !g.gone && !g.blanket && g.offT >= T.sincapDelay && g.by == null)) sq.state = 'idle';
      }
    }
    // The owl chases woodpeckers.
    const owl = run.owl;
    if (owl) {
      owl.t += dt;
      if (owl.state === 'perch') {
        const wp = run.wps.find((w) => w.t >= T.baykusDelay);
        if (wp) { owl.state = 'fly'; owl.target = wp.id; owl.col = wp.col; owl.t = 0; }
      } else if (owl.state === 'fly' && owl.t >= T.baykusFly) {
        this.shoo(owl.target, 'baykus');
        owl.state = 'back'; owl.t = 0;
      } else if (owl.state === 'back' && owl.t >= T.baykusFly) {
        owl.state = 'perch'; owl.t = 0;
      }
      if (owl.state === 'fly' && !run.wps.some((w) => w.id === owl.target)) { owl.state = 'back'; owl.t = 0; }
    }
    // The reindeer feeds the stove.
    const deer = run.deer;
    if (deer) {
      deer.cd -= dt; deer.t += dt;
      if (deer.cd <= 0 && run.temp + this.pendingHeat() < T.geyikBelow) {
        this.addLog('geyik'); deer.cd = T.geyikCooldown; deer.t = 0;
      }
    }
  }

  moveTo(o, x, y, step) {
    const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
    if (d <= step) { o.x = x; o.y = y; return true; }
    o.x += dx / d * step; o.y += dy / d * step;
    return false;
  }

  // ---- spring -------------------------------------------------------------

  startSpring() {
    const run = this.run, s = this.save;
    this.phase = 'spring';
    run.t = 0;
    run.wps = [];
    const rows = [];
    let pay = 0, tip = 0, hearts = 0;
    for (const g of run.guests) {
      const lvl = s.grid[g.cell].lvl;
      const h = heartsFor(g.sleep, g.woke), p = payFor(g.sp, lvl, g.sleep, g.woke);
      rows.push({ id: g.id, sp: g.sp, cell: g.cell, sleep: Math.round(g.woke ? 0 : g.sleep), hearts: h, pay: p.pay, tip: p.tip, woke: g.woke });
      pay += p.pay; tip += p.tip; hearts += h;
    }
    const starsBefore = starsFor(s.fame);
    const unlockedBefore = ROOM_ORDER.filter((t) => roomUnlocked(s, t));
    s.money += pay + tip;
    s.fame += hearts;
    s.total.guests += rows.length;
    s.total.hearts += hearts;
    s.total.nuts += pay + tip;
    s.total.woke += rows.filter((x) => x.woke).length;
    s.year += 1;
    const unlocked = ROOM_ORDER.filter((t) => roomUnlocked(s, t) && !unlockedBefore.includes(t));
    run.results = {
      year: run.year, rows, pay, tip, hearts, left: run.left,
      starsBefore, starsAfter: starsFor(s.fame), unlocked,
    };
    this.emit('spring', { results: run.results });
  }

  updateSpring(dt) {
    this.run.t += dt;
    if (this.run.t >= TUNE.springLen) { this.phase = 'summary'; this.emit('summary', { results: this.run.results }); }
  }

  toSummer() {
    if (this.phase !== 'summary' && this.phase !== 'spring') return;
    this.phase = 'summer';
    this.emit('summer');
  }

  // ---- summer: building ---------------------------------------------------

  dig(i) {
    const s = this.save, cost = digCost(dugCount(s));
    if (this.phase !== 'summer' || !canDig(s, i)) return 'no';
    if (s.money < cost) return 'money';
    s.money -= cost; s.grid[i].dug = true;
    this.emit('dug', { cell: i, cost });
    return 'ok';
  }

  build(i, type) {
    const s = this.save, g = s.grid[i], R = ROOMS[type];
    if (this.phase !== 'summer' || !g.dug || g.room || !R) return 'no';
    if (!roomUnlocked(s, type)) return 'locked';
    if (s.money < R.cost) return 'money';
    s.money -= R.cost; g.room = type; g.lvl = 1;
    this.emit('built', { cell: i, type, cost: R.cost });
    return 'ok';
  }

  upgradeRoom(i) {
    const s = this.save, g = s.grid[i];
    if (this.phase !== 'summer' || !g.room || g.lvl >= 3) return 'no';
    const cost = upgradeCost(g.room, g.lvl);
    if (s.money < cost) return 'money';
    s.money -= cost; g.lvl++;
    this.emit('upgraded', { cell: i, lvl: g.lvl, cost });
    return 'ok';
  }

  demolish(i) {
    const s = this.save, g = s.grid[i];
    if (this.phase !== 'summer' || !g.room) return 'no';
    const back = Math.round(ROOMS[g.room].cost / 2);
    s.money += back; g.room = null; g.lvl = 1;
    this.emit('demolished', { cell: i, back });
    return 'ok';
  }

  itemCost(id) {
    if (STAFF[id]) { const n = this.save.staff[id]; return n >= STAFF[id].max ? null : STAFF[id].cost[n]; }
    if (UPGRADES[id]) return this.save.upgrades[id] ? null : UPGRADES[id].cost;
    return null;
  }

  buy(id) {
    const s = this.save, cost = this.itemCost(id);
    if (this.phase !== 'summer' || cost == null) return 'no';
    if (s.money < cost) return 'money';
    s.money -= cost;
    if (STAFF[id]) s.staff[id]++; else s.upgrades[id] = true;
    this.emit('bought', { id, cost });
    return 'ok';
  }

  // ---- loop ---------------------------------------------------------------

  update(dt) {
    if (this.phase === 'autumn') this.updateAutumn(dt);
    else if (this.phase === 'winter') this.updateWinter(dt);
    else if (this.phase === 'spring') this.updateSpring(dt);
  }
}
