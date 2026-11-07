const { loadGame, play } = require('./bot');
const A = loadGame();

const PLAYERS = {
  kid:  { react: 2.0, gap: 1.1, accuracy: 0.85, buyStaff: true, fun: 0.6 },
  avg:  { react: 1.2, gap: 0.7, accuracy: 0.92, buyStaff: true, fun: 0.8 },
  fast: { react: 0.6, gap: 0.4, accuracy: 0.97, buyStaff: true, fun: 0.95 },
  kidNoStaff: { react: 2.0, gap: 1.1, accuracy: 0.85, buyStaff: false, fun: 0.6 },
  kidChoresOnly: { react: 2.0, gap: 1.1, accuracy: 0.85, buyStaff: true, fun: 0 },
};
const years = +(process.argv[2] || 14);
const which = process.argv[3] ? process.argv[3].split(',') : Object.keys(PLAYERS);
const seeds = [1, 2, 3, 4, 5, 6];

for (const name of which) {
  const runs = seeds.map((s) => play(A, PLAYERS[name], years, s));
  console.log(`\n== ${name} (avg of ${seeds.length} runs)`);
  console.log('yr guests left woke sleep hearts earned extra aurora caught dreams apm stars fame rooms money staff');
  for (let y = 0; y < years; y++) {
    const rows = runs.map((r) => r[y]);
    const m = (k) => (rows.reduce((a, r) => a + r[k], 0) / rows.length);
    const f = (k, d = 0) => m(k).toFixed(d).padStart(5);
    console.log(`${String(y + 1).padStart(2)} ${f('guests', 1)} ${f('left', 1)} ${f('woke', 1)} ${f('avgSleep')} ${f('hearts', 1)} ${f('earned')} ${f('extra')} ${f('auroras', 1)} ${f('caught')} ${f('dreams', 1)} ${f('apm')} ${f('stars', 1)} ${f('fame')} ${f('rooms', 1)} ${f('moneyAfter')}  ${rows[0].staff}`);
  }
}
