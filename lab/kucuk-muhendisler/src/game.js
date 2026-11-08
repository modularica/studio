// Küçük Mühendisler — oyun arayüzü ve çizim.
(function () {
  'use strict';
  const KM = window.KM, LEVELS = window.KM_LEVELS;
  const { W, H, DT, T, PARTS, DIRS } = KM;
  const TAU = Math.PI * 2;
  const NAMES = { ramp: 'Rampa', spring: 'Yay', belt: 'Konveyör', piston: 'Piston', fan: 'Pervane', sensor: 'Sensör' };
  const ORDER = ['ramp', 'spring', 'belt', 'piston', 'fan', 'sensor'];
  const DEFAULT_O = { ramp: 'dr', spring: 'u', belt: 'r', piston: 'u', fan: 'r', sensor: '-' };
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const C = {};
  for (const k of ['paper', 'paper-hi', 'paper-deep', 'ink', 'ink-dim', 'hand', 'ball', 'eye', 'bad']) C[k] = css.getPropertyValue('--' + k).trim();
  const FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';
  const ALL_OPEN = location.hash === '#hepsi';
  const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
  const pad2 = n => String(n).padStart(2, '0');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------------------------------------------------------------- kayıt
  // İlerleme (damgalar, kurulumlar, son çizim) Lab'da hesaba eşitlenir; ses ve görünüm cihazda kalır.
  const KEY = 'kucuk-muhendisler.v1';
  const DEVICE_KEY = 'kucuk-muhendisler.cihaz';
  let saved = {}, device = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  try { device = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') || {}; } catch (e) { device = {}; }
  for (const k of ['muted', 'look', 'lookTip']) if (device[k] === undefined && saved[k] !== undefined) device[k] = saved[k];

  // Lab (uzigames.com/lab) bağlantıları: hesap.js varsa ilerleme notu ve "Nasıldı?" düğmeleri.
  const lab = {
    on: !!window.Hesap,
    note(t) { try { if (window.Hesap) window.Hesap.not(t); } catch (e) { /* yok say */ } },
  };

  const LOOKS_OK = v => v === 'cizim' || v === 'gecis' || v === 'canli';
  const S = {
    li: 0, level: null, occ: null, parts: [], nextId: 1,
    mode: 'build', sim: null, acc: 0, endT: 0, restNoted: false, goalPlayed: false,
    trails: null, lastFail: null, drag: null, press: null, linkFrom: null,
    held: new Map(), seen: null, time: 0,
    progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {},
    setups: saved.setups && typeof saved.setups === 'object' ? saved.setups : {},
    muted: !!device.muted,
    look: LOOKS_OK(device.look) ? device.look : 'gecis', morph: 0, lookTip: !!device.lookTip,
  };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ progress: S.progress, setups: S.setups, li: S.li })); } catch (e) { /* kayıt yoksa da oynanır */ }
  }
  function persistDevice() {
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify({ muted: S.muted, look: S.look, lookTip: S.lookTip })); } catch (e) { /* yok say */ }
  }
  function saveSetup() {
    S.setups[S.level.id] = S.parts.map(p => ({ id: p.id, type: p.type, o: p.o, x: p.x, y: p.y, link: p.link == null ? null : p.link }));
    persist();
  }

  // ---------------------------------------------------------------- ses
  let AC = null;
  function audio() {
    if (S.muted) return null;
    if (AC === null) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = false; } }
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    return AC || null;
  }
  function tone(f0, dur, type, vol, f1, delay) {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    const a = audio(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const SFX = {
    place: () => { tone(420, 0.05, 'square', 0.035); tone(210, 0.09, 'triangle', 0.06); },
    tick: () => tone(950, 0.03, 'square', 0.025),
    remove: () => tone(320, 0.12, 'triangle', 0.05, 150),
    link: () => { tone(880, 0.05, 'sine', 0.05); tone(1320, 0.07, 'sine', 0.05, null, 0.05); },
    run: () => tone(300, 0.14, 'triangle', 0.05, 620),
    piston: () => { noise(0.07, 0.18, 1100); tone(120, 0.12, 'sine', 0.18, 55); },
    spring: () => tone(190, 0.28, 'triangle', 0.09, 760),
    sensor: () => tone(1500, 0.05, 'sine', 0.045),
    goal: () => { tone(660, 0.14, 'triangle', 0.08); tone(990, 0.3, 'triangle', 0.08, null, 0.12); },
    fail: () => tone(240, 0.32, 'sawtooth', 0.035, 90),
  };
  const sfx = k => { try { SFX[k] && SFX[k](); } catch (e) { /* ses opsiyonel */ } };

  // ---------------------------------------------------------------- görünüm
  function makeView(cssW, cssH, dpr, wx0, wy0, ww, wh) {
    const cs = Math.min(cssW / ww, cssH / wh);
    const ox = (cssW - ww * cs) / 2 - wx0 * cs;
    const top = (cssH - wh * cs) / 2 + (wy0 + wh) * cs;
    return {
      cs, dpr,
      sx: x => ox + x * cs,
      sy: y => top - y * cs,
      wx: sx => (sx - ox) / cs,
      wy: sy => (top - sy) / cs,
      px: n => n / cs,
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

  // ---------------------------------------------------------------- çizim yardımcıları
  function fillStroke(c, Vw, fill, stroke, width) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = Vw.px(width); c.strokeStyle = stroke; c.stroke(); }
  }
  function rrect(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    c.lineTo(x + w, y + h - r); c.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); c.closePath();
  }
  function textAt(c, Vw, str, x, y, size, color, align, weight) {
    c.save(); Vw.screen(c);
    c.font = `${weight || 700} ${size}px ${FONT}`;
    c.fillStyle = color; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.fillText(str, Vw.sx(x), Vw.sy(y));
    c.restore();
  }
  function badge(c, Vw, num, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = C.hand; c.fill();
    if (num) textAt(c, Vw, String(num), x, y - r * 0.05, Math.max(8, r * Vw.cs * 1.3), C['paper-deep'], 'center', 700);
  }

  function drawGrid(c, Vw, labels, live) {
    c.fillStyle = live ? 'rgba(4,16,38,0.22)' : 'rgba(255,255,255,0.025)'; c.fillRect(0, 0, W, H);
    c.beginPath();
    for (let x = 0.5; x < W; x += 1) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 0.5; y < H; y += 1) { c.moveTo(0, y); c.lineTo(W, y); }
    c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, live ? 0.02 : 0.035); c.stroke();
    c.beginPath();
    for (let x = 1; x < W; x++) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 1; y < H; y++) { c.moveTo(0, y); c.lineTo(W, y); }
    c.strokeStyle = rgba(C.ink, live ? 0.055 : 0.1); c.stroke();
    c.lineWidth = Vw.px(1.5); c.strokeStyle = rgba(C.ink, 0.85); c.strokeRect(0, 0, W, H);
    if (!labels) return;
    c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, 0.32);
    c.strokeRect(-M * 0.84, -M * 0.84, W + M * 1.68, H + M * 1.68);
    const fs = Math.max(9, Math.min(13, Vw.cs * 0.3));
    for (let i = 0; i < W; i++) textAt(c, Vw, String.fromCharCode(65 + i), i + 0.5, H + M * 0.42, fs, rgba(C.ink, 0.5), 'center', 600);
    for (let j = 0; j < H; j++) textAt(c, Vw, String(j + 1), -M * 0.42, j + 0.5, fs, rgba(C.ink, 0.5), 'center', 600);
    c.beginPath();
    for (let i = 0; i <= W; i++) { c.moveTo(i, H); c.lineTo(i, H + 0.12); c.moveTo(i, 0); c.lineTo(i, -0.12); }
    for (let j = 0; j <= H; j++) { c.moveTo(0, j); c.lineTo(-0.12, j); c.moveTo(W, j); c.lineTo(W + 0.12, j); }
    c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, 0.5); c.stroke();
  }

  function wallPath(c, w) {
    c.beginPath();
    if (typeof w[0] === 'number') c.rect(w[0], w[1], w[2] - w[0], w[3] - w[1]);
    else { c.moveTo(w[0][0], w[0][1]); for (let i = 1; i < w.length; i++) c.lineTo(w[i][0], w[i][1]); c.closePath(); }
  }
  function wallBounds(w) {
    if (typeof w[0] === 'number') return w;
    const xs = w.map(q => q[0]), ys = w.map(q => q[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function drawWalls(c, Vw, level) {
    for (const w of level.walls || []) {
      c.save();
      wallPath(c, w); c.fillStyle = rgba(C.ink, 0.07); c.fill(); c.clip();
      const b = wallBounds(w), h = b[3] - b[1];
      c.beginPath();
      for (let k = b[0] - h; k < b[2]; k += 0.2) { c.moveTo(k, b[1]); c.lineTo(k + h, b[3]); }
      c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, 0.3); c.stroke();
      c.restore();
      wallPath(c, w); c.lineWidth = Vw.px(1.5); c.strokeStyle = rgba(C.ink, 0.9); c.stroke();
    }
  }

  function drawCup(c, Vw, cup) {
    const rim = KM.CUP.rim, t = KM.CUP.wall;
    c.fillStyle = rgba(C.ball, 0.09); c.fillRect(cup.x + t, cup.y + t, cup.w - 2 * t, rim - t);
    for (const b of KM.cupBoxes(cup)) { c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); fillStroke(c, Vw, rgba(C.ink, 0.16), C.ink, 1.5); }
    const left = !(cup.back && cup.back.side === 'l');
    const px = left ? cup.x + t / 2 : cup.x + cup.w - t / 2, py0 = cup.y + rim, py1 = py0 + 0.9, dir = left ? 1 : -1;
    c.beginPath(); c.moveTo(px, py0); c.lineTo(px, py1); c.lineWidth = Vw.px(1.4); c.strokeStyle = C.ink; c.stroke();
    c.beginPath(); c.moveTo(px, py1); c.lineTo(px + dir * 0.46, py1 - 0.14); c.lineTo(px, py1 - 0.28); c.closePath();
    c.fillStyle = C.ball; c.fill();
  }

  function drawPipe(c, Vw, level) {
    const p = level.pipe; if (!p) return;
    const st = KM.startsOf(level)[0], r = 0.34;
    let b, mouth;
    if (p.dir === 'r') { b = [-0.4, st.y - r, st.x + 0.02, st.y + r]; mouth = [b[2] - 0.09, b[1] - 0.07, b[2], b[3] + 0.07]; }
    else if (p.dir === 'l') { b = [st.x - 0.02, st.y - r, W + 0.4, st.y + r]; mouth = [b[0], b[1] - 0.07, b[0] + 0.09, b[3] + 0.07]; }
    else { b = [st.x - r, st.y - 0.02, st.x + r, Math.min(H + 0.4, p.y + 1.7)]; mouth = [b[0] - 0.07, b[1], b[2] + 0.07, b[1] + 0.09]; }
    c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); fillStroke(c, Vw, C.paper, null, 0);
    c.fillStyle = rgba(C.ink, 0.1); c.fill(); c.lineWidth = Vw.px(1.5); c.strokeStyle = C.ink; c.stroke();
    c.beginPath();
    if (p.dir === 'd') { c.moveTo(b[0] + 0.12, b[1] + 0.3); c.lineTo(b[0] + 0.12, b[3]); } else { c.moveTo(b[0], b[3] - 0.12); c.lineTo(b[2] - 0.3, b[3] - 0.12); }
    c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, 0.45); c.stroke();
    c.beginPath(); c.rect(mouth[0], mouth[1], mouth[2] - mouth[0], mouth[3] - mouth[1]); fillStroke(c, Vw, C.paper, C.ink, 1.5);
  }

  function drawRamp(c, Vw, p) {
    const [a, b] = KM.rampLine(p.o);
    const ax = p.x + a[0], ay = p.y + a[1], bx = p.x + b[0], by = p.y + b[1];
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), t = T.plank;
    c.save(); c.translate(ax, ay); c.rotate(ang);
    c.beginPath(); c.rect(0, -t / 2, len, t);
    c.fillStyle = C.paper; c.fill();
    fillStroke(c, Vw, rgba(C.ink, 0.15), C.ink, 1.6);
    const n = Math.max(4, Math.round(len / 0.17));
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = i * len / n, x1 = (i + 1) * len / n, up = i % 2 === 0;
      c.moveTo(x0, up ? -t / 2 : t / 2); c.lineTo(x1, up ? t / 2 : -t / 2);
    }
    c.lineWidth = Vw.px(0.9); c.strokeStyle = rgba(C.ink, 0.7); c.stroke();
    for (const x of [0.08, len - 0.08]) {
      c.beginPath(); c.arc(x, 0, 0.034, 0, TAU); c.fillStyle = C.paper; c.fill();
      c.lineWidth = Vw.px(1.2); c.strokeStyle = C.ink; c.stroke();
    }
    c.restore();
  }

  function drawSpring(c, Vw, p, rt) {
    const k = rt && rt.compress > 0 ? Math.sin((1 - rt.compress / 0.18) * Math.PI) : 0;
    const top = 0.36 - 0.13 * k, padH = 0.085, x = p.x, y = p.y;
    c.beginPath(); c.rect(x + 0.12, y, 0.76, 0.07); fillStroke(c, Vw, rgba(C.ink, 0.2), C.ink, 1.3);
    const y0 = y + 0.07, y1 = y + top - padH, n = 6;
    c.beginPath(); c.moveTo(x + 0.5, y0);
    for (let i = 1; i < n; i++) c.lineTo(x + (i % 2 ? 0.26 : 0.74), y0 + (y1 - y0) * (i / n));
    c.lineTo(x + 0.5, y1);
    c.lineWidth = Vw.px(1.5); c.strokeStyle = C.ink; c.stroke();
    c.beginPath(); c.rect(x + 0.08, y + top - padH, 0.84, padH); fillStroke(c, Vw, rgba(C.ink, 0.3), C.ink, 1.5);
  }

  function drawBelt(c, Vw, p, time) {
    const x = p.x, y = p.y, t = T.plank, dir = p.o === 'r' ? 1 : -1;
    c.beginPath(); rrect(c, x, y - t / 2, 2, t, t / 2); fillStroke(c, Vw, rgba(C.ink, 0.12), C.ink, 1.5);
    for (const rx of [x + t / 2, x + 2 - t / 2]) { c.beginPath(); c.arc(rx, y, t * 0.3, 0, TAU); c.lineWidth = Vw.px(1.1); c.stroke(); }
    const ph = (time * 0.9) % 0.25;
    c.beginPath();
    for (let k = 0.15; k < 2; k += 0.25) {
      const cx = dir > 0 ? x + k + ph : x + 2 - k - ph;
      if (cx < x + 0.18 || cx > x + 1.82) continue;
      c.moveTo(cx - 0.035 * dir, y + 0.035); c.lineTo(cx + 0.03 * dir, y); c.lineTo(cx - 0.035 * dir, y - 0.035);
    }
    c.lineWidth = Vw.px(1.2); c.stroke();
  }

  function drawPiston(c, Vw, p, rt) {
    const g = KM.pistonGeom(p.o), d = DIRS[p.o], off = rt ? rt.offset : 0;
    const bx0 = p.x + g.base[0], by0 = p.y + g.base[1], bx1 = p.x + g.base[2], by1 = p.y + g.base[3];
    const hx0 = p.x + g.head[0] + d[0] * off, hy0 = p.y + g.head[1] + d[1] * off;
    const hx1 = p.x + g.head[2] + d[0] * off, hy1 = p.y + g.head[3] + d[1] * off;
    c.beginPath();
    if (p.o === 'u') c.rect(p.x + 0.44, by1, 0.12, hy0 - by1);
    else if (p.o === 'r') c.rect(bx1, p.y + 0.44, hx0 - bx1, 0.12);
    else c.rect(hx1, p.y + 0.44, bx0 - hx1, 0.12);
    fillStroke(c, Vw, rgba(C.ink, 0.35), C.ink, 1.1);
    c.beginPath(); c.rect(bx0, by0, bx1 - bx0, by1 - by0);
    c.fillStyle = C.paper; c.fill();
    fillStroke(c, Vw, rgba(C.hand, 0.22), C.hand, 1.8);
    c.beginPath();
    if (p.o === 'u') for (const yy of [by0 + 0.12, by1 - 0.12]) { c.moveTo(bx0, yy); c.lineTo(bx1, yy); }
    else for (const xx of [bx0 + 0.12, bx1 - 0.12]) { c.moveTo(xx, by0); c.lineTo(xx, by1); }
    c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.hand, 0.7); c.stroke();
    c.beginPath(); c.rect(hx0, hy0, hx1 - hx0, hy1 - hy0); fillStroke(c, Vw, rgba(C.ink, 0.4), C.ink, 1.5);
    badge(c, Vw, p.num, (bx0 + bx1) / 2, (by0 + by1) / 2, 0.16);
  }

  function drawFanZone(c, Vw, p, rt, time) {
    const z = KM.fanZone(p), on = !!(rt && rt.on), L = T.fanLen;
    const pt = (along, lat) => p.o === 'r' ? [z[0] + along, z[1] + lat] : p.o === 'l' ? [z[2] - along, z[1] + lat] : [z[0] + lat, z[1] + along];
    const d = DIRS[p.o], width = 0.9;
    c.save();
    c.beginPath(); c.rect(z[0], z[1], z[2] - z[0], z[3] - z[1]);
    c.setLineDash([Vw.px(4), Vw.px(4)]); c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, on ? 0.4 : 0.17); c.stroke();
    c.setLineDash([]); c.clip();
    c.beginPath();
    if (on) {
      for (let i = 0; i < 12; i++) {
        const lat = 0.1 + ((i * 0.618) % 1) * (width - 0.2), u = ((time * 1.9 + i * 0.137) % 1) * (L + 0.6) - 0.3;
        const a = pt(u, lat), b = pt(u + 0.5, lat);
        c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      }
      c.lineWidth = Vw.px(1.3); c.strokeStyle = rgba(C.ink, 0.55);
    } else {
      for (let u = 0.8; u < L; u += 1.6) {
        const tip = pt(u + 0.12, width / 2), l1 = pt(u - 0.06, width / 2 + 0.14), l2 = pt(u - 0.06, width / 2 - 0.14);
        c.moveTo(l1[0], l1[1]); c.lineTo(tip[0], tip[1]); c.lineTo(l2[0], l2[1]);
      }
      c.lineWidth = Vw.px(1.2); c.strokeStyle = rgba(C.ink, 0.22);
    }
    c.stroke(); c.restore();
    void d;
  }

  function drawFan(c, Vw, p, rt) {
    const cx = p.x + 0.5, cy = p.y + 0.5, on = !!(rt && rt.on), ang = rt ? rt.blade : 0;
    c.beginPath(); c.rect(p.x + 0.16, p.y + 0.16, 0.68, 0.68);
    c.fillStyle = C.paper; c.fill();
    fillStroke(c, Vw, rgba(C.hand, on ? 0.3 : 0.16), C.hand, 1.8);
    c.save(); c.translate(cx, cy); c.rotate(-ang);
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.ellipse(0.135, 0, 0.13, 0.055, 0, 0, TAU);
      fillStroke(c, Vw, rgba(C.ink, on ? 0.5 : 0.25), C.ink, 1.1);
    }
    c.restore();
    c.beginPath(); c.arc(cx, cy, 0.045, 0, TAU); c.fillStyle = C.ink; c.fill();
    const d = DIRS[p.o];
    c.beginPath();
    for (let k = -1; k <= 1; k++) {
      if (d[0]) { const gx = p.x + (d[0] > 0 ? 0.92 : 0.08); c.moveTo(gx, cy + k * 0.2 - 0.06); c.lineTo(gx, cy + k * 0.2 + 0.06); }
      else { const gy = p.y + 0.92; c.moveTo(cx + k * 0.2 - 0.06, gy); c.lineTo(cx + k * 0.2 + 0.06, gy); }
    }
    c.lineWidth = Vw.px(1.8); c.strokeStyle = C.hand; c.stroke();
    badge(c, Vw, p.num, p.x + 0.18, p.y + 0.82, 0.14);
  }

  function drawSensor(c, Vw, p, rt, linked) {
    const cx = p.x + 0.5, cy = p.y + 0.5, f = rt ? Math.max(0, rt.flash / 0.4) : 0;
    if (f > 0) { c.beginPath(); c.arc(cx, cy, 0.18 + 0.32 * (1 - f), 0, TAU); c.fillStyle = rgba(C.eye, 0.4 * f); c.fill(); }
    c.save(); c.setLineDash([Vw.px(3), Vw.px(3)]);
    c.beginPath(); c.rect(p.x + 0.06, p.y + 0.06, 0.88, 0.88); c.lineWidth = Vw.px(1.1); c.strokeStyle = rgba(C.eye, 0.8); c.stroke();
    c.restore();
    c.beginPath();
    c.moveTo(cx - 0.26, cy); c.lineTo(cx - 0.11, cy); c.moveTo(cx + 0.11, cy); c.lineTo(cx + 0.26, cy);
    c.moveTo(cx, cy - 0.26); c.lineTo(cx, cy - 0.11); c.moveTo(cx, cy + 0.11); c.lineTo(cx, cy + 0.26);
    c.lineWidth = Vw.px(1.4); c.strokeStyle = C.eye; c.stroke();
    c.beginPath(); c.arc(cx, cy, 0.1, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx, cy, 0.035, 0, TAU); c.fillStyle = C.eye; c.fill();
    if (!linked) { c.beginPath(); c.arc(p.x + 0.84, p.y + 0.84, 0.075, 0, TAU); c.fillStyle = C.bad; c.fill(); }
  }

  function drawLink(c, Vw, s, t) {
    const td = PARTS[t.type];
    const sx = s.x + 0.5, sy = s.y + 0.5, tx = t.x + td.w / 2, ty = t.y + td.h / 2;
    const mx = (sx + tx) / 2 + (sx === tx ? 0.9 : 0), my = Math.max(sy, ty) + 0.7;
    c.save(); c.setLineDash([Vw.px(5), Vw.px(4)]);
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, tx, ty);
    c.lineWidth = Vw.px(1.7); c.strokeStyle = rgba(C.eye, 0.85); c.stroke();
    c.restore();
    c.beginPath(); c.arc(tx, ty, 0.06, 0, TAU); c.fillStyle = C.eye; c.fill();
  }

  function bolts(c, Vw, p) {
    const d = PARTS[p.type];
    for (const [bx, by] of [[p.x + 0.09, p.y + 0.09], [p.x + d.w - 0.09, p.y + 0.09]]) {
      c.beginPath(); c.arc(bx, by, 0.045, 0, TAU); c.fillStyle = C.paper; c.fill();
      c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.ink, 0.85); c.stroke();
      c.beginPath(); c.moveTo(bx - 0.028, by - 0.028); c.lineTo(bx + 0.028, by + 0.028); c.stroke();
    }
  }

  function drawPart(c, Vw, p, rt, time) {
    if (p.type === 'ramp') drawRamp(c, Vw, p);
    else if (p.type === 'spring') drawSpring(c, Vw, p, rt);
    else if (p.type === 'belt') drawBelt(c, Vw, p, time);
    else if (p.type === 'piston') drawPiston(c, Vw, p, rt);
    else if (p.type === 'fan') drawFan(c, Vw, p, rt);
    else if (p.type === 'sensor') drawSensor(c, Vw, p, rt, true);
    if (p.fixed) bolts(c, Vw, p);
  }

  // 0 numaralı top sarı; diğerleri çelik bilye (aynı fizik, farklı görünüm).
  const BALL_LOOK = [
    { fill: null, edge: '#a77a12', mark: 'rgba(130,90,10,0.75)' },
    { fill: '#cdd8e8', edge: '#5d6f8c', mark: 'rgba(60,75,100,0.7)' },
  ];
  const ballFill = i => (i ? BALL_LOOK[1].fill : C.ball);
  function drawBall(c, Vw, x, y, ang, alpha, idx) {
    const R = T.R, look = BALL_LOOK[idx ? 1 : 0];
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = ballFill(idx); c.fill();
    c.lineWidth = Vw.px(1.5); c.strokeStyle = look.edge; c.stroke();
    c.save(); c.rotate(ang);
    c.beginPath(); c.moveTo(-R * 0.72, 0); c.lineTo(R * 0.72, 0); c.moveTo(0, -R * 0.3); c.lineTo(0, R * 0.3);
    c.lineWidth = Vw.px(1.8); c.strokeStyle = look.mark; c.stroke();
    c.restore();
    c.beginPath(); c.arc(-R * 0.36, R * 0.36, R * 0.22, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
    c.restore();
  }

  function drawTrail(c, Vw, trail, alpha, idx) {
    if (!trail || trail.length < 2) return;
    c.fillStyle = rgba(ballFill(idx), alpha);
    const r = Vw.px(1.7);
    for (let i = 0; i < trail.length; i += 2) { c.beginPath(); c.arc(trail[i][0], trail[i][1], r, 0, TAU); c.fill(); }
  }

  function outline(c, Vw, p, color, alpha, width) {
    const d = PARTS[p.type];
    c.beginPath(); c.rect(p.x + 0.04, p.y + 0.04, d.w - 0.08, d.h - 0.08);
    c.lineWidth = Vw.px(width || 2); c.strokeStyle = rgba(color, alpha); c.stroke();
  }


  // ---------------------------------------------------------------- canlı görünüm
  // Aynı geometri, gerçek malzemeler: ahşap raf ve rampalar, turuncu boyalı elle kumandalı
  // cihazlar, çelik yay/kova/boru, kauçuk bant, parlak top. Gölgeler cihaz pikseliyle verilir.
  const WOOD = { hi: '#f4d9a8', mid: '#e3bd84', lo: '#c29159', edge: '#8a5b2b', grain: 'rgba(120,76,32,0.22)' };
  const STEEL = { hi: '#f5f8fc', mid: '#bcc7d6', lo: '#6c7a90', edge: '#47546a' };
  const ORANGE = { hi: '#ffc48f', mid: '#ff9440', lo: '#c4580f', edge: '#8f3d06' };
  function shadowOn(c, Vw, k) {
    const d = Vw.dpr * (k == null ? 1 : k);
    c.shadowColor = 'rgba(3,12,30,0.5)'; c.shadowBlur = 7 * d; c.shadowOffsetX = 3 * d; c.shadowOffsetY = 4 * d;
  }
  function shadowOff(c) { c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
  function band(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
    return g;
  }
  // Kesitin iki ucu arasında yuvarlak görünen metal/boya geçişi.
  const tube = (m) => [m.lo, m.mid, m.hi, m.mid, m.lo];

  function drawWallsL(c, Vw, level) {
    (level.walls || []).forEach((w, wi) => {
      const b = wallBounds(w), h = Math.max(0.01, b[3] - b[1]);
      c.save();
      wallPath(c, w);
      c.fillStyle = band(c, 0, b[3], 0, b[1], [WOOD.hi, h > 0.5 ? WOOD.mid : WOOD.lo, WOOD.lo]);
      shadowOn(c, Vw); c.fill(); shadowOff(c);
      c.clip();
      let seed = (wi + 1) * 7919;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      c.beginPath();
      for (let y = b[1] + 0.06; y < b[3] - 0.03; y += 0.09 + rnd() * 0.11) {
        c.moveTo(b[0] - 0.1, y);
        for (let x = b[0]; x <= b[2] + 0.4; x += 0.4) c.lineTo(x, y + (rnd() - 0.5) * 0.03);
      }
      c.lineWidth = Vw.px(1); c.strokeStyle = WOOD.grain; c.stroke();
      c.restore();
      wallPath(c, w); c.lineWidth = Vw.px(1.2); c.strokeStyle = WOOD.edge; c.stroke();
      if (typeof w[0] === 'number') {
        c.beginPath(); c.moveTo(w[0] + Vw.px(1.5), w[3] - Vw.px(1.5)); c.lineTo(w[2] - Vw.px(1.5), w[3] - Vw.px(1.5));
        c.lineWidth = Vw.px(1.2); c.strokeStyle = 'rgba(255,247,228,0.8)'; c.stroke();
      }
    });
  }

  function drawCupL(c, Vw, cup) {
    const rim = KM.CUP.rim, t = KM.CUP.wall;
    c.fillStyle = band(c, 0, cup.y + rim, 0, cup.y, ['#202a3b', '#3a4860']);
    c.fillRect(cup.x + t, cup.y + t, cup.w - 2 * t, rim - t);
    for (const b of KM.cupBoxes(cup)) {
      const vertical = (b[3] - b[1]) > (b[2] - b[0]);
      c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
      c.fillStyle = vertical ? band(c, b[0], 0, b[2], 0, tube(STEEL)) : band(c, 0, b[3], 0, b[1], [STEEL.hi, STEEL.mid, STEEL.lo]);
      shadowOn(c, Vw); c.fill(); shadowOff(c);
      c.lineWidth = Vw.px(1); c.strokeStyle = STEEL.edge; c.stroke();
    }
    const left = !(cup.back && cup.back.side === 'l');
    const px = left ? cup.x + t / 2 : cup.x + cup.w - t / 2, py0 = cup.y + rim, py1 = py0 + 0.9, dir = left ? 1 : -1;
    c.beginPath(); c.moveTo(px, py0); c.lineTo(px, py1); c.lineWidth = Vw.px(2); c.strokeStyle = STEEL.lo; c.stroke();
    c.beginPath(); c.moveTo(px, py1); c.lineTo(px + dir * 0.46, py1 - 0.14); c.lineTo(px, py1 - 0.28); c.closePath();
    shadowOn(c, Vw, 0.6); c.fillStyle = C.ball; c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = '#b58a12'; c.stroke();
  }

  function drawPipeL(c, Vw, level) {
    const p = level.pipe; if (!p) return;
    const st = KM.startsOf(level)[0], r = 0.34;
    let b, mouth, vertical = p.dir === 'd';
    if (p.dir === 'r') { b = [-0.4, st.y - r, st.x + 0.02, st.y + r]; mouth = [b[2] - 0.1, b[1] - 0.07, b[2], b[3] + 0.07]; }
    else if (p.dir === 'l') { b = [st.x - 0.02, st.y - r, W + 0.4, st.y + r]; mouth = [b[0], b[1] - 0.07, b[0] + 0.1, b[3] + 0.07]; }
    else { b = [st.x - r, st.y - 0.02, st.x + r, Math.min(H + 0.4, p.y + 1.7)]; mouth = [b[0] - 0.07, b[1], b[2] + 0.07, b[1] + 0.1]; }
    const g = vertical ? band(c, b[0], 0, b[2], 0, tube(STEEL)) : band(c, 0, b[3], 0, b[1], tube(STEEL));
    c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); c.fillStyle = g;
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = STEEL.edge; c.stroke();
    c.beginPath(); c.rect(mouth[0], mouth[1], mouth[2] - mouth[0], mouth[3] - mouth[1]);
    c.fillStyle = vertical ? band(c, mouth[0], 0, mouth[2], 0, tube(STEEL)) : band(c, 0, mouth[3], 0, mouth[1], tube(STEEL));
    c.fill(); c.stroke();
  }

  function screw(c, Vw, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    const g = c.createRadialGradient(x - r * 0.3, y + r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, STEEL.hi); g.addColorStop(1, STEEL.lo);
    c.fillStyle = g; c.fill(); c.lineWidth = Vw.px(0.8); c.strokeStyle = STEEL.edge; c.stroke();
    c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.6); c.lineTo(x + r * 0.6, y + r * 0.6); c.stroke();
  }

  function drawRampL(c, Vw, p) {
    const [a, b] = KM.rampLine(p.o);
    const ax = p.x + a[0], ay = p.y + a[1], bx = p.x + b[0], by = p.y + b[1];
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), t = T.plank;
    c.save(); c.translate(ax, ay); c.rotate(ang);
    c.beginPath(); rrect(c, 0, -t / 2, len, t, t * 0.25);
    c.fillStyle = band(c, 0, t / 2, 0, -t / 2, [WOOD.hi, WOOD.mid, WOOD.lo]);
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = WOOD.edge; c.stroke();
    c.beginPath(); c.moveTo(0.1, t * 0.05); c.lineTo(len * 0.45, -t * 0.08); c.moveTo(len * 0.55, t * 0.1); c.lineTo(len - 0.1, -t * 0.02);
    c.lineWidth = Vw.px(0.8); c.strokeStyle = WOOD.grain; c.stroke();
    screw(c, Vw, 0.09, 0, 0.035); screw(c, Vw, len - 0.09, 0, 0.035);
    c.restore();
  }

  function drawSpringL(c, Vw, p, rt) {
    const k = rt && rt.compress > 0 ? Math.sin((1 - rt.compress / 0.18) * Math.PI) : 0;
    const top = 0.36 - 0.13 * k, padH = 0.09, x = p.x, y = p.y;
    c.beginPath(); c.rect(x + 0.1, y, 0.8, 0.07);
    c.fillStyle = band(c, 0, y + 0.07, 0, y, [STEEL.mid, STEEL.lo]);
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    const y0 = y + 0.07, y1 = y + top - padH, n = 6;
    const coil = () => { c.beginPath(); c.moveTo(x + 0.5, y0); for (let i = 1; i < n; i++) c.lineTo(x + (i % 2 ? 0.25 : 0.75), y0 + (y1 - y0) * (i / n)); c.lineTo(x + 0.5, y1); };
    coil(); c.lineJoin = 'round'; c.lineWidth = Vw.px(4); c.strokeStyle = STEEL.edge;
    shadowOn(c, Vw, 0.6); c.stroke(); shadowOff(c);
    coil(); c.lineWidth = Vw.px(1.6); c.strokeStyle = STEEL.hi; c.stroke();
    c.beginPath(); rrect(c, x + 0.07, y + top - padH, 0.86, padH, 0.03);
    c.fillStyle = band(c, 0, y + top, 0, y + top - padH, ['#5a6270', '#2a2f38', '#1b1f26']);
    shadowOn(c, Vw, 0.8); c.fill(); shadowOff(c);
    c.beginPath(); c.moveTo(x + 0.1, y + top - Vw.px(1.2)); c.lineTo(x + 0.9, y + top - Vw.px(1.2));
    c.lineWidth = Vw.px(1); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
  }

  function drawBeltL(c, Vw, p, time) {
    const x = p.x, y = p.y, t = T.plank, dir = p.o === 'r' ? 1 : -1;
    c.beginPath(); rrect(c, x, y - t / 2, 2, t, t / 2);
    c.fillStyle = band(c, 0, y + t / 2, 0, y - t / 2, ['#4a515d', '#262b33', '#16191f']);
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    const ph = (time * 2.5) % 0.16;
    c.save(); c.beginPath(); rrect(c, x, y - t / 2, 2, t, t / 2); c.clip();
    c.beginPath();
    for (let k = -0.16; k < 2.2; k += 0.16) {
      const cx = dir > 0 ? x + k + ph : x + 2 - k - ph;
      c.moveTo(cx, y + t / 2); c.lineTo(cx - 0.04 * dir, y - t / 2);
    }
    c.lineWidth = Vw.px(1.1); c.strokeStyle = 'rgba(160,170,185,0.35)'; c.stroke();
    c.restore();
    for (const rx of [x + t / 2, x + 2 - t / 2]) {
      c.beginPath(); c.arc(rx, y, t * 0.36, 0, TAU);
      const g = c.createRadialGradient(rx - 0.01, y + 0.01, 0, rx, y, t * 0.36);
      g.addColorStop(0, STEEL.hi); g.addColorStop(1, STEEL.lo);
      c.fillStyle = g; c.fill();
    }
    c.beginPath(); c.moveTo(x + 0.15, y + t / 2 - Vw.px(1)); c.lineTo(x + 1.85, y + t / 2 - Vw.px(1));
    c.lineWidth = Vw.px(1); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.stroke();
  }

  function drawPistonL(c, Vw, p, rt) {
    const g = KM.pistonGeom(p.o), d = DIRS[p.o], off = rt ? rt.offset : 0;
    const bx0 = p.x + g.base[0], by0 = p.y + g.base[1], bx1 = p.x + g.base[2], by1 = p.y + g.base[3];
    const hx0 = p.x + g.head[0] + d[0] * off, hy0 = p.y + g.head[1] + d[1] * off;
    const hx1 = p.x + g.head[2] + d[0] * off, hy1 = p.y + g.head[3] + d[1] * off;
    const vertical = p.o === 'u';
    let rod;
    if (p.o === 'u') rod = [p.x + 0.43, by1 - 0.05, p.x + 0.57, hy0];
    else if (p.o === 'r') rod = [bx1 - 0.05, p.y + 0.43, hx0, p.y + 0.57];
    else rod = [hx1, p.y + 0.43, bx0 + 0.05, p.y + 0.57];
    c.beginPath(); c.rect(rod[0], rod[1], rod[2] - rod[0], rod[3] - rod[1]);
    c.fillStyle = vertical ? band(c, rod[0], 0, rod[2], 0, tube(STEEL)) : band(c, 0, rod[3], 0, rod[1], tube(STEEL));
    c.fill();
    c.beginPath(); rrect(c, bx0, by0, bx1 - bx0, by1 - by0, 0.05);
    c.fillStyle = vertical ? band(c, bx0, 0, bx1, 0, tube(ORANGE)) : band(c, 0, by1, 0, by0, tube(ORANGE));
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = ORANGE.edge; c.stroke();
    c.beginPath();
    if (vertical) for (const yy of [by0 + 0.1, by1 - 0.1]) { c.moveTo(bx0, yy); c.lineTo(bx1, yy); }
    else for (const xx of [bx0 + 0.1, bx1 - 0.1]) { c.moveTo(xx, by0); c.lineTo(xx, by1); }
    c.lineWidth = Vw.px(1.2); c.strokeStyle = 'rgba(120,45,0,0.45)'; c.stroke();
    c.beginPath(); rrect(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 0.025);
    c.fillStyle = vertical ? band(c, 0, hy1, 0, hy0, [STEEL.hi, STEEL.mid, STEEL.lo]) : band(c, hx0, 0, hx1, 0, [STEEL.lo, STEEL.hi, STEEL.mid]);
    shadowOn(c, Vw, 0.8); c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = STEEL.edge; c.stroke();
    badge(c, Vw, p.num, (bx0 + bx1) / 2, (by0 + by1) / 2, 0.15);
  }

  function drawFanZoneL(c, Vw, p, rt, time, build) {
    const z = KM.fanZone(p), on = !!(rt && rt.on), L = T.fanLen;
    const pt = (along, lat) => p.o === 'r' ? [z[0] + along, z[1] + lat] : p.o === 'l' ? [z[2] - along, z[1] + lat] : [z[0] + lat, z[1] + along];
    if (!on && !build) return;
    c.save();
    c.beginPath(); c.rect(z[0], z[1], z[2] - z[0], z[3] - z[1]);
    if (!on) {
      c.setLineDash([Vw.px(3), Vw.px(5)]); c.lineWidth = Vw.px(1); c.strokeStyle = 'rgba(230,240,255,0.14)'; c.stroke();
      c.restore(); return;
    }
    c.clip();
    c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const lat = 0.1 + ((i * 0.618) % 1) * 0.7, u = ((time * 2.1 + i * 0.137) % 1) * (L + 0.8) - 0.4;
      const a = pt(u, lat), b = pt(u + 0.6, lat + Math.sin(time * 6 + i) * 0.03);
      const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineWidth = Vw.px(2); c.strokeStyle = g; c.stroke();
    }
    c.restore();
  }

  function drawFanL(c, Vw, p, rt) {
    const cx = p.x + 0.5, cy = p.y + 0.5, on = !!(rt && rt.on), ang = rt ? rt.blade : 0;
    c.beginPath(); rrect(c, p.x + 0.13, p.y + 0.13, 0.74, 0.74, 0.12);
    c.fillStyle = band(c, p.x + 0.13, p.y + 0.87, p.x + 0.87, p.y + 0.13, [ORANGE.hi, ORANGE.mid, ORANGE.lo]);
    shadowOn(c, Vw); c.fill(); shadowOff(c);
    c.lineWidth = Vw.px(1); c.strokeStyle = ORANGE.edge; c.stroke();
    c.beginPath(); c.arc(cx, cy, 0.29, 0, TAU); c.fillStyle = '#18202c'; c.fill();
    if (on) { c.beginPath(); c.arc(cx, cy, 0.26, 0, TAU); c.fillStyle = 'rgba(214,224,238,0.28)'; c.fill(); }
    c.save(); c.translate(cx, cy); c.rotate(-ang); c.globalAlpha = on ? 0.6 : 1;
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.ellipse(0.125, 0, 0.12, 0.05, 0.25, 0, TAU);
      c.fillStyle = band(c, 0, 0.05, 0, -0.05, [STEEL.hi, STEEL.mid]); c.fill();
    }
    c.restore();
    c.beginPath(); c.arc(cx, cy, 0.05, 0, TAU); c.fillStyle = STEEL.mid; c.fill();
    const d = DIRS[p.o];
    c.beginPath();
    for (let k = -1; k <= 1; k++) {
      if (d[0]) { const gx = cx + d[0] * 0.27; c.moveTo(gx, cy + k * 0.12 - 0.05); c.lineTo(gx, cy + k * 0.12 + 0.05); }
      else { const gy = cy + 0.27; c.moveTo(cx + k * 0.12 - 0.05, gy); c.lineTo(cx + k * 0.12 + 0.05, gy); }
    }
    c.lineWidth = Vw.px(2); c.strokeStyle = 'rgba(20,26,36,0.9)'; c.stroke();
    badge(c, Vw, p.num, p.x + 0.19, p.y + 0.81, 0.13);
  }

  function drawSensorL(c, Vw, p, rt, linked) {
    const cx = p.x + 0.5, cy = p.y + 0.5, f = rt ? Math.max(0, rt.flash / 0.4) : 0;
    c.beginPath();
    const k = 0.16;
    for (const [qx, qy, sx, sy] of [[p.x + 0.07, p.y + 0.07, 1, 1], [p.x + 0.93, p.y + 0.07, -1, 1], [p.x + 0.07, p.y + 0.93, 1, -1], [p.x + 0.93, p.y + 0.93, -1, -1]]) {
      c.moveTo(qx + sx * k, qy); c.lineTo(qx, qy); c.lineTo(qx, qy + sy * k);
    }
    c.lineWidth = Vw.px(1.6); c.strokeStyle = rgba(C.eye, 0.8); c.stroke();
    c.save(); c.setLineDash([Vw.px(2), Vw.px(3)]);
    c.beginPath(); c.arc(cx, cy, 0.22, 0, TAU); c.lineWidth = Vw.px(1); c.strokeStyle = rgba(C.eye, 0.45); c.stroke();
    c.restore();
    if (f > 0) {
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 0.45);
      g.addColorStop(0, rgba(C.eye, 0.75 * f)); g.addColorStop(1, rgba(C.eye, 0));
      c.beginPath(); c.arc(cx, cy, 0.45, 0, TAU); c.fillStyle = g; c.fill();
    }
    c.beginPath(); c.arc(cx, cy, 0.11, 0, TAU); c.fillStyle = '#121822';
    shadowOn(c, Vw, 0.6); c.fill(); shadowOff(c);
    const lg = c.createRadialGradient(cx - 0.02, cy + 0.02, 0, cx, cy, 0.065);
    lg.addColorStop(0, '#e9fdff'); lg.addColorStop(0.5, C.eye); lg.addColorStop(1, '#1b6f7a');
    c.beginPath(); c.arc(cx, cy, 0.065, 0, TAU); c.fillStyle = lg; c.fill();
    if (!linked) { c.beginPath(); c.arc(p.x + 0.84, p.y + 0.84, 0.075, 0, TAU); c.fillStyle = C.bad; c.fill(); }
  }

  function drawLinkL(c, Vw, s, t) {
    const td = PARTS[t.type];
    const sx = s.x + 0.5, sy = s.y + 0.5, tx = t.x + td.w / 2, ty = t.y + td.h / 2;
    const dist = Math.hypot(tx - sx, ty - sy);
    const mx = (sx + tx) / 2 + (sx === tx ? 0.7 : 0), my = Math.min(sy, ty) - 0.25 - dist * 0.12;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, tx, ty);
    c.lineCap = 'round'; c.lineWidth = Vw.px(3); c.strokeStyle = '#13606b';
    shadowOn(c, Vw, 0.5); c.stroke(); shadowOff(c);
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, tx, ty);
    c.lineWidth = Vw.px(1); c.strokeStyle = 'rgba(160,245,250,0.8)'; c.stroke();
    c.beginPath(); c.arc(tx, ty, 0.05, 0, TAU); c.fillStyle = '#13606b'; c.fill();
  }

  function boltsL(c, Vw, p) {
    const d = PARTS[p.type];
    screw(c, Vw, p.x + 0.09, p.y + 0.09, 0.045); screw(c, Vw, p.x + d.w - 0.09, p.y + 0.09, 0.045);
  }

  function drawPartL(c, Vw, p, rt, time) {
    if (p.type === 'ramp') drawRampL(c, Vw, p);
    else if (p.type === 'spring') drawSpringL(c, Vw, p, rt);
    else if (p.type === 'belt') drawBeltL(c, Vw, p, time);
    else if (p.type === 'piston') drawPistonL(c, Vw, p, rt);
    else if (p.type === 'fan') drawFanL(c, Vw, p, rt);
    else if (p.type === 'sensor') drawSensorL(c, Vw, p, rt, true);
    if (p.fixed) boltsL(c, Vw, p);
  }

  function drawBallL(c, Vw, x, y, ang, alpha, idx) {
    const R = T.R, steel = !!idx;
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    const g = c.createRadialGradient(-R * 0.35, R * 0.38, R * 0.05, 0, 0, R);
    if (steel) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c9d3e1'); g.addColorStop(1, '#56647c'); }
    else { g.addColorStop(0, '#fff7cf'); g.addColorStop(0.4, '#ffd23e'); g.addColorStop(1, '#bb7f00'); }
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = g;
    shadowOn(c, Vw, 0.9); c.fill(); shadowOff(c);
    if (!steel) {
      c.save(); c.rotate(ang);
      c.beginPath(); c.arc(0, -R * 1.25, R * 1.05, Math.PI * 0.3, Math.PI * 0.7);
      c.lineWidth = Vw.px(1.4); c.strokeStyle = 'rgba(150,95,0,0.55)'; c.stroke();
      c.restore();
    } else {
      c.beginPath(); c.ellipse(R * 0.1, -R * 0.35, R * 0.55, R * 0.16, -0.3, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.28)'; c.fill();
    }
    c.beginPath(); c.ellipse(-R * 0.38, R * 0.42, R * 0.2, R * 0.13, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
    c.restore();
  }

  // ---------------------------------------------------------------- yardımcılar (kurulum)
  const allParts = () => KM.listParts(S.level, S.parts);
  const devicesAll = () => allParts().filter(p => PARTS[p.type].manual);
  const trayTotal = () => Object.values(S.level.tray || {}).reduce((a, b) => a + b, 0);
  const trayLeft = type => ((S.level.tray || {})[type] || 0) - S.parts.filter(p => p.type === type).length;
  function unlocked(i) {
    if (i === 0 || ALL_OPEN) return true;
    const prev = S.progress[LEVELS[i - 1].id];
    return !!(prev && prev.solved);
  }
  function centerOf(p) { const d = PARTS[p.type]; return [p.x + d.w / 2, p.y + d.h / 2]; }
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
  const LOOKS = ['gecis', 'canli', 'cizim'];
  const LOOK_NAME = { cizim: 'Çizim', gecis: 'Çizim → canlı', canli: 'Canlı' };
  const buildStyle = () => (S.look === 'canli' ? 'live' : 'bp');

  function drawScene(c, style, items, run, time) {
    const L = S.level, live = style === 'live';
    drawGrid(c, V, true, live);
    for (const it of items) if (it.p.type === 'fan') (live ? drawFanZoneL : drawFanZone)(c, V, it.p, it.rt, time, !run);
    (live ? drawWallsL : drawWalls)(c, V, L);
    (run ? S.sim.trails : S.trails || []).forEach((tr, i) => drawTrail(c, V, tr, (run ? 0.75 : 0.42) * (live ? 0.85 : 1), i));
    for (const cup of KM.cupsOf(L)) (live ? drawCupL : drawCup)(c, V, cup);
    (live ? drawPipeL : drawPipe)(c, V, L);
    for (const it of items) if (it.p.type !== 'sensor') (live ? drawPartL : drawPart)(c, V, it.p, it.rt, time);
    const byId = {};
    for (const it of items) byId[it.p.id] = it.p;
    for (const it of items) {
      if (it.p.type !== 'sensor') continue;
      const target = run ? (it.rt.link && it.rt.link.p) : byId[it.p.link];
      if (target) (live ? drawLinkL : drawLink)(c, V, it.p, target);
    }
    for (const it of items) {
      if (it.p.type !== 'sensor') continue;
      const linked = run ? !!it.rt.link : !!byId[it.p.link];
      (live ? drawSensorL : drawSensor)(c, V, it.p, it.rt, linked);
    }
    const ball = live ? drawBallL : drawBall;
    if (run) {
      S.sim.balls.forEach((b, i) => {
        if (S.sim.bstate[i] === 'out') return;
        const bp = b.getPosition();
        ball(c, V, bp.x, bp.y, b.getAngle(), 1, i);
      });
    } else {
      KM.startsOf(L).forEach((st, i) => ball(c, V, st.x, st.y, 0, live ? 0.85 : 0.6, i));
    }
  }

  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function render() {
    if (!V) return;
    const c = ctx, time = S.time;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    V.tf(c);
    const run = S.mode === 'run' && S.sim;
    const items = run ? S.sim.rts.map(rt => ({ p: rt.p, rt })) : allParts().map(p => ({ p, rt: null }));
    const m = S.look === 'cizim' ? 0 : S.look === 'canli' ? 1 : S.morph;
    if (m <= 0.001) drawScene(c, 'bp', items, run, time);
    else if (m >= 0.999) drawScene(c, 'live', items, run, time);
    else {
      // Çizim soldan sağa taranarak gerçeğe dönüşür.
      drawScene(c, 'bp', items, run, time);
      const sx = -M + (W + 2 * M) * ease(m);
      c.save();
      c.beginPath(); c.rect(-M - 1, -M - 1, sx + M + 1, H + 2 * M + 2); c.clip();
      c.clearRect(-M - 1, -M - 1, sx + M + 1, H + 2 * M + 2);
      drawScene(c, 'live', items, run, time);
      c.restore();
      const g = c.createLinearGradient(sx - 0.6, 0, sx, 0);
      g.addColorStop(0, rgba(C.eye, 0)); g.addColorStop(1, rgba(C.eye, 0.35));
      c.fillStyle = g; c.fillRect(sx - 0.6, -M, 0.6, H + 2 * M);
      c.beginPath(); c.moveTo(sx, -M); c.lineTo(sx, H + M);
      c.lineWidth = V.px(2); c.strokeStyle = 'rgba(235,252,255,0.95)'; c.stroke();
    }
    if (run) {
      const pulse = 0.25 + 0.2 * Math.sin(time * 5);
      for (const it of items) if (PARTS[it.p.type].manual) outline(c, V, it.p, C.hand, pulse, 1.5);
    }
    if (S.linkFrom) {
      const pulse = 0.55 + 0.4 * Math.sin(time * 7);
      for (const it of items) if (PARTS[it.p.type].manual) outline(c, V, it.p, C.hand, pulse, 2.5);
      outline(c, V, S.linkFrom, C.eye, 0.9, 2.5);
    }
    const dr = S.drag;
    if (dr && dr.cand && dr.over) {
      const live = buildStyle() === 'live';
      for (const q of KM.cellsOf(dr.cand)) {
        c.fillStyle = dr.valid ? rgba(C.ink, 0.13) : rgba(C.bad, 0.32);
        c.fillRect(q[0], q[1], 1, 1);
      }
      c.save(); c.globalAlpha = dr.valid ? 0.9 : 0.55;
      if (dr.cand.type === 'fan') (live ? drawFanZoneL : drawFanZone)(c, V, dr.cand, null, time, true);
      (live ? drawPartL : drawPart)(c, V, dr.cand, null, time);
      c.restore();
    }
  }

  function drawIcon(canvas, type, o, style) {
    const r = canvas.getBoundingClientRect();
    const w = r.width || 52, h = r.height || 30, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const d = PARTS[type], c = canvas.getContext('2d');
    const Vi = makeView(w, h, dpr, d.w / 2 - 1.2, d.h / 2 - 0.62, 2.4, 1.24);
    Vi.tf(c);
    const p = { type, o: o || DEFAULT_O[type], x: 0, y: 0 };
    ((style || buildStyle()) === 'live' ? drawPartL : drawPart)(c, Vi, p, null, 0);
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
    drawWalls(c, Vt, L); for (const cup of KM.cupsOf(L)) drawCup(c, Vt, cup); drawPipe(c, Vt, L);
    for (const p of fixed) drawPart(c, Vt, p, null, 0);
    KM.startsOf(L).forEach((st, i) => drawBall(c, Vt, st.x, st.y, 0, 1, i));
  }

  // ---------------------------------------------------------------- arayüz
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2800);
  }
  function hideToast() { clearTimeout(toastTimer); $('toast').classList.remove('show'); }

  const badgeText = b => b.k === 'solve' ? 'Makine çalıştı'
    : b.k === 'budget' ? `En fazla ${b.n} parça`
    : b.k === 'presses' ? (b.n === 1 ? 'Tek basış' : `En fazla ${b.n} basış`)
    : 'Tam otomatik';
  const badgeOk = (b, used, presses) => b.k === 'solve' || (b.k === 'budget' && used <= b.n)
    || (b.k === 'presses' && presses <= b.n) || (b.k === 'auto' && presses === 0);
  const badgeTip = b => b.k === 'budget' ? `Daha az parçayla dene: en fazla ${b.n} parça.`
    : b.k === 'presses' ? 'Tek basışla dene: doğru anı bekle, bir kez bas.'
    : b.k === 'auto' ? 'Tam otomatik dene: hiç dokunmadan çalışan bir makine kur. Sensör, top üstünden geçince bağlı cihazı çalıştırır.'
    : '';

  function setHint() {
    const L = S.level, h = L.hints || {}, prog = S.progress[L.id];
    let t;
    if (S.mode === 'run') t = h.run || 'Makine çalışıyor. Durdur’a basınca kuruluma dönersin.';
    else if (S.linkFrom) t = 'Sensörü bağlamak için turuncu bir cihaza dokun. Boş bir yere dokunursan vazgeçersin.';
    else if (prog && prog.solved) {
      const missing = L.badges.some(b => !prog.badges[b.k]);
      t = missing ? (h.after || 'Eksik damgaları dene.')
        : S.li + 1 < LEVELS.length ? 'Bu çizimin bütün damgaları tamam. Sıradaki çizime geç.' : 'Atölye defterindeki bütün çizimler tamam. Yeni çizimler yolda.';
    } else if (S.lastFail) t = h.fail || 'Noktalı çizgiye bak ve kurulumu değiştir.';
    else if (!S.parts.length) t = h.place || h.ready;
    else t = h.ready || 'Hazırsan Çalıştır.';
    const el = $('hint');
    if (el.textContent !== t) el.textContent = t;
  }

  function refreshHeader() {
    const L = S.level;
    $('tb-no').textContent = `${pad2(S.li + 1)} / ${pad2(LEVELS.length)}`;
    $('tb-name').textContent = L.name;
    $('tb-task').textContent = L.task;
    document.title = `Küçük Mühendisler · ${L.name}`;
  }

  function refreshBom() {
    const ol = $('bom-list'); ol.textContent = '';
    const types = ORDER.filter(t => ((S.level.tray || {})[t] || 0) > 0);
    $('bom-foot').hidden = !types.length;
    if (!types.length) {
      const li = document.createElement('li'); li.className = 'bom-none';
      li.textContent = 'Bu çizimde parça yok. Makine kurulu, iş kumandada.';
      ol.appendChild(li); return;
    }
    types.forEach((type, i) => {
      const left = trayLeft(type);
      const li = document.createElement('li');
      li.className = 'bom-row' + (left > 0 ? '' : ' empty');
      li.innerHTML = `<span class="no">${i + 1}</span><canvas aria-hidden="true"></canvas><span class="nm">${NAMES[type]}</span><span class="qty">×${left}</span>`;
      li.setAttribute('aria-label', `${NAMES[type]}, ${left} adet`);
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
    const run = S.mode === 'run';
    $('bom').hidden = run; $('pult').hidden = !run;
    const btn = $('run');
    btn.classList.toggle('stop', run);
    $('run-label').textContent = run ? 'Durdur' : 'Çalıştır';
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
      p.textContent = 'Bu makinede elle kumandalı cihaz yok. Sadece izle.';
      box.appendChild(p); return;
    }
    for (const rt of devs) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'dev';
      b.innerHTML = `<span class="num">${rt.num}</span><span class="nm">${NAMES[rt.type]}</span><span class="act">${rt.type === 'fan' ? 'Basılı tut' : 'Bas'}</span>`;
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
  function updatePult() {
    if (!S.sim) return;
    for (const rt of S.sim.devices) {
      if (!rt.btn) continue;
      const on = rt.type === 'fan' ? rt.on : rt.state !== 'idle';
      if (rt.btn.classList.contains('on') !== on) rt.btn.classList.toggle('on', on);
    }
    const t = S.sim.balls.length > 1 ? `Elle: ${S.sim.presses} · Kova: ${S.sim.goals}/${S.sim.need}` : `Elle: ${S.sim.presses}`;
    const el = $('press-count'); if (el.textContent !== t) el.textContent = t;
  }

  // ---------------------------------------------------------------- bölüm
  function loadLevel(i) {
    hideToast();
    S.li = i; S.level = LEVELS[i]; S.occ = KM.occupancy(S.level);
    S.mode = 'build'; S.sim = null; S.trails = null; S.lastFail = null; S.drag = null; S.press = null; S.linkFrom = null;
    S.held.clear();
    S.parts = []; S.nextId = 1;
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
    const d = PARTS[type];
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
      addPlaced(p); sfx('place');
    } else if (dr.fromId) {
      if (!dr.over) { relinkAfterRemoval(dr.fromId); sfx('remove'); }
      else { S.parts.push(dr.orig); toast('Oraya sığmıyor. Parça eski yerine döndü.', 1800); }
    } else if (dr.over) {
      toast('Oraya sığmıyor. Kırmızı hücreler dolu.', 1800);
    }
    saveSetup(); refreshBom(); setHint();
  }

  function rotatePart(p) {
    const os = PARTS[p.type].orients;
    if (os.length < 2) return;
    const i = os.indexOf(p.o);
    for (let k = 1; k < os.length; k++) {
      const o = os[(i + k) % os.length], cand = Object.assign({}, p, { o });
      if (KM.canPlace(S.level, S.occ, S.parts, cand, p.id)) { p.o = o; sfx('tick'); saveSetup(); return; }
    }
  }

  function enterLink(sensor) {
    if (!devicesAll().length) { toast('Bu çizimde bağlanacak elle kumandalı cihaz yok.'); return; }
    S.linkFrom = sensor; sfx('tick'); setHint();
  }
  function exitLink() { if (S.linkFrom) { S.linkFrom = null; setHint(); } }

  function onBoardDown(e) {
    if (!V || overlayOpen()) return;
    audio();
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
    if (rt.type === 'fan') { S.held.set(pid, rt); S.sim.hold(rt, true); }
    else S.sim.press(rt, true);
    updatePult();
  }
  function devUp(rt, pid) {
    if (!S.held.has(pid)) return;
    S.held.delete(pid);
    if (S.sim && rt.type === 'fan' && ![...S.held.values()].includes(rt)) S.sim.hold(rt, false);
    updatePult();
  }
  function releaseAll() {
    for (const [pid, rt] of [...S.held]) devUp(rt, pid);
    S.held.clear();
  }

  function toggleRun() { if (S.mode === 'run') stopRun('user'); else startRun(); }

  function startRun() {
    if (S.drag || overlayOpen()) return;
    exitLink(); hideToast(); audio();
    S.sim = KM.createSim(S.level, S.parts.map(p => Object.assign({}, p)));
    S.mode = 'run'; S.acc = 0; S.endT = 0; S.restNoted = false; S.goalPlayed = false;
    S.held.clear();
    S.seen = S.sim.rts.map(rt => ({ fires: rt.fires, comp: rt.compress }));
    sfx('run');
    refreshSide(); buildPult(); updatePult();
  }

  function stopRun(reason) {
    if (!S.sim) return;
    releaseAll();
    S.trails = S.sim.trails.map(t => t.slice());
    S.sim = null; S.mode = 'build';
    if (reason !== 'user') S.lastFail = reason;
    if (reason === 'out') { toast('Top düştü. Noktalı çizgi son yolunu gösteriyor.'); sfx('fail'); }
    else if (reason === 'timeout') toast('Süre doldu. Makineyi gözden geçir.');
    else if (reason === 'rest') toast('Top durdu. Kurulumu değiştirip yeniden dene.');
    refreshSide();
  }

  function succeed() {
    const sim = S.sim, L = S.level;
    const used = S.parts.length, presses = sim.presses, t = sim.goalStep * DT;
    const prog = S.progress[L.id] || (S.progress[L.id] = { solved: false, badges: {} });
    const res = L.badges.map(b => ({ b, ok: badgeOk(b, used, presses) }));
    const fresh = [];
    for (const r of res) if (r.ok && !prog.badges[r.b.k]) { prog.badges[r.b.k] = true; fresh.push(r.b.k); }
    prog.solved = true;
    persist();
    const got = L.badges.filter(b => prog.badges[b.k]).length;
    lab.note(`Çizim ${pad2(S.li + 1)} ${L.name}: çalıştı · damga ${got}/${L.badges.length} · elle ${presses} · ${LOOK_NAME[S.look]}`);
    releaseAll();
    S.trails = sim.trails.map(t => t.slice()); S.sim = null; S.mode = 'build'; S.lastFail = null;
    refreshSide();
    showResult(res, fresh, used, presses, t);
  }

  function frame(now) {
    const dt = frame.last ? Math.min(0.05, (now - frame.last) / 1000) : 0;
    frame.last = now; S.time += dt;
    const target = S.look === 'gecis' && S.mode === 'run' ? 1 : 0;
    if (reduceMotion) S.morph = target;
    else if (S.morph < target) S.morph = Math.min(1, S.morph + dt / 0.6);
    else if (S.morph > target) S.morph = Math.max(0, S.morph - dt / 0.35);
    if (S.mode === 'run' && S.sim) {
      const sim = S.sim;
      // Çizim → canlı görünümünde makine, tarama bitince çalışmaya başlar.
      if (!(S.look === 'gecis' && S.morph < 1)) {
        S.acc += dt;
        let n = 0;
        while (S.acc >= DT && n < 12) { sim.step(); S.acc -= DT; n++; }
        if (n >= 12) S.acc = 0;
      }
      sim.rts.forEach((rt, i) => {
        const s = S.seen[i];
        if (rt.fires > s.fires) sfx(rt.type === 'sensor' ? 'sensor' : 'piston');
        if (rt.compress > s.comp + 0.01) sfx('spring');
        s.fires = rt.fires; s.comp = rt.compress;
      });
      if (sim.status === 'goal') {
        if (!S.goalPlayed) { S.goalPlayed = true; sfx('goal'); }
        S.endT += dt; if (S.endT > 0.85) succeed();
      } else if (sim.status === 'out') {
        S.endT += dt; if (S.endT > 0.45) stopRun('out');
      } else if (sim.status === 'timeout') stopRun('timeout');
      else if (sim.restT > 2.4 && !S.restNoted) {
        S.restNoted = true;
        if (sim.devices.length) toast('Top durdu. Elle bir şey yapman gerekiyor olabilir.', 3200);
        else stopRun('rest');
      }
      updatePult();
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- katmanlar
  const overlayOpen = () => !$('result').hidden || !$('levels').hidden;
  function openOverlay(id, focusId) { $(id).hidden = false; const f = $(focusId); if (f) f.focus(); }
  function closeOverlay(id) { $(id).hidden = true; }

  function showResult(res, fresh, used, presses, t) {
    const L = S.level, prog = S.progress[L.id];
    $('result-cap').textContent = `Çizim ${pad2(S.li + 1)} · onaylandı`;
    const ul = $('result-stamps'); ul.textContent = '';
    for (const r of res) {
      const got = !!prog.badges[r.b.k];
      const li = document.createElement('li');
      li.className = 'goal' + (got ? ' got' : '') + (fresh.includes(r.b.k) ? ' new' : '');
      li.innerHTML = `<span class="stamp">${CHECK}</span><span>${badgeText(r.b)}${got && !r.ok ? ' · önceki denemeden' : ''}</span>`;
      ul.appendChild(li);
    }
    $('st-time').textContent = t.toFixed(1).replace('.', ',') + ' sn';
    $('st-parts').textContent = String(used);
    $('st-press').textContent = String(presses);
    const missing = L.badges.find(b => !prog.badges[b.k]);
    $('result-tip').textContent = missing ? badgeTip(missing) : (S.li + 1 < LEVELS.length ? 'Bu çizimin bütün damgaları tamam.' : 'Atölye defterindeki bütün çizimler bitti. Yenileri yolda.');
    const last = S.li + 1 >= LEVELS.length;
    $('btn-next').textContent = last ? 'Bölümler' : 'Sonraki çizim';
    openOverlay('result', 'btn-next');
  }

  function openLevels() {
    const grid = $('level-grid'); grid.textContent = '';
    LEVELS.forEach((L, i) => {
      const prog = S.progress[L.id], open = unlocked(i);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lvl' + (i === S.li ? ' cur' : ''); b.disabled = !open;
      const dots = L.badges.map(bd => `<span class="dot${prog && prog.badges[bd.k] ? ' got' : ''}" title="${badgeText(bd)}"></span>`).join('');
      b.innerHTML = `<canvas aria-hidden="true"></canvas><div class="meta"><div><span class="cap">Çizim ${pad2(i + 1)}</span><div class="nm">${L.name}</div></div><div class="dots">${dots}</div></div>${open ? '' : '<span class="lock">Kilitli</span>'}`;
      b.setAttribute('aria-label', `Çizim ${i + 1}: ${L.name}${open ? '' : ', kilitli'}`);
      b.addEventListener('click', () => { closeOverlay('levels'); loadLevel(i); });
      grid.appendChild(b);
    });
    openOverlay('levels', 'levels-close');
    requestAnimationFrame(() => grid.querySelectorAll('canvas').forEach((c, i) => drawThumb(c, LEVELS[i])));
  }

  function setLook(look, announce) {
    S.look = look;
    if (S.mode === 'run' && look === 'gecis') S.morph = 1;
    persistDevice();
    $('look-label').textContent = LOOK_NAME[look];
    $('btn-look').setAttribute('aria-label', `Görünüm: ${LOOK_NAME[look]}. Değiştirmek için dokun.`);
    if (S.mode === 'build' && S.level) refreshBom();
    if (announce) toast(`Görünüm: ${LOOK_NAME[look]}`, 1800);
  }

  function setMuted(m) {
    S.muted = m; persistDevice();
    const b = $('btn-sound'); b.setAttribute('aria-pressed', String(!m)); b.setAttribute('aria-label', m ? 'Sesi aç' : 'Sesi kapat');
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  $('run').addEventListener('click', toggleRun);
  $('btn-levels').addEventListener('click', () => { if (S.mode === 'run') stopRun('user'); openLevels(); });
  $('levels-close').addEventListener('click', () => closeOverlay('levels'));
  $('btn-sound').addEventListener('click', () => setMuted(!S.muted));
  $('btn-look').addEventListener('click', () => setLook(LOOKS[(LOOKS.indexOf(S.look) + 1) % LOOKS.length], true));
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
  window.KM_GAME = { S, loadLevel, startRun, stopRun, toggleRun, addPlaced, rotatePart, saveSetup, refreshSide, setLook, view: () => V };

  function boot(data) {
    if (lab.on) document.documentElement.classList.add('lab');
    makeNoise();
    setMuted(S.muted);
    setLook(S.look, false);
    layout();
    let li = typeof data.li === 'number' ? data.li : typeof saved.li === 'number' ? saved.li : 0;
    if (!(li >= 0 && li < LEVELS.length) || !unlocked(li)) li = 0;
    if (Array.isArray(data.parts)) S.setups[LEVELS[li].id] = data.parts;
    loadLevel(li);
    if (!S.lookTip) {
      S.lookTip = true; persistDevice();
      setTimeout(() => toast('Yeni: üstteki Görünüm düğmesiyle çizim ve canlı görünüm arasında geçebilirsin.', 4200), 600);
    }
    requestAnimationFrame(frame);
  }
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ li: S.li, parts: S.parts.map(p => ({ id: p.id, type: p.type, o: p.o, x: p.x, y: p.y, link: p.link })) })); } catch (e) { /* yok say */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
}());
