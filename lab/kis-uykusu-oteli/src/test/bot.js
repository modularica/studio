// Balance test: a bot plays many years with a given reaction speed.
// Run: node test/run-sim.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame() {
  const ctx = { console, Math, Date, Object, Array, Set, Infinity, isFinite, JSON };
  vm.createContext(ctx);
  const src = ['data.js', 'sim.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  vm.runInContext(src + '\nthis.API = { Game, newSave, cleanSave, FOOD_ORDER, SPECIES, ROOMS, STAFF, UPGRADES, TUNE, starsFor, guestsWanted, canDig, digCost, dugCount, upgradeCost, cellRC, ROOM_ORDER, STAFF_ORDER, UPGRADE_ORDER, COLS, ROWS };', ctx);
  return ctx.API;
}

class Bot {
  constructor(A, game, opt) {
    this.A = A; this.g = game; this.o = opt; this.cd = 0; this.coldT = 0; this.actions = 0;
  }
  tick(dt) {
    const g = this.g, run = g.run, o = this.o;
    this.cd -= dt;
    if (g.phase === 'autumn') {
      if (this.cd > 0) return;
      for (const q of run.queue) {
        if (q.wait < o.react * 1.5) continue;
        const cell = g.freeRoomFor(q.sp);
        if (cell >= 0) { g.placeGuest(q.id, cell); this.cd = o.gap * 1.5; this.actions++; return; }
      }
    } else if (g.phase === 'winter') {
      if (run.temp + g.pendingHeat() < 40) this.coldT += dt; else this.coldT = 0;
      if (this.cd > 0) return;
      if (o.lazyStove && this.coldT < o.react * 2) { /* slow to notice the stove */ }
      else if (this.coldT >= o.react && run.temp + g.pendingHeat() < 52) { if (g.addLog()) { this.cd = o.gap; this.actions++; return; } }
      const wp = run.wps.find((w) => w.t >= o.react);
      if (wp) { g.shoo(wp.id); this.cd = o.gap; this.actions++; return; }
      let best = null, bs = Infinity;
      for (const x of run.guests) {
        if (x.gone) continue;
        const need = (!x.blanket && x.offT >= o.react) || (x.snore > 0 && (this.A.TUNE.snoreLen - x.snore) >= o.react);
        if (need && x.sleep < bs) { bs = x.sleep; best = x; }
      }
      if (best && this.g.rand() < o.accuracy) { g.tapRoom(best.cell); this.cd = o.gap; this.actions++; return; }
      if (best) { this.cd = o.gap; return; }   // missed tap
      // nothing to fix: chase the fun things
      if (o.fun) {
        const d = run.drops.find((x) => x.p > 0.25 && x.p < 0.95 && x.p / x.v >= o.react * 0.6);
        if (d && this.g.rand() < o.fun) { g.catchDrop(d.id); this.cd = o.gap * 0.8; this.actions++; return; }
        const dr = run.guests.find((x) => !x.gone && x.dream && x.dream.t >= o.react);
        if (dr && this.g.rand() < o.fun) { g.feed(dr.cell, dr.dream.item); this.cd = o.gap * 2; this.actions++; return; }
      }
    } else if (g.phase === 'summary') {
      g.toSummer();
    }
  }

