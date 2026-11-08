// Bölüm tasarım aracı: node tests/design.js [bölüm-id] [--brute] [--sweep]
const KM = require('../sim');
const LEVELS = require('../levels');
const args = process.argv.slice(2);
const only = args.find(a => !a.startsWith('--'));
const brute = args.includes('--brute');
const sweep = args.includes('--sweep');
const trace = args.includes('--trace');
const f = n => n.toFixed(2);

const withIds = parts => parts.map((p, i) => Object.assign({ id: i + 1 }, p));

for (const L of LEVELS) {
  if (only && L.id !== only) continue;
  console.log(`\n=== ${L.id} — ${L.name}`);
  const occ = KM.occupancy(L);
  const z = KM.runHeadless(L, [], [], 20);
  console.log(`boş kurulum: ${z.status} t=${f(z.t)} son=(${f(z.x)},${f(z.y)})`);
  for (const s of L.sol || []) {
    const parts = withIds(s.parts);
    const valid = parts.every(p => KM.canPlace(L, occ, parts, p, p.id));
    const r = KM.runHeadless(L, parts, s.inputs, 20);
    console.log(`çözüm "${s.name}": ${r.status} t=${f(r.t)} basış=${r.presses} son=(${f(r.x)},${f(r.y)}) yerleşim=${valid ? 'geçerli' : 'GEÇERSİZ'}`);
    if (trace) console.log('  iz: ' + r.trail.filter((_, i) => i % 10 === 0).map(q => `(${q[0].toFixed(1)},${q[1].toFixed(1)})`).join(' '));
  }
  if (brute) {
    const types = Object.keys(L.tray || {});
    const wins = [];
    for (const type of types) for (const o of KM.PARTS[type].orients) for (let x = 0; x < 16; x++) for (let y = 0; y < 10; y++) {
      const p = { id: 1, type, x, y, o };
      if (type === 'sensor') p.link = (L.fixed || []).length ? 'f0' : null;
      if (!KM.canPlace(L, occ, [], p, null)) continue;
      const base = (L.sol && L.sol[0] && L.sol[0].inputs) || [];
      const r = KM.runHeadless(L, [p], type === 'sensor' ? [] : base, 20);
      if (r.status === 'goal') wins.push(`${type}:${o}@${x},${y}(${f(r.t)}s,b${r.presses})`);
    }
    console.log(`tek parça çözümleri (${wins.length}): ${wins.join(' ')}`);
  }
  if (sweep) {
    const s = (L.sol || []).find(q => q.inputs && (q.inputs.length === 1 || (q.inputs.length === 2 && q.inputs[0].act === 'down')));
    if (!s) continue;
    const parts = withIds(s.parts);
    const marks = [];
    let firstOk = null, lastOk = null, runs = [];
    for (let t = 0; t <= 8; t += 0.02) {
      let inputs;
      if (s.inputs.length === 1) inputs = [{ t, num: 1, act: 'press' }];
      else inputs = [{ t: s.inputs[0].t, num: 1, act: 'down' }, { t: s.inputs[0].t + t, num: 1, act: 'up' }];
      const r = KM.runHeadless(L, parts, inputs, 20);
      const ok = r.status === 'goal';
      marks.push(ok ? '#' : '.');
      if (ok) { if (firstOk === null) firstOk = t; lastOk = t; }
      else if (firstOk !== null) { runs.push([firstOk, lastOk]); firstOk = null; }
    }
    if (firstOk !== null) runs.push([firstOk, lastOk]);
    console.log('zaman taraması (0..8 sn, 0.02 adım):');
    for (let i = 0; i < marks.length; i += 100) console.log(`  ${f(i * 0.02).padStart(5)} ${marks.slice(i, i + 100).join('')}`);
    console.log('  başarılı pencereler: ' + runs.map(r => `${f(r[0])}–${f(r[1])} (${f(r[1] - r[0] + 0.02)} sn)`).join(', '));
  }
}
