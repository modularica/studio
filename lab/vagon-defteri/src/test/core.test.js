// Çekirdek denemesi: node test/core.test.js
// Yapay ivme ve çizgilerle: sarsıntı sezme, temizleme, durak sezme, kodlama.
const C = require('../core.js');
let fail = 0, pass = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

// tekrarlanabilir gürültü
let seed = 7;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function gauss() { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); }

// 60 Hz ivme: tren titreşimi (10–25 Hz), el hareketi (1 Hz), sarsıntılar [t, süre ms, tepe m/s²]
function motion(T, opt) {
  const out = [];
  for (let t = 0; t <= T; t += 1000 / 60) {
    const s = t / 1000;
    const amp = opt.amp ? opt.amp(t) : 0.25;
    let ax = amp * (Math.sin(2 * Math.PI * 13 * s) + 0.6 * Math.sin(2 * Math.PI * 21 * s + 1)) + 0.05 * gauss();
    let ay = amp * (Math.sin(2 * Math.PI * 17 * s + 2) + 0.5 * Math.sin(2 * Math.PI * 24 * s)) + 0.05 * gauss();
    let az = amp * 0.7 * Math.sin(2 * Math.PI * 11 * s + 0.5) + 0.05 * gauss();
    if (opt.hand) { ax += opt.hand * Math.sin(2 * Math.PI * 1.1 * s); ay += opt.hand * 0.8 * Math.cos(2 * Math.PI * 0.9 * s); }
    for (const [jt, dur, pk] of (opt.jolts || [])) {
      if (t >= jt && t <= jt + dur) { const u = (t - jt) / dur; const p = pk * Math.sin(Math.PI * u); ax += p * 0.8; ay += p * 0.6; az += p * 0.3; }
    }
    out.push({ t, ax, ay, az });
  }
  return out;
}
function windowsFor(samples, level) {
  const M = new C.MotionMeter(level || 'orta');
  for (const s of samples) M.push(s.t, s.ax, s.ay, s.az);
  return M.windows.map(w => ({ t0: w.t0, t1: w.t1 }));
}
// düz çizgi, 120 Hz nokta; spike(t) -> y sapması
function line(t0, dur, x0, x1, y, dev) {
  const pts = [];
  for (let t = t0; t <= t0 + dur; t += 1000 / 120) {
    const u = (t - t0) / dur;
    pts.push({ x: x0 + (x1 - x0) * u, y: y + (dev ? dev(t) : 0), t });
  }
  return pts;
}
function maxDevY(pts, y) { return Math.max(...pts.map(p => Math.abs(p.y - y))); }

console.log('Sarsıntı sezme');
{
  const quiet = motion(20000, {});
  ok(windowsFor(quiet).length === 0, 'sakin trende (0.25 m/s² titreşim) sarsıntı yok');
  const hand = motion(20000, { hand: 0.6 });
  ok(windowsFor(hand).length === 0, 'el hareketi (1 Hz, 0.6 m/s²) sarsıntı sayılmaz');
  ok(windowsFor(quiet, 'cok').length === 0 && windowsFor(hand, 'cok').length === 0, '"çok" ayarında da sakin trende sarsıntı yok');
  const j = motion(20000, { jolts: [[5000, 70, 5], [12000, 90, 3.5]] });
  const w = windowsFor(j);
  ok(w.length === 2, 'iki sarsıntı, iki pencere (' + w.length + ')');
  ok(w[0] && w[0].t0 >= 4990 && w[0].t0 <= 5060, 'pencere sarsıntıyla başlıyor (' + (w[0] && Math.round(w[0].t0)) + ' ms)');
  const soft = windowsFor(motion(20000, { jolts: [[5000, 70, 1.3]] }), 'orta');
  ok(soft.length === 0, '"orta"da hafif sarsıntı (1.3) geçer');
  const soft2 = windowsFor(motion(20000, { jolts: [[5000, 70, 1.3]] }), 'cok');
  ok(soft2.length === 1, '"çok"ta aynı sarsıntı yakalanır');
}

