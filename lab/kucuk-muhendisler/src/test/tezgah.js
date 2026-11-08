// Yeni bölüm denemeleri için tezgâh: node tests/lab.js <senaryo>
const KM = require('../sim');
const f = n => n.toFixed(2);

function sweepPress(L, parts, num, from, to, step) {
  const runs = []; let a = null, b = null, s = '';
  for (let t = from; t <= to + 1e-9; t += step) {
    const r = KM.runHeadless(L, parts, [{ t, num, act: 'press' }], 20);
    const ok = r.status === 'goal'; s += ok ? '#' : '.';
    if (ok) { if (a === null) a = t; b = t; } else if (a !== null) { runs.push([a, b]); a = null; }
  }
  if (a !== null) runs.push([a, b]);
  return { s, runs: runs.map(r => `${f(r[0])}–${f(r[1])} (${f(r[1] - r[0] + step)} sn)`).join(', ') || 'yok' };
}

function sensorScan(L, extra, link, region) {
  const occ = KM.occupancy(L), wins = [];
  for (let x = region[0]; x <= region[2]; x++) for (let y = region[1]; y <= region[3]; y++) {
    const s = { id: 99, type: 'sensor', o: '-', x, y, link };
    if (!KM.canPlace(L, occ, extra, s, null)) continue;
    const r = KM.runHeadless(L, extra.concat([s]), [], 20);
    wins.push(`${x},${y}:${r.status === 'goal' ? 'GOL' : r.status}`);
  }
  return wins.join(' ');
}

module.exports = { sweepPress, sensorScan, f };

if (require.main === module) {
  const which = process.argv[2];
  if (which === 'hizli') {
    const L = {
      start: { x: 3.5, y: 9.3 }, pipe: { x: 3, y: 9, dir: 'd' },
      walls: [[2.7, 0, 3, 4], [2.7, 5, 3, 9], [4, 0, 4.3, 4], [4, 5, 4.3, 9]],
      fixed: [{ type: 'piston', x: 2, y: 4, o: 'r' }],
      cup: { x: 6, y: 1, w: 2, back: { side: 'r', h: 3 } },
    };
    console.log('boş:', KM.runHeadless(L, [], [], 20).status);
    console.log('sensör taraması (sütun D):', sensorScan(L, [], 'f0', [3, 0, 3, 8]));
    const sw = sweepPress(L, [], 1, 0, 1.6, 0.005);
    console.log('elle pencere:', sw.runs);
  }
}