  summer() {
    const A = this.A, g = this.g, s = g.save;
    let guard = 0;
    while (guard++ < 40) {
      const rooms = s.grid.filter((x) => x.room).length;
      const empties = s.grid.map((x, i) => i).filter((i) => s.grid[i].dug && !s.grid[i].room);
      const unl = A.ROOM_ORDER.filter((t) => s.fame >= A.ROOMS[t].fame);
      const count = (t) => s.grid.filter((x) => x.room === t).length;
      const want = A.guestsWanted(s);
      // 1. advertising is cheap and early
      if (s.year >= 2 && !s.upgrades.ilan && s.money >= A.UPGRADES.ilan.cost) { g.buy('ilan'); continue; }
      // 2. a room for every new kind of guest, more rooms while guests outnumber them
      const needRoom = rooms < want;
      const extra = empties.length ? 0 : A.digCost(A.dugCount(s));
      const cands = [];
      const newType = unl.slice().reverse().find((t) => count(t) === 0);
      if (newType) cands.push(newType);
      if (needRoom) cands.push(...unl.slice().reverse().filter((t) => count(t) < 3), 'yuva');
      const type = cands.find((t) => A.ROOMS[t].cost + extra <= s.money) || null;
      if (type) {
        if (empties.length) { if (g.build(empties[0], type) === 'ok') continue; }
        else {
          const dig = s.grid.map((x, i) => i).filter((i) => A.canDig(s, i)).sort((a, b) => a - b)[0];
          if (dig != null && g.dig(dig) === 'ok') continue;
        }
      }
      // 3. helpers once the hotel is busy
      if (rooms >= 5 && this.o.buyStaff) {
        const order = ['sincap', 'geyik', 'baykus', 'duvar', 'sincap', 'yosun', 'ninni', 'sincap'];
        let bought = false;
        for (const id of order) {
          const c = g.itemCost(id);
          if (c != null && s.money >= c) { g.buy(id); bought = true; break; }
          if (c != null) break;    // save up for the next one in order
        }
        if (bought) continue;
      }
      // 4. upgrade the best-paying room
      if (rooms >= 8) {
        const up = s.grid.map((x, i) => i).filter((i) => s.grid[i].room && s.grid[i].lvl < 3)
          .sort((a, b) => A.SPECIES[A.ROOMS[s.grid[b].room].species[0]].price - A.SPECIES[A.ROOMS[s.grid[a].room].species[0]].price)[0];
        if (up != null && g.upgradeRoom(up) === 'ok') continue;
      }
      break;
    }
  }
}

function play(A, opt, years, seed) {
  const save = A.newSave();
  const g = new A.Game(save, seed);
  const bot = new Bot(A, g, opt);
  const log = [];
  for (let y = 0; y < years; y++) {
    g.startAutumn();
    bot.actions = 0;
    let winterT = 0, minTemp = 100, maxTemp = 0, coldS = 0, hotS = 0;
    let guard = 0;
    while (g.phase !== 'summer' && guard++ < 100000) {
      g.update(0.05);
      bot.tick(0.05);
      if (g.phase === 'winter') {
        winterT += 0.05; minTemp = Math.min(minTemp, g.run.temp); maxTemp = Math.max(maxTemp, g.run.temp);
        if (g.run.temp < A.TUNE.ZONE[0]) coldS += 0.05;
        if (g.run.temp > A.TUNE.ZONE[1]) hotS += 0.05;
      }
      g.takeEvents();
    }
    const r = g.run.results;
    const avg = r.rows.length ? r.rows.reduce((a, x) => a + x.sleep, 0) / r.rows.length : 0;
    log.push({
      year: r.year, guests: r.rows.length, left: r.left, woke: r.rows.filter((x) => x.woke).length,
      avgSleep: Math.round(avg), hearts: r.hearts, earned: r.pay + r.tip, apm: Math.round(bot.actions / Math.max(1, winterT) * 60),
      cold: Math.round(coldS), hot: Math.round(hotS),
      stars: A.starsFor(save.fame), fame: save.fame,
      rooms: save.grid.filter((x) => x.room).length,
      auroras: r.auroras, caught: r.caught, dreams: r.dreams, extra: r.caught + r.dreamTip,
    });
    bot.summer();
    log[log.length - 1].moneyAfter = save.money;
    log[log.length - 1].staff = `${save.staff.sincap}${save.staff.baykus}${save.staff.geyik}`;
    log[log.length - 1].upg = Object.keys(save.upgrades).join(',');
  }
  return log;
}

module.exports = { loadGame, play };