console.log('Çizgi temizleme');
{
  // sarsıntı 5000. ms'de; parmak 20 ms sonra 60 birim kayıyor, 180 ms'de dönüyor
  const W = windowsFor(motion(8000, { jolts: [[5000, 70, 5]] }));
  const dev = t => (t > 5020 && t < 5200) ? 60 * Math.sin(Math.PI * (t - 5020) / 180) : 0;
  const pts = line(4500, 1000, 100, 700, 500, dev);
  ok(maxDevY(pts, 500) > 55, 'ham çizgide 60 birimlik sıçrama var');
  const r = C.cleanStroke(pts, W, { minDev: 8 });
  ok(r.fixes.length === 1, 'bir düzeltme');
  ok(maxDevY(r.pts, 500) < 3, 'temiz çizgi düz (en çok ' + maxDevY(r.pts, 500).toFixed(1) + ' birim sapma)');
  ok(Math.abs(r.pts[0].x - 100) < 1 && Math.abs(r.pts[r.pts.length - 1].x - 700) < 1, 'uçlar yerinde');

  // aynı sarsıntı ama parmak kımıldamamış
  const r2 = C.cleanStroke(line(4500, 1000, 100, 700, 500), W, { minDev: 8 });
  ok(r2.fixes.length === 0 && r2.pts.length === line(4500, 1000, 100, 700, 500).length, 'parmak kaymadıysa çizgiye dokunulmaz');

  // sarsıntı yokken sert köşe
  const zig = [];
  for (let i = 0; i < 60; i++) zig.push({ x: 100 + i * 5, y: 500 + (i % 20 < 10 ? i % 10 : 10 - (i % 10)) * 12, t: 6000 + i * 8 });
  const r3 = C.cleanStroke(zig, W, { minDev: 8 });
  ok(r3.fixes.length === 0 && r3.pts.length === zig.length, 'sarsıntı penceresi dışındaki zikzak olduğu gibi kalır');

  // uzun sarsıntılı yol (1.5 sn): silme yok
  const Wl = windowsFor(motion(8000, { jolts: [[5000, 1500, 4]] }));
  const r4 = C.cleanStroke(line(4500, 2000, 100, 700, 500, t => (t > 5000 && t < 6500) ? 20 * Math.sin(t / 30) : 0), Wl, { minDev: 8 });
  ok(r4.fixes.length === 0, 'uzun sarsıntıda çizgi silinmez');

  // çizginin sonunda sarsıntı: sıçrayan kuyruk kesilir
  const tail = line(4600, 450, 100, 400, 500, t => t > 5020 ? (t - 5020) * 0.9 : 0);
  const r5 = C.cleanStroke(tail, W, { minDev: 8 });
  ok(maxDevY(r5.pts, 500) < 3 && r5.pts.length < tail.length, 'sondaki sıçrama kesilir');

  // daire çizerken sonda sarsıntı ama parmak kaymamış: kuyruk kalır
  const circ = [];
  for (let t = 4600; t <= 5150; t += 1000 / 120) { const a = (t - 4600) / 160; circ.push({ x: 400 + 100 * Math.cos(a), y: 400 + 100 * Math.sin(a), t }); }
  const r7 = C.cleanStroke(circ, W, { minDev: 8 });
  ok(r7.pts.length === circ.length, 'dairenin sonundaki sarsıntıda parmak kaymadıysa kuyruk kalır');

  // titreyen parmak (±1.5 birim), sonda sarsıntı, kayma yok: kuyruk kalır
  const jit = line(4600, 450, 100, 400, 500, () => (rnd() - 0.5) * 3);
  const r8 = C.cleanStroke(jit, W, { minDev: 8 });
  ok(r8.pts.length === jit.length, 'titrek ama kaymamış kuyruk kesilmez');

  // çizgi sürerken açık pencere: kuyruk bekletilir
  const live = line(4600, 450, 100, 400, 500);
  const r6 = C.cleanStroke(live, [{ t0: 4950, t1: 5050, open: true }], { minDev: 8, live: true });
  ok(r6.held > 0 && r6.pts.length < live.length, 'sarsıntı sürerken son noktalar gösterilmez (' + r6.held + ')');
}

