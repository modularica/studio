// Küçük Mühendisler — fizik çekirdeği.
// Tarayıcıda window.KM olarak, Node'da require('./sim') ile çalışır.
// Sabit zaman adımı (1/120 sn) kullanır: aynı kurulum + aynı adımda basılan
// düğme her seferinde aynı sonucu verir.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('planck'));
  else root.KM = factory(root.planck);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (pl) {
  'use strict';

  const W = 16, H = 10, DT = 1 / 120;

  // Ayar düğmeleri. Bölümler bu değerlerle doğrulandı; değiştirirsen testleri yeniden çalıştır.
  const T = {
    G: 15,
    R: 0.28,
    ballFriction: 0.5, ballRest: 0.2, ballAngDamp: 0.3, ballLinDamp: 0.02,
    plank: 0.14,
    springV: 11.5,
    pistonDist: 1.0, pistonV: 11, pistonHold: 0.12, pistonBackV: 4,
    fanLen: 6, fanForce: 1.2, fanFalloff: 0.1,
    beltV: 7.5,
    restTime: 1.5,
    maxTime: 40,
  };

  const PARTS = {
    ramp:   { orients: ['dr', 'dl', 'flat'], w: 2, h: 1 },
    spring: { orients: ['u'], w: 1, h: 1 },
    belt:   { orients: ['r', 'l'], w: 2, h: 1 },
    piston: { orients: ['u', 'r', 'l'], w: 1, h: 1, manual: 'press' },
    fan:    { orients: ['r', 'l', 'u'], w: 1, h: 1, manual: 'hold' },
    sensor: { orients: ['-'], w: 1, h: 1, sensor: true },
  };

  const DIRS = { u: [0, 1], r: [1, 0], l: [-1, 0], d: [0, -1] };

  function cellsOf(p) {
    const d = PARTS[p.type], out = [];
    for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) out.push([p.x + i, p.y + j]);
    return out;
  }

  function rampLine(o) {
    if (o === 'dr') return [[0, 1], [2, 0]];
    if (o === 'dl') return [[0, 0], [2, 1]];
    return [[0, 0], [2, 0]];
  }

  function pistonGeom(o) {
    if (o === 'u') return { base: [0.14, 0, 0.86, 0.6], head: [0.04, 0.82, 0.96, 1.0] };
    if (o === 'r') return { base: [0, 0.14, 0.6, 0.86], head: [0.82, 0.04, 1.0, 0.96] };
    return { base: [0.4, 0.14, 1, 0.86], head: [0, 0.04, 0.18, 0.96] };
  }

  function fanZone(p) {
    const L = T.fanLen;
    if (p.o === 'r') return [p.x + 1, p.y + 0.05, p.x + 1 + L, p.y + 0.95];
    if (p.o === 'l') return [p.x - L, p.y + 0.05, p.x, p.y + 0.95];
    return [p.x + 0.05, p.y + 1, p.x + 0.95, p.y + 1 + L];
  }

  const CUP = { wall: 0.12, rim: 0.8 };
  const cupsOf = level => level.cups || [level.cup];
  const startsOf = level => level.balls || [level.start];
  function cupBoxes(cup) {
    const { x, y, w } = cup, t = CUP.wall, out = [];
    const back = cup.back || null;
    const lh = back && back.side === 'l' ? back.h : CUP.rim;
    const rh = back && back.side === 'r' ? back.h : CUP.rim;
    out.push([x, y, x + t, y + lh]);
    out.push([x + w - t, y, x + w, y + rh]);
    out.push([x, y, x + w, y + t]);
    return out;
  }

  // Parçaları çizim ve test için ortak sıraya koyar: önce bölümün sabit
  // parçaları, sonra oyuncunun parçaları. Elle kumandalı cihazlar 1, 2, 3...
  function listParts(level, placed) {
    const all = [];
    (level.fixed || []).forEach((f, i) => all.push(Object.assign({ id: 'f' + i, fixed: true }, f)));
    (placed || []).forEach(p => all.push(p));
    let n = 0;
    for (const p of all) if (PARTS[p.type].manual) p.num = ++n; else delete p.num;
    return all;
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // Hücre başına duvarla kaplı oran (0..1), 5x5 örnekle.
  function coverage(level) {
    const cov = {};
    const rects = (level.walls || []).filter(w => typeof w[0] === 'number');
    for (const c of cupsOf(level)) rects.push(...cupBoxes(c));
    const polys = (level.walls || []).filter(w => typeof w[0] !== 'number');
    for (let cx = 0; cx < W; cx++) for (let cy = 0; cy < H; cy++) {
      let hit = 0;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const x = cx + 0.1 + i * 0.2, y = cy + 0.1 + j * 0.2;
        if (rects.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]) || polys.some(pg => pointInPoly(x, y, pg))) hit++;
      }
      if (hit) cov[cx + ',' + cy] = hit / 25;
    }
    return cov;
  }

  // Oyuncunun parça koyamayacağı hücreler.
  function occupancy(level) {
    const cov = coverage(level);
    const solid = new Set(), sensor = new Set();
    for (const k in cov) { if (cov[k] > 0) solid.add(k); if (cov[k] >= 0.5) sensor.add(k); }
    for (const c of cupsOf(level)) for (let i = 0; i < c.w; i++) solid.add((c.x + i) + ',' + c.y);
    if (level.pipe) solid.add(level.pipe.x + ',' + level.pipe.y);
    for (const f of level.fixed || []) for (const q of cellsOf(f)) solid.add(q[0] + ',' + q[1]);
    return { solid, sensor };
  }

  function canPlace(level, occ, parts, cand, ignoreId) {
    const d = PARTS[cand.type];
    if (cand.x < 0 || cand.y < 0 || cand.x + d.w > W || cand.y + d.h > H) return false;
    const mine = cellsOf(cand).map(q => q[0] + ',' + q[1]);
    if (d.sensor) {
      if (mine.some(k => occ.sensor.has(k))) return false;
      for (const p of parts) if (p.id !== ignoreId && PARTS[p.type].sensor && cellsOf(p).some(q => mine.includes(q[0] + ',' + q[1]))) return false;
      return true;
    }
    if (mine.some(k => occ.solid.has(k))) return false;
    for (const p of parts) if (p.id !== ignoreId && !PARTS[p.type].sensor && cellsOf(p).some(q => mine.includes(q[0] + ',' + q[1]))) return false;
    return true;
  }

  function createSim(level, placed) {
    const world = new pl.World({ gravity: pl.Vec2(0, -T.G) });
    const statics = world.createBody();
    const box = (body, r, opts, ud) => {
      const f = body.createFixture(
        pl.Box((r[2] - r[0]) / 2, (r[3] - r[1]) / 2, pl.Vec2((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), 0),
        Object.assign({ friction: 0.6 }, opts || {}));
      if (ud) f.setUserData(ud);
      return f;
    };

    for (const w of level.walls || []) {
      if (typeof w[0] === 'number') box(statics, w);
      else statics.createFixture(pl.Polygon(w.map(q => pl.Vec2(q[0], q[1]))), { friction: 0.6 });
    }
    const cups = cupsOf(level);
    for (const c of cups) for (const r of cupBoxes(c)) box(statics, r);

    const parts = listParts(level, placed);
    const rts = [], pistons = [], fans = [], sensors = [], byId = {};
    for (const p of parts) {
      const rt = { p, type: p.type, o: p.o, x: p.x, y: p.y, num: p.num || 0,
        state: 'idle', offset: 0, timer: 0, held: false, latched: false, on: false, blade: 0,
        flash: 0, compress: 0, inside: false, link: null, fires: 0 };
      byId[p.id] = rt;
      rts.push(rt);
      if (p.type === 'ramp') {
        const [a, b] = rampLine(p.o);
        const ax = p.x + a[0], ay = p.y + a[1], bx = p.x + b[0], by = p.y + b[1];
        const len = Math.hypot(bx - ax, by - ay);
        statics.createFixture(pl.Box(len / 2, T.plank / 2, pl.Vec2((ax + bx) / 2, (ay + by) / 2), Math.atan2(by - ay, bx - ax)),
          { friction: 0.6 });
      } else if (p.type === 'spring') {
        box(statics, [p.x + 0.08, p.y, p.x + 0.92, p.y + 0.36], { friction: 0.6 }, { kind: 'spring', rt });
      } else if (p.type === 'belt') {
        box(statics, [p.x, p.y - T.plank / 2, p.x + 2, p.y + T.plank / 2], { friction: 0.9 }, { kind: 'belt', rt });
      } else if (p.type === 'piston') {
        const g = pistonGeom(p.o);
        box(statics, [p.x + g.base[0], p.y + g.base[1], p.x + g.base[2], p.y + g.base[3]]);
        const head = world.createKinematicBody({ position: pl.Vec2(0, 0) });
        box(head, [p.x + g.head[0], p.y + g.head[1], p.x + g.head[2], p.y + g.head[3]], { friction: 0.6 }, { kind: 'head', rt });
        rt.head = head;
        pistons.push(rt);
      } else if (p.type === 'fan') {
        box(statics, [p.x + 0.16, p.y + 0.16, p.x + 0.84, p.y + 0.84]);
        rt.zone = fanZone(p);
        fans.push(rt);
      } else if (p.type === 'sensor') {
        sensors.push(rt);
      }
    }
    for (const s of sensors) s.link = s.p.link != null ? (byId[s.p.link] || null) : null;

    const balls = startsOf(level).map((st, i) => {
      const b = world.createDynamicBody({ position: pl.Vec2(st.x, st.y), bullet: true,
        angularDamping: T.ballAngDamp, linearDamping: T.ballLinDamp });
      b.createFixture(pl.Circle(T.R), { density: 1, friction: T.ballFriction, restitution: T.ballRest })
        .setUserData({ kind: 'ball', i });
      b.setLinearVelocity(pl.Vec2(st.vx || 0, st.vy || 0));
      if (st.vx && !st.vy) b.setAngularVelocity(-(st.vx) / T.R);
      return b;
    });
    const ball = balls[0];
    const mass = ball.getMass();
    const need = Math.min(level.need || balls.length, balls.length);

    const launches = [];
    world.on('begin-contact', c => {
      const fa = c.getFixtureA(), fb = c.getFixtureB(), ua = fa.getUserData(), ub = fb.getUserData();
      const s = ua && ua.kind === 'spring' ? ua.rt : ub && ub.kind === 'spring' ? ub.rt : null;
      const bf = ua && ua.kind === 'ball' ? fa : ub && ub.kind === 'ball' ? fb : null;
      if (!s || !bf) return;
      const body = bf.getBody(), bp = body.getPosition();
      if (bp.y > s.y + 0.36 && bp.x > s.x - 0.05 && bp.x < s.x + 1.05) launches.push([s, body]);
    });
    world.on('pre-solve', c => {
      const ua = c.getFixtureA().getUserData(), ub = c.getFixtureB().getUserData();
      if (ua && ua.kind === 'belt') c.setTangentSpeed((ua.rt.o === 'r' ? 1 : -1) * T.beltV);
      else if (ub && ub.kind === 'belt') c.setTangentSpeed((ub.rt.o === 'r' ? -1 : 1) * T.beltV);
      if ((ua && ua.kind === 'head') || (ub && ub.kind === 'head')) c.setRestitution(0);
    });

    const sim = {
      world, ball, balls, rts, pistons, fans, sensors, need,
      bstate: balls.map(() => 'run'), goals: 0,
      devices: rts.filter(r => PARTS[r.type].manual),
      steps: 0, status: 'run', presses: 0, restT: 0, goalStep: -1,
      trails: balls.map(() => []),
      time() { return sim.steps * DT; },
      press(rt, manual) {
        if (sim.status === 'out') return false;
        if (rt.type === 'piston') {
          if (rt.state !== 'idle') return false;
          rt.state = 'out'; rt.fires++;
          if (manual) sim.presses++;
          return true;
        }
        if (rt.type === 'fan') {
          // Sensör pervaneyi anahtar gibi açar; bir daha tetiklenirse kapatır.
          rt.latched = !rt.latched;
          if (manual) sim.presses++;
          return true;
        }
        return false;
      },
      hold(rt, down) {
        if (rt.type !== 'fan') return sim.press(rt, true);
        if (down && !rt.held) sim.presses++;
        rt.held = !!down;
        return true;
      },
      step() {
        if (sim.status === 'out') return;
        for (const rt of pistons) {
          const d = DIRS[rt.o];
          let v = 0;
          if (rt.state === 'out') {
            v = T.pistonV;
            if (rt.offset + v * DT >= T.pistonDist) { v = (T.pistonDist - rt.offset) / DT; rt.state = 'hold'; rt.timer = T.pistonHold; }
          } else if (rt.state === 'hold') {
            rt.timer -= DT;
            if (rt.timer <= 0) rt.state = 'back';
          } else if (rt.state === 'back') {
            v = -T.pistonBackV;
            if (rt.offset + v * DT <= 0) { v = -rt.offset / DT; rt.state = 'idle'; }
          }
          rt.offset += v * DT;
          rt.head.setLinearVelocity(pl.Vec2(d[0] * v, d[1] * v));
        }
        for (const rt of fans) {
          rt.on = rt.held || rt.latched;
          if (!rt.on) continue;
          rt.blade += DT * 30;
          const z = rt.zone, d = DIRS[rt.o];
          balls.forEach((b, i) => {
            if (sim.bstate[i] === 'out') return;
            const bp = b.getPosition();
            if (bp.x < z[0] || bp.x > z[2] || bp.y < z[1] || bp.y > z[3]) return;
            const dist = rt.o === 'r' ? bp.x - z[0] : rt.o === 'l' ? z[2] - bp.x : bp.y - z[1];
            const f = T.fanForce * mass * T.G * (1 - T.fanFalloff * Math.max(0, dist) / T.fanLen);
            b.applyForceToCenter(pl.Vec2(d[0] * f, d[1] * f), true);
          });
        }

        world.step(DT, 8, 3);
        sim.steps++;

        if (launches.length) {
          const done = new Set();
          for (const [sp, body] of launches) {
            sp.compress = 0.18;
            if (done.has(body)) continue;
            done.add(body);
            const v = body.getLinearVelocity();
            body.setLinearVelocity(pl.Vec2(v.x, T.springV));
          }
          launches.length = 0;
        }

        // Sensör, bir top hücrenin ortasına (gidiş yönünde) varınca bir kez tetikler;
        // aynı topla yeniden tetiklemek için topun hücreden çıkması gerekir.
        for (const s of sensors) {
          if (!s.armedBy) s.armedBy = balls.map(() => true);
          let any = false;
          balls.forEach((b, i) => {
            if (sim.bstate[i] === 'out') return;
            const p = b.getPosition(), bv = b.getLinearVelocity();
            const inside = p.x >= s.x && p.x < s.x + 1 && p.y >= s.y && p.y < s.y + 1;
            if (!inside) { s.armedBy[i] = true; return; }
            any = true;
            if (!s.armedBy[i]) return;
            const dx = p.x - (s.x + 0.5), dy = p.y - (s.y + 0.5), sp = Math.hypot(bv.x, bv.y);
            const hit = sp < 0.3 ? Math.hypot(dx, dy) < 0.35 : dx * bv.x + dy * bv.y >= 0;
            if (hit) { s.armedBy[i] = false; s.flash = 0.4; s.fires++; if (s.link) sim.press(s.link, false); }
          });
          s.inside = any;
        }
        for (const rt of rts) {
          if (rt.flash > 0) rt.flash -= DT;
          if (rt.compress > 0) rt.compress -= DT;
        }
        if (sim.steps % 3 === 0) balls.forEach((b, i) => {
          if (sim.bstate[i] === 'out' || sim.trails[i].length >= 1600) return;
          const p = b.getPosition(); sim.trails[i].push([p.x, p.y]);
        });

        let slow = true;
        balls.forEach((b, i) => {
          if (sim.bstate[i] === 'out') return;
          const v = b.getLinearVelocity();
          if (Math.hypot(v.x, v.y) >= 0.05 || Math.abs(b.getAngularVelocity()) >= 0.25) slow = false;
        });
        sim.restT = slow ? sim.restT + DT : 0;

        let goals = 0, outs = 0;
        balls.forEach((b, i) => {
          if (sim.bstate[i] === 'run') {
            const p = b.getPosition();
            if (cups.some(c => p.x > c.x + CUP.wall && p.x < c.x + c.w - CUP.wall && p.y > c.y && p.y < c.y + CUP.rim)) sim.bstate[i] = 'goal';
            else if (p.y < -1.5 || p.x < -1.5 || p.x > W + 1.5) { sim.bstate[i] = 'out'; b.setActive(false); }
          }
          if (sim.bstate[i] === 'goal') goals++; else if (sim.bstate[i] === 'out') outs++;
        });
        sim.goals = goals;
        if (sim.status === 'run') {
          if (goals >= need) { sim.status = 'goal'; sim.goalStep = sim.steps; }
          else if (outs > balls.length - need) sim.status = 'out';
          else if (sim.steps * DT > T.maxTime) sim.status = 'timeout';
        }
      },
    };
    return sim;
  }

  // Test ve bot için: kurulumu verilen girdilerle sonuna kadar çalıştırır.
  // inputs: [{t: saniye, num: cihaz no, act: 'press'|'down'|'up'}]
  function runHeadless(level, placed, inputs, maxSec) {
    const sim = createSim(level, placed);
    const queue = (inputs || []).map(i => Object.assign({ step: Math.round(i.t / DT) }, i)).sort((a, b) => a.step - b.step);
    const limit = Math.round((maxSec || 20) / DT);
    let qi = 0;
    while (sim.status === 'run' && sim.steps < limit) {
      while (qi < queue.length && queue[qi].step <= sim.steps) {
        const inp = queue[qi++];
        const dev = sim.devices.find(d => d.num === inp.num);
        if (!dev) continue;
        if (inp.act === 'press') sim.press(dev, true);
        else sim.hold(dev, inp.act === 'down');
      }
      sim.step();
    }
    const p = sim.ball.getPosition();
    return { status: sim.status, t: sim.steps * DT, presses: sim.presses, x: p.x, y: p.y, trail: sim.trails[0], trails: sim.trails, goals: sim.goals, sim };
  }

  return { W, H, DT, T, PARTS, DIRS, CUP, cupsOf, startsOf, cellsOf, coverage, occupancy, canPlace, pointInPoly, rampLine, pistonGeom, fanZone, cupBoxes, listParts, createSim, runHeadless };
}));
