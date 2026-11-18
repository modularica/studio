// Kestirme arayıcı: node test/kestirme.js <seviye dosyası> <id> [keep=cutter,fan] [only=ramp,spring] [pairs] [noinp] [T=20] [max=60000]
// Tepsideki her parçanın her yeri/yönü tek başına, `pairs` ile ikili olarak denenir. Topun (balonun, ipin) yoluna
// değmeyen parçalar budanır; sürücüler (kol, dişli, kasnak, motor, vinç…) sabit sürücülere ya da eşine değiyorsa,
// mum alevi ipe/balona/sönük muma, merceğin odağı ipe/balona/muma yetişiyorsa denenir.
// Girdi şemaları: ilk çözümün girdileri, girdisiz, bütün cihazlar baştan basılı (`noinp`: ilk çözümünkiler hariç).
// keep: ilk çözümden sabit tutulacak türler (o parçalar tahtada kalır, tepsiden düşülür).
const KM = require('../sim');
const { PARTS } = KM;
const DRV = new Set(['crank', 'gear', 'lift', 'turbine', 'pulley', 'motor', 'winch']);
const show = p => `${p.type}:${p.o}@${p.x},${p.y}${p.link !== undefined && p.link !== null ? '>' + p.link : ''}`;

function run(L, parts, inputs, sec) {
  const sim = KM.createSim(L, parts);
  const q = (inputs || []).map(i => Object.assign({ step: Math.round(i.t / KM.DT) }, i)).sort((a, b) => a.step - b.step);
  let qi = 0, evN = -1, evT = 0; const lim = Math.round((sec || 20) / KM.DT); const pts = [], rope = [];
  while (sim.status === 'run' && sim.steps < lim) {
    while (qi < q.length && q[qi].step <= sim.steps) {
      const inp = q[qi++], dev = sim.devices.find(d => d.num === inp.num); if (!dev) continue;
      if (inp.act === 'press') sim.press(dev, true); else sim.hold(dev, inp.act === 'down');
    }
    sim.step();
    if (sim.steps % 6 === 0) {
      sim.balls.forEach((b, i) => { if (sim.bstate[i] !== 'out') { const p = b.getPosition(); pts.push([p.x, p.y]); } });
      for (const bl of sim.balloons) if (bl.alive) { const p = bl.body.getPosition(); pts.push([p.x, p.y, 'b']); }
      for (const r of sim.ropes) if (!r.cut) {
        const a = r.bodyA.getWorldPoint(r.la), b = r.bodyB.getWorldPoint(r.lb);
        for (let k = 0; k <= 8; k++) rope.push([a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8]);
      }
    }
    // Erken çıkış: top durdu ve bir şey olmuyor (ip yanmıyor, ateş yayılmıyor, dişli dönmüyor).
    const ev = sim.ropes.filter(r => r.cut).length + sim.candles.filter(c => c.lit).length + sim.pops + sim.unhooks;
    if (ev !== evN) { evN = ev; evT = sim.steps; }
    const busy = sim.steps - evT < 120 || sim.drives.some(d => d.spin) || sim.lifts.some(l => l.spin) || sim.ropes.some(r => !r.cut && r.heat > 0)
      || ((sim.candles.length || sim.lenses.length) && sim.ropes.some(r => !r.cut) && sim.steps * KM.DT < 15);
    if (sim.restT > 1.5 && !busy && q.slice(qi).every(i => i.act === 'up') && sim.steps > 240) break;
  }
  return { ok: sim.status === 'goal', pts, rope };
}