console.log('Yumuşatma ve kodlama');
{
  const pts = line(0, 500, 0, 300, 100, t => 3 * Math.sin(t / 7));
  const s = C.smooth(pts, 4);
  ok(Math.abs(s[0].x) < 0.01 && Math.abs(s[s.length - 1].x - 300) < 0.01, 'yumuşatma uçları oynatmaz');
  ok(maxDevY(s, 100) < maxDevY(pts, 100), 'yumuşatma titremeyi azaltır');
  const simp = C.simplify(s, 0.6);
  ok(simp.length < s.length, 'sadeleştirme nokta azaltır (' + s.length + ' → ' + simp.length + ')');
  const back = C.decode(C.encode(simp));
  ok(back.length === simp.length && back.every((p, i) => Math.abs(p.x - simp[i].x) <= 0.25 && Math.abs(p.y - simp[i].y) <= 0.25), 'kodla / çöz yarım birim hassas');
}

console.log('Durak sezme (yapay yolculuk: 4 durak)');
{
  // giderken 0.3 genlik titreşim, duruşta 0.01 + elde çizim (1 Hz, 0.5)
  const segs = [];
  let t = 0;
  const plan = [['go', 140], ['stop', 35], ['go', 160], ['stop', 30], ['go', 150], ['stop', 40], ['go', 120]];
  for (const [k, secs] of plan) { segs.push([t, t + secs * 1000, k]); t += secs * 1000; }
  const amp = tt => { const sg = segs.find(s => tt >= s[0] && tt < s[1]); return sg && sg[2] === 'stop' ? 0.01 : 0.3; };
  const samples = motion(t, { amp, hand: 0.5 });
  const M = new C.MotionMeter('orta'), D = new C.StopDetector();
  const evs = [];
  let nextVib = 0, vibStop = 0, vibGo = 0, nS = 0, nG = 0;
  for (const s of samples) {
    const r = M.push(s.t, s.ax, s.ay, s.az);
    if (s.t >= nextVib) {
      nextVib += 100;
      const e = D.push(s.t, r.vib);
      if (e) evs.push([e, Math.round(s.t / 1000)]);
      if (amp(s.t) < 0.1 && s.t % 1000 < 20) { vibStop += r.vib; nS++; } else if (s.t % 1000 < 20) { vibGo += r.vib; nG++; }
    }
  }
  console.log('    titreşim: giderken ' + (vibGo / nG).toFixed(3) + ', dururken ' + (vibStop / nS).toFixed(3) + ' m/s²; olaylar ' + JSON.stringify(evs));
  const stops = evs.filter(e => e[0] === 'stop').map(e => e[1]);
  ok(stops.length === 3, 'üç duruş sezildi (' + stops.length + ')');
  ok(stops.every((st, i) => Math.abs(st - [146, 341, 521][i]) <= 6), 'duruşlar zamanında (beklenen 146, 341, 521): ' + stops.join(', '));
  ok(evs.filter(e => e[0] === 'go').length === 3, 'üç kalkış sezildi');
}

console.log('Marmaray');
{
  const L = C.LINES.marmaray.stations;
  ok(L.length === 43, '43 istasyon');
  ok(L.indexOf('Halkalı') - L.indexOf('Göztepe') === 18, 'Göztepe → Halkalı 18 durak');
  const trip = { line: 'marmaray', at: L.indexOf('Göztepe'), dir: 1, moving: true };
  ok(C.tripTitle(trip) === 'Göztepe → Feneryolu', 'başlık: ' + C.tripTitle(trip));
  ok(C.tripTitle({ line: 'marmaray', at: 42, dir: 1, moving: true }) === 'Halkalı', 'son durakta tek ad');
}

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
