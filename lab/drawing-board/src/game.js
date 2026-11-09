// Drawing Board — oyun arayüzü ve çizim. Arayüz metinleri İngilizce; Lab'a giden notlar Türkçe.
(function () {
  'use strict';
  const KM = window.KM, LEVELS = window.KM_LEVELS;
  const { W, H, DT, T, PARTS, DIRS } = KM;
  const TAU = Math.PI * 2;
  const NAMES = { ramp: 'Ramp', spring: 'Spring', belt: 'Conveyor', piston: 'Piston', fan: 'Fan', sensor: 'Sensor', gate: 'Gate', magnet: 'Magnet', flipper: 'Flipper', bumper: 'Bumper', cutter: 'Scissors', pin: 'Pin', crank: 'Crank', gear: 'Gear', lift: 'Lift', turbine: 'Turbine' };
  const ORDER = ['ramp', 'spring', 'belt', 'bumper', 'pin', 'gear', 'lift', 'turbine', 'gate', 'piston', 'fan', 'flipper', 'magnet', 'cutter', 'crank', 'sensor'];
  const DEFAULT_O = { ramp: 'dr', spring: 'u', belt: 'r', piston: 'u', fan: 'r', sensor: '-', gate: 'u', magnet: 'l', flipper: 'l', bumper: 'r', cutter: '-', pin: 'u', crank: 'cw', gear: '-', lift: 'r', turbine: 'cw' };
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const C = {};
  for (const k of ['paper', 'paper-hi', 'paper-deep', 'ink', 'ink-dim', 'hand', 'ball', 'eye', 'bad']) C[k] = css.getPropertyValue('--' + k).trim();
  const FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';
  const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
  const pad2 = n => String(n).padStart(2, '0');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------------------------------------------------------------- kayıt
  // İlerleme (damgalar, kurulumlar, son çizim) Lab'da hesaba eşitlenir; ses tercihi cihazda kalır.
  // Oyunun adı Kasım 2026'ya kadar "Küçük Mühendisler"di: eski anahtarlardaki kayıt bir kez taşınır.
  const KEY = 'drawing-board.v1';
  const DEVICE_KEY = 'drawing-board.device';
  try {
    for (const [now, old] of [[KEY, 'kucuk-muhendisler.v1'], [DEVICE_KEY, 'kucuk-muhendisler.cihaz']]) {
      const v = localStorage.getItem(old);
      if (localStorage.getItem(now) === null && v !== null) localStorage.setItem(now, v);
    }
  } catch (e) { /* kayıt yoksa da oynanır */ }
  let saved = {}, device = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  try { device = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') || {}; } catch (e) { device = {}; }
  if (device.muted === undefined && saved.muted !== undefined) device.muted = saved.muted;

  // Lab (uzigames.com/lab) bağlantıları: hesap.js varsa ilerleme notu ve "Nasıldı?" düğmeleri.
  const lab = {
    on: !!window.Hesap,
    note(t) { try { if (window.Hesap) window.Hesap.not(t); } catch (e) { /* yok say */ } },
  };

  const S = {
    li: 0, level: null, occ: null, parts: [], nextId: 1,
    mode: 'build', sim: null, acc: 0, endT: 0, restNoted: false, goalPlayed: false,
    trails: null, trailFail: null, lastFail: null, drag: null, press: null, linkFrom: null, snap: null,
    fx: [], prevV: [], prevState: [],
    held: new Map(), seen: null, time: 0,
    progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {},
    setups: saved.setups && typeof saved.setups === 'object' ? saved.setups : {},
    muted: !!device.muted,
    // Müzik tercihi ayrı; daha önce sesi kapatmış olanda müzik de kapalı başlar.
    music: device.music === undefined ? !device.muted : !!device.music,
    goalN: 0, goalAt: null, winAt: null, flashT: null, lastHit: [], introNew: null, newSeen: false,
  };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ progress: S.progress, setups: S.setups, li: S.li })); } catch (e) { /* kayıt yoksa da oynanır */ }
  }
  function persistDevice() {
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify({ muted: S.muted, music: S.music })); } catch (e) { /* yok say */ }
  }

  // Her çizimin getirdiği yenilik: ilk kez görülen parça, çelik bilye, bayraklı kova.
  // Önceki çizim ilk kez çözülünce sonuç penceresinde "New part unlocked!" olarak açılır;
  // çizimin içinde, çözülene kadar parça listesinde ve tahtada "New" yazar.
  const NEWS = {
    spring: ['New part', 'Spring', 'Launches any ball that lands on it.'],
    piston: ['New part', 'Piston', 'Press it at the right moment and it punches the ball.'],
    fan: ['New part', 'Fan', 'Hold it and it blows the ball along. It reaches 6 squares.'],
    sensor: ['New part', 'Sensor', 'When a ball crosses it, the linked device fires by itself.'],
    belt: ['New part', 'Conveyor', 'Carries the ball the way its arrows point.'],
    gate: ['New part', 'Gate', 'Press to open, press again to close. Laid flat, it is a trapdoor.'],
    magnet: ['New part', 'Magnet', 'Hold it to pull a steel ball in. Yellow balls ignore it.'],
    bumper: ['New part', 'Bumper', 'Bounces the ball off like a mirror, fast. Tap it to flip the slant.'],
    flipper: ['New part', 'Flipper', 'Press it and it swings up and hits the ball. A resting ball flies straight up.'],
    steel: ['New ball', 'Steel ball', 'A second ball. Both balls have to get in.'],
    flags: ['New cup', 'Flag cups', 'A flagged cup only takes the ball of its own color.'],
    cutter: ['New part', 'Scissors', 'Press it and it cuts any rope in its square.'],
    balloon: ['New thing', 'Balloon', 'It lifts its ball up. Wind from a fan pushes it along.'],
    pin: ['New part', 'Pin', 'Pops a balloon that touches it. The ball drops.'],
    crank: ['New part', 'Crank', 'Hold it and it turns the gear next to it.'],
    gear: ['New part', 'Gear', 'Gears side by side turn each other, each the other way round.'],
    turbine: ['New part', 'Turbine', 'Wind from a fan spins it, and it turns the gear next to it.'],
    lift: ['New part', 'Lift', 'A gear at its side moves it up or down. When the gear stops, it stays.'],
  };
  const INTRO = (() => {
    const seen = new Set();
    return LEVELS.map(L => {
      const got = [], types = KM.listParts(L, []).map(p => p.type).concat(Object.keys(L.tray || {}).filter(k => L.tray[k] > 0));
      for (const k of ORDER) if (types.includes(k) && !seen.has(k)) { seen.add(k); if (NEWS[k]) got.push(k); }
      if (!seen.has('steel') && KM.ballKinds(L).includes('steel')) { seen.add('steel'); got.push('steel'); }
      if (!seen.has('flags') && KM.cupsOf(L).some(c => c.kind)) { seen.add('flags'); got.push('flags'); }
      if (!seen.has('balloon') && (L.balloons || []).length) { seen.add('balloon'); got.push('balloon'); }
      return got;
    });
  })();
  function saveSetup() {
    S.setups[S.level.id] = S.parts.map(p => ({ id: p.id, type: p.type, o: p.o, x: p.x, y: p.y, link: p.link == null ? null : p.link }));
    persist();
  }

  // ---------------------------------------------------------------- ses
  // Müzik ve sesler audio.js'te (KM_AUDIO): hepsi sentez, o an çalan akora uyar.
  // Müzik kipi: kurarken 'build', makine çalışırken 'run', pencere açıkken 'menu'.
  const AU = window.KM_AUDIO;
  const sfx = (k, o) => { if (!S.muted && AU) AU.play(k, o); };
  function audio() { try { if (AU) AU.unlock(); } catch (e) { /* ses opsiyonel */ } }
  function musicMode(m) { try { if (AU) AU.setMode(m); } catch (e) { /* yok say */ } }

  // ---------------------------------------------------------------- görünüm
  // cs: bir karenin piksel boyu. lw: çizgi kalınlığı (küçük çizimlerde incelir), lod: ayrıntı düzeyi.
  function makeView(cssW, cssH, dpr, wx0, wy0, ww, wh) {
    const cs = Math.min(cssW / ww, cssH / wh);
    const ox = (cssW - ww * cs) / 2 - wx0 * cs;
    const top = (cssH - wh * cs) / 2 + (wy0 + wh) * cs;
    const k = Math.max(0.6, Math.min(1.12, cs / 56));
    return {
      cs, dpr, lod: cs >= 34 ? 2 : cs >= 18 ? 1 : 0,
      sx: x => ox + x * cs,
      sy: y => top - y * cs,
      wx: sx => (sx - ox) / cs,
      wy: sy => (top - sy) / cs,
      px: n => n / cs,
      lw: n => n * k / cs,
      tf: c => c.setTransform(dpr * cs, 0, 0, -dpr * cs, dpr * ox, dpr * top),
      screen: c => c.setTransform(dpr, 0, 0, dpr, 0, 0),
    };
  }

  const cv = $('board'), ctx = cv.getContext('2d');
  const M = 0.62;
  let V = null;
  function layout() {
    const r = $('sheet').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    V = makeView(r.width, r.height, dpr, -M, -M, W + 2 * M, H + 2 * M);
  }

  // ---------------------------------------------------------------- çizim dili
  // Teknik çizim kuralları: kalın çizgi görünen kenar, ince çizgi ayrıntı, kesik çizgi
  // görünmeyen kenar, çizgi-nokta eksen, çizgi-iki nokta hareketli parçanın öbür konumu,
  // 45° tarama kesit. Kalınlıklar ekran pikseli (Vw.lw). Küçük çizimlerde (parça listesi,
  // bölüm kartları) ayrıntı azalır: Vw.lod 0 küçük, 1 orta, 2 tam.
  const LW = { edge: 1.9, part: 1.5, thin: 1.05, hair: 0.75 };
  const DASH = { hidden: [4, 3], center: [12, 3, 2, 3], phantom: [9, 3, 2, 2, 2, 3], dot: [0.01, 4.6], wire: [5, 4] };
  const ink = a => rgba(C.ink, a), hand = a => rgba(C.hand, a), eye = a => rgba(C.eye, a);
  const DEEP = 'rgba(10,39,72,0.6)';
  const HALO = 'rgba(10,39,72,0.9)';
  const GOLD = '#a77a12';

  function stroke(c, Vw, color, w, dash) {
    c.lineWidth = Vw.lw(w); c.strokeStyle = color;
    if (dash) c.setLineDash(dash.map(n => Vw.lw(n)));
    c.stroke();
    if (dash) c.setLineDash([]);
  }
  function fill(c, color) { c.fillStyle = color; c.fill(); }
  function rrect(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    c.lineTo(x + w, y + h - r); c.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); c.closePath();
  }
  function textAt(c, Vw, str, x, y, size, color, align, weight, halo) {
    c.save(); Vw.screen(c);
    c.font = `${weight || 700} ${size}px ${FONT}`;
    c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (halo) { c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = halo; c.strokeText(str, Vw.sx(x), Vw.sy(y)); }
    c.fillStyle = color; c.fillText(str, Vw.sx(x), Vw.sy(y));
    c.restore();
  }
  function badge(c, Vw, num, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); fill(c, C.hand); stroke(c, Vw, C['paper-deep'], LW.thin);
    if (num) textAt(c, Vw, String(num), x, y - r * 0.05, Math.max(8, r * Vw.cs * 1.3), C['paper-deep'], 'center', 700);
  }
  // 45° tarama; çağıran önce kırpar.
  function hatch(c, Vw, b, color) {
    const g = Vw.lw(6), h = b[3] - b[1];
    c.beginPath();
    for (let k = b[0] - h; k < b[2]; k += g) { c.moveTo(k, b[1]); c.lineTo(k + h, b[3]); }
    stroke(c, Vw, color, LW.hair);
  }
  // Kesit: koyu zemin, tarama, kalın kenar. path() yolu ekler, b sınır kutusu.
  function section(c, Vw, path, b, edge, w) {
    c.beginPath(); path(); fill(c, DEEP);
    if (Vw.lod) { c.save(); c.clip(); hatch(c, Vw, b, ink(0.3)); c.restore(); }
    c.beginPath(); path(); stroke(c, Vw, edge || C.ink, w || LW.edge);
  }
  function axisLine(c, Vw, x0, y0, x1, y1, color) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, Vw, color || ink(0.4), LW.hair, DASH.center);
  }
  function bolt(c, Vw, x, y, color) {
    const r = Vw.lw(3.6);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6, px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); fill(c, C['paper-deep']); stroke(c, Vw, color, LW.thin);
    c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); stroke(c, Vw, color, LW.hair);
  }
  function arrow(c, Vw, x, y, ang, size, color) {
    const s = Vw.lw(size), a = 0.36;
    c.beginPath(); c.moveTo(x, y);
    c.lineTo(x - s * Math.cos(ang - a), y - s * Math.sin(ang - a));
    c.lineTo(x - s * Math.cos(ang + a), y - s * Math.sin(ang + a));
    c.closePath(); fill(c, color);
  }
  // Açık ok (yön işareti); çağıran çizer.
  function chevron(c, Vw, x, y, ang, size) {
    const s = Vw.lw(size), a = 0.66;
    c.moveTo(x - s * Math.cos(ang - a), y - s * Math.sin(ang - a)); c.lineTo(x, y);
    c.lineTo(x - s * Math.cos(ang + a), y - s * Math.sin(ang + a));
  }
  // Ölçü çizgisi: iki uçta ok, ortada yazı.
  function dimLine(c, Vw, x0, y0, x1, y1, label, color) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, Vw, color, LW.hair);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    arrow(c, Vw, x1, y1, ang, 7, color); arrow(c, Vw, x0, y0, ang + Math.PI, 7, color);
    if (label) textAt(c, Vw, label, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(9, Math.min(12, Vw.cs * 0.2)), color, 'center', 700, HALO);
  }

  // Parçanın yerel çerçevesi: hücre ortası, a kadar döndürülmüş.
  const PISTON_ROT = { u: 0, r: -Math.PI / 2, l: Math.PI / 2 };  // +y itme yönü
  const FAN_ROT = { r: 0, l: Math.PI, u: Math.PI / 2 };          // +x üfleme yönü
  function toWorld(p, lx, ly, a) {
    const cs = Math.cos(a), sn = Math.sin(a);
    return [p.x + 0.5 + lx * cs - ly * sn, p.y + 0.5 + lx * sn + ly * cs];
  }

  // ---------------------------------------------------------------- tahta
  function drawGrid(c, Vw, labels, hl) {
    c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, 0, W, H);
    if (Vw.lod) {
      c.beginPath();
      for (let x = 0.5; x < W; x += 1) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 1) { c.moveTo(0, y); c.lineTo(W, y); }
      c.lineWidth = Vw.px(1); c.strokeStyle = ink(0.035); c.stroke();
    }
    c.beginPath();
    for (let x = 1; x < W; x++) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 1; y < H; y++) { c.moveTo(0, y); c.lineTo(W, y); }
    c.lineWidth = Vw.px(1); c.strokeStyle = ink(0.1); c.stroke();
    const e = M * 0.84;
    if (hl) {
      // Yardımcı çizgiler: sürüklenen parçanın kenarları çerçeveye kadar uzar.
      c.beginPath();
      for (const x of [hl.x0, hl.x1]) { c.moveTo(x, -e); c.lineTo(x, H + e); }
      for (const y of [hl.y0, hl.y1]) { c.moveTo(-e, y); c.lineTo(W + e, y); }
      stroke(c, Vw, hl.ok ? ink(0.42) : rgba(C.bad, 0.55), LW.hair, DASH.hidden);
    }
    c.beginPath(); c.rect(0, 0, W, H); stroke(c, Vw, ink(0.85), LW.part);
    if (!labels) return;
    c.beginPath(); c.rect(-e, -e, W + 2 * e, H + 2 * e); c.lineWidth = Vw.px(1); c.strokeStyle = ink(0.32); c.stroke();
    const fs = Math.max(9, Math.min(13, Vw.cs * 0.3));
    const mark = (x, y, w, h) => { c.fillStyle = hl.ok ? ink(0.9) : rgba(C.bad, 0.9); c.fillRect(x - w / 2, y - h / 2, w, h); };
    for (let i = 0; i < W; i++) {
      const on = hl && i >= hl.x0 && i < hl.x1, y = H + M * 0.42;
      if (on) mark(i + 0.5, y, 0.84, M * 0.56);
      textAt(c, Vw, String.fromCharCode(65 + i), i + 0.5, y, fs, on ? C['paper-deep'] : ink(0.5), 'center', on ? 700 : 600);
    }
    for (let j = 0; j < H; j++) {
      const on = hl && j >= hl.y0 && j < hl.y1, x = -M * 0.42;
      if (on) mark(x, j + 0.5, M * 0.6, 0.8);
      textAt(c, Vw, String(j + 1), x, j + 0.5, fs, on ? C['paper-deep'] : ink(0.5), 'center', on ? 700 : 600);
    }
    c.beginPath();
    for (let i = 0; i <= W; i++) { c.moveTo(i, H); c.lineTo(i, H + 0.12); c.moveTo(i, 0); c.lineTo(i, -0.12); }
    for (let j = 0; j <= H; j++) { c.moveTo(0, j); c.lineTo(-0.12, j); c.moveTo(W, j); c.lineTo(W + 0.12, j); }
    c.lineWidth = Vw.px(1); c.strokeStyle = ink(0.5); c.stroke();
  }

  function wallPath(c, w) {
    if (typeof w[0] === 'number') c.rect(w[0], w[1], w[2] - w[0], w[3] - w[1]);
    else { c.moveTo(w[0][0], w[0][1]); for (let i = 1; i < w.length; i++) c.lineTo(w[i][0], w[i][1]); c.closePath(); }
  }
  function wallBounds(w) {
    if (typeof w[0] === 'number') return w;
    const xs = w.map(q => q[0]), ys = w.map(q => q[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function drawWalls(c, Vw, level) {
    for (const w of level.walls || []) section(c, Vw, () => wallPath(c, w), wallBounds(w));
  }

  // Kova kesitte: taranmış U, içinde hedef, kenarında bayrak.
  // Bayraklı kova (cup.kind) yalnızca kendi renginden topu sayar: bayrak ve hedef o topun renginde.
  function drawCup(c, Vw, cup, time) {
    const { x, y, w } = cup, rim = KM.CUP.rim, t = KM.CUP.wall, back = cup.back || null;
    const lh = back && back.side === 'l' ? back.h : rim, rh = back && back.side === 'r' ? back.h : rim;
    const look = BALL_LOOK[cup.kind === 'steel' ? 1 : 0], tint = look.fill || C.ball;
    c.fillStyle = rgba(tint, 0.08); c.fillRect(x + t, y + t, w - 2 * t, rim - t);
    c.beginPath(); c.moveTo(x + t, y + rim); c.lineTo(x + w - t, y + rim);
    stroke(c, Vw, rgba(tint, 0.45), LW.hair, DASH.hidden);
    if (Vw.lod) {
      const tx = x + w / 2, ty = y + t + 0.29;
      c.beginPath(); c.arc(tx, ty, 0.17, 0, TAU); c.moveTo(tx + 0.085, ty); c.arc(tx, ty, 0.085, 0, TAU);
      stroke(c, Vw, rgba(tint, 0.5), LW.thin);
      c.beginPath(); c.arc(tx, ty, 0.026, 0, TAU); fill(c, rgba(tint, 0.7));
    }
    section(c, Vw, () => {
      c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + rh); c.lineTo(x + w - t, y + rh); c.lineTo(x + w - t, y + t);
      c.lineTo(x + t, y + t); c.lineTo(x + t, y + lh); c.lineTo(x, y + lh); c.closePath();
    }, [x, y, x + w, y + Math.max(lh, rh)]);
    // Bayrak: arka duvarın olmadığı kenarda.
    const left = !(back && back.side === 'l');
    const px = left ? x + t / 2 : x + w - t / 2, py0 = y + rim, py1 = py0 + 0.95, dir = left ? 1 : -1;
    const wv = reduceMotion ? 0 : Math.sin(time * 2.6) * 0.035;
    c.beginPath(); c.moveTo(px, py0); c.lineTo(px, py1 + 0.02); stroke(c, Vw, C.ink, LW.thin);
    c.beginPath(); c.arc(px, py1 + 0.045, 0.032, 0, TAU); fill(c, C.ink);
    c.beginPath(); c.moveTo(px, py1);
    c.quadraticCurveTo(px + dir * 0.24, py1 + 0.03 + wv, px + dir * 0.5, py1 - 0.13 + wv * 0.5);
    c.quadraticCurveTo(px + dir * 0.24, py1 - 0.22 - wv, px, py1 - 0.3);
    c.closePath(); fill(c, tint); stroke(c, Vw, look.edge, LW.hair);
  }

  // Başlangıç borusu boyuna kesitte: taranmış cidarlar, ağızda flanş, uzak uçta kırık çizgisi.
  function drawPipe(c, Vw, level) {
    const p = level.pipe; if (!p) return;
    const st = KM.startsOf(level)[0], r = 0.34, wt = 0.07;
    let mx, my, rot, len;
    if (p.dir === 'r') { mx = st.x + 0.02; my = st.y; rot = 0; len = mx + 0.4; }
    else if (p.dir === 'l') { mx = st.x - 0.02; my = st.y; rot = Math.PI; len = W + 0.4 - mx; }
    else { mx = st.x; my = st.y - 0.02; rot = -Math.PI / 2; len = Math.min(H + 0.4, p.y + 1.7) - my; }
    c.save(); c.translate(mx, my); c.rotate(rot);
    c.fillStyle = ink(0.04); c.fillRect(-len, -r + wt, len, 2 * (r - wt));
    if (Vw.lod > 1) axisLine(c, Vw, -len + 0.1, 0, 0.5);
    c.beginPath(); c.rect(-len, r - wt, len, wt); c.rect(-len, -r, len, wt); fill(c, DEEP);
    if (Vw.lod) { c.save(); c.clip(); hatch(c, Vw, [-len, -r, 0, r], ink(0.3)); c.restore(); }
    c.beginPath(); c.moveTo(-len, r); c.lineTo(0, r); c.moveTo(-len, -r); c.lineTo(0, -r); stroke(c, Vw, C.ink, LW.edge);
    c.beginPath(); c.moveTo(-len, r - wt); c.lineTo(0, r - wt); c.moveTo(-len, -r + wt); c.lineTo(0, -r + wt); stroke(c, Vw, C.ink, LW.thin);
    if (Vw.lod) {
      c.beginPath(); c.moveTo(-len, -r - 0.05);
      c.bezierCurveTo(-len + 0.14, -r * 0.4, -len - 0.14, r * 0.4, -len, r + 0.05);
      stroke(c, Vw, C.ink, LW.thin);
    }
    for (const s of [1, -1]) {
      const y0 = s > 0 ? r - wt : -r - 0.08, h = wt + 0.08;
      section(c, Vw, () => c.rect(-0.13, y0, 0.13, h), [-0.13, y0, 0, y0 + h]);
    }
    c.restore();
  }

  // Rampa: Warren kafes kiriş, uçlarında pim.
  function drawRamp(c, Vw, p, ann) {
    const [a, b] = KM.rampLine(p.o);
    const ax = p.x + a[0], ay = p.y + a[1], bx = p.x + b[0], by = p.y + b[1];
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), t = T.plank, h = t / 2;
    c.save(); c.translate(ax, ay); c.rotate(ang);
    if (ann && Vw.lod > 1) { axisLine(c, Vw, -0.24, 0, 0); axisLine(c, Vw, len, 0, len + 0.24); }
    c.beginPath(); c.rect(0, -h, len, t); fill(c, C.paper); fill(c, ink(0.12));
    if (Vw.lod) {
      const n = Math.max(4, Math.round((len - 0.3) / 0.19)), x0 = 0.15, step = (len - 0.3) / n;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const up = i % 2 === 0;
        c.moveTo(x0 + i * step, up ? -h : h); c.lineTo(x0 + (i + 1) * step, up ? h : -h);
      }
      c.moveTo(x0, -h); c.lineTo(x0, h); c.moveTo(len - x0, -h); c.lineTo(len - x0, h);
      stroke(c, Vw, ink(0.7), LW.hair);
    }
    c.beginPath(); c.rect(0, -h, len, t); stroke(c, Vw, C.ink, LW.part);
    if (!p.fixed) for (const x of [0.075, len - 0.075]) {
      c.beginPath(); c.arc(x, 0, 0.036, 0, TAU); fill(c, C['paper-deep']); stroke(c, Vw, C.ink, LW.thin);
    }
    c.restore();
  }

  // Yay: taranmış taban, helezon (öndeki teller kalın, arkadakiler kesik), baskı plakası.
  function drawSpring(c, Vw, p, rt, ann) {
    const k = rt && rt.compress > 0 ? Math.sin((1 - rt.compress / 0.18) * Math.PI) : 0;
    const x = p.x, y = p.y, top = y + 0.36 - 0.13 * k, padH = 0.08, base = 0.07;
    const cx = x + 0.5, rx = 0.27, y0 = y + base, y1 = top - padH;
    if (ann && Vw.lod) {
      c.beginPath(); c.moveTo(cx, top + 0.1); c.lineTo(cx, y + 0.82); stroke(c, Vw, ink(0.4), LW.hair, DASH.hidden);
      arrow(c, Vw, cx, y + 0.9, Math.PI / 2, 7, ink(0.5));
    }
    section(c, Vw, () => c.rect(x + 0.1, y, 0.8, base), [x + 0.1, y, x + 0.9, y + base], C.ink, LW.part);
    const n = 3, pitch = (y1 - y0) / n, ry = Math.min(0.06, pitch * 0.8);
    c.beginPath();
    for (let i = 0; i < n; i++) { const cy = y0 + (i + 0.5) * pitch; c.moveTo(cx + rx, cy); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); }
    stroke(c, Vw, ink(0.55), LW.hair, Vw.lod ? DASH.hidden : null);
    c.beginPath();
    for (let i = 0; i < n; i++) { const cy = y0 + (i + 0.5) * pitch; c.moveTo(cx - rx, cy); c.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU); }
    stroke(c, Vw, C.ink, LW.part);
    c.beginPath(); c.rect(x + 0.08, top - padH, 0.84, padH); fill(c, C.paper); fill(c, ink(0.25)); stroke(c, Vw, C.ink, LW.edge);
    if (k > 0.05) {
      c.beginPath();
      for (const dx of [-0.26, 0, 0.26]) { c.moveTo(cx + dx, top + 0.07); c.lineTo(cx + dx, top + 0.07 + 0.26 * k); }
      stroke(c, Vw, ink(0.7), LW.thin);
    }
  }

  // Konveyör: iki kasnak arasında bant, üstünde akış okları.
  function drawBelt(c, Vw, p, time) {
    const x = p.x, y = p.y, t = T.plank, r = t / 2, dir = p.o === 'r' ? 1 : -1;
    c.beginPath(); rrect(c, x, y - r, 2, t, r); fill(c, C.paper); fill(c, ink(0.1)); stroke(c, Vw, C.ink, LW.part);
    for (const px of [x + r, x + 2 - r]) {
      c.beginPath(); c.arc(px, y, r * 0.6, 0, TAU); stroke(c, Vw, C.ink, LW.thin);
      if (Vw.lod > 1 && !p.fixed) {
        const a = -dir * time * 5;
        c.beginPath(); c.moveTo(px + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); c.lineTo(px - Math.cos(a) * r * 0.6, y - Math.sin(a) * r * 0.6);
        stroke(c, Vw, C.ink, LW.hair);
      }
    }
    const ph = ((time * 0.9) % 0.25 + 0.25) % 0.25;
    c.beginPath();
    for (let k = 0.15; k < 2; k += 0.25) {
      const cx = dir > 0 ? x + k + ph : x + 2 - k - ph;
      if (cx < x + 0.24 || cx > x + 1.76) continue;
      chevron(c, Vw, cx, y, dir > 0 ? 0 : Math.PI, 4);
    }
    stroke(c, Vw, ink(0.9), LW.thin);
  }

  // Piston: hava silindiri (turuncu: elle kumanda), kol, taranmış itme başlığı.
  // Kurarken başlığın basınca varacağı yer çizgi-iki nokta ile görünür.
  function drawPiston(c, Vw, p, rt, ann) {
    const off = rt ? rt.offset : 0, lod = Vw.lod, a = PISTON_ROT[p.o];
    c.save(); c.translate(p.x + 0.5, p.y + 0.5); c.rotate(a);
    if (ann) {
      const d = T.pistonDist;
      c.beginPath(); c.rect(-0.46, 0.32 + d, 0.92, 0.18);
      c.moveTo(-0.055, 0.5); c.lineTo(-0.055, 0.32 + d); c.moveTo(0.055, 0.5); c.lineTo(0.055, 0.32 + d);
      stroke(c, Vw, hand(0.6), LW.thin, DASH.phantom);
    }
    c.beginPath(); c.rect(-0.055, 0.1, 0.11, 0.22 + off); fill(c, C.paper); fill(c, ink(0.3)); stroke(c, Vw, C.ink, LW.thin);
    c.beginPath(); c.rect(-0.36, -0.5, 0.72, 0.6); fill(c, C.paper); fill(c, hand(0.2));
    if (lod) {
      c.beginPath(); c.moveTo(-0.36, -0.4); c.lineTo(0.36, -0.4); c.moveTo(-0.36, 0); c.lineTo(0.36, 0);
      stroke(c, Vw, hand(0.85), LW.thin);
    }
    if (lod > 1) {
      c.beginPath(); c.moveTo(-0.27, -0.4); c.lineTo(-0.27, 0); c.moveTo(0.27, -0.4); c.lineTo(0.27, 0);
      stroke(c, Vw, hand(0.5), LW.hair);
      c.beginPath(); c.rect(0.36, -0.33, 0.07, 0.1); fill(c, C.paper); stroke(c, Vw, C.hand, LW.thin);
    }
    c.beginPath(); c.rect(-0.36, -0.5, 0.72, 0.6); stroke(c, Vw, C.hand, LW.edge);
    section(c, Vw, () => c.rect(-0.46, 0.32 + off, 0.92, 0.18), [-0.46, 0.32 + off, 0.46, 0.5 + off]);
    if (rt && rt.state === 'out' && !reduceMotion) {
      c.beginPath();
      for (const lx of [-0.4, -0.22, 0.22, 0.4]) { c.moveTo(lx, 0.24 + off); c.lineTo(lx, 0.02 + off); }
      stroke(c, Vw, ink(0.65), LW.thin);
    }
    c.restore();
    const b = toWorld(p, 0, -0.2, a);
    badge(c, Vw, p.num, b[0], b[1], 0.15);
  }

  // Pervanenin etki alanı: kesik sınır, kapalıyken yön okları, açıkken akım çizgileri.
  // Kurarken alanın boyu ölçü çizgisiyle yazılır.
  function drawFanZone(c, Vw, p, rt, time) {
    const z = KM.fanZone(p), on = !!(rt && rt.on), L = T.fanLen, wd = 0.9;
    const pt = (along, lat) => p.o === 'r' ? [z[0] + along, z[1] + lat] : p.o === 'l' ? [z[2] - along, z[1] + lat] : [z[0] + lat, z[1] + along];
    const ang = FAN_ROT[p.o];
    c.save();
    c.beginPath(); c.rect(z[0], z[1], z[2] - z[0], z[3] - z[1]);
    if (on) fill(c, ink(0.04));
    stroke(c, Vw, ink(on ? 0.42 : 0.2), LW.hair, DASH.hidden);
    c.clip();
    c.beginPath();
    if (on) {
      for (let i = 0; i < 11; i++) {
        const lat = 0.1 + ((i * 0.618) % 1) * (wd - 0.2), u = ((time * 1.9 + i * 0.137) % 1) * (L + 0.6) - 0.3;
        const a0 = pt(u, lat), a1 = pt(u + 0.25, lat + 0.03 * Math.sin(time * 9 + i)), a2 = pt(u + 0.5, lat);
        c.moveTo(a0[0], a0[1]); c.quadraticCurveTo(a1[0], a1[1], a2[0], a2[1]);
      }
      stroke(c, Vw, ink(0.6), LW.thin);
    } else {
      for (let u = 0.75; u < L; u += 1.5) { const q = pt(u, wd / 2); chevron(c, Vw, q[0], q[1], ang, 6); }
      stroke(c, Vw, ink(0.26), LW.thin);
    }
    c.restore();
  }
  // Pervanenin erimi ölçü çizgisiyle (kurarken, her şeyin üstünde).
  function drawFanRange(c, Vw, p) {
    if (!Vw.lod) return;
    const z = KM.fanZone(p), L = T.fanLen, wd = 0.9;
    const pt = (along, lat) => p.o === 'r' ? [z[0] + along, z[1] + lat] : p.o === 'l' ? [z[2] - along, z[1] + lat] : [z[0] + lat, z[1] + along];
    const q0 = pt(0.06, wd - 0.15), q1 = pt(L - 0.06, wd - 0.15), m = pt(L / 2, wd / 2);
    dimLine(c, Vw, q0[0], q0[1], q1[0], q1[1], null, ink(0.5));
    textAt(c, Vw, `${L} squares`, m[0], m[1], Math.max(9, Math.min(12.5, Vw.cs * 0.21)), ink(0.75), 'center', 700, HALO);
  }

  // Pervane: önden kanatlar ve göbek, çıkış ağzında panjur.
  function drawFan(c, Vw, p, rt) {
    const on = !!(rt && rt.on), spin = rt ? rt.blade : 0, lod = Vw.lod;
    c.save(); c.translate(p.x + 0.5, p.y + 0.5); c.rotate(FAN_ROT[p.o]);
    c.beginPath(); c.moveTo(0.34, -0.25); c.lineTo(0.45, -0.31); c.lineTo(0.45, 0.31); c.lineTo(0.34, 0.25); c.closePath();
    fill(c, C.paper); fill(c, hand(on ? 0.3 : 0.14)); stroke(c, Vw, C.hand, LW.part);
    if (lod) {
      c.beginPath(); for (const ly of [-0.16, 0, 0.16]) { c.moveTo(0.345, ly); c.lineTo(0.445, ly * 1.2); }
      stroke(c, Vw, C.hand, LW.thin);
    }
    c.beginPath(); c.rect(-0.34, -0.34, 0.68, 0.68); fill(c, C.paper); fill(c, hand(on ? 0.3 : 0.16)); stroke(c, Vw, C.hand, LW.edge);
    if (lod) { c.beginPath(); c.arc(0, 0, 0.29, 0, TAU); stroke(c, Vw, hand(0.75), LW.thin); }
    if (lod > 1) {
      for (const [bx, by] of [[-0.27, -0.27], [0.27, -0.27], [0.27, 0.27], [-0.27, 0.27]]) {
        c.beginPath(); c.arc(bx, by, 0.026, 0, TAU); stroke(c, Vw, hand(0.85), LW.hair);
      }
    }
    c.save(); c.rotate(-spin);
    for (let i = 0; i < 5; i++) {
      c.rotate(TAU / 5);
      c.beginPath(); c.moveTo(0.05, -0.025);
      c.quadraticCurveTo(0.15, -0.105, 0.255, -0.05);
      c.quadraticCurveTo(0.23, 0.035, 0.05, 0.03); c.closePath();
      fill(c, ink(on ? 0.5 : 0.22)); stroke(c, Vw, C.ink, LW.hair);
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, 0.065, 0, TAU); fill(c, C['paper-deep']); stroke(c, Vw, C.ink, LW.thin);
    c.beginPath(); c.arc(0, 0, 0.022, 0, TAU); fill(c, C.ink);
    c.restore();
    badge(c, Vw, p.num, p.x + 0.18, p.y + 0.82, 0.14);
  }

  // Kapı: geçit karesinde kılavuz rayları arasında kayan taranmış levha, yanındaki karede turuncu yuva.
  // Açılınca levha yuvaya çekilir. Dik kapıda (u) yuva üstte; yatay kapakta (r / l) yuva yanda,
  // üstü zeminle aynı hizada. Kurarken geçidin yanında aç-kapa oku görünür.
  function drawGate(c, Vw, p, rt, ann) {
    const g = KM.GATES[p.o], off = rt ? rt.offset : 0, lod = Vw.lod, open = !!(rt && rt.open);
    const vert = p.o === 'u', R = (q, dx, dy) => [p.x + q[0] + dx, p.y + q[1] + dy, p.x + q[2] + dx, p.y + q[3] + dy];
    const px = p.x + g.pass[0], py = p.y + g.pass[1];
    if (lod) {
      c.beginPath();
      if (vert) for (const gx of [0.35, 0.65]) { c.moveTo(px + gx, py + 0.04); c.lineTo(px + gx, py + 1); }
      else for (const gy of [0.34, 0.66]) { c.moveTo(px, py + gy); c.lineTo(px + 1, py + gy); }
      stroke(c, Vw, ink(0.38), LW.hair, DASH.hidden);
    }
    const pr = R(g.plate, g.dir[0] * off, g.dir[1] * off);
    section(c, Vw, () => c.rect(pr[0], pr[1], pr[2] - pr[0], pr[3] - pr[1]), pr);
    const h = R(g.housing, 0, 0);
    c.beginPath(); c.rect(h[0], h[1], h[2] - h[0], h[3] - h[1]); fill(c, C.paper); fill(c, hand(open ? 0.3 : 0.18));
    if (lod) {
      c.beginPath();
      if (vert) { c.moveTo(h[0], h[1] + 0.1); c.lineTo(h[2], h[1] + 0.1); c.moveTo(h[0], h[3] - 0.1); c.lineTo(h[2], h[3] - 0.1); }
      else { c.moveTo(h[0] + 0.1, h[1]); c.lineTo(h[0] + 0.1, h[3]); c.moveTo(h[2] - 0.1, h[1]); c.lineTo(h[2] - 0.1, h[3]); }
      stroke(c, Vw, hand(0.85), LW.thin);
    }
    c.beginPath(); c.rect(h[0], h[1], h[2] - h[0], h[3] - h[1]); stroke(c, Vw, C.hand, LW.edge);
    if (ann && lod) {
      const col = hand(0.7);
      c.beginPath();
      if (vert) {
        c.moveTo(px + 0.86, py + 0.28); c.lineTo(px + 0.86, py + 0.72); stroke(c, Vw, hand(0.6), LW.thin);
        arrow(c, Vw, px + 0.86, py + 0.8, Math.PI / 2, 6, col); arrow(c, Vw, px + 0.86, py + 0.2, -Math.PI / 2, 6, col);
      } else {
        c.moveTo(px + 0.28, py + 0.86); c.lineTo(px + 0.72, py + 0.86); stroke(c, Vw, hand(0.6), LW.thin);
        arrow(c, Vw, px + 0.8, py + 0.86, 0, 6, col); arrow(c, Vw, px + 0.2, py + 0.86, Math.PI, 6, col);
      }
    }
    badge(c, Vw, p.num, (h[0] + h[2]) / 2, vert ? (h[1] + h[3]) / 2 : h[1] - 0.2, 0.14);
  }

  // Mıknatıs: turuncu gövdede bobin sargıları, yüzünde taranmış kutup parçası. Açıkken önünde alan çizgileri.
  const MAG_ROT = { r: 0, l: Math.PI, u: Math.PI / 2, d: -Math.PI / 2 };
  function drawMagnet(c, Vw, p, rt, time) {
    const on = !!(rt && rt.on), lod = Vw.lod;
    c.save(); c.translate(p.x + 0.5, p.y + 0.5); c.rotate(MAG_ROT[p.o]);
    if (on) {
      for (let k = 0; k < 3; k++) {
        const q = reduceMotion ? k / 3 : (time * 1.4 + k / 3) % 1, r = 0.12 + q * 1.5;
        c.beginPath(); c.arc(0.35, 0, r, -0.95, 0.95); stroke(c, Vw, ink(0.55 * (1 - q)), LW.thin);
      }
    }
    c.beginPath(); c.rect(-0.35, -0.35, 0.7, 0.7); fill(c, C.paper); fill(c, hand(on ? 0.3 : 0.16));
    if (lod) {
      c.beginPath();
      for (let k = 0; k < 6; k++) { const lx = -0.25 + k * 0.065; c.moveTo(lx, -0.25); c.lineTo(lx + 0.035, 0.25); }
      stroke(c, Vw, hand(0.8), LW.thin);
    }
    c.beginPath(); c.rect(-0.35, -0.35, 0.7, 0.7); stroke(c, Vw, C.hand, LW.edge);
    section(c, Vw, () => c.rect(0.17, -0.31, 0.18, 0.62), [0.17, -0.31, 0.35, 0.31]);
    c.restore();
    const d = DIRS[p.o], perp = d[0] ? [0, 1] : [-1, 0];
    badge(c, Vw, p.num, p.x + 0.5 - d[0] * 0.32 + perp[0] * 0.32, p.y + 0.5 - d[1] * 0.32 + perp[1] * 0.32, 0.14);
  }
  // Mıknatısın erimi: yüzünün önünde yarım daire, yarıçapı yazılı (kurarken).
  function drawMagnetRange(c, Vw, p) {
    if (!Vw.lod) return;
    const fc = KM.magnetFace(p), a = Math.atan2(fc.d[1], fc.d[0]), R = T.magRange;
    c.beginPath(); c.moveTo(fc.x + R * Math.cos(a - Math.PI / 2), fc.y + R * Math.sin(a - Math.PI / 2));
    c.arc(fc.x, fc.y, R, a - Math.PI / 2, a + Math.PI / 2);
    stroke(c, Vw, ink(0.3), LW.hair, DASH.hidden);
    const ex = fc.x + fc.d[0] * R, ey = fc.y + fc.d[1] * R;
    dimLine(c, Vw, fc.x + fc.d[0] * 0.08, fc.y + fc.d[1] * 0.08, ex, ey, null, ink(0.45));
    const lx = fc.x + fc.d[0] * R * 0.55 + (fc.d[0] ? 0 : 0.42), ly = fc.y + fc.d[1] * R * 0.55 + (fc.d[0] ? 0.24 : 0);
    textAt(c, Vw, `${R} squares`, lx, ly, Math.max(9, Math.min(12.5, Vw.cs * 0.21)), ink(0.75), 'center', 700, HALO);
  }

  // Sensör: hücreyi gözetler (köşe işaretleri, nişangâh). Bağlı değilse kırmızı nokta.
  function drawSensor(c, Vw, p, rt, linked) {
    const x = p.x, y = p.y, cx = x + 0.5, cy = y + 0.5, f = rt ? Math.max(0, rt.flash / 0.4) : 0;
    const act = f > 0 || !!(rt && rt.inside);
    if (f > 0) { c.beginPath(); c.arc(cx, cy, 0.18 + 0.32 * (1 - f), 0, TAU); fill(c, eye(0.35 * f)); }
    if (Vw.lod) { c.beginPath(); c.rect(x + 0.06, y + 0.06, 0.88, 0.88); stroke(c, Vw, eye(act ? 0.6 : 0.32), LW.hair, DASH.hidden); }
    const a = 0.06, b = 0.94, L = 0.2;
    c.beginPath();
    c.moveTo(x + a, y + a + L); c.lineTo(x + a, y + a); c.lineTo(x + a + L, y + a);
    c.moveTo(x + b - L, y + a); c.lineTo(x + b, y + a); c.lineTo(x + b, y + a + L);
    c.moveTo(x + b, y + b - L); c.lineTo(x + b, y + b); c.lineTo(x + b - L, y + b);
    c.moveTo(x + a + L, y + b); c.lineTo(x + a, y + b); c.lineTo(x + a, y + b - L);
    stroke(c, Vw, act ? C.eye : eye(0.85), LW.part);
    c.beginPath();
    c.moveTo(cx - 0.27, cy); c.lineTo(cx - 0.12, cy); c.moveTo(cx + 0.12, cy); c.lineTo(cx + 0.27, cy);
    c.moveTo(cx, cy - 0.27); c.lineTo(cx, cy - 0.12); c.moveTo(cx, cy + 0.12); c.lineTo(cx, cy + 0.27);
    stroke(c, Vw, C.eye, LW.part);
    c.beginPath(); c.arc(cx, cy, 0.11, 0, TAU); stroke(c, Vw, C.eye, LW.thin);
    c.beginPath(); c.arc(cx, cy, 0.035, 0, TAU); fill(c, C.eye);
    if (!linked) {
      c.beginPath(); c.arc(x + 0.84, y + 0.84, 0.075, 0, TAU); fill(c, C.bad); stroke(c, Vw, C['paper-deep'], LW.thin);
    }
  }

  // Sensör kablosu, şemadaki gibi dik açılı: sensörün kenarından cihazın kenarına.
  function drawLink(c, Vw, s, t, pulse) {
    const td = KM.sizeOf(t), sx = s.x + 0.5, sy = s.y + 0.5;
    const x0 = t.x, x1 = t.x + td.w, y0 = t.y, y1 = t.y + td.h, tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    const inX = sx > x0 && sx < x1, inY = sy > y0 && sy < y1;
    if (inX && inY) return;
    const hx = tx > sx ? 1 : -1, vy = ty > sy ? 1 : -1;
    let pts;
    if (inY) pts = [[sx + 0.5 * hx, sy], [hx > 0 ? x0 : x1, sy]];
    else if (inX) pts = [[sx, sy + 0.5 * vy], [sx, vy > 0 ? y0 : y1]];
    else pts = [[sx + 0.5 * hx, sy], [tx, sy], [tx, vy > 0 ? y0 : y1]];
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) {
      const r = Math.min(0.22, Math.abs(pts[1][0] - pts[0][0]) / 2, Math.abs(pts[2][1] - pts[1][1]) / 2);
      c.arcTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], r);
    }
    const e = pts[pts.length - 1];
    c.lineTo(e[0], e[1]);
    stroke(c, Vw, pulse != null ? C.eye : eye(0.85), LW.part, DASH.wire);
    c.beginPath(); c.arc(pts[0][0], pts[0][1], 0.04, 0, TAU); fill(c, C.eye);
    c.beginPath(); c.arc(e[0], e[1], 0.06, 0, TAU); fill(c, C.eye); stroke(c, Vw, C['paper-deep'], LW.hair);
    if (pulse == null) return;
    // Sinyal: tetiklenince kablo boyunca cihaza giden nokta.
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let d = pulse * total, q = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= l || i === pts.length - 1) { const k = l ? Math.min(1, d / l) : 1; q = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; break; }
      d -= l;
    }
    c.beginPath(); c.arc(q[0], q[1], 0.16, 0, TAU); fill(c, eye(0.25));
    c.beginPath(); c.arc(q[0], q[1], 0.075, 0, TAU); fill(c, '#eafcff');
  }

  // Flipper: turuncu kol (elle kumanda), menteşe pimi, taranmış ayak. Kurarken kalkık konumu çizgi-iki nokta ve salınım oku.
  function drawFlipper(c, Vw, p, rt, ann) {
    const g = KM.flipperGeom(p), s = g.s, L = T.flipLen, a = rt ? rt.angle : T.flipDown;
    section(c, Vw, () => c.rect(g.px - 0.09, p.y + 0.06, 0.18, g.py - 0.14 - p.y - 0.06), [g.px - 0.09, p.y + 0.06, g.px + 0.09, g.py - 0.14]);
    const paddle = () => { c.beginPath(); c.moveTo(-0.13, -0.13); c.lineTo(L, -0.055); c.lineTo(L, 0.055); c.lineTo(-0.13, 0.13); c.closePath(); };
    c.save(); c.translate(g.px, g.py); c.scale(s, 1);
    if (ann) {
      c.save(); c.rotate(T.flipUp); paddle(); stroke(c, Vw, hand(0.55), LW.thin, DASH.phantom); c.restore();
      if (Vw.lod) {
        c.beginPath(); c.arc(0, 0, L + 0.18, T.flipDown + 0.08, T.flipUp - 0.06); stroke(c, Vw, ink(0.45), LW.hair);
        const e = T.flipUp - 0.06;
        arrow(c, Vw, Math.cos(e) * (L + 0.18), Math.sin(e) * (L + 0.18), e + Math.PI / 2, 6, ink(0.55));
      }
    }
    c.save(); c.rotate(a); paddle(); fill(c, C.paper); fill(c, hand(rt && rt.on ? 0.32 : 0.18));
    if (Vw.lod) { c.beginPath(); c.moveTo(0.25, 0); c.lineTo(L - 0.12, 0); stroke(c, Vw, hand(0.6), LW.hair, DASH.center); }
    paddle(); stroke(c, Vw, C.hand, LW.edge); c.restore();
    c.beginPath(); c.arc(0, 0, 0.1, 0, TAU); fill(c, C.paper); stroke(c, Vw, C.ink, LW.thin);
    c.beginPath(); c.arc(0, 0, 0.035, 0, TAU); fill(c, C.ink);
    c.restore();
    badge(c, Vw, p.num, g.px + s * 0.05, p.y + 0.22, 0.15);
  }

  // Tampon: köşegende taranmış levha, arkasında iki yaprak yay. Kurarken düşen topun nereye seksiyeceği oklarla.
  function drawBumper(c, Vw, p, rt, ann) {
    const cx = p.x + 0.5, cy = p.y + 0.5, ang = p.o === 'r' ? -Math.PI / 4 : Math.PI / 4, len = Math.SQRT2 * 1.12, k = rt && rt.flash > 0 ? rt.flash / 0.25 : 0;
    if (ann && Vw.lod) {
      const out = p.o === 'r' ? 1 : -1;
      c.beginPath(); c.moveTo(cx, p.y + 1.35); c.lineTo(cx, cy + 0.2); c.moveTo(cx + out * 0.2, cy); c.lineTo(cx + out * 0.95, cy);
      stroke(c, Vw, ink(0.45), LW.hair, DASH.hidden);
      arrow(c, Vw, cx, cy + 0.24, -Math.PI / 2, 5, ink(0.5)); arrow(c, Vw, cx + out * 1.0, cy, out > 0 ? 0 : Math.PI, 6, ink(0.6));
    }
    c.save(); c.translate(cx, cy); c.rotate(ang);
    // Arkadaki yaylar (levhanın alt yüzünde) ve taban
    if (Vw.lod) {
      c.beginPath();
      for (const sx of [-0.3, 0.3]) { c.moveTo(sx, -0.07); c.lineTo(sx - 0.06, -0.14); c.lineTo(sx + 0.06, -0.2); c.lineTo(sx - 0.06, -0.26); c.lineTo(sx, -0.31); }
      c.moveTo(-0.42, -0.31); c.lineTo(0.42, -0.31);
      stroke(c, Vw, ink(0.7), LW.thin);
    }
    section(c, Vw, () => c.rect(-len / 2, -0.07, len, 0.14), [-len / 2, -0.07, len / 2, 0.07], C.ink, LW.part);
    if (k > 0 && !reduceMotion) {
      c.beginPath(); for (const sx of [-0.35, 0, 0.35]) { c.moveTo(sx, 0.14); c.lineTo(sx, 0.14 + 0.28 * k); }
      stroke(c, Vw, rgba(C.ball, 0.9 * k), LW.thin);
    }
    c.restore();
  }

  // Makas: turuncu (elle kumanda) iki ağız, iki halka. Basınca hücresinden geçen ipi keser;
  // kurarken kestiği hücre kesik çizgiyle gösterilir.
  function drawCutter(c, Vw, p, rt, ann) {
    const cx = p.x + 0.5, cy = p.y + 0.5, k = rt && rt.snipT > 0 ? rt.snipT / 0.3 : 0;
    const open = 0.42 * (k > 0 && !reduceMotion ? 1 - Math.sin(k * Math.PI) : 1);
    if (ann || k > 0) { c.beginPath(); c.rect(p.x + 0.05, p.y + 0.05, 0.9, 0.9); stroke(c, Vw, hand(k > 0 ? 0.8 : 0.45), LW.hair, DASH.hidden); }
    const px = cx - 0.04, py = cy;
    for (const sgn of [1, -1]) {
      c.save(); c.translate(px, py); c.rotate(sgn * open / 2);
      c.beginPath(); c.moveTo(0, 0.09 * sgn); c.lineTo(0.52, 0); c.lineTo(0, -0.025 * sgn); c.closePath();
      fill(c, C.paper); fill(c, hand(rt && k > 0 ? 0.5 : 0.25)); stroke(c, Vw, C.hand, LW.part);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-0.15, 0.06 * sgn); stroke(c, Vw, C.hand, LW.edge);
      c.beginPath(); c.arc(-0.27, 0.13 * sgn, 0.12, 0, TAU); fill(c, hand(0.2)); stroke(c, Vw, C.hand, LW.edge);
      c.restore();
    }
    c.beginPath(); c.arc(px, py, 0.045, 0, TAU); fill(c, C.ink);
    badge(c, Vw, p.num, p.x + 0.82, p.y + 0.82, 0.14);
  }

  // İğne: kesitli taban ve sivri çelik uç. Balona değerse balon patlar; topa bir şey yapmaz.
  function drawPin(c, Vw, p) {
    const t = KM.pinTri(p), d = KM.DIRS[p.o], n = [-d[1], d[0]], bx = (t[0][0] + t[2][0]) / 2, by = (t[0][1] + t[2][1]) / 2;
    const q = [[bx + n[0] * 0.2, by + n[1] * 0.2], [bx - n[0] * 0.2, by - n[1] * 0.2]];
    const r = [[q[0][0] - d[0] * 0.08, q[0][1] - d[1] * 0.08], [q[1][0] - d[0] * 0.08, q[1][1] - d[1] * 0.08]];
    const box = [Math.min(q[0][0], r[1][0]), Math.min(q[0][1], r[1][1]), Math.max(q[0][0], r[1][0]), Math.max(q[0][1], r[1][1])];
    section(c, Vw, () => { c.moveTo(q[0][0], q[0][1]); c.lineTo(q[1][0], q[1][1]); c.lineTo(r[1][0], r[1][1]); c.lineTo(r[0][0], r[0][1]); c.closePath(); }, box, C.ink, LW.part);
    c.beginPath(); c.moveTo(t[0][0], t[0][1]); c.lineTo(t[1][0], t[1][1]); c.lineTo(t[2][0], t[2][1]); c.closePath();
    fill(c, C['paper-hi'] || C.paper); stroke(c, Vw, C.ink, LW.part);
    if (Vw.lod) axisLine(c, Vw, bx, by, t[1][0] - d[0] * 0.12, t[1][1] - d[1] * 0.12, ink(0.45));
  }

  // Balon ve ipi (bölümün kendisinde). Balon kırmızı; ip mürekkep.
  const BALLOON = '#e2604f';
  function drawBalloon(c, Vw, x, y, alpha) {
    const r = T.balR;
    c.save(); c.globalAlpha = alpha;
    c.beginPath(); c.ellipse(x, y + 0.03, r * 0.94, r * 1.08, 0, 0, TAU); fill(c, BALLOON); stroke(c, Vw, '#7d2418', LW.part);
    c.beginPath(); c.moveTo(x, y - r * 1.02); c.lineTo(x - 0.07, y - r * 1.02 - 0.09); c.lineTo(x + 0.07, y - r * 1.02 - 0.09); c.closePath(); fill(c, BALLOON); stroke(c, Vw, '#7d2418', LW.thin);
    c.beginPath(); c.ellipse(x - r * 0.38, y + r * 0.42, r * 0.17, r * 0.27, -0.5, 0, TAU); fill(c, 'rgba(255,255,255,0.5)');
    c.restore();
  }
  function rope(c, Vw, a, b, alpha) {
    // Hafif sarkık ip: ortası biraz yana kıvrılır.
    const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.04, my = (a[1] + b[1]) / 2;
    c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mx, my, b[0], b[1]);
    stroke(c, Vw, ink(0.85 * alpha), LW.thin);
  }
  function hook(c, Vw, x, y) {
    c.beginPath(); c.arc(x, y, 0.09, 0, TAU); fill(c, C.paper); stroke(c, Vw, C.ink, LW.part);
  }
  function drawRopes(c, Vw, L, run) {
    if (run) {
      const sim = S.sim;
      for (const r of sim.ropes) {
        if (r.kind === 'hang') hook(c, Vw, r.hook[0], r.hook[1]);
        if (r.cut) {
          if (r.kind === 'hang') rope(c, Vw, r.hook, [r.hook[0], r.hook[1] - 0.35], 0.6);
          continue;
        }
        const a = r.bodyA.getWorldPoint(r.la), b = r.bodyB.getWorldPoint(r.lb);
        rope(c, Vw, [a.x, a.y], [b.x, b.y], 1);
      }
      for (const bl of sim.balloons) {
        if (!bl.alive) continue;
        const bp = bl.body.getPosition();
        if (bl.rope.cut) rope(c, Vw, [bp.x, bp.y - T.balR], [bp.x - 0.05, bp.y - T.balR - 0.8], 0.7);
        drawBalloon(c, Vw, bp.x, bp.y, 1);
      }
    } else {
      const st = KM.startsOf(L);
      for (const h of L.hangs || []) { const b = st[h.ball || 0]; rope(c, Vw, [h.x, h.y], [b.x, b.y + T.R], 0.8); hook(c, Vw, h.x, h.y); }
      for (const q of L.balloons || []) {
        const b = st[q.ball || 0], len = q.len || 1.1;
        // Üstünde raf varsa balon rafın altında başlar (ip gevşek).
        let lim = Infinity;
        for (const w of L.walls || []) if (typeof w[0] === 'number' && w[0] <= b.x && w[2] >= b.x && w[1] > b.y) lim = Math.min(lim, w[1]);
        const top = Math.min(b.y + T.R + len, lim - 2 * T.balR - 0.02);
        rope(c, Vw, [b.x, top], [b.x, b.y + T.R], 0.8);
        drawBalloon(c, Vw, b.x, top + T.balR, 0.85);
        if (Vw.lod) { c.beginPath(); c.moveTo(b.x, top + 2 * T.balR + 0.12); c.lineTo(b.x, top + 2 * T.balR + 0.62); stroke(c, Vw, ink(0.5), LW.hair, DASH.hidden); arrow(c, Vw, b.x, top + 2 * T.balR + 0.7, Math.PI / 2, 6, ink(0.55)); }
      }
    }
  }

  // Dişli: dişli çark, göbek ve eksen. Komşu dişlilerin dişleri birbirine otursun diye
  // kareler satranç tahtası gibi yarım diş kaydırılır. Kilitlenen ağda kırmızı çarpı.
  function gearPath(c, r, n, ang) {
    const ri = r - 0.08;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = ang + i * TAU / n, w = TAU / n;
      const pts = [[ri, a0], [r, a0 + w * 0.18], [r, a0 + w * 0.48], [ri, a0 + w * 0.66]];
      for (const [rr, a] of pts) { const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0 && rr === ri && a === a0) c.moveTo(x, y); else c.lineTo(x, y); }
    }
    c.closePath();
  }
  function jamMark(c, Vw, x, y) {
    c.beginPath(); c.moveTo(x - 0.16, y - 0.16); c.lineTo(x + 0.16, y + 0.16); c.moveTo(x + 0.16, y - 0.16); c.lineTo(x - 0.16, y + 0.16);
    c.lineCap = 'round'; stroke(c, Vw, C.bad, LW.edge + 1); c.lineCap = 'butt';
  }
  function drawGear(c, Vw, p, rt) {
    const ang = (rt && rt.body ? rt.body.getAngle() : 0) + ((p.x + p.y) % 2 ? Math.PI / 10 : 0), turning = !!(rt && rt.spin);
    c.save(); c.translate(p.x + 0.5, p.y + 0.5);
    gearPath(c, T.gearR + 0.04, 10, ang); fill(c, C.paper); fill(c, ink(turning ? 0.22 : 0.12)); stroke(c, Vw, C.ink, LW.part);
    if (Vw.lod) {
      c.beginPath(); c.arc(0, 0, 0.24, 0, TAU); stroke(c, Vw, ink(0.6), LW.hair);
      for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2; c.beginPath(); c.arc(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.045, 0, TAU); stroke(c, Vw, ink(0.6), LW.hair); }
      axisLine(c, Vw, -0.5, 0, 0.5, 0, ink(0.3)); axisLine(c, Vw, 0, -0.5, 0, 0.5, ink(0.3));
    }
    c.beginPath(); c.arc(0, 0, 0.07, 0, TAU); fill(c, C['paper-deep']); stroke(c, Vw, C.ink, LW.thin);
    c.restore();
    if (rt && rt.jam) jamMark(c, Vw, p.x + 0.5, p.y + 0.5);
  }
  // Kol: turuncu el çarkı (dişli kenar, tutamaklı kol). Kurarken döneceği yön ok ile.
  function drawCrank(c, Vw, p, rt, ann) {
    const ang = (rt && rt.body ? rt.body.getAngle() : 0) + ((p.x + p.y) % 2 ? Math.PI / 10 : 0), on = !!(rt && rt.on), dir = p.o === 'ccw' ? 1 : -1;
    c.save(); c.translate(p.x + 0.5, p.y + 0.5);
    gearPath(c, 0.38, 10, ang); fill(c, C.paper); fill(c, hand(on ? 0.34 : 0.18)); stroke(c, Vw, C.hand, LW.part);
    c.save(); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0.24, 0); stroke(c, Vw, C.hand, LW.edge + 0.6);
    c.beginPath(); c.arc(0.24, 0, 0.075, 0, TAU); fill(c, C.hand); stroke(c, Vw, C['paper-deep'], LW.thin);
    c.restore();
    c.beginPath(); c.arc(0, 0, 0.07, 0, TAU); fill(c, C['paper-deep']); stroke(c, Vw, C.hand, LW.thin);
    if (ann && Vw.lod) {
      const a0 = dir > 0 ? -0.6 : 0.6 + Math.PI, a1 = a0 + dir * 1.5;
      c.beginPath(); c.arc(0, 0, 0.5, Math.min(a0, a1), Math.max(a0, a1)); stroke(c, Vw, ink(0.55), LW.hair);
      arrow(c, Vw, Math.cos(a1) * 0.5, Math.sin(a1) * 0.5, a1 + dir * Math.PI / 2, 6, ink(0.65));
    }
    c.restore();
    if (rt && rt.jam) jamMark(c, Vw, p.x + 0.5, p.y + 0.5);
    badge(c, Vw, p.num, p.x + 0.13, p.y + 0.87, 0.13);
  }
  // Türbin: üç kanatlı rotor, dişli göbek. Pervanenin rüzgârı gelince kendi döner.
  function drawTurbine(c, Vw, p, rt, ann) {
    const ang = (rt && rt.body ? rt.body.getAngle() : 0) + ((p.x + p.y) % 2 ? Math.PI / 10 : 0), on = !!(rt && rt.spin), dir = p.o === 'ccw' ? 1 : -1;
    c.save(); c.translate(p.x + 0.5, p.y + 0.5);
    gearPath(c, 0.26, 8, ang); fill(c, C.paper); fill(c, ink(0.14)); stroke(c, Vw, C.ink, LW.thin);
    c.save(); c.rotate(ang);
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.moveTo(0.06, 0); c.quadraticCurveTo(0.2, 0.16 * dir, 0.44, 0.06 * dir); c.lineTo(0.44, -0.03 * dir); c.quadraticCurveTo(0.25, -0.03 * dir, 0.06, -0.05 * dir); c.closePath();
      fill(c, C.paper); fill(c, ink(on ? 0.45 : 0.22)); stroke(c, Vw, C.ink, LW.thin);
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, 0.06, 0, TAU); fill(c, C['paper-deep']); stroke(c, Vw, C.ink, LW.thin);
    if (ann && Vw.lod) {
      const a0 = dir > 0 ? -0.6 : 0.6 + Math.PI, a1 = a0 + dir * 1.5;
      c.beginPath(); c.arc(0, 0, 0.5, Math.min(a0, a1), Math.max(a0, a1)); stroke(c, Vw, ink(0.55), LW.hair);
      arrow(c, Vw, Math.cos(a1) * 0.5, Math.sin(a1) * 0.5, a1 + dir * Math.PI / 2, 6, ink(0.65));
    }
    c.restore();
    if (rt && rt.jam) jamMark(c, Vw, p.x + 0.5, p.y + 0.5);
  }
  // Asansör: eğik levha (taranmış kesit), iki yanında kremayer. Kurarken gideceği yol çizgi-iki noktayla.
  function drawLift(c, Vw, p, rt, ann) {
    const off = rt ? rt.offset : 0, tilt = p.o === 'r' ? -T.liftTilt : T.liftTilt, y = p.y - 0.07 + off;
    if (ann && Vw.lod) {
      c.beginPath(); c.rect(p.x, p.y - 0.14, 2, T.liftMax + 0.14); stroke(c, Vw, ink(0.35), LW.hair, DASH.phantom);
      c.save(); c.translate(p.x + 1, y + T.liftMax); c.rotate(tilt); c.beginPath(); c.rect(-1, -0.07, 2, 0.14); stroke(c, Vw, ink(0.5), LW.thin, DASH.phantom); c.restore();
      arrow(c, Vw, p.x + 1, p.y + 0.85, Math.PI / 2, 7, ink(0.55));
      c.beginPath(); c.moveTo(p.x + 1, p.y + 0.15); c.lineTo(p.x + 1, p.y + 0.8); stroke(c, Vw, ink(0.45), LW.hair, DASH.hidden);
    }
    // kremayer: levha yükseldikçe iki ucunda dişli çubuk görünür
    if (Vw.lod && off > 0.02) {
      c.beginPath();
      for (const sx of [p.x + 0.04, p.x + 1.96]) {
        c.moveTo(sx, y); c.lineTo(sx, p.y - 0.07);
        const out = sx < p.x + 1 ? -0.07 : 0.07;
        for (let k = y - 0.12; k > p.y - 0.07; k -= 0.15) { c.moveTo(sx, k); c.lineTo(sx + out, k - 0.05); }
      }
      stroke(c, Vw, ink(0.75), LW.thin);
    }
    c.save(); c.translate(p.x + 1, y); c.rotate(tilt);
    section(c, Vw, () => c.rect(-1, -0.07, 2, 0.14), [-1, -0.07, 1, 0.07], C.ink, LW.part);
    c.restore();
    if (rt && rt.jam) jamMark(c, Vw, p.x + 1, y + 0.3);
  }

  // Sabit parçalar cıvatalı: taşınamazlar.
  function fixings(c, Vw, p) {
    if (!Vw.lod) return;
    const d = KM.sizeOf(p), col = ink(0.92);
    let pts;
    if (p.type === 'ramp') {
      const [a, b] = KM.rampLine(p.o), ax = p.x + a[0], ay = p.y + a[1], bx = p.x + b[0], by = p.y + b[1];
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      pts = [[ax + ux * 0.075, ay + uy * 0.075], [bx - ux * 0.075, by - uy * 0.075]];
    } else if (p.type === 'belt') pts = [[p.x + T.plank / 2, p.y], [p.x + 2 - T.plank / 2, p.y]];
    else if (p.type === 'piston') { const a = PISTON_ROT[p.o]; pts = [toWorld(p, -0.43, -0.42, a), toWorld(p, 0.43, -0.42, a)]; }
    else if (p.type === 'gate') {
      const g = KM.GATES[p.o], hx = (g.housing[0] + g.housing[2]) / 2, hy = (g.housing[1] + g.housing[3]) / 2;
      pts = p.o === 'u' ? [[p.x + 0.2, p.y + 1.9], [p.x + 0.8, p.y + 1.9]] : [[p.x + hx - 0.32, p.y + 0.14], [p.x + hx + 0.32, p.y + 0.14]];
      void hy;
    }
    else pts = [[p.x + 0.08, p.y + 0.08], [p.x + d.w - 0.08, p.y + 0.08]];
    for (const q of pts) bolt(c, Vw, q[0], q[1], col);
  }

  function drawPart(c, Vw, p, rt, time, ann) {
    if (p.type === 'ramp') drawRamp(c, Vw, p, ann);
    else if (p.type === 'spring') drawSpring(c, Vw, p, rt, ann);
    else if (p.type === 'belt') drawBelt(c, Vw, p, time);
    else if (p.type === 'piston') drawPiston(c, Vw, p, rt, ann);
    else if (p.type === 'fan') drawFan(c, Vw, p, rt);
    else if (p.type === 'gate') drawGate(c, Vw, p, rt, ann);
    else if (p.type === 'magnet') drawMagnet(c, Vw, p, rt, time);
    else if (p.type === 'flipper') drawFlipper(c, Vw, p, rt, ann);
    else if (p.type === 'bumper') drawBumper(c, Vw, p, rt, ann);
    else if (p.type === 'cutter') drawCutter(c, Vw, p, rt, ann);
    else if (p.type === 'pin') drawPin(c, Vw, p);
    else if (p.type === 'gear') drawGear(c, Vw, p, rt);
    else if (p.type === 'crank') drawCrank(c, Vw, p, rt, ann);
    else if (p.type === 'lift') drawLift(c, Vw, p, rt, ann);
    else if (p.type === 'turbine') drawTurbine(c, Vw, p, rt, ann);
    else if (p.type === 'sensor') drawSensor(c, Vw, p, rt, true);
    if (p.fixed) fixings(c, Vw, p);
  }

  // 0 numaralı top sarı; diğerleri çelik bilye (aynı fizik, farklı görünüm).
  const BALL_LOOK = [
    { fill: null, edge: GOLD, mark: 'rgba(130,90,10,0.75)' },
    { fill: '#cdd8e8', edge: '#5d6f8c', mark: 'rgba(60,75,100,0.7)' },
  ];
  const ballFill = i => (i ? BALL_LOOK[1].fill : C.ball);
  const kindIdx = k => (k === 'steel' ? 1 : 0);
  function drawBall(c, Vw, x, y, ang, alpha, idx) {
    const R = T.R, look = BALL_LOOK[idx ? 1 : 0];
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); fill(c, ballFill(idx)); stroke(c, Vw, look.edge, LW.part);
    c.save(); c.rotate(ang);
    c.beginPath(); c.moveTo(-R * 0.72, 0); c.lineTo(R * 0.72, 0); c.moveTo(0, -R * 0.3); c.lineTo(0, R * 0.3);
    stroke(c, Vw, look.mark, 1.8);
    c.restore();
    c.beginPath(); c.arc(-R * 0.36, R * 0.36, R * 0.22, 0, TAU); fill(c, 'rgba(255,255,255,0.55)');
    c.restore();
  }

  // Topun yolu: noktalı çizgi, aralıklarla yön oku. Başarısız denemede topun
  // son görüldüğü yer kırmızı çarpıyla işaretlenir.
  function drawTrail(c, Vw, trail, alpha, idx, failMark) {
    if (!trail || trail.length < 2) return;
    const col = rgba(ballFill(idx), alpha);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(trail[0][0], trail[0][1]);
    for (let i = 1; i < trail.length; i++) c.lineTo(trail[i][0], trail[i][1]);
    stroke(c, Vw, col, 2.3, DASH.dot);
    if (Vw.lod) {
      c.beginPath();
      let acc = 0.7;
      for (let i = 1; i < trail.length; i++) {
        const dx = trail[i][0] - trail[i - 1][0], dy = trail[i][1] - trail[i - 1][1], d = Math.hypot(dx, dy);
        acc += d;
        if (acc >= 1.4 && d > 1e-4) { acc = 0; chevron(c, Vw, trail[i][0], trail[i][1], Math.atan2(dy, dx), 5.5); }
      }
      stroke(c, Vw, col, LW.part);
    }
    c.lineCap = 'butt'; c.lineJoin = 'miter';
    if (!failMark) return;
    let e = null;
    for (let i = trail.length - 1; i >= 0 && !e; i--) {
      const q = trail[i];
      if (q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H) e = q;
    }
    if (!e) return;
    const s = 0.15;
    c.beginPath(); c.moveTo(e[0] - s, e[1] - s); c.lineTo(e[0] + s, e[1] + s); c.moveTo(e[0] - s, e[1] + s); c.lineTo(e[0] + s, e[1] - s);
    c.lineCap = 'round';
    stroke(c, Vw, HALO, LW.edge + 2.4); stroke(c, Vw, C.bad, LW.edge + 0.4);
    c.lineCap = 'butt';
  }

  function outline(c, Vw, p, color, alpha, width) {
    const d = KM.sizeOf(p);
    c.beginPath(); c.rect(p.x + 0.04, p.y + 0.04, d.w - 0.08, d.h - 0.08);
    c.lineWidth = Vw.px(width || 2); c.strokeStyle = rgba(color, alpha); c.stroke();
  }

  // Bu çizimde ilk kez görülen sabit parça: ilk çalıştırmaya kadar kesik sarı çerçeve ve "NEW" etiketi.
  function drawNewTag(c, Vw, p, time, label) {
    const d = KM.sizeOf(p), a = reduceMotion ? 0.8 : 0.55 + 0.35 * Math.sin(time * 4.2);
    c.beginPath(); c.rect(p.x - 0.1, p.y - 0.1, d.w + 0.2, d.h + 0.2);
    stroke(c, Vw, rgba(C.ball, a), LW.part, DASH.hidden);
    if (!label) return;
    const x = p.x + d.w / 2, y = p.y + d.h + 0.32 > H - 0.15 ? p.y - 0.32 : p.y + d.h + 0.32;
    const w = Vw.px(40), h = Vw.px(19);
    c.beginPath(); rrect(c, x - w / 2, y - h / 2, w, h, Vw.px(3)); fill(c, C.ball);
    textAt(c, Vw, 'NEW', x, y, 12.5, C['paper-deep'], 'center', 700);
  }

  // ---------------------------------------------------------------- yardımcılar (kurulum)
  const allParts = () => KM.listParts(S.level, S.parts);
  const devicesAll = () => allParts().filter(p => PARTS[p.type].manual);
  const trayTotal = () => Object.values(S.level.tray || {}).reduce((a, b) => a + b, 0);
  const trayLeft = type => ((S.level.tray || {})[type] || 0) - S.parts.filter(p => p.type === type).length;
  // Bütün çizimler açık (9 Kasım 2026, Umut'un isteği): sıra yalnızca öneri.
  function unlocked() { return true; }
  function centerOf(p) { const d = KM.sizeOf(p); return [p.x + d.w / 2, p.y + d.h / 2]; }
  function autoLink(sensor) {
    const [sx, sy] = centerOf(sensor);
    let best = null, bd = 1e9;
    for (const d of devicesAll()) {
      const [dx, dy] = centerOf(d), dist = Math.hypot(dx - sx, dy - sy);
      if (dist < bd) { bd = dist; best = d; }
    }
    sensor.link = best ? best.id : null;
  }
  function relinkAfterRemoval(id) {
    for (const s of S.parts) if (s.type === 'sensor' && s.link === id) autoLink(s);
  }
  function cellHit(list, w) {
    const cx = Math.floor(w.x), cy = Math.floor(w.y);
    const hits = list.filter(p => KM.cellsOf(p).some(q => q[0] === cx && q[1] === cy));
    return hits.find(p => p.type === 'sensor') || hits[0] || null;
  }

  // ---------------------------------------------------------------- tahta çizimi
  const inCup = q => KM.cupsOf(S.level).some(cp => q[0] > cp.x && q[0] < cp.x + cp.w && q[1] > cp.y && q[1] < cp.y + KM.CUP.rim + 0.3);

  // ann: kurarken görünen ölçü ve hareket çizgileri (pistonun varacağı yer, pervanenin erimi, yayın yönü).
  function drawScene(c, items, run, time, hl) {
    const L = S.level, ann = !run;
    drawGrid(c, V, true, hl);
    for (const it of items) if (it.p.type === 'fan') drawFanZone(c, V, it.p, it.rt, time);
    drawWalls(c, V, L);
    const trails = run ? S.sim.trails : S.trails || [];
    const kinds = run ? S.sim.kinds : KM.ballKinds(L);
    trails.forEach((tr, i) => drawTrail(c, V, tr, run ? 0.75 : 0.45, kindIdx(kinds[i]), !run && !!S.trailFail && tr.length > 0 && !inCup(tr[tr.length - 1])));
    for (const cup of KM.cupsOf(L)) drawCup(c, V, cup, time);
    drawPipe(c, V, L);
    for (const it of items) if (it.p.type !== 'sensor') drawPart(c, V, it.p, it.rt, time, ann);
    const byId = {};
    for (const it of items) byId[it.p.id] = it.p;
    for (const it of items) {
      if (it.p.type !== 'sensor') continue;
      const target = run ? (it.rt.link && it.rt.link.p) : byId[it.p.link];
      const age = run && it.rt.flash > 0 ? 0.4 - it.rt.flash : -1;
      if (target) drawLink(c, V, it.p, target, age >= 0 && age < 0.24 && !reduceMotion ? age / 0.24 : null);
    }
    for (const it of items) {
      if (it.p.type !== 'sensor') continue;
      drawSensor(c, V, it.p, it.rt, run ? !!it.rt.link : !!byId[it.p.link]);
    }
    if (ann) for (const it of items) {
      if (it.p.type === 'fan') drawFanRange(c, V, it.p);
      else if (it.p.type === 'magnet') drawMagnetRange(c, V, it.p);
    }
    if (ann && S.introNew && !S.newSeen) {
      const tagged = new Set();   // aynı türden birkaç parça varsa etiket ilkinde, çerçeve hepsinde
      for (const it of items) if (it.p.fixed && S.introNew.has(it.p.type)) { drawNewTag(c, V, it.p, time, !tagged.has(it.p.type)); tagged.add(it.p.type); }
    }
    drawRopes(c, V, L, run);
    if (run) {
      S.sim.balls.forEach((b, i) => {
        if (S.sim.bstate[i] === 'out') return;
        const bp = b.getPosition();
        drawBall(c, V, bp.x, bp.y, b.getAngle(), 1, kindIdx(kinds[i]));
      });
    } else {
      KM.startsOf(L).forEach((st, i) => drawBall(c, V, st.x, st.y, 0, 0.6, kindIdx(kinds[i])));
    }
  }

  function render() {
    if (!V) return;
    const c = ctx, time = S.time;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    V.tf(c);
    const run = S.mode === 'run' && S.sim;
    const items = run ? S.sim.rts.map(rt => ({ p: rt.p, rt })) : allParts().map(p => ({ p, rt: null }));
    const dr = S.drag, cand = dr && dr.cand && dr.over ? dr.cand : null;
    const cz = cand && KM.sizeOf(cand);
    const hl = cand ? { x0: cand.x, x1: cand.x + cz.w, y0: cand.y, y1: cand.y + cz.h, ok: dr.valid } : null;
    drawScene(c, items, run, time, hl);
    if (run) {
      const pulse = 0.25 + 0.2 * Math.sin(time * 5);
      for (const it of items) if (PARTS[it.p.type].manual) outline(c, V, it.p, C.hand, pulse, 1.5);
    }
    if (S.linkFrom) {
      const pulse = 0.55 + 0.4 * Math.sin(time * 7);
      for (const it of items) if (PARTS[it.p.type].manual) outline(c, V, it.p, C.hand, pulse, 2.5);
      outline(c, V, S.linkFrom, C.eye, 0.9, 2.5);
    }
    if (cand) {
      for (const q of KM.cellsOf(cand)) {
        c.fillStyle = dr.valid ? rgba(C.ink, 0.13) : rgba(C.bad, 0.32);
        c.fillRect(q[0], q[1], 1, 1);
      }
      c.save(); c.globalAlpha = dr.valid ? 0.9 : 0.55;
      if (cand.type === 'fan') drawFanZone(c, V, cand, null, time);
      drawPart(c, V, cand, null, time, true);
      if (cand.type === 'fan') drawFanRange(c, V, cand);
      if (cand.type === 'magnet') drawMagnetRange(c, V, cand);
      c.restore();
    }
    drawEffects(c, time);
    // Yerleşince kısa bir oturma çizgisi.
    const sn = S.snap;
    if (sn && !reduceMotion && time - sn.t < 0.3) {
      const k = (time - sn.t) / 0.3, g = 0.2 * (1 - k);
      c.beginPath(); c.rect(sn.x - g, sn.y - g, sn.w + 2 * g, sn.h + 2 * g);
      c.lineWidth = V.px(1.5); c.strokeStyle = rgba(C.ink, 0.85 * (1 - k)); c.stroke();
    }
  }

  // Çalışırken kısa izler: çarpma çizgileri, kovaya giren topun hedef halkaları.
  function drawEffects(c, time) {
    for (const f of S.fx) {
      const age = time - f.t;
      if (f.k === 'hit') {
        const k = age / 0.28; if (k >= 1) continue;
        c.beginPath();
        for (const da of [-1.15, -0.5, 0.5, 1.15]) {
          const a = f.a + da, r0 = 0.05 + 0.06 * k, r1 = r0 + 0.13 * (1 - k * 0.5);
          c.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); c.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
        }
        c.lineCap = 'round'; stroke(c, V, ink(0.9 * (1 - k)), LW.part); c.lineCap = 'butt';
      } else if (f.k === 'goal') {
        const k = age / 0.8; if (k >= 1) continue;
        c.beginPath();
        for (const lag of [0, 0.22]) {
          const q = Math.max(0, k - lag) / (1 - lag);
          if (q > 0) { c.moveTo(f.x + 0.17 + 0.8 * q, f.y); c.arc(f.x, f.y, 0.17 + 0.8 * q, 0, TAU); }
        }
        stroke(c, V, rgba(C.ball, 0.85 * (1 - k)), LW.part);
      } else if (f.k === 'pop') {
        // Balon patladı: kırmızı parçalar ve kısa çizgiler dışarı saçılır.
        const k = age / 0.45; if (k >= 1) continue;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = i * TAU / 10 + 0.3, r0 = 0.2 + 0.6 * k, r1 = r0 + 0.18 * (1 - k);
          c.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); c.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
        }
        c.lineCap = 'round'; stroke(c, V, rgba(BALLOON, 0.95 * (1 - k)), LW.edge); c.lineCap = 'butt';
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + 1.1, r = 0.25 + 0.7 * k;
          c.beginPath(); c.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r - 0.5 * k * k, 0.06, 0, TAU); fill(c, rgba(BALLOON, 1 - k));
        }
      } else if (f.k === 'win') {
        // Makine çalıştı: kovadan çıkan ışınlar ve kovanın üstünde kendini çizen onay işareti.
        const k = age / 1.15; if (k >= 1) continue;
        const e = 1 - Math.pow(1 - Math.min(1, k * 1.7), 3), fade = 1 - Math.max(0, (k - 0.55) / 0.45);
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU + 0.2, r0 = 0.45 + 1.5 * e, r1 = r0 + 0.25 + 0.35 * (1 - e);
          c.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); c.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
        }
        c.lineCap = 'round'; stroke(c, V, rgba(C.ball, 0.9 * fade), LW.edge);
        c.beginPath(); c.arc(f.x, f.y, 0.3 + 1.9 * e, 0, TAU); stroke(c, V, ink(0.5 * fade), LW.thin, DASH.center);
        const pts = [[f.x - 0.42, f.y + 1.55], [f.x - 0.12, f.y + 1.25], [f.x + 0.5, f.y + 1.95]];
        const L1 = Math.hypot(0.3, 0.3), L2 = Math.hypot(0.62, 0.7), q = Math.min(1, k * 2.6) * (L1 + L2);
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        if (q <= L1) c.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * q / L1, pts[0][1] + (pts[1][1] - pts[0][1]) * q / L1);
        else { c.lineTo(pts[1][0], pts[1][1]); const u = (q - L1) / L2; c.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * u, pts[1][1] + (pts[2][1] - pts[1][1]) * u); }
        c.lineJoin = 'round';
        stroke(c, V, HALO, LW.edge + 5); stroke(c, V, rgba(C.ball, fade), LW.edge + 2.2);
        c.lineCap = 'butt'; c.lineJoin = 'miter';
      }
    }
    // Son top kovaya girince tahta bir an aydınlanır.
    if (S.flashT != null && !reduceMotion) {
      const k = (time - S.flashT) / 0.35;
      if (k >= 0 && k < 1) { c.save(); V.screen(c); c.fillStyle = ink(0.13 * (1 - k)); c.fillRect(0, 0, cv.width, cv.height); c.restore(); }
    }
  }

  function drawIcon(canvas, type, o) {
    const r = canvas.getBoundingClientRect();
    const w = canvas.clientWidth || r.width || 52, h = canvas.clientHeight || r.height || 30, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const d = KM.sizeOf({ type, o: o || DEFAULT_O[type] }), c = canvas.getContext('2d');
    const vw = Math.max(2.4, d.w + 0.4), vh = Math.max(1.24, d.h + 0.2);
    const Vi = makeView(w, h, dpr, d.w / 2 - vw / 2, d.h / 2 - vh / 2, vw, vh);
    Vi.tf(c);
    drawPart(c, Vi, { type, o: o || DEFAULT_O[type], x: 0, y: 0 }, null, 0, false);
  }

  function drawThumb(canvas, L) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    const c = canvas.getContext('2d');
    const Vt = makeView(r.width, r.height, dpr, -0.5, -0.5, W + 1, H + 1);
    Vt.tf(c);
    drawGrid(c, Vt, false);
    const fixed = KM.listParts(L, []);
    for (const p of fixed) if (p.type === 'fan') drawFanZone(c, Vt, p, null, 0);
    drawWalls(c, Vt, L); for (const cup of KM.cupsOf(L)) drawCup(c, Vt, cup, 0); drawPipe(c, Vt, L);
    for (const p of fixed) drawPart(c, Vt, p, null, 0, false);
    const kinds = KM.ballKinds(L);
    KM.startsOf(L).forEach((st, i) => drawBall(c, Vt, st.x, st.y, 0, 1, kindIdx(kinds[i])));
  }

  // ---------------------------------------------------------------- arayüz
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2800);
  }
  function hideToast() { clearTimeout(toastTimer); $('toast').classList.remove('show'); }

  const badgeText = b => b.k === 'solve' ? 'Machine works'
    : b.k === 'budget' ? (b.n === 1 ? 'Just one part' : `At most ${b.n} parts`)
    : b.k === 'presses' ? (b.n === 1 ? 'One press' : `At most ${b.n} presses`)
    : 'Fully automatic';
  const badgeOk = (b, used, presses) => b.k === 'solve' || (b.k === 'budget' && used <= b.n)
    || (b.k === 'presses' && presses <= b.n) || (b.k === 'auto' && presses === 0);
  const badgeTip = b => b.k === 'budget' ? (b.n === 1 ? 'Try it with a single part.' : `Try it with fewer parts: ${b.n} at most.`)
    : b.k === 'presses' ? (b.n === 1 ? 'Try it with one press: wait for the right moment, then press once.' : `Try it with at most ${b.n} presses.`)
    : b.k === 'auto' ? 'Try it fully automatic: build a machine that runs without a touch. A sensor fires its linked device when a ball crosses it.'
    : '';

  function setHint() {
    const L = S.level, h = L.hints || {}, prog = S.progress[L.id];
    let t;
    if (S.mode === 'edit') t = TOOL_HINT[S.edit.tool];
    else if (S.mode === 'run') t = h.run || 'The machine is running. Press Stop to go back to building.';
    else if (S.linkFrom) t = 'Tap an orange device to link the sensor to it. Tap an empty spot to cancel.';
    else if (prog && prog.solved) {
      const missing = L.badges.some(b => !prog.badges[b.k]);
      t = missing ? (h.after || 'Go for the missing stamps.')
        : S.li + 1 < LEVELS.length ? 'Every stamp on this drawing is yours. On to the next one.' : 'Every drawing in the notebook is done. New drawings are on the way.';
    } else if (S.lastFail) t = h.fail || 'Look at the dotted line and change the setup.';
    else if (!S.parts.length) t = h.place || h.ready;
    else t = h.ready || 'Ready? Press Run.';
    const el = $('hint');
    if (el.textContent !== t) el.textContent = t;
  }

  function refreshHeader() {
    const L = S.level;
    const edit = S.mode === 'edit';
    $('tb-no').textContent = edit ? 'Edit' : L.book === 'W' ? 'Workshop' : `${pad2(S.li + 1)} / ${pad2(OFFICIAL)}`;
    $('tb-name').textContent = cleanName(L.name);
    $('tb-task').textContent = edit ? 'Draw your own machine puzzle. Test it, then share it.' : L.task;
    document.title = `Drawing Board · ${L.name}`;
  }

  function refreshBom() {
    const ol = $('bom-list'); ol.textContent = '';
    const types = ORDER.filter(t => ((S.level.tray || {})[t] || 0) > 0);
    $('bom-foot').hidden = !types.length;
    if (!types.length) {
      const li = document.createElement('li'); li.className = 'bom-none';
      li.textContent = 'No parts in this drawing. The machine is built; the controls are yours.';
      ol.appendChild(li); return;
    }
    types.forEach((type, i) => {
      const left = trayLeft(type);
      const li = document.createElement('li');
      const isNew = !!(S.introNew && S.introNew.has(type));
      li.className = 'bom-row' + (left > 0 ? '' : ' empty') + (isNew ? ' is-new' : '');
      li.innerHTML = `<span class="no">${i + 1}</span><canvas aria-hidden="true"></canvas><span class="nm">${NAMES[type]}${isNew ? ' <i class="tag-new">New</i>' : ''}</span><span class="qty">×${left}</span>`;
      li.setAttribute('aria-label', `${NAMES[type]}${isNew ? ', new part' : ''}, ${left} left`);
      li.addEventListener('pointerdown', e => startTrayDrag(type, e));
      ol.appendChild(li);
      drawIcon(li.querySelector('canvas'), type);
    });
  }

  function refreshGoals() {
    const ul = $('goal-list'); ul.textContent = '';
    const prog = S.progress[S.level.id];
    for (const b of S.level.badges) {
      const got = !!(prog && prog.badges[b.k]);
      const li = document.createElement('li'); li.className = 'goal' + (got ? ' got' : '');
      li.innerHTML = `<span class="stamp">${CHECK}</span><span>${badgeText(b)}</span>`;
      ul.appendChild(li);
    }
  }

  function refreshSide() {
    const run = S.mode === 'run', edit = S.mode === 'edit';
    $('editor').hidden = !edit; $('goals').hidden = edit; $('run').hidden = edit;
    $('btn-edit').hidden = edit || run || S.level.book !== 'W';
    if (edit) { $('bom').hidden = true; $('pult').hidden = true; setHint(); return; }
    $('bom').hidden = run; $('pult').hidden = !run;
    const btn = $('run');
    btn.classList.toggle('stop', run);
    $('run-label').textContent = run ? 'Stop' : 'Run';
    $('run-ico').innerHTML = run ? '<rect x="4" y="4" width="12" height="12" fill="currentColor"/>' : '<path d="M4 2.5l13 7.5-13 7.5z" fill="currentColor"/>';
    if (!run) refreshBom();
    refreshGoals(); setHint();
  }

  function buildPult() {
    const box = $('pult-buttons'); box.textContent = '';
    const devs = S.sim.devices;
    $('pult-foot').hidden = !devs.length;
    if (!devs.length) {
      const p = document.createElement('p'); p.className = 'pult-none';
      p.textContent = 'Nothing to work by hand on this machine. Just watch.';
      box.appendChild(p); return;
    }
    for (const rt of devs) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'dev';
      b.innerHTML = `<span class="num">${rt.num}</span><span class="nm">${NAMES[rt.type]}</span><span class="act">${actText(rt)}</span>`;
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* yok say */ }
        devDown(rt, e.pointerId);
      });
      const up = e => devUp(rt, e.pointerId);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); devDown(rt, 'kb'); } });
      b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') devUp(rt, 'kb'); });
      rt.btn = b;
      box.appendChild(b);
    }
  }
  const actText = rt => PARTS[rt.type].manual === 'hold' ? 'Hold' : rt.type === 'gate' ? (rt.open ? 'Close' : 'Open') : 'Press';
  function updatePult() {
    if (!S.sim) return;
    for (const rt of S.sim.devices) {
      if (!rt.btn) continue;
      const m = PARTS[rt.type].manual;
      const on = m === 'hold' ? rt.on : rt.type === 'gate' ? rt.open : rt.state !== 'idle';
      if (rt.btn.classList.contains('on') !== on) rt.btn.classList.toggle('on', on);
      const act = rt.btn.querySelector('.act'), at = actText(rt);
      if (act && act.textContent !== at) act.textContent = at;
    }
    const t = S.sim.balls.length > 1 ? `Presses: ${S.sim.presses} · Cups: ${S.sim.goals}/${S.sim.need}` : `Presses: ${S.sim.presses}`;
    const el = $('press-count'); if (el.textContent !== t) el.textContent = t;
  }

  // ---------------------------------------------------------------- bölüm
  function loadLevel(i) {
    hideToast();
    S.li = i; S.level = LEVELS[i]; S.occ = KM.occupancy(S.level);
    S.mode = 'build'; S.sim = null; S.trails = null; S.trailFail = null; S.lastFail = null; S.drag = null; S.press = null; S.linkFrom = null; S.snap = null;
    S.held.clear();
    S.parts = []; S.nextId = 1;
    const prog0 = S.progress[S.level.id];
    S.introNew = INTRO[i].length && !(prog0 && prog0.solved) ? new Set(INTRO[i]) : null; S.newSeen = false;
    try { if (AU) AU.setLevel(S.level.id); } catch (e) { /* yok say */ }
    if (!overlayOpen()) musicMode('build');
    const setup = S.setups[S.level.id] || [];
    for (const q of setup) {
      if (!q || !PARTS[q.type] || typeof q.x !== 'number' || typeof q.y !== 'number') continue;
      if (!PARTS[q.type].orients.includes(q.o)) continue;
      const p = { id: typeof q.id === 'number' ? q.id : S.nextId, type: q.type, o: q.o, x: q.x, y: q.y, link: q.link == null ? null : q.link };
      if (trayLeft(p.type) <= 0 || !KM.canPlace(S.level, S.occ, S.parts, p, null)) continue;
      S.parts.push(p); S.nextId = Math.max(S.nextId, p.id + 1);
    }
    persist();
    refreshHeader(); refreshSide();
  }

  function addPlaced(p) {
    S.parts.push(p);
    if (p.type === 'sensor' && (p.link == null || !devicesAll().some(d => d.id === p.link))) autoLink(p);
  }

  // ---------------------------------------------------------------- sürükle-bırak
  function evWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: V.wx(e.clientX - r.left), y: V.wy(e.clientY - r.top) };
  }
  const inBoard = (w, pad) => w.x >= -pad && w.x <= W + pad && w.y >= -pad && w.y <= H + pad;

  function startTrayDrag(type, e) {
    if (S.mode !== 'build' || trayLeft(type) <= 0 || S.drag) return;
    e.preventDefault();
    exitLink(); audio();
    const d = KM.sizeOf({ type, o: DEFAULT_O[type] });
    S.drag = { type, o: DEFAULT_O[type], fromId: null, link: null, grab: [d.w / 2, d.h / 2], pid: e.pointerId, lift: e.pointerType === 'touch' ? 0.9 : 0, cand: null, valid: false, over: false };
    updateDrag(e);
  }

  function updateDrag(e) {
    const dr = S.drag, w = evWorld(e);
    w.y += dr.lift;
    dr.cand = { id: dr.fromId || 0, type: dr.type, o: dr.o, x: Math.round(w.x - dr.grab[0]), y: Math.round(w.y - dr.grab[1]), link: dr.link };
    dr.over = inBoard(w, 0.25);
    dr.valid = dr.over && KM.canPlace(S.level, S.occ, S.parts, dr.cand, null);
    const img = $('dragimg');
    if (!dr.over) {
      if (!img.firstChild || img.dataset.type !== dr.type) {
        img.textContent = '';
        const c = document.createElement('canvas'); c.style.width = '78px'; c.style.height = '45px';
        img.appendChild(c); img.style.display = 'block'; img.dataset.type = dr.type;
        drawIcon(c, dr.type, dr.o);
      }
      img.style.display = 'block';
      img.style.transform = `translate(${e.clientX - 39}px, ${e.clientY - 22 - dr.lift * 40}px)`;
    } else img.style.display = 'none';
  }

  function endDrag() {
    const dr = S.drag; S.drag = null;
    const img = $('dragimg'); img.style.display = 'none'; img.textContent = ''; delete img.dataset.type;
    if (dr.valid) {
      const p = { id: dr.fromId || S.nextId++, type: dr.type, o: dr.o, x: dr.cand.x, y: dr.cand.y, link: dr.link };
      addPlaced(p); sfx('place'); snapAt(p);
    } else if (dr.fromId) {
      if (!dr.over) { relinkAfterRemoval(dr.fromId); sfx('remove'); }
      else { S.parts.push(dr.orig); toast('It doesn’t fit there. The part went back.', 1800); }
    } else if (dr.over) {
      toast('It doesn’t fit there. The red squares are taken.', 1800);
    }
    saveSetup(); refreshBom(); setHint();
  }

  function snapAt(p) { const d = KM.sizeOf(p); S.snap = { x: p.x, y: p.y, w: d.w, h: d.h, t: S.time }; }

  function rotatePart(p) {
    const os = PARTS[p.type].orients;
    if (os.length < 2) return;
    const i = os.indexOf(p.o);
    for (let k = 1; k < os.length; k++) {
      const o = os[(i + k) % os.length], cand = Object.assign({}, p, { o });
      if (KM.canPlace(S.level, S.occ, S.parts, cand, p.id)) { p.o = o; sfx('tick'); snapAt(p); saveSetup(); return; }
    }
  }

  function enterLink(sensor) {
    if (!devicesAll().length) { toast('There is no orange device to link in this drawing.'); return; }
    S.linkFrom = sensor; sfx('tick'); setHint();
  }
  function exitLink() { if (S.linkFrom) { S.linkFrom = null; setHint(); } }

  function onBoardDown(e) {
    if (!V || overlayOpen()) return;
    audio();
    if (S.mode === 'edit') { edDown(e); return; }
    const w = evWorld(e);
    if (S.mode === 'run') {
      if (!S.sim) return;
      const cx = Math.floor(w.x), cy = Math.floor(w.y);
      const rt = S.sim.devices.find(d => KM.cellsOf(d).some(q => q[0] === cx && q[1] === cy));
      if (rt) { e.preventDefault(); devDown(rt, e.pointerId); }
      return;
    }
    if (S.drag) return;
    if (S.linkFrom) {
      const t = cellHit(devicesAll(), w);
      if (t) { S.linkFrom.link = t.id; sfx('link'); saveSetup(); }
      exitLink();
      return;
    }
    const p = cellHit(S.parts, w);
    if (!p) return;
    e.preventDefault();
    S.press = { pid: e.pointerId, part: p, x0: e.clientX, y0: e.clientY, grab: [w.x - p.x, w.y - p.y] };
  }

  function onMove(e) {
    if (S.mode === 'edit') { edMove(e); return; }
    if (S.drag && e.pointerId === S.drag.pid) { updateDrag(e); return; }
    const pr = S.press;
    if (pr && e.pointerId === pr.pid && Math.hypot(e.clientX - pr.x0, e.clientY - pr.y0) > 7) {
      S.press = null;
      const p = pr.part;
      S.parts = S.parts.filter(q => q !== p);
      S.drag = { type: p.type, o: p.o, fromId: p.id, link: p.link, orig: p, grab: pr.grab, pid: pr.pid, lift: 0, cand: null, valid: false, over: true };
      updateDrag(e);
    }
  }

  function onUp(e) {
    if (S.edit && S.edit.down === e.pointerId) { S.edit.down = null; return; }
    if (S.drag && e.pointerId === S.drag.pid) { endDrag(); return; }
    const pr = S.press;
    if (pr && e.pointerId === pr.pid) {
      S.press = null;
      if (pr.part.type === 'sensor') enterLink(pr.part); else rotatePart(pr.part);
      return;
    }
    const rt = S.held.get(e.pointerId);
    if (rt) devUp(rt, e.pointerId);
  }

  function onCancel(e) {
    if (S.drag && e.pointerId === S.drag.pid) { S.drag.valid = false; S.drag.over = true; endDrag(); }
    if (S.press && e.pointerId === S.press.pid) S.press = null;
    const rt = S.held.get(e.pointerId);
    if (rt) devUp(rt, e.pointerId);
  }

  // ---------------------------------------------------------------- çalıştırma
  function devDown(rt, pid) {
    if (!S.sim || S.sim.status === 'out') return;
    if (PARTS[rt.type].manual === 'hold') { S.held.set(pid, rt); S.sim.hold(rt, true); }
    else S.sim.press(rt, true);
    updatePult();
  }
  function devUp(rt, pid) {
    if (!S.held.has(pid)) return;
    S.held.delete(pid);
    if (S.sim && PARTS[rt.type].manual === 'hold' && ![...S.held.values()].includes(rt)) S.sim.hold(rt, false);
    updatePult();
  }
  function releaseAll() {
    for (const [pid, rt] of [...S.held]) devUp(rt, pid);
    S.held.clear();
  }

  function toggleRun() { if (S.mode === 'edit') return; if (S.mode === 'run') stopRun('user'); else startRun(); }

  function startRun() {
    if (S.drag || overlayOpen()) return;
    exitLink(); hideToast(); audio();
    S.sim = KM.createSim(S.level, S.parts.map(p => Object.assign({}, p)));
    S.mode = 'run'; S.acc = 0; S.endT = 0; S.restNoted = false; S.goalPlayed = false;
    S.goalN = 0; S.goalAt = null; S.winAt = null; S.flashT = null; S.lastHit = []; S.newSeen = true;
    S.held.clear();
    S.seen = S.sim.rts.map(rt => ({ fires: rt.fires, comp: rt.compress, on: rt.on })); S.popsSeen = 0;
    S.fx = []; S.prevV = []; S.prevState = S.sim.bstate.slice();
    sfx('run'); musicMode('run');
    refreshSide(); buildPult(); updatePult();
  }

  function stopRun(reason) {
    if (!S.sim) return;
    releaseAll();
    S.trails = S.sim.trails.map(t => t.slice());
    S.trailFail = reason !== 'user' ? reason : null;
    S.sim = null; S.mode = 'build'; S.goalAt = null;
    musicMode('build');
    if (reason !== 'user') S.lastFail = reason;
    else sfx('stop');
    if (reason === 'out') { toast('The ball fell off. The dotted line shows its last path.'); sfx('fail'); }
    else if (reason === 'timeout') toast('Time’s up. Take another look at the machine.');
    else if (reason === 'rest') toast('The ball stopped. Change the setup and try again.');
    refreshSide();
  }

  function succeed() {
    const sim = S.sim, L = S.level;
    const used = S.parts.length, presses = sim.presses, t = sim.goalStep * DT;
    const prog = S.progress[L.id] || (S.progress[L.id] = { solved: false, badges: {} });
    const first = !prog.solved;
    const res = L.badges.map(b => ({ b, ok: badgeOk(b, used, presses) }));
    const fresh = [];
    for (const r of res) if (r.ok && !prog.badges[r.b.k]) { prog.badges[r.b.k] = true; fresh.push(r.b.k); }
    prog.solved = true;
    persist();
    const got = L.badges.filter(b => prog.badges[b.k]).length;
    lab.note(`${L.book === 'W' ? 'Atölye: ' + cleanName(L.name) : 'Çizim ' + pad2(S.li + 1) + ' ' + L.name}: çalıştı · damga ${got}/${L.badges.length} · elle ${presses}`);
    releaseAll();
    S.trails = sim.trails.map(t => t.slice()); S.trailFail = null; S.sim = null; S.mode = 'build'; S.lastFail = null; S.goalAt = null;
    if (first) S.introNew = null;
    refreshSide();
    showResult(res, fresh, used, presses, t, first);
  }

  // Topların hızındaki ani değişim çarpmadır: temas noktasına kısa çizgiler.
  // Çarpma sesi topun yüksekliğinden nota seçer: merdivenden inen top inen bir ezgi çalar.
  function watchBalls(sim) {
    sim.balls.forEach((b, i) => {
      const st = sim.bstate[i];
      if (st === 'goal' && S.prevState[i] !== 'goal') {
        const bp = b.getPosition();
        const cup = KM.cupsOf(S.level).find(cp => bp.x > cp.x && bp.x < cp.x + cp.w) || KM.cupsOf(S.level)[0];
        const fx = { k: 'goal', x: cup.x + cup.w / 2, y: cup.y + KM.CUP.wall + 0.29, t: S.time };
        if (!reduceMotion) S.fx.push(fx);
        if (sim.status === 'goal') S.winAt = fx;      // son top: kutlama frame()'de
        else sfx('goal', { n: S.goalN });
        S.goalN++;
      }
      S.prevState[i] = st;
      if (st === 'out') return;
      const v = b.getLinearVelocity(), pv = S.prevV[i];
      S.prevV[i] = [v.x, v.y];
      if (!pv) return;
      const dx = v.x - pv[0], dy = v.y - pv[1], dv = Math.hypot(dx, dy);
      if (dv > 4 && S.time - (S.lastHit[i] || -1) > 0.12) {
        S.lastHit[i] = S.time;
        const bp = b.getPosition();
        if (!reduceMotion) S.fx.push({ k: 'hit', i, x: bp.x - T.R * dx / dv, y: bp.y - T.R * dy / dv, a: Math.atan2(-dy, -dx), t: S.time });
        if (st !== 'goal') sfx('hit', { h: bp.y / H, v: (dv - 4) / 10, x: bp.x / W * 2 - 1 });
      }
    });
    if (S.fx.length > 40) S.fx = S.fx.filter(f => S.time - f.t < 1.2);
  }

  function frame(now) {
    const dt = frame.last ? Math.min(0.05, (now - frame.last) / 1000) : 0;
    frame.last = now; S.time += dt;
    if (S.mode === 'run' && S.sim) {
      const sim = S.sim;
      // Son top kovaya girince an donar, sonra ağır çekim (yalnızca görüntü; fizik adımı aynı).
      const g = S.goalAt == null ? -1 : S.time - S.goalAt;
      S.acc += dt * (g < 0 || reduceMotion ? 1 : g < 0.09 ? 0 : 0.4);
      let n = 0;
      while (S.acc >= DT && n < 12) { sim.step(); S.acc -= DT; n++; }
      if (n >= 12) S.acc = 0;
      watchBalls(sim);
      sim.rts.forEach((rt, i) => {
        const s = S.seen[i];
        if (rt.fires > s.fires) sfx({ sensor: 'sensor', gate: 'gate', flipper: 'flipper', bumper: 'bumper', cutter: 'cutter', crank: 'tick' }[rt.type] || 'piston');
        if (rt.compress > s.comp + 0.01) sfx('spring');
        if (rt.type === 'magnet' && rt.on && !s.on) sfx('magnet');
        if (rt.type === 'crank' && rt.on && !s.on) sfx('crank');
        s.fires = rt.fires; s.comp = rt.compress; s.on = rt.on;
      });
      if (sim.pops > S.popsSeen) {
        S.popsSeen = sim.pops;
        for (const bl of sim.balloons) if (!bl.alive && !bl.fxDone) {
          bl.fxDone = true;
          if (bl.y > H + 0.3) continue;   // tavanın üstüne kaçıp patlayan balon görünmez
          sfx('pop', { x: bl.x / W * 2 - 1 });
          if (!reduceMotion) S.fx.push({ k: 'pop', x: bl.x, y: bl.y, t: S.time });
        }
      }
      if (sim.status === 'goal') {
        if (!S.goalPlayed) {
          S.goalPlayed = true; S.goalAt = S.time; S.flashT = S.time;
          const w = S.winAt || { x: KM.cupsOf(S.level)[0].x + 1, y: KM.cupsOf(S.level)[0].y + 0.4 };
          if (!reduceMotion) S.fx.push({ k: 'win', x: w.x, y: w.y, t: S.time });
          sfx('win');
        }
        S.endT += dt; if (S.endT > 1.05) succeed();
      } else if (sim.status === 'out') {
        S.endT += dt; if (S.endT > 0.45) stopRun('out');
      } else if (sim.status === 'timeout') stopRun('timeout');
      else if (sim.restT > 2.4 && !S.restNoted) {
        S.restNoted = true;
        if (sim.devices.length) toast('The ball stopped. Maybe something needs a hand.', 3200);
        else stopRun('rest');
      }
      updatePult();
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- katmanlar
  const overlayOpen = () => !$('result').hidden || !$('levels').hidden;
  function openOverlay(id, focusId) { $(id).hidden = false; const f = $(focusId); if (f) f.focus(); musicMode('menu'); }
  function closeOverlay(id) {
    $(id).hidden = true;
    if (id === 'result') { clearLater(); stopConfetti(); }
    if (!overlayOpen()) musicMode(S.mode === 'run' ? 'run' : 'build');
  }

  // Sonuç penceresi sırayla açılır: kart gelir, ONAY damgası basılır, damgalar tek tek düşer,
  // ilk çözümde sonraki çizimin yeniliği ("New part unlocked!") belirir. Kapatınca zamanlayıcılar durur.
  let timers = [];
  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  function clearLater() { timers.forEach(clearTimeout); timers = []; }
  const TITLES = ['Nice machine!', 'Smooth run!', 'Spot on!', 'Clockwork!', 'Engineered!'];

  function showResult(res, fresh, used, presses, t, first) {
    const L = S.level, prog = S.progress[L.id], i = S.li, anim = !reduceMotion;
    const allNow = res.every(r => r.ok), done = L.badges.every(b => prog.badges[b.k]);
    clearLater(); stopConfetti();
    $('result').classList.toggle('anim', anim);
    $('result-cap').textContent = `Drawing ${pad2(i + 1)} · ${L.name}`;
    $('approved-no').textContent = `Dwg ${pad2(i + 1)}`;
    $('result-title').textContent = first ? (allNow && L.badges.length > 1 ? 'Perfect!' : 'It works!')
      : fresh.length ? (done ? 'All stamps!' : 'New stamp!') : TITLES[Math.floor(Math.random() * TITLES.length)];
    const ul = $('result-stamps'); ul.textContent = '';
    for (const r of res) {
      const got = !!prog.badges[r.b.k];
      const li = document.createElement('li');
      li.className = 'goal' + (got ? ' got' : '') + (fresh.includes(r.b.k) ? ' new' : '');
      li.innerHTML = `<span class="stamp">${CHECK}</span><span>${badgeText(r.b)}${got && !r.ok ? ' · from an earlier run' : ''}</span>`;
      ul.appendChild(li);
    }
    $('st-parts').textContent = String(used);
    $('st-press').textContent = String(presses);
    const missing = L.badges.find(b => !prog.badges[b.k]);
    $('result-tip').textContent = missing ? badgeTip(missing) : (i + 1 < LEVELS.length ? 'Every stamp on this drawing is yours.' : 'Every drawing in the notebook is done. New ones are on the way.');
    const last = i + 1 >= LEVELS.length;
    $('btn-next').textContent = last ? 'Drawings' : 'Next drawing';
    // Yenilik: yalnızca ilk çözümde, sonraki çizim yeni bir şey getiriyorsa.
    const news = first && !last ? INTRO[i + 1] : [];
    const book = first && !last && LEVELS[i + 1].book !== L.book ? LEVELS[i + 1].book : null;
    const box = $('result-unlock'), items = $('unlock-items');
    box.hidden = !news.length && !book; box.classList.remove('in');
    $('unlock-book').hidden = !book;
    if (book) $('unlock-book').innerHTML = `<span class="cap">Up next: Notebook ${book}</span><span class="bk">${BOOKS[book] || ''}</span>`;
    items.textContent = '';
    for (const k of news) {
      const [kind, name, desc] = NEWS[k], el = document.createElement('div');
      el.className = 'unlock-item';
      el.innerHTML = `<div class="unlock-art"><canvas aria-hidden="true"></canvas></div><div class="unlock-txt"><span class="cap">${kind} unlocked!</span><span class="stencil unlock-name">${name}</span><p>${desc}</p></div>`;
      items.appendChild(el);
    }
    openOverlay('result', 'btn-next');
    items.querySelectorAll('canvas').forEach((cnv, j) => drawNewsIcon(cnv, news[j]));
    countUp($('st-time'), t, anim ? 550 : 0);

    const card = $('result').querySelector('.sheet-card'), stamp = $('approved');
    card.classList.remove('enter', 'shake'); stamp.classList.remove('on');
    ul.querySelectorAll('.goal').forEach(li => li.classList.toggle('in', !anim));
    if (!anim) { stamp.classList.add('on'); sfx('approved'); if (!box.hidden) { box.classList.add('in'); later(250, () => sfx('unlock')); } return; }
    void card.offsetWidth;
    card.classList.add('enter');
    later(230, () => stamp.classList.add('on'));
    later(420, () => {
      sfx('approved'); card.classList.remove('enter'); card.classList.add('shake');
      if (first || (fresh.length && done)) confetti(first ? 80 : 120);
    });
    const lis = [...ul.children];
    lis.forEach((li, k) => later(640 + k * 300, () => {
      li.classList.add('in');
      if (li.classList.contains('got')) sfx('stamp', { n: k, old: !li.classList.contains('new') });
    }));
    if (!box.hidden) later(760 + lis.length * 300, () => { box.classList.add('in'); sfx('unlock'); });
  }

  function countUp(el, v, ms) {
    if (!ms) { el.textContent = v.toFixed(1) + ' s'; return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (v * e).toFixed(1) + ' s';
      if (k < 1 && !$('result').hidden) requestAnimationFrame(step);
    };
    el.textContent = '0.0 s'; requestAnimationFrame(step);
  }

  // Yeniliğin resmi: parçaysa parça listesindeki çizim, değilse iki top ya da iki bayraklı kova.
  function drawNewsIcon(cnv, k) {
    const w = cnv.clientWidth || 132, h = cnv.clientHeight || 88, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cnv.width = Math.round(w * dpr); cnv.height = Math.round(h * dpr);
    const c = cnv.getContext('2d');
    if (PARTS[k]) {
      const o = DEFAULT_O[k], d = KM.sizeOf({ type: k, o });
      const Vi = makeView(w, h, dpr, -0.35, -0.3, d.w + 0.7, d.h + 0.6); Vi.tf(c);
      drawPart(c, Vi, { type: k, o, x: 0, y: 0 }, null, 0, false);
    } else if (k === 'steel') {
      const Vi = makeView(w, h, dpr, -0.75, -0.5, 1.5, 1); Vi.tf(c);
      drawBall(c, Vi, -0.3, 0, 0.5, 1, 0); drawBall(c, Vi, 0.3, 0, -0.4, 1, 1);
    } else if (k === 'flags') {
      const Vi = makeView(w, h, dpr, -0.15, -0.1, 4.6, 2.05); Vi.tf(c);
      drawCup(c, Vi, { x: 0, y: 0, w: 2, kind: 'yellow' }, 0); drawCup(c, Vi, { x: 2.3, y: 0, w: 2, kind: 'steel' }, 0);
    } else if (k === 'balloon') {
      const Vi = makeView(w, h, dpr, -0.9, -0.35, 1.8, 2.6); Vi.tf(c);
      rope(c, Vi, [0, 1.3], [0, 0.28], 1); drawBalloon(c, Vi, 0, 1.3 + T.balR, 1); drawBall(c, Vi, 0, 0, 0.3, 1, 0);
    }
  }

  // Konfeti: sonuç kartının arkasında dökülen kâğıt parçaları.
  const CONF = { parts: [], raf: 0, last: 0 };
  function confetti(n) {
    if (reduceMotion) return;
    const cnv = $('confetti'), r = cnv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width) return;
    cnv.width = Math.round(r.width * dpr); cnv.height = Math.round(r.height * dpr);
    const cols = [C.ink, C.ball, C.eye, C.hand, C.ball, C.ink];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      CONF.parts.push({
        x: r.width / 2 + side * r.width * (0.05 + Math.random() * 0.32), y: r.height * (0.18 + Math.random() * 0.22),
        vx: side * (0.6 + Math.random() * 4.5), vy: -(4 + Math.random() * 7), a: Math.random() * TAU, va: (Math.random() - 0.5) * 0.35,
        w: 5 + Math.random() * 5, h: 8 + Math.random() * 7, col: cols[i % cols.length], f: Math.random() * TAU,
      });
    }
    if (!CONF.raf) { CONF.last = 0; CONF.raf = requestAnimationFrame(confettiFrame); }
  }
  function confettiFrame(now) {
    const cnv = $('confetti'), c = cnv.getContext('2d'), cw = cnv.clientWidth || 1, ch = cnv.clientHeight || 1;
    const dt = CONF.last ? Math.min(2.5, (now - CONF.last) / 16.7) : 1; CONF.last = now;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cnv.width, cnv.height);
    c.setTransform(cnv.width / cw, 0, 0, cnv.height / ch, 0, 0);
    CONF.parts = CONF.parts.filter(p => p.y < ch + 30);
    for (const p of CONF.parts) {
      p.vy = Math.min(p.vy + 0.2 * dt, 3.4 + Math.sin(p.f));
      p.vx *= Math.pow(0.985, dt); p.f += 0.11 * dt;
      p.x += (p.vx + Math.sin(p.f) * 0.9) * dt; p.y += p.vy * dt; p.a += p.va * dt;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(Math.cos(p.f * 1.6), 1);
      c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
    }
    if (CONF.parts.length) CONF.raf = requestAnimationFrame(confettiFrame);
    else { CONF.raf = 0; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cnv.width, cnv.height); }
  }
  function stopConfetti() {
    CONF.parts = [];
    if (CONF.raf) cancelAnimationFrame(CONF.raf);
    CONF.raf = 0;
    const cnv = $('confetti'); if (cnv) cnv.getContext('2d').clearRect(0, 0, cnv.width, cnv.height);
  }

  const BOOKS = { 1: 'Basics', 2: 'Gates and Magnets', 3: 'Flippers and Bumpers', 4: 'Balloons and Scissors', 5: 'Gears and Wind' };

  // ---------------------------------------------------------------- Atölye: kendi çizimin
  // Çizim (doc) sıkışık tutulur: boru, kova, duvar hücreleri, sabit parçalar, oyuncunun parça listesi.
  // wsLevel() onu oynanır bölüme çevirir; Atölye çizimleri LEVELS'in sonuna 'W' defteri olarak eklenir,
  // hep açıktır. Kayıt drawing-board.workshop (hesaba eşitlenir). Paylaşım: adres sonunda #cizim=<base64>.
  const WS_KEY = 'drawing-board.workshop';
  const ED_TYPES = ['ramp', 'spring', 'belt', 'bumper', 'gate', 'piston', 'fan', 'flipper', 'magnet'];
  const TRAY_TYPES = ['ramp', 'spring', 'belt', 'bumper', 'gate', 'piston', 'fan', 'flipper', 'magnet', 'sensor'];
  const TOOLS = [['wall', 'Wall'], ['ball', 'Ball'], ['cup', 'Cup'], ['part', 'Part'], ['erase', 'Erase']];
  const TOOL_HINT = {
    wall: 'Tap or drag on the board to draw walls. Start on a wall to erase.',
    ball: 'Tap where the ball comes in. Tap the pipe again to change its direction.',
    cup: 'Tap where the cup goes. It is two squares wide.',
    part: 'Pick a part, then tap the board. Tap a fixed part to turn it.',
    erase: 'Tap or drag to erase walls and parts.',
  };
  const WS_HINTS = {
    place: 'A drawing from the workshop. Drag parts from the list onto the board.',
    ready: 'Ready? Press Run.', run: 'Will it work?',
    fail: 'Look at the dotted line and change the setup.', after: 'Go for the missing stamps.',
  };
  const isNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
  const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} .,!?'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'My drawing';
  const newId = () => 'ws-' + Math.random().toString(36).slice(2, 10);
  // Dışarıdan (kayıt, paylaşılan link) gelen çizimi süz: yalnız bilinen alanlar, tahtanın içi.
  function cleanDoc(q) {
    if (!q || typeof q !== 'object' || !q.pipe || !q.cup) return null;
    const p = q.pipe, c = q.cup;
    if (!isNum(p.x, 0, 15) || !isNum(p.y, 0, 9) || !['r', 'l', 'd'].includes(p.dir) || !isNum(c.x, 0, 14) || !isNum(c.y, 0, 9)) return null;
    const d = { id: /^ws-[a-z0-9]{4,12}$/.test(q.id) ? q.id : newId(), name: cleanName(q.name),
      pipe: { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir }, cup: { x: Math.round(c.x), y: Math.round(c.y) } };
    d.walls = (Array.isArray(q.walls) ? q.walls : []).slice(0, 160)
      .filter(w => Array.isArray(w) && isNum(w[0], 0, 15) && isNum(w[1], 0, 9)).map(w => [Math.round(w[0]), Math.round(w[1])]);
    d.fixed = (Array.isArray(q.fixed) ? q.fixed : []).slice(0, 30)
      .filter(f => f && ED_TYPES.includes(f.type) && PARTS[f.type].orients.includes(f.o) && isNum(f.x, 0, 15) && isNum(f.y, 0, 9))
      .map(f => ({ type: f.type, o: f.o, x: Math.round(f.x), y: Math.round(f.y) }));
    d.tray = {};
    for (const k of TRAY_TYPES) { const n = q.tray && q.tray[k]; if (isNum(n, 1, 9)) d.tray[k] = Math.round(n); }
    return d;
  }
  // Yan yana duvar hücreleri tek blok olur (çizimde ve fizikte).
  function mergeWalls(cells) {
    const set = new Set(cells.map(w => w[0] + ',' + w[1])), out = [];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      if (!set.has(x + ',' + y) || set.has((x - 1) + ',' + y)) continue;
      let e = x; while (set.has((e + 1) + ',' + y)) e++;
      out.push([x, y, e + 1, y + 1]);
    }
    return out;
  }
  function wsLevel(d) {
    const { x, y, dir } = d.pipe;
    const start = dir === 'r' ? { x: x + 0.6, y: y + 0.28, vx: 2.5 } : dir === 'l' ? { x: x + 0.4, y: y + 0.28, vx: -2.5 } : { x: x + 0.5, y: y + 0.3 };
    const auto = d.tray.sensor && d.fixed.some(f => PARTS[f.type].manual);
    return {
      id: d.id, name: d.name, book: 'W', ws: d, task: 'Get the ball into the cup.', start, pipe: { x, y, dir },
      walls: mergeWalls(d.walls), cup: { x: d.cup.x, y: d.cup.y, w: 2 },
      fixed: d.fixed.map(f => Object.assign({}, f)), tray: Object.assign({}, d.tray),
      badges: auto ? [{ k: 'solve' }, { k: 'auto' }] : [{ k: 'solve' }], hints: WS_HINTS,
    };
  }
  function starterDoc() {
    const walls = [];
    for (let x = 0; x < 16; x++) walls.push([x, 0]);
    walls.push([0, 6], [1, 6], [2, 6]);
    return { id: newId(), name: 'My drawing', pipe: { x: 0, y: 7, dir: 'r' }, cup: { x: 12, y: 1 }, walls, fixed: [], tray: { ramp: 2 } };
  }
  const OFFICIAL = LEVELS.filter(L => L.book !== 'W').length;
  S.ws = (() => { try { const a = JSON.parse(localStorage.getItem(WS_KEY) || '[]'); return Array.isArray(a) ? a.map(cleanDoc).filter(Boolean).slice(0, 40) : []; } catch (e) { return []; } })();
  function persistWS() { try { localStorage.setItem(WS_KEY, JSON.stringify(S.ws)); } catch (e) { /* yok say */ } }
  function syncWS() {
    LEVELS.length = OFFICIAL; INTRO.length = OFFICIAL;
    for (const d of S.ws) { LEVELS.push(wsLevel(d)); INTRO.push([]); }
  }
  syncWS();
  const wsIndex = id => LEVELS.findIndex(L => L.id === id);

  function openEditor(doc) {
    if (S.mode === 'run') stopRun('user');
    hideToast(); exitLink();
    S.edit = { doc: JSON.parse(JSON.stringify(doc)), tool: 'wall', part: 'ramp', down: null, last: null, paint: true };
    S.mode = 'edit'; S.sim = null; S.parts = []; S.trails = null; S.introNew = null;
    edChanged(true);
    $('ed-name').value = S.edit.doc.name;
    buildEditor();
    musicMode('build');
  }
  function edChanged(quiet) {
    const L = wsLevel(S.edit.doc);
    S.level = L; S.occ = KM.occupancy(L);
    if (!quiet) S.edit.dirty = true;
    refreshHeader(); refreshSide();
  }
  function buildEditor() {
    const tools = $('ed-tools'); tools.textContent = '';
    for (const [k, label] of TOOLS) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(S.edit.tool === k));
      b.addEventListener('click', () => { S.edit.tool = k; buildEditor(); setHint(); });
      tools.appendChild(b);
    }
    const parts = $('ed-parts'); parts.textContent = ''; parts.hidden = S.edit.tool !== 'part';
    if (!parts.hidden) {
      for (const k of ED_TYPES) {
        const b = document.createElement('button'); b.type = 'button';
        b.setAttribute('aria-pressed', String(S.edit.part === k)); b.setAttribute('aria-label', NAMES[k]);
        b.innerHTML = `<canvas aria-hidden="true"></canvas><span>${NAMES[k]}</span>`;
        b.addEventListener('click', () => { S.edit.part = k; buildEditor(); });
        parts.appendChild(b);
      }
      requestAnimationFrame(() => parts.querySelectorAll('canvas').forEach((c, i) => drawIcon(c, ED_TYPES[i])));
    }
    const tray = $('ed-tray'); tray.textContent = '';
    for (const k of TRAY_TYPES) {
      const n = S.edit.doc.tray[k] || 0, li = document.createElement('li');
      li.className = n ? 'on' : '';
      li.innerHTML = `<span>${NAMES[k]}</span><span><button type="button" aria-label="Fewer ${NAMES[k]}">−</button> <span class="n">${n}</span> <button type="button" aria-label="More ${NAMES[k]}">+</button></span>`;
      const [minus, plus] = li.querySelectorAll('button');
      const set = v => { if (v > 0) S.edit.doc.tray[k] = v; else delete S.edit.doc.tray[k]; sfx('tick'); edChanged(); buildEditor(); };
      minus.addEventListener('click', () => set(Math.max(0, n - 1)));
      plus.addEventListener('click', () => set(Math.min(9, n + 1)));
      tray.appendChild(li);
    }
    $('ed-delete').hidden = wsIndex(S.edit.doc.id) < 0;
    setHint();
  }

  // Tahtaya dokununca seçili araç. first: dokunuşun ilk hücresi (sürüklerken false).
  function editAt(x, y, first) {
    const d = S.edit.doc, t = S.edit.tool;
    if (x < 0 || y < 0 || x > 15 || y > 9) return;
    const inCup = (cx, cy) => cy === d.cup.y && (cx === d.cup.x || cx === d.cup.x + 1);
    const atPipe = (cx, cy) => cx === d.pipe.x && cy === d.pipe.y;
    const fixedAt = (cx, cy) => d.fixed.find(f => KM.cellsOf(f).some(q => q[0] === cx && q[1] === cy));
    const clearCell = (cx, cy) => {
      d.walls = d.walls.filter(w => !(w[0] === cx && w[1] === cy));
      d.fixed = d.fixed.filter(f => !KM.cellsOf(f).some(q => q[0] === cx && q[1] === cy));
    };
    const fits = (f, self) => KM.cellsOf(f).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < 16 && cy < 10 && !inCup(cx, cy) && !atPipe(cx, cy)
      && !d.walls.some(w => w[0] === cx && w[1] === cy) && !d.fixed.some(o => o !== self && KM.cellsOf(o).some(q => q[0] === cx && q[1] === cy)));
    const wi = d.walls.findIndex(w => w[0] === x && w[1] === y);
    if (t === 'wall') {
      if (first) S.edit.paint = wi < 0;
      if (S.edit.paint) { if (wi >= 0 || inCup(x, y) || atPipe(x, y) || fixedAt(x, y)) return; d.walls.push([x, y]); sfx('place'); }
      else { if (wi < 0) return; d.walls.splice(wi, 1); sfx('remove'); }
    } else if (t === 'erase') {
      if (wi < 0 && !fixedAt(x, y)) return;
      clearCell(x, y); sfx('remove');
    } else if (!first) return;
    else if (t === 'ball') {
      if (atPipe(x, y)) d.pipe.dir = { r: 'l', l: 'd', d: 'r' }[d.pipe.dir];
      else { if (inCup(x, y)) return; clearCell(x, y); d.pipe = { x, y, dir: d.pipe.dir }; }
      sfx('tick');
    } else if (t === 'cup') {
      const cx = Math.min(x, 14);
      if (atPipe(cx, y) || atPipe(cx + 1, y)) return;
      clearCell(cx, y); clearCell(cx + 1, y); d.cup = { x: cx, y }; sfx('place');
    } else if (t === 'part') {
      const f = fixedAt(x, y);
      if (f) {
        const os = PARTS[f.type].orients, o0 = f.o;
        for (let k = 1; k <= os.length; k++) { f.o = os[(os.indexOf(o0) + k) % os.length]; if (fits(f, f)) break; }
        sfx('tick');
      } else {
        const nf = { type: S.edit.part, o: DEFAULT_O[S.edit.part], x, y };
        if (!fits(nf, null)) { toast("It doesn't fit there."); return; }
        d.fixed.push(nf); sfx('place');
      }
    }
    edChanged();
  }
  function edDown(e) {
    const w = evWorld(e), x = Math.floor(w.x), y = Math.floor(w.y);
    e.preventDefault();
    S.edit.down = e.pointerId; S.edit.last = x + ',' + y;
    editAt(x, y, true);
  }
  function edMove(e) {
    if (!S.edit || S.edit.down !== e.pointerId) return false;
    const w = evWorld(e), x = Math.floor(w.x), y = Math.floor(w.y), k = x + ',' + y;
    if (k !== S.edit.last) { S.edit.last = k; editAt(x, y, false); }
    return true;
  }
  // Kaydet: çizim Atölye defterine girer (değiştiyse eski damgaları silinir).
  function saveDoc() {
    const d = S.edit.doc;
    d.name = cleanName($('ed-name').value);
    const i = S.ws.findIndex(q => q.id === d.id);
    if (i >= 0) S.ws[i] = JSON.parse(JSON.stringify(d)); else S.ws.push(JSON.parse(JSON.stringify(d)));
    if (S.edit.dirty) { delete S.progress[d.id]; delete S.setups[d.id]; }
    persistWS(); syncWS(); persist();
    return wsIndex(d.id);
  }
  function closeEditor(play) {
    if (!S.edit) return;
    const i = saveDoc();
    S.edit = null; S.mode = 'build';
    if (play) { loadLevel(i); toast('Now solve your own drawing!'); }
  }
  function shareDoc(d) {
    const json = JSON.stringify({ id: d.id, name: d.name, pipe: d.pipe, cup: d.cup, walls: d.walls, fixed: d.fixed, tray: d.tray });
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.origin + location.pathname + '#cizim=' + b64;
    const done = () => toast('Link copied. Send it to a friend in the Lab.');
    if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ title: `Drawing Board · ${d.name}`, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
  }
  // Paylaşılan link: çizimi Atölye defterine ekle ve aç.
  function importFromHash() {
    const m = /^#cizim=([A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!m) return -1;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* yok say */ }
    try {
      const b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const d = cleanDoc(JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))));
      if (!d) return -1;
      if (!S.ws.some(q => q.id === d.id)) { S.ws.push(d); persistWS(); syncWS(); }
      return wsIndex(d.id);
    } catch (e) { return -1; }
  }

  function openLevels() {
    if (S.mode === 'edit') closeEditor(false);
    const grid = $('level-grid'); grid.textContent = '';
    const thumbs = [];
    let book = null;
    LEVELS.forEach((L, i) => {
      if (L.book !== book) {
        book = L.book;
        const h = document.createElement('div'); h.className = 'book-head';
        h.innerHTML = book === 'W' ? '<span class="cap">Workshop</span><span class="bk">Your drawings</span>'
          : `<span class="cap">Notebook ${book}</span><span class="bk">${BOOKS[book] || ''}</span>`;
        grid.appendChild(h);
      }
      const prog = S.progress[L.id], open = unlocked(i);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lvl' + (i === S.li ? ' cur' : ''); b.disabled = !open;
      const dots = L.badges.map(bd => `<span class="dot${prog && prog.badges[bd.k] ? ' got' : ''}" title="${badgeText(bd)}"></span>`).join('');
      const nw = INTRO[i].length ? `<span class="new-chip">New: ${INTRO[i].map(k => NEWS[k][1]).join(', ')}</span>` : '';
      b.innerHTML = `<canvas aria-hidden="true"></canvas><div class="meta"><div><span class="cap">${L.book === 'W' ? 'Workshop' : 'Drawing ' + pad2(i + 1)}</span><div class="nm">${cleanName(L.name)}</div></div><div class="dots">${dots}</div></div>${nw}${open ? '' : '<span class="lock">Locked</span>'}`;
      b.setAttribute('aria-label', `Drawing ${i + 1}: ${L.name}${open ? '' : ', locked'}`);
      b.addEventListener('click', () => { closeOverlay('levels'); loadLevel(i); });
      grid.appendChild(b);
      thumbs.push([b.querySelector('canvas'), L]);
    });
    openOverlay('levels', 'levels-close');
    requestAnimationFrame(() => thumbs.forEach(([c, L]) => drawThumb(c, L)));
  }

  function setMusic(on, quiet) {
    S.music = on; persistDevice();
    const b = $('btn-music'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
    $('ico-music').innerHTML = '<path d="M7.5 15.5V5l9-2.2v10.4"/><circle cx="5.3" cy="15.5" r="2.2"/><circle cx="14.3" cy="13.2" r="2.2"/>'
      + (on ? '' : '<path d="M2.5 2.5l15 15"/>');
    if (!quiet) try { if (AU) AU.setMusic(on); } catch (e) { /* yok say */ }
  }
  function setMuted(m) {
    S.muted = m; persistDevice();
    try { if (AU) AU.setSfx(!m); } catch (e) { /* yok say */ }
    const b = $('btn-sound'); b.setAttribute('aria-pressed', String(!m)); b.setAttribute('aria-label', m ? 'Turn sound on' : 'Turn sound off');
    $('ico-sound').innerHTML = m
      ? '<path d="M3 8v4h3l4 3.5v-11L6 8H3z"/><path d="M13.5 7.5l5 5M18.5 7.5l-5 5"/>'
      : '<path d="M3 8v4h3l4 3.5v-11L6 8H3z"/><path d="M13 7c1.2 1.6 1.2 4.4 0 6M15.5 5c2.4 2.8 2.4 7.2 0 10"/>';
  }

  function makeNoise() {
    try {
      const n = document.createElement('canvas'); n.width = n.height = 160;
      const g = n.getContext('2d'), img = g.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 200 + Math.random() * 55;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.random() * 12;
      }
      g.putImageData(img, 0, 0);
      document.body.style.setProperty('--noise', `url(${n.toDataURL()})`);
    } catch (e) { /* doku opsiyonel */ }
  }

  // ---------------------------------------------------------------- olaylar
  cv.addEventListener('pointerdown', onBoardDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
    try { if (AU) { if (document.hidden) AU.pause(); else AU.resume(); } } catch (e) { /* yok say */ }
  });
  document.addEventListener('gesturestart', e => e.preventDefault());
  $('run').addEventListener('click', toggleRun);
  $('btn-levels').addEventListener('click', () => { if (S.mode === 'run') stopRun('user'); openLevels(); });
  $('btn-new-drawing').addEventListener('click', () => { closeOverlay('levels'); openEditor(starterDoc()); });
  $('btn-edit').addEventListener('click', () => { if (S.level.ws) openEditor(S.level.ws); });
  $('ed-test').addEventListener('click', () => closeEditor(true));
  $('ed-share').addEventListener('click', () => { S.edit.doc.name = cleanName($('ed-name').value); saveDoc(); shareDoc(S.edit.doc); });
  $('ed-name').addEventListener('change', () => { S.edit.doc.name = cleanName($('ed-name').value); edChanged(); });
  $('ed-delete').addEventListener('click', () => {
    if (!window.confirm(`Delete "${S.edit.doc.name}"?`)) return;
    S.ws = S.ws.filter(q => q.id !== S.edit.doc.id); persistWS(); syncWS();
    S.edit = null; S.mode = 'build'; loadLevel(Math.min(S.li, OFFICIAL - 1) >= 0 ? Math.min(S.li, OFFICIAL - 1) : 0);
  });
  $('levels-close').addEventListener('click', () => closeOverlay('levels'));
  $('btn-sound').addEventListener('click', () => setMuted(!S.muted));
  $('btn-music').addEventListener('click', () => setMusic(!S.music));
  // Tarayıcı sesi ancak dokununca açar: her dokunuşta bağlamı uyandır (müzik açıksa başlar).
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend']) window.addEventListener(ev, audio, { capture: true, passive: true });
  $('btn-retry').addEventListener('click', () => { closeOverlay('result'); setHint(); });
  $('btn-next').addEventListener('click', () => {
    closeOverlay('result');
    if (S.li + 1 < LEVELS.length) loadLevel(S.li + 1); else openLevels();
  });
  for (const id of ['result', 'levels']) $(id).addEventListener('pointerdown', e => { if (e.target === $(id)) closeOverlay(id); });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('result').hidden) closeOverlay('result');
      else if (!$('levels').hidden) closeOverlay('levels');
      else if (S.linkFrom) exitLink();
      else if (S.mode === 'run') stopRun('user');
      return;
    }
    if (overlayOpen()) return;
    if (/^[1-9]$/.test(e.key) && S.mode === 'run' && S.sim) {
      e.preventDefault();
      if (e.repeat) return;
      const rt = S.sim.devices.find(d => d.num === Number(e.key));
      if (rt) devDown(rt, 'key' + e.key);
      return;
    }
    const a = document.activeElement;
    if ((e.key === ' ' || e.key === 'Enter') && (!a || a === document.body)) { e.preventDefault(); toggleRun(); }
  });
  window.addEventListener('keyup', e => {
    if (/^[1-9]$/.test(e.key) && S.sim) {
      const rt = S.sim.devices.find(d => d.num === Number(e.key));
      if (rt) devUp(rt, 'key' + e.key);
    }
  });

  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe($('sheet'));
  else window.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.level && S.mode === 'build') refreshBom(); });

  // Test ve geliştirme için küçük bir kapı.
  window.KM_GAME = { S, openEditor, closeEditor, editAt, starterDoc, shareDoc, wsLevel, loadLevel, startRun, stopRun, toggleRun, addPlaced, rotatePart, saveSetup, refreshSide, openLevels, INTRO, view: () => V };

  function boot(data) {
    if (lab.on) document.documentElement.classList.add('lab');
    makeNoise();
    try { if (AU) AU.prefs(S.music, !S.muted); } catch (e) { /* yok say */ }
    setMuted(S.muted); setMusic(S.music, true);
    layout();
    let li = typeof data.li === 'number' ? data.li : typeof saved.li === 'number' ? saved.li : 0;
    if (!(li >= 0 && li < LEVELS.length) || !unlocked(li)) li = 0;
    const shared = importFromHash();
    if (shared >= 0) li = shared;
    if (Array.isArray(data.parts)) S.setups[LEVELS[li].id] = data.parts;
    loadLevel(li);
    requestAnimationFrame(frame);
  }
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ li: S.li, parts: S.parts.map(p => ({ id: p.id, type: p.type, o: p.o, x: p.x, y: p.y, link: p.link })) })); } catch (e) { /* yok say */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
}());
