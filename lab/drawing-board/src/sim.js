// Drawing Board — fizik çekirdeği.
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
    gateV: 7, gateLift: 0.98,
    magRange: 2.5, magV: 6, magA: 14, magK: 10, magMax: 4,
    flipLen: 1.6, flipDown: -0.3, flipUp: 0.45, flipW: 9, flipBackW: 5, flipPulse: 0.25,
    bumpMin: 9,
    balR: 0.42, balRise: 1.4, balK: 6, balMaxF: 3, balFanV: 2.6, balTop: 10.5, hookR: 0.08,
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
    // Kapı: bir kare geçit, yanındaki kare yuva. Basınca levha yuvaya çekilir (açık), bir daha basınca
    // geri gelir. 'u' dik kapı (yuva üstte, yolu keser); 'r' / 'l' yatay kapak (yuva sağda / solda).
    gate:   { orients: ['u', 'r', 'l'], w: 1, h: 2, dims: { r: [2, 1], l: [2, 1] }, manual: 'toggle' },
    // Mıknatıs: yüzü dönük olduğu yöne; basılı tutunca önündeki çelik bilyeleri çeker, sarı topa etkisi yok.
    magnet: { orients: ['u', 'r', 'l', 'd'], w: 1, h: 1, manual: 'hold' },
    // Flipper (langırt kolu): menteşe bir uçta; basılı tutunca kalkar, bırakınca iner. 'r' kol sağa, 'l' sola uzanır.
    // Sensöre bağlıysa bir kez vurur (kalkar, kısa bekler, iner).
    flipper: { orients: ['r', 'l'], w: 2, h: 1, manual: 'hold' },
    // Tampon: hücrenin köşegeninde sekitici levha. 'r' \ biçiminde (düşen topu sağa atar), 'l' / biçiminde.
    // Çarpan top en az T.bumpMin hızla geri sekiyor.
    bumper: { orients: ['r', 'l'], w: 1, h: 1 },
    // Makas: basınca hücresinden geçen ipleri keser (balon ipi ya da kancaya asılı top). Sensöre de bağlanır.
    cutter: { orients: ['-'], w: 1, h: 1, manual: 'press' },
    // İğne: balon değince patlar. Ucu o yöne bakar.
    pin: { orients: ['u', 'r', 'd', 'l'], w: 1, h: 1 },
  };

  const DIRS = { u: [0, 1], r: [1, 0], l: [-1, 0], d: [0, -1] };

  // Parçanın kapladığı alan (yönüne göre değişebilir).
  function sizeOf(p) {
    const d = PARTS[p.type], s = d.dims && d.dims[p.o];
    return s ? { w: s[0], h: s[1] } : { w: d.w, h: d.h };
  }
  function cellsOf(p) {
    const d = sizeOf(p), out = [];
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

  // Flipper: menteşe noktası ve yön (s = 1 kol sağa, -1 sola). Açı 0 yatay; T.flipDown aşağıda, T.flipUp yukarıda.
  function flipperGeom(p) {
    const s = p.o === 'r' ? 1 : -1;
    return { px: p.x + (s > 0 ? 0.25 : 1.75), py: p.y + 0.55, s };
  }
  function bumperLine(p) {
    // Köşeden köşeye (biraz taşarak): yerde yuvarlanan top da yüzüne çarpsın, ucuna değil.
    const e = 0.06;
    return p.o === 'r' ? [[p.x - e, p.y + 1 + e], [p.x + 1 + e, p.y - e]] : [[p.x - e, p.y - e], [p.x + 1 + e, p.y + 1 + e]];
  }

  // İğne: hücrenin tabanından o yöne uzanan sivri üçgen (dünya köşeleri).
  function pinTri(p) {
    const cx = p.x + 0.5, cy = p.y + 0.5, d = DIRS[p.o], n = [-d[1], d[0]];
    const base = [cx - d[0] * 0.45, cy - d[1] * 0.45], tip = [cx + d[0] * 0.42, cy + d[1] * 0.42];
    return [[base[0] + n[0] * 0.13, base[1] + n[1] * 0.13], tip, [base[0] - n[0] * 0.13, base[1] - n[1] * 0.13]];
  }
  // Doğru parçası dikdörtgeni kesiyor mu (makas için)
  function segHitsRect(a, b, r) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [pp, q] of [[-dx, a[0] - r[0]], [dx, r[2] - a[0]], [-dy, a[1] - r[1]], [dy, r[3] - a[1]]]) {
      if (pp === 0) { if (q < 0) return false; continue; }
      const t = q / pp;
      if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
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
  // Top çeşidi: ilk top sarı, diğerleri çelik bilye (bölüm 'kind' ile değiştirebilir). Fizikleri aynı;
  // yalnızca mıknatıs çelik bilyeyi çeker.
  const ballKinds = level => startsOf(level).map((st, i) => st.kind || (i ? 'steel' : 'yellow'));

  // Mıknatısın yüzü (ortası) ve yönü.
  function magnetFace(p) {
    const d = DIRS[p.o];
    return { x: p.x + 0.5 + d[0] * 0.35, y: p.y + 0.5 + d[1] * 0.35, d };
  }
  // Kapı levhası (kapalıyken), yuvası ve açılış yönü; parçanın sol alt köşesine göre.
  const GATES = {
    u: { plate: [0.4, 0.02, 0.6, 1.0], housing: [0.3, 1.0, 0.7, 2.0], dir: [0, 1], pass: [0, 0] },
    // Yatay kapağın üstü ve yuvası aynı hizada (0.6): zemin gibi üstünden yuvarlanılır.
    r: { plate: [0.02, 0.4, 1.0, 0.6], housing: [1.0, 0.32, 2.0, 0.6], dir: [1, 0], pass: [0, 0] },
    l: { plate: [1.0, 0.4, 1.98, 0.6], housing: [0.0, 0.32, 1.0, 0.6], dir: [-1, 0], pass: [1, 0] },
  };
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
    const d = PARTS[cand.type], z = sizeOf(cand);
    if (cand.x < 0 || cand.y < 0 || cand.x + z.w > W || cand.y + z.h > H) return false;
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
    const rts = [], pistons = [], fans = [], sensors = [], gates = [], magnets = [], flippers = [], byId = {};
    const kinds = ballKinds(level);
    for (const p of parts) {
      const rt = { p, type: p.type, o: p.o, x: p.x, y: p.y, num: p.num || 0,
        state: 'idle', offset: 0, timer: 0, held: false, latched: false, on: false, blade: 0,
        flash: 0, compress: 0, inside: false, link: null, fires: 0, open: false };
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
      } else if (p.type === 'gate') {
        const g = GATES[p.o];
        box(statics, [p.x + g.housing[0], p.y + g.housing[1], p.x + g.housing[2], p.y + g.housing[3]]);
        const plate = world.createKinematicBody({ position: pl.Vec2(0, 0) });
        box(plate, [p.x + g.plate[0], p.y + g.plate[1], p.x + g.plate[2], p.y + g.plate[3]], { friction: 0.3 }, { kind: 'gate', rt });
        rt.plate = plate;
        gates.push(rt);
      } else if (p.type === 'magnet') {
        box(statics, [p.x + 0.15, p.y + 0.15, p.x + 0.85, p.y + 0.85]);
        rt.face = magnetFace(p);
        magnets.push(rt);
      } else if (p.type === 'flipper') {
        const g = flipperGeom(p), s = g.s, L = T.flipLen;
        const body = world.createKinematicBody({ position: pl.Vec2(g.px, g.py), angle: s * T.flipDown });
        const pts = [[-0.13, -0.13], [L, -0.055], [L, 0.055], [-0.13, 0.13]].map(q => pl.Vec2(s * q[0], q[1]));
        body.createFixture(pl.Polygon(s > 0 ? pts : pts.reverse()), { friction: 0.5 }).setUserData({ kind: 'flipper', rt });
        box(statics, [g.px - 0.08, p.y + 0.1, g.px + 0.08, g.py - 0.14]);   // menteşe ayağı
        rt.body = body; rt.angle = T.flipDown; rt.pulse = 0; rt.s = s;
        flippers.push(rt);
      } else if (p.type === 'cutter') {
        rt.cuts = 0;
      } else if (p.type === 'pin') {
        statics.createFixture(pl.Polygon(pinTri(p).map(q => pl.Vec2(q[0], q[1]))), { friction: 0.2 }).setUserData({ kind: 'pin', rt });
      } else if (p.type === 'bumper') {
        const [a, b] = bumperLine(p);
        statics.createFixture(pl.Box(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, 0.07, pl.Vec2((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), Math.atan2(b[1] - a[1], b[0] - a[0])),
          { friction: 0, restitution: 0.9 }).setUserData({ kind: 'bumper', rt });
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

    // İpler ve balonlar (bölümün kendisinde): hangs = kancaya asılı top, balloons = topu taşıyan balon.
    const ropes = [], balloons = [];
    const tie = (bodyA, pa, bodyB, pb, len, extra) => {
      const j = world.createJoint(pl.RopeJoint({ maxLength: len, localAnchorA: bodyA.getLocalPoint(pa), localAnchorB: bodyB.getLocalPoint(pb) }, bodyA, bodyB));
      const r = Object.assign({ joint: j, bodyA, bodyB, la: bodyA.getLocalPoint(pa), lb: bodyB.getLocalPoint(pb), cut: false }, extra);
      ropes.push(r); return r;
    };
    (level.hangs || []).forEach(h => {
      const b = balls[h.ball || 0], bp = b.getPosition();
      statics.createFixture(pl.Circle(pl.Vec2(h.x, h.y), T.hookR), { isSensor: true });
      tie(statics, pl.Vec2(h.x, h.y), b, pl.Vec2(bp.x, bp.y + T.R), Math.max(0.1, h.y - bp.y - T.R), { kind: 'hang', hook: [h.x, h.y] });
    });
    (level.balloons || []).forEach((q, k) => {
      const b = balls[q.ball || 0], bp = b.getPosition(), len = q.len || 1.1;
      const body = world.createDynamicBody({ position: pl.Vec2(bp.x, bp.y + T.R + len + T.balR), fixedRotation: true, linearDamping: 0.4 });
      body.createFixture(pl.Circle(T.balR), { density: 0.05, friction: 0, restitution: 0.3 }).setUserData({ kind: 'balloon', k });
      const bl = { body, alive: true, popT: -1, k, x: bp.x, y: bp.y + T.R + len + T.balR };
      bl.rope = tie(body, pl.Vec2(bp.x, bp.y + T.R + len), b, pl.Vec2(bp.x, bp.y + T.R), len, { kind: 'balloon', balloon: bl, ballIdx: q.ball || 0 });
      balloons.push(bl);
    });
    const popQueue = [];
    const need = Math.min(level.need || balls.length, balls.length);

    const launches = [], bounces = [];
    world.on('begin-contact', c => {
      const fa = c.getFixtureA(), fb = c.getFixtureB(), ua = fa.getUserData(), ub = fb.getUserData();
      const bal = ua && ua.kind === 'balloon' ? ua : ub && ub.kind === 'balloon' ? ub : null;
      if (bal && ((ua && ua.kind === 'pin') || (ub && ub.kind === 'pin'))) popQueue.push(bal.k);
      const bu = ua && ua.kind === 'bumper' ? ua.rt : ub && ub.kind === 'bumper' ? ub.rt : null;
      const bb = ua && ua.kind === 'ball' ? fa : ub && ub.kind === 'ball' ? fb : null;
      if (bu && bb) bounces.push([bu, bb.getBody()]);
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
      world, ball, balls, kinds, rts, pistons, fans, sensors, gates, magnets, flippers, need, ropes, balloons, pops: 0,
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
        if (rt.type === 'fan' || rt.type === 'magnet') {
          // Sensör pervaneyi ve mıknatısı anahtar gibi açar; bir daha tetiklenirse kapatır.
          rt.latched = !rt.latched;
          if (manual) sim.presses++;
          return true;
        }
        if (rt.type === 'gate') {
          rt.open = !rt.open; rt.fires++;
          if (manual) sim.presses++;
          return true;
        }
        if (rt.type === 'cutter') {
          // Hücresinden geçen bütün ipler kesilir.
          const r0 = [rt.x, rt.y, rt.x + 1, rt.y + 1];
          for (const r of ropes) {
            if (r.cut) continue;
            const a = r.bodyA.getWorldPoint(r.la), b = r.bodyB.getWorldPoint(r.lb);
            if (segHitsRect([a.x, a.y], [b.x, b.y], r0)) { world.destroyJoint(r.joint); r.cut = true; rt.cuts++; }
          }
          rt.fires++; rt.snipT = 0.3;
          if (manual) sim.presses++;
          return true;
        }
        if (rt.type === 'flipper') {
          rt.pulse = T.flipPulse;
          if (manual) sim.presses++;
          return true;
        }
        return false;
      },
      hold(rt, down) {
        if (PARTS[rt.type].manual !== 'hold') return sim.press(rt, true);
        if (down && !rt.held) sim.presses++;
        // Flipper'a kısa dokunuş da tam vuruş olsun: en az T.flipPulse kalkık kalır.
        if (rt.type === 'flipper' && down && !rt.held) rt.pulse = T.flipPulse;
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
        for (const rt of gates) {
          const g = GATES[rt.o], target = rt.open ? T.gateLift : 0, gap = target - rt.offset;
          let v = 0;
          if (Math.abs(gap) > 1e-9) {
            v = Math.sign(gap) * T.gateV;
            if (Math.abs(gap) < Math.abs(v) * DT) v = gap / DT;
            // Kapanan levha önündeki topu ezmez: top çekilene kadar bekler.
            if (v < 0) {
              const o = rt.offset - 0.03;
              const x0 = rt.x + g.plate[0] + g.dir[0] * o, y0 = rt.y + g.plate[1] + g.dir[1] * o;
              const x1 = rt.x + g.plate[2] + g.dir[0] * rt.offset, y1 = rt.y + g.plate[3] + g.dir[1] * rt.offset;
              const r = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
              const hit = balls.some((b, i) => {
                if (sim.bstate[i] === 'out') return false;
                const bp = b.getPosition();
                const cx = Math.max(r[0], Math.min(bp.x, r[2])), cy = Math.max(r[1], Math.min(bp.y, r[3]));
                return Math.hypot(bp.x - cx, bp.y - cy) < T.R + 0.01;
              });
              if (hit) v = 0;
            }
          }
          rt.offset += v * DT;
          rt.plate.setLinearVelocity(pl.Vec2(g.dir[0] * v, g.dir[1] * v));
        }
        for (const rt of magnets) {
          rt.on = rt.held || rt.latched;
          if (!rt.on) continue;
          const fc = rt.face, d = fc.d;
          balls.forEach((b, i) => {
            if (sim.bstate[i] === 'out' || kinds[i] !== 'steel') return;
            const bp = b.getPosition(), rx = bp.x - fc.x, ry = bp.y - fc.y;
            if (rx * d[0] + ry * d[1] < -0.05 || Math.hypot(rx, ry) > T.magRange) return;
            // Alanın içinde bilye ağırlıksız gibi yüzün önündeki yuvaya yönlendirilir, orada tutulur:
            // hız, yuvaya kalan yola göre seçilen hıza doğru çekilir (kuvvet sınırlı).
            const tx = fc.x + d[0] * T.R - bp.x, ty = fc.y + d[1] * T.R - bp.y, tl = Math.hypot(tx, ty);
            const v = b.getLinearVelocity(), sp = Math.min(T.magV, Math.sqrt(2 * T.magA * tl));
            const ux = tl > 1e-6 ? tx / tl : 0, uy = tl > 1e-6 ? ty / tl : 0;
            let fx = mass * T.magK * (ux * sp - v.x), fy = mass * T.magK * (uy * sp - v.y) + mass * T.G;
            const fl = Math.hypot(fx, fy), cap = T.magMax * mass * T.G;
            if (fl > cap) { fx *= cap / fl; fy *= cap / fl; }
            b.applyForceToCenter(pl.Vec2(fx, fy), true);
            if (tl < 0.3) b.setAngularVelocity(b.getAngularVelocity() * 0.9);
          });
        }

        for (const rt of flippers) {
          if (rt.pulse > 0) rt.pulse -= DT;
          const was = rt.on;
          rt.on = rt.held || rt.pulse > 0;
          if (rt.on && !was) rt.fires++;
          const gap = (rt.on ? T.flipUp : T.flipDown) - rt.angle;
          let w = 0;
          if (Math.abs(gap) > 1e-9) {
            w = gap > 0 ? T.flipW : -T.flipBackW;
            if (Math.abs(gap) < Math.abs(w) * DT) w = gap / DT;
          }
          rt.angle += w * DT;
          rt.body.setAngularVelocity(rt.s * w);
        }

        // Balon: ağırlıksız gibi yükselir (ipindeki topu da taşır), açık pervanenin kuşağında rüzgârla sürüklenir.
        for (const bl of balloons) {
          if (!bl.alive) continue;
          const body = bl.body, v = body.getLinearVelocity(), bp = body.getPosition();
          const m = body.getMass() + (bl.rope.cut ? 0 : balls[bl.rope.ballIdx].getMass());
          let tx = 0, ty = T.balRise, wind = false;
          for (const rt of fans) {
            if (!rt.on) continue;
            const z = rt.zone;
            if (bp.x < z[0] - 0.3 || bp.x > z[2] + 0.3 || bp.y < z[1] - 0.3 || bp.y > z[3] + 0.3) continue;
            const d = DIRS[rt.o]; tx += d[0] * T.balFanV; ty += d[1] * T.balFanV; wind = true;
          }
          const cap = m * T.G * T.balMaxF;
          // Rüzgâr yokken yatayda yalnız hafif hava sürtünmesi: eğik tavana değen balon kayarak ilerler.
          const fx = Math.max(-cap, Math.min(cap, wind ? m * T.balK * (tx - v.x) : -m * 0.8 * v.x));
          const fy = Math.max(0, Math.min(cap, m * T.G + m * T.balK * (ty - v.y)));
          body.applyForceToCenter(pl.Vec2(fx, fy), true);
          if (bp.y > T.balTop) popQueue.push(bl.k);
        }
        for (const rt of rts) if (rt.snipT > 0) rt.snipT -= DT;

        world.step(DT, 8, 3);
        sim.steps++;

        while (popQueue.length) {
          const bl = balloons[popQueue.pop()];
          if (!bl || !bl.alive) continue;
          bl.alive = false; bl.popT = sim.steps; sim.pops++;
          const p = bl.body.getPosition(); bl.x = p.x; bl.y = p.y;
          if (!bl.rope.cut) { world.destroyJoint(bl.rope.joint); bl.rope.cut = true; }
          world.destroyBody(bl.body);
        }

        if (bounces.length) {
          // Tampon topu en az T.bumpMin hızla geri atar (langırttaki gibi canlı).
          const done = new Set();
          for (const [bu, body] of bounces) {
            bu.flash = 0.25;
            if (done.has(body)) continue;
            done.add(body); bu.fires++;
            const v = body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
            if (sp > 0.05 && sp < T.bumpMin) body.setLinearVelocity(pl.Vec2(v.x * T.bumpMin / sp, v.y * T.bumpMin / sp));
          }
          bounces.length = 0;
        }

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
            // Bayraklı kova (kind) yalnızca kendi renginden topu sayar.
            if (cups.some(c => (!c.kind || c.kind === kinds[i]) && p.x > c.x + CUP.wall && p.x < c.x + c.w - CUP.wall && p.y > c.y && p.y < c.y + CUP.rim)) sim.bstate[i] = 'goal';
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

  return { pinTri, segHitsRect, W, H, DT, T, PARTS, DIRS, CUP, GATES, cupsOf, startsOf, ballKinds, sizeOf, cellsOf, coverage, occupancy, canPlace, pointInPoly, rampLine, pistonGeom, fanZone, magnetFace, flipperGeom, bumperLine, cupBoxes, listParts, createSim, runHeadless };
}));