function search(L, opts) {
  opts = opts || {};
  const T = opts.T || 20;
  const s0 = (L.sol && L.sol[0]) || { parts: [], inputs: [] };
  const keep = opts.keep || [];
  const base = s0.parts.filter(p => keep.includes(p.type)).map((p, i) => Object.assign({ id: i + 1 }, p));
  const occ = KM.occupancy(L);
  const tray = Object.assign({}, L.tray);
  for (const p of base) tray[p.type]--;
  const fixed = (L.fixed || []).map((p, i) => Object.assign({ id: 'f' + i }, p));
  const targets0 = [...fixed, ...base].filter(p => PARTS[p.type].manual || PARTS[p.type].switched).map(p => p.id);
  const pulleys0 = [...fixed, ...base].filter(p => p.type === 'pulley').map(p => p.id);
  const drives0 = [...fixed, ...base].filter(p => DRV.has(p.type));
  const unlit0 = fixed.filter(p => p.type === 'candle' && p.unlit);
  const holdall = [];
  for (let num = 1; num <= 4; num++) holdall.push({ t: 0, num, act: 'down' }, { t: 60, num, act: 'up' });
  const scheds = opts.noinp || !(s0.inputs || []).length ? [[], holdall] : [s0.inputs, [], holdall];
  const cand = [];
  for (const type of Object.keys(tray)) {
    if (!(tray[type] > 0) || (opts.only && !opts.only.includes(type))) continue;
    for (const o of PARTS[type].orients) for (let x = 0; x < 16; x++) for (let y = 0; y < 10; y++) {
      // 'X' = çiftteki öbür parçaya bağlı sensör/düğme/kasnak
      const links = PARTS[type].sensor || PARTS[type].trigger ? [...targets0, 'X'] : type === 'pulley' ? [null, ...pulleys0, 'X'] : [undefined];
      for (const link of links) {
        const p = { id: 50, type, x, y, o }; if (link !== undefined) p.link = link;
        if (KM.canPlace(L, occ, base, p, null)) cand.push(p);
      }
    }
  }
  const cellsTouch = (a, b) => KM.cellsOf(a).some(([x, y]) => KM.cellsOf(b).some(([u, v]) => Math.abs(x - u) + Math.abs(y - v) <= 1));
  const zoneOf = p => {
    const c = KM.cellsOf(p); let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (const [x, y] of c) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    const r = [[x0 - 0.7, y0 - 0.7, x1 + 0.7, y1 + 0.7]];
    if (p.type === 'fan') r.push(KM.fanZone(p));
    if (p.type === 'magnet') r.push([x0 - 2.5, y0 - 2.5, x1 + 2.5, y1 + 2.5]);
    return r;
  };
  const inR = (q, z) => q[0] >= z[0] && q[0] <= z[2] && q[1] >= z[1] && q[1] <= z[3];
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function relevant(p, res, partner) {
    if (zoneOf(p).some(z => res.pts.some(q => inR(q, z)))) return true;
    if (DRV.has(p.type) && (drives0.some(d => cellsTouch(d, p)) || (partner && DRV.has(partner.type) && cellsTouch(partner, p)))) return true;
    if (p.type === 'pulley' && p.link) return true;
    if (p.type === 'cutter' && res.rope.some(q => inR(q, [p.x, p.y, p.x + 1, p.y + 1]))) return true;
    if (p.type === 'candle') {
      const z = KM.candleZone(p);
      if (res.rope.some(q => inR(q, z)) || res.pts.some(q => q[2] && inR(q, [z[0] - 0.45, z[1] - 0.45, z[2] + 0.45, z[3] + 0.45]))) return true;
      if (unlit0.some(c => d2(KM.candleFlame(p), KM.candleWick(c)) < 1.05)) return true;
    }
    if (p.type === 'lens') {
      const f = KM.lensFocus(p);
      if (res.rope.some(q => d2(q, f) < 0.3) || res.pts.some(q => q[2] && d2(q, f) < 0.5)) return true;
      if (unlit0.some(c => d2(f, KM.candleWick(c)) < 0.4)) return true;
    }
    if (partner && (PARTS[p.type].sensor || PARTS[p.type].trigger) && p.link === partner.id) return zoneOf(p).some(z => res.pts.some(q => inR(q, z)));
    return false;
  }
  const fix = (p, id, partnerId) => { const q = Object.assign({}, p, { id }); if (q.link === 'X') q.link = partnerId; return q; };
  const runAll = ps => {
    let best = null;
    for (const sc of scheds) {
      const r = run(L, [...base, ...ps], sc, T); if (r.ok) return r;
      if (!best) best = r; else { best.pts = best.pts.concat(r.pts); best.rope = best.rope.concat(r.rope); }
    }
    return best;
  };
  const b0 = runAll([]);
  const out = { base: base.map(show), baseOk: b0.ok, n: cand.length, one: [], two: [], tried2: 0 };
  const single = cand.filter(p => p.link !== 'X');
  const res = new Map();
  for (const p of single) {
    const q = fix(p, 50);
    const r = relevant(q, b0) ? runAll([q]) : null;
    res.set(p, r || b0);
    if (r && r.ok) out.one.push(show(q));
  }
  if (opts.pairs) {
    const seen = new Set();
    // `max` ile sınırlı aramada örnek yansız olsun: adaylar karışık sırada (sabit tohum, her seferinde aynı örnek).
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const mix = list => list.map(p => [rnd(), p]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const outerList = opts.maxPairs ? mix(single) : single, innerList = opts.maxPairs ? mix(cand) : cand;
    outer: for (const a0 of outerList) {
      const ra = res.get(a0), a = fix(a0, 50);
      for (const b0_ of innerList) {
        if (b0_ === a0) continue;
        if (a0.type === b0_.type && tray[a0.type] < 2) continue;
        const b = fix(b0_, 51, 50);
        if (b0_.link === 'X' && !(PARTS[a.type].manual || PARTS[a.type].switched || (b.type === 'pulley' && a.type === 'pulley'))) continue;
        const key = [show(a), show(b)].sort().join('+');
        if (seen.has(key)) continue;
        if (!relevant(b, ra, a)) continue;
        if (!KM.canPlace(L, occ, [...base, a], b, null)) continue;
        seen.add(key); out.tried2++;
        if (opts.maxPairs && out.tried2 > opts.maxPairs) break outer;
        if (runAll([a, b]).ok) out.two.push(show(a) + ' + ' + show(b));
      }
    }
  }
  return out;
}

if (require.main === module) {
  const [file, id, ...fl] = process.argv.slice(2);
  const L = require(require('path').resolve(file)).find(l => l.id === id);
  if (!L) { console.log(`${id}: yok`); process.exit(1); }
  const arg = k => (fl.find(x => x.startsWith(k + '=')) || '').slice(k.length + 1);
  const list = k => arg(k).split(',').filter(Boolean);
  const t0 = Date.now();
  const r = search(L, { keep: list('keep'), only: list('only').length ? list('only') : null, pairs: fl.includes('pairs'), noinp: fl.includes('noinp'), T: +arg('T') || 20, maxPairs: +arg('max') || 0 });
  console.log(`taban ${r.base.join(' ') || '-'}: ${r.baseOk ? 'ÇÖZÜLÜYOR' : 'olmuyor'}; aday ${r.n}`);
  console.log(`tek (${r.one.length}): ${r.one.slice(0, 30).join(' ')}`);
  if (fl.includes('pairs')) console.log(`çift (${r.two.length}/${r.tried2}): ${r.two.slice(0, 30).join(' | ')}`);
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} sn`);
}

module.exports = { run, search, show };
