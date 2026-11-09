// Kestirme arayıcı: node test/kestirme.js <seviye dosyası> <id> [keep=cutter,fan] [pairs] [noinp] [T=20]
const KM = require('../sim');
const [file, id, ...fl] = process.argv.slice(2);
const L = require(file).find(l => l.id === id);
const keep = (fl.find(x => x.startsWith('keep=')) || 'keep=').slice(5).split(',').filter(Boolean);
const s0 = (L.sol && L.sol[0]) || { parts: [], inputs: [] };
const base = s0.parts.filter(p => keep.includes(p.type)).map((p, i) => Object.assign({}, p, { id: i + 1 }));
const inputs = fl.includes('noinp') ? [] : (s0.inputs || []);
const occ = KM.occupancy(L);
const tray = Object.assign({}, L.tray);
for (const p of base) tray[p.type]--;
const devIds = [...base.filter(p => KM.PARTS[p.type].manual).map(p => p.id), ...(L.fixed || []).map((p, i) => 'f' + i).filter((_, i) => KM.PARTS[L.fixed[i].type].manual)];
const T = +((fl.find(x => x.startsWith('T=')) || 'T=20').slice(2));
function run(ps) {
  const sim = KM.createSim(L, [...base, ...ps]);
  const q = inputs.map(i => Object.assign({ step: Math.round(i.t / KM.DT) }, i)).sort((a, b) => a.step - b.step);
  let qi = 0; const lim = Math.round(T / KM.DT); const pts = [];
  while (sim.status === 'run' && sim.steps < lim) {
    while (qi < q.length && q[qi].step <= sim.steps) {
      const inp = q[qi++], dev = sim.devices.find(d => d.num === inp.num); if (!dev) continue;
      if (inp.act === 'press') sim.press(dev, true); else sim.hold(dev, inp.act === 'down');
    }
    sim.step();
    if (sim.steps % 6 === 0) {
      for (const b of sim.balls) { const p = b.getPosition(); pts.push([p.x, p.y]); }
      for (const bl of sim.balloons) if (bl.alive) { const p = bl.body.getPosition(); pts.push([p.x, p.y]); }
    }
    if (sim.restT > 1.5 && q.slice(qi).every(i => i.act === 'up') && sim.steps > 240) break;
  }
  return { ok: sim.status === 'goal', pts };
}
const zoneOf = p => {
  const c = KM.cellsOf(p); let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
  for (const [x, y] of c) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  const r = [[x0 - 0.7, y0 - 0.7, x1 + 0.7, y1 + 0.7]];
  if (p.type === 'fan') r.push(KM.fanZone(p));
  if (p.type === 'magnet') r.push([x0 - 2.5, y0 - 2.5, x1 + 2.5, y1 + 2.5]);
  return r;
};
const near = (p, pts) => zoneOf(p).some(z => pts.some(q => q[0] >= z[0] && q[0] <= z[2] && q[1] >= z[1] && q[1] <= z[3]));
const cand = [];
const only = (fl.find(x => x.startsWith('only=')) || '').slice(5).split(',').filter(Boolean);
for (const type of Object.keys(tray)) if (tray[type] > 0 && (!only.length || only.includes(type))) for (const o of KM.PARTS[type].orients) for (let x = 0; x < 16; x++) for (let y = 0; y < 10; y++) {
  for (const link of type === 'sensor' ? devIds : [undefined]) {
    const p = { id: 50, type, x, y, o }; if (link !== undefined) p.link = link;
    if (KM.canPlace(L, occ, base, p, null)) cand.push(p);
  }
}
const show = p => `${p.type}:${p.o}@${p.x},${p.y}${p.link !== undefined ? '>' + p.link : ''}`;
const b0 = run([]);
console.log(`taban ${base.map(show).join(' ') || '-'}: ${b0.ok ? 'ÇÖZÜLÜYOR' : 'olmuyor'}; aday ${cand.length}`);
const res = cand.map(p => near(p, b0.pts) ? run([p]) : b0);
const one = cand.filter((p, i) => res[i].ok);
console.log(`tek (${one.length}): ${one.slice(0, 30).map(show).join(' ')}`);
if (fl.includes('pairs')) {
  const two = []; let n = 0;
  for (let i = 0; i < cand.length; i++) for (let j = 0; j < cand.length; j++) {
    if (i === j) continue;
    const a = cand[i], b = Object.assign({}, cand[j], { id: 51 });
    if (!near(b, res[i].pts)) continue;           // b, a'lı yörüngeye değmiyorsa etkisiz
    if (j < i && near(a, res[j].pts)) continue;   // bu çift zaten (j,i) olarak denendi
    if (a.type === b.type && tray[a.type] < 2) continue;
    if (!KM.canPlace(L, occ, [...base, a], b, null)) continue;
    n++;
    if (run([a, b]).ok) two.push(show(a) + ' + ' + show(b));
  }
  console.log(`çift (${two.length}/${n}): ${two.slice(0, 30).join(' | ')}`);
}
