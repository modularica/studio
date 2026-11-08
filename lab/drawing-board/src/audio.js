// Drawing Board — müzik ve sesler. Hepsi WebAudio sentezi; ses dosyası yok.
// Müzik: her çizimin kendi tonu, akor yürüyüşü, marimba ostinatosu ve ezgisi var (çizim kimliğinden tohum).
//   build: kurarken sakin (piyano akorları, uzun bas, seyrek marimba, iki turda bir ezgi)
//   run:   makine çalışırken saat tıkırtısı, yumuşak davul, akor vuruşları, marimba ostinatosu ve ezgi girer
//   menu:  sonuç ve bölüm penceresi açıkken kısık ve boğuk
// Katmanlar bir sonraki vuruşta girip çıkar, yeni çizimin müziği bir sonraki ölçüde başlar.
// Parça sesleri (yay, sensör, kapı, çarpma, kova…) o an çalan akordan nota seçer: makine müziğe uyar.
// Tarayıcıda window.KM_AUDIO. render() testler için müziği OfflineAudioContext'te önceden çalar.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KM_AUDIO = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BPM = 84, S16 = 60 / BPM / 4, SWING = 0.18, AHEAD = 0.22;
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  const PENTA = [0, 1, 2, 4, 5];                 // majör pentatonik, gam basamağı olarak
  const KEYS = [0, 2, 3, 5, 7, 9];               // C D Eb F G A
  // Akor yürüyüşleri (gam basamağı, 0 = I). Hepsi diyatonik, yumuşak.
  const PROGS = [[0, 5, 3, 4], [3, 2, 1, 0], [5, 3, 0, 4], [1, 4, 0, 5], [3, 4, 2, 5]];
  const RHYTHMS = [[0, 4, 6, 8, 14], [0, 3, 6, 10, 12], [2, 4, 8, 11], [0, 6, 8, 12, 14], [0, 2, 4, 10]];
  const MODES = {
    build: { lp: 7500, vol: 1, drums: false, ost: 0.45, mel: 2, stabs: false },
    run: { lp: 15000, vol: 1, drums: true, ost: 1, mel: 1, stabs: true },
    menu: { lp: 2200, vol: 0.55, drums: false, ost: 0.3, mel: 0, stabs: false },
  };
  const MUSIC_VOL = 0.9, SFX_VOL = 1.0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hash(s) {
    let h = 2166136261; s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------ çizimin şarkısı
  function makeSong(id) {
    const seed = hash(id || 'drawing-board'), r = rng(seed);
    const pick = a => a[Math.floor(r() * a.length)];
    const key = pick(KEYS);
    const ia = Math.floor(r() * PROGS.length);
    let ib = Math.floor(r() * (PROGS.length - 1)); if (ib >= ia) ib++;
    // Ostinato: 16 adım, -1 sus, 0..3 akor sesi (kök, üçlü, beşli, oktav).
    const ost = [];
    for (let i = 0; i < 16; i++) {
      if (i === 0) ost.push(0);
      else if (i % 4 === 0) ost.push(Math.floor(r() * 4));
      else if (i % 2 === 0) ost.push(r() < 0.75 ? Math.floor(r() * 4) : -1);
      else ost.push(r() < 0.28 ? Math.floor(r() * 4) : -1);
    }
    // Ezgi: iki ölçülük motif; adımlar pentatonikte, akorun sesinden saparak.
    let p = pick([0, 0, 1, 2]);
    const motif = [pick(RHYTHMS), pick([[0], [0, 6], [0, 8], [2, 8]])].map((steps, bi) => ({
      steps, offs: steps.map((s, i) => (bi === 0 && i === 0 ? p : (p = clamp(p + pick([-2, -1, -1, 1, 1, 2]), -3, 5)))),
    }));
    motif[1].offs[motif[1].offs.length - 1] = 0;   // ikinci ölçü akorun sesine döner
    return { id, seed, key, progs: [PROGS[ia], PROGS[ib]], ost, motif };
  }

  // Gam basamağı → MIDI (base: tonun alt sınırı)
  const degMidi = (song, d, base) => base + song.key + 12 * Math.floor(d / 7) + MAJ[mod(d, 7)];
  function inRange(m, lo, hi) { while (m < lo) m += 12; while (m >= hi) m -= 12; return m; }
  // k: 0 kök, 1 üçlü, 2 beşli, 3 yedili, 4 dokuzlu (üçlü yığını)
  const tone = (song, c, k, lo, hi) => inRange(degMidi(song, c + 2 * k, 48), lo, hi);
  const pentaMidi = (song, i) => 72 + song.key + 12 * Math.floor(i / 5) + MAJ[PENTA[mod(i, 5)]];
  function anchorIdx(c) {   // akorun pentatonikteki sesi: önce üçlü, sonra beşli, sonra kök
    for (const k of [1, 2, 0]) { const j = PENTA.indexOf(mod(c + 2 * k, 7)); if (j >= 0) return j; }
    return 0;
  }
  const melodyMidi = (song, c, off) => inRange(pentaMidi(song, anchorIdx(c) + off), 67, 90);

  // ------------------------------------------------------------ ses grafiği
  // müzik: enstrüman otobüsleri → musicIn → alçak geçiren → musicVol → kompresör
  //        enstrüman gönderileri → musicWet (musicVol'ün eşi) → yankı → kompresör
  // sesler: sfx → sfxVol → kompresör (biraz da yankıya)
  let X = null;
  function makeGraph(ac) {
    const G = { ac };
    G.comp = ac.createDynamicsCompressor();
    G.comp.threshold.value = -14; G.comp.knee.value = 10; G.comp.ratio.value = 3;
    G.comp.attack.value = 0.004; G.comp.release.value = 0.25;
    G.comp.connect(ac.destination);
    G.musicVol = ac.createGain(); G.musicVol.gain.value = 0.0001; G.musicVol.connect(G.comp);
    G.musicLP = ac.createBiquadFilter(); G.musicLP.type = 'lowpass'; G.musicLP.Q.value = 0.4;
    G.musicLP.frequency.value = MODES.build.lp; G.musicLP.connect(G.musicVol);
    G.musicIn = ac.createGain(); G.musicIn.connect(G.musicLP);
    G.verbIn = ac.createGain();
    try {
      const len = Math.floor(ac.sampleRate * 2.4), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) { lp += 0.3 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - i / len, 2.4); }
      }
      const cv = ac.createConvolver(); cv.buffer = ir;
      const ret = ac.createGain(); ret.gain.value = 0.6;
      G.verbIn.connect(cv); cv.connect(ret); ret.connect(G.comp);
    } catch (e) { /* yankısız da olur */ }
    G.musicWet = ac.createGain(); G.musicWet.gain.value = 0.0001; G.musicWet.connect(G.verbIn);
    const bus = (send, dry, wet) => {
      const g = ac.createGain(); g.connect(dry);
      if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(wet); }
      return g;
    };
    G.keys = bus(0.35, G.musicIn, G.musicWet); G.bass = bus(0.03, G.musicIn, G.musicWet);
    G.mallet = bus(0.4, G.musicIn, G.musicWet); G.bell = bus(0.55, G.musicIn, G.musicWet);
    G.drums = bus(0.08, G.musicIn, G.musicWet);
    G.sfxVol = ac.createGain(); G.sfxVol.gain.value = SFX_VOL; G.sfxVol.connect(G.comp);
    G.sfx = bus(0.22, G.sfxVol, G.verbIn);
    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    G.noise = nb;
    return G;
  }

  // ------------------------------------------------------------ çalgılar
  function env(g, t, a, peak, d) {
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function gain(dest) { const g = X.ac.createGain(); g.gain.value = 0; g.connect(dest); return g; }
  function osc(type, f, t, dur, dest, det) {
    const o = X.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function panned(dest, pan) {
    if (!pan || !X.ac.createStereoPanner) return dest;
    const p = X.ac.createStereoPanner(); p.pan.value = pan; p.connect(dest); return p;
  }
  // Yumuşak elektrik piyano: üçgen dalga, kısa ikinci harmonik, kapanan filtre.
  function keys(m, t, v, d, dest) {
    const f = mtof(m), lp = X.ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.2;
    lp.frequency.setValueAtTime(Math.min(10000, f * 10), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 3), t + Math.min(1.2, d));
    lp.connect(dest);
    const g = gain(lp), g2 = gain(lp);
    env(g, t, 0.01, v, d); env(g2, t, 0.004, v * 0.3, Math.min(0.5, d * 0.3));
    osc('triangle', f, t, d + 0.02, g); osc('sine', f * 2, t, Math.min(0.6, d * 0.4), g2, 3);
  }
  // Marimba: sinüs, kısa tokmak sesi (yaklaşık 4. kısmi).
  function mallet(m, t, v, pan, dest) {
    const f = mtof(m), out = panned(dest, pan);
    const g = gain(out), g2 = gain(out), d = Math.min(1.1, 0.35 + 90 / f);
    env(g, t, 0.003, v, d); env(g2, t, 0.002, v * 0.38, 0.07);
    osc('sine', f, t, d, g); osc('sine', f * 3.93, t, 0.1, g2);
  }
  // Ezgi: yumuşak çan.
  function bell(m, t, v, dest, d) {
    const f = mtof(m), g = gain(dest), g2 = gain(dest);
    d = d || 1.5;
    env(g, t, 0.012, v, d); env(g2, t, 0.006, v * 0.22, 0.35);
    osc('sine', f, t, d, g); osc('sine', f * 2.01, t, 0.4, g2);
  }
  function bassNote(m, t, v, d, dest) {
    const f = mtof(m), lp = X.ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 950; lp.connect(dest || X.bass);
    const g = gain(lp), g2 = gain(lp);
    env(g, t, 0.012, v, d); env(g2, t, 0.01, v * 0.5, d * 0.6);
    osc('sine', f, t, d, g); osc('triangle', f * 2, t, d * 0.6, g2);
  }
  function thump(t, v, f0, f1, d, dest) {   // davul ve damga gümlemesi
    const g = gain(dest || X.drums), o = X.ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.5);
    env(g, t, 0.003, v, d); o.connect(g); o.start(t); o.stop(t + d + 0.06);
  }
  function hiss(t, v, d, type, freq, q, dest, f1) {   // süzülmüş gürültü
    const s = X.ac.createBufferSource(); s.buffer = X.noise;
    const f = X.ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d);
    if (q) f.Q.value = q;
    const g = gain(dest || X.drums); env(g, t, Math.min(0.004, d * 0.2), v, d);
    s.loop = true; s.connect(f); f.connect(g); s.start(t, Math.random() * 0.9); s.stop(t + d + 0.08);
  }
  function wood(t, v, f0, dest) {   // tahta tok
    const g = gain(dest || X.drums), o = X.ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + 0.04);
    env(g, t, 0.002, v, 0.06); o.connect(g); o.start(t); o.stop(t + 0.12);
  }

  // ------------------------------------------------------------ zamanlayıcı
  const st = {
    music: true, sfx: true, mode: 'build', want: 'build',
    song: makeSong('rampa'), next: null, bar0: 0, restart: false,
    step: 0, nextT: 0, timer: 0, playing: false, paused: false, dead: false, at: null,
  };
  const chordLog = [];   // [{ t, c, song }] — sesler o anki akoru buradan bulur
  const nowT = () => (st.at != null ? st.at : X.ac.currentTime);

  function chordOf(lbar, song) {
    const loop = Math.floor(lbar / 4), prog = song.progs[mod(loop, 3) === 2 ? 1 : 0];
    return prog[mod(lbar, 4)];
  }

  function schedStep(step, t0) {
    const s = step % 16, bar = Math.floor(step / 16);
    if (s === 0) {
      if (st.next) { st.song = st.next; st.next = null; st.bar0 = bar; }
      else if (st.restart) st.bar0 = bar;
      st.restart = false;
    }
    if (s % 4 === 0 && st.want !== st.mode) st.mode = st.want;   // katmanlar vuruş başında girer
    const song = st.song, M = MODES[st.mode];
    const lbar = bar - st.bar0, loop = Math.floor(lbar / 4);
    const c = chordOf(lbar, song), nc = chordOf(lbar + 1, song);
    const t = t0 + (s & 1 ? SWING * S16 : 0);
    const r = rng(song.seed ^ Math.imul(step + 1, 2654435761));
    if (s === 0) { chordLog.push({ t, c, song }); if (chordLog.length > 8) chordLog.shift(); }
    // piyano
    if (s === 0) {
      const ks = mod(c, 7) === 2 ? [0, 1, 2, 3] : [1, 2, 3, 4];   // iii akorunda dokuzlu yerine kök (b9 olmasın)
      ks.forEach((k, i) => keys(tone(song, c, k, 55, 75), t + i * 0.017 + r() * 0.006, 0.048 + r() * 0.012, 2.8, X.keys));
    } else if (M.stabs && (s === 6 || s === 14) && r() < 0.65) {
      [1, 2, 3].forEach((k, i) => keys(tone(song, c, k, 57, 77), t + i * 0.008, 0.026, 0.42, X.keys));
    } else if (!M.drums && s === 10 && r() < 0.3) {
      [2, 3].forEach((k, i) => keys(tone(song, c, k, 62, 81), t + i * 0.03, 0.022, 1.6, X.keys));
    }
    // bas
    const root = tone(song, c, 0, 36, 48);
    if (s === 0) bassNote(root, t, M.drums ? 0.12 : 0.1, M.drums ? 0.55 : 1.9);
    else if (M.drums && s === 10) bassNote(tone(song, c, 2, 36, 50), t, 0.08, 0.3);
    else if (M.drums && s === 14 && r() < 0.5) bassNote(tone(song, nc, 0, 36, 48) + (r() < 0.5 ? -1 : 2), t, 0.06, 0.2);
    // marimba
    const o = song.ost[s];
    if (o >= 0 && (M.ost >= 1 || (s % 4 === 0 && r() < M.ost))) {
      const m = o === 3 ? tone(song, c, 0, 67, 79) + 12 : tone(song, c, o, 67, 84);
      mallet(m, t, (s % 4 === 0 ? 0.085 : 0.06) * (0.85 + r() * 0.3), s % 8 < 4 ? -0.35 : 0.35, X.mallet);
    }
    // ezgi
    if (M.mel && (M.mel === 1 || mod(loop, 2) === 1)) {
      const mot = song.motif[mod(lbar, 2)], k = mot.steps.indexOf(s);
      if (k >= 0) {
        const last = k === mot.steps.length - 1 && mod(lbar, 2) === 1;
        const off = mot.offs[k] + (mod(loop, 4) === 3 && !last ? 1 : 0);   // dördüncü turda biraz yukarıdan
        bell(melodyMidi(song, c, off), t, 0.065, X.bell, last ? 2.2 : 1.4);
      }
    }
    // davul (makine çalışırken)
    if (M.drums) {
      if (s === 0 || s === 10 || (s === 7 && r() < 0.25)) thump(t, s === 0 ? 0.17 : 0.12, 125, 46, 0.26);
      if (s === 4 || s === 12) wood(t, 0.06, 1150);
      if (s % 2 === 0) hiss(t, s % 4 === 0 ? 0.034 : 0.021, 0.022, 'highpass', 7500);
      else hiss(t, 0.015 + r() * 0.007, 0.05, 'bandpass', 6200, 0.9);
    }
  }

  function tick() {
    if (!X || !st.playing) return;
    const now = X.ac.currentTime;
    if (st.nextT < now) st.nextT = now + 0.04;   // sekme gizliyken geride kaldıysa atla
    while (st.nextT < now + AHEAD) { schedStep(st.step, st.nextT); st.step++; st.nextT += S16; }
  }

  function setParam(p, v, tau) {
    const now = nowT();
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
    else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
    p.setTargetAtTime(v, now, tau);
  }
  function applyMode(m, tau) {
    if (!X) return;
    const M = MODES[m], v = st.music && st.playing ? MUSIC_VOL * M.vol : 0.0001;
    setParam(X.musicLP.frequency, M.lp, tau || 0.35);
    setParam(X.musicVol.gain, v, tau || 0.35); setParam(X.musicWet.gain, v, tau || 0.35);
  }

  function ensure() {
    if (X) return true;
    if (st.dead) return false;
    try {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) { st.dead = true; return false; }
      let ac;
      try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); }
      X = makeGraph(ac);
      return true;
    } catch (e) { st.dead = true; X = null; return false; }
  }
  // iOS bölünmüş (interrupted) bağlamı da dokununca yeniden başlar.
  function resumeCtx() { if (X && X.ac.state !== 'running' && X.ac.state !== 'closed' && X.ac.resume) X.ac.resume().catch(() => {}); }

  function startMusic() {
    if (!X || st.playing) return;
    st.playing = true;
    st.step = Math.ceil(st.step / 16) * 16;   // yeni ölçüden başla
    if (st.next) { st.song = st.next; st.next = null; }
    st.bar0 = st.step / 16; st.restart = false; st.mode = st.want;
    st.nextT = X.ac.currentTime + 0.08;
    applyMode(st.want, 0.9);   // yavaşça gelir
    clearInterval(st.timer); st.timer = setInterval(tick, 25); tick();
  }
  function stopMusic() {
    if (!st.playing) return;
    st.playing = false; clearInterval(st.timer);
    if (X) { setParam(X.musicVol.gain, 0.0001, 0.18); setParam(X.musicWet.gain, 0.0001, 0.18); }
  }

  function harmony() {
    if (X && st.playing) {
      const now = nowT() + 0.03;
      for (let i = chordLog.length - 1; i >= 0; i--) if (chordLog[i].t <= now) return chordLog[i];
    }
    return { c: 0, song: st.next || st.song };
  }

  // ------------------------------------------------------------ sesler (o anki akorda)
  const SFX = {
    place(t, h) { mallet(tone(h.song, h.c, 0, 60, 72), t, 0.2, 0, X.sfx); mallet(tone(h.song, h.c, 2, 64, 79), t + 0.04, 0.12, 0, X.sfx); wood(t, 0.04, 1900, X.sfx); },
    tick(t, h) { mallet(tone(h.song, h.c, 1, 76, 88), t, 0.1, 0, X.sfx); },
    remove(t, h) { mallet(tone(h.song, h.c, 2, 64, 76), t, 0.15, 0, X.sfx); mallet(tone(h.song, h.c, 0, 52, 64), t + 0.07, 0.15, 0, X.sfx); },
    link(t, h) { bell(tone(h.song, h.c, 1, 74, 86), t, 0.11, X.sfx, 0.5); bell(tone(h.song, h.c, 2, 78, 91), t + 0.075, 0.11, X.sfx, 0.7); },
    run(t, h) {
      [0, 1, 2].forEach((k, i) => mallet(tone(h.song, h.c, k, 60, 72), t + i * 0.05, 0.13, 0, X.sfx));
      mallet(tone(h.song, h.c, 0, 60, 72) + 12, t + 0.15, 0.14, 0, X.sfx);
      hiss(t, 0.05, 0.3, 'bandpass', 500, 1.2, X.sfx, 3200);
    },
    stop(t, h) { mallet(tone(h.song, h.c, 2, 60, 72), t, 0.11, 0, X.sfx); mallet(tone(h.song, h.c, 0, 55, 67), t + 0.06, 0.11, 0, X.sfx); },
    piston(t, h) { hiss(t, 0.2, 0.08, 'lowpass', 1300, 0, X.sfx); thump(t, 0.28, mtof(tone(h.song, h.c, 0, 43, 55)) * 2, mtof(tone(h.song, h.c, 0, 43, 55)), 0.16, X.sfx); },
    spring(t, h) {
      const f = mtof(tone(h.song, h.c, 0, 48, 60)), g = gain(X.sfx), o = X.ac.createOscillator();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 4, t + 0.16);
      env(g, t, 0.005, 0.11, 0.32); o.connect(g); o.start(t); o.stop(t + 0.4);
      mallet(tone(h.song, h.c, 0, 48, 60) + 24, t + 0.15, 0.08, 0, X.sfx);
    },
    sensor(t, h) { bell(tone(h.song, h.c, 2, 84, 96), t, 0.07, X.sfx, 0.45); },
    flipper(t, h) { thump(t, 0.22, 220, 90, 0.12, X.sfx); hiss(t, 0.1, 0.05, 'bandpass', 1800, 1, X.sfx); mallet(tone(h.song, h.c, 0, 55, 67), t, 0.13, 0, X.sfx); },
    bumper(t, h) { mallet(tone(h.song, h.c, 2, 76, 88), t, 0.13, 0, X.sfx); bell(tone(h.song, h.c, 1, 84, 96), t + 0.01, 0.06, X.sfx, 0.5); hiss(t, 0.06, 0.03, 'highpass', 4000, 0, X.sfx); },
    gate(t, h) { hiss(t, 0.12, 0.14, 'bandpass', 900, 1.2, X.sfx, 600); mallet(tone(h.song, h.c, 0, 48, 60), t, 0.16, 0, X.sfx); },
    magnet(t, h) {
      const f = mtof(tone(h.song, h.c, 0, 36, 48)) * 2, lp = X.ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(X.sfx);
      const g = gain(lp); env(g, t, 0.03, 0.06, 0.4); osc('sawtooth', f, t, 0.45, g);
      bell(tone(h.song, h.c, 1, 72, 84), t + 0.02, 0.045, X.sfx, 0.6);
    },
    // Çarpma: yükseklik ezginin perdesini, çarpmanın gücü sesini verir (o.h 0..1, o.v 0..1, o.x -1..1).
    hit(t, h, o) {
      const i = Math.round(clamp(o.h, 0, 1) * 9);
      const m = 60 + h.song.key + 12 * Math.floor(i / 5) + MAJ[PENTA[i % 5]];
      mallet(m, t, 0.035 + 0.09 * clamp(o.v, 0, 1), clamp(o.x || 0, -0.7, 0.7), X.sfx);
    },
    // Bir top kovaya girdi: her top bir öncekinden yukarıdan başlar.
    goal(t, h, o) {
      const n = (o && o.n) || 0;
      [0, 1, 2, 3].forEach((k, i) => {
        const kk = k + n, m = tone(h.song, h.c, kk % 3, 72, 84) + 12 * Math.floor(kk / 3);
        mallet(m, t + i * 0.055, 0.12, 0, X.sfx); if (i === 3) bell(m, t + i * 0.055, 0.06, X.sfx, 1);
      });
    },
    fail(t, h) {
      mallet(tone(h.song, h.c, 2, 64, 76), t, 0.12, 0, X.sfx);
      mallet(tone(h.song, h.c, 1, 60, 72), t + 0.12, 0.11, 0, X.sfx);
      bell(tone(h.song, h.c, 0, 50, 62), t + 0.24, 0.08, X.sfx, 0.9);
    },
    // Sonuç penceresi: büyük onay damgası, damgalar, yeni parça.
    approved(t) { thump(t, 0.42, 150, 52, 0.3, X.sfx); hiss(t, 0.22, 0.08, 'lowpass', 1800, 0, X.sfx); },
    stamp(t, h, o) {
      const n = (o && o.n) || 0, fresh = !(o && o.old);
      thump(t, fresh ? 0.26 : 0.14, 190, 70, 0.16, X.sfx); hiss(t, fresh ? 0.14 : 0.07, 0.05, 'lowpass', 2300, 0, X.sfx);
      const m = tone(h.song, h.c, n % 3, 72, 84) + 12 * Math.floor(n / 3);
      mallet(m, t + 0.01, fresh ? 0.14 : 0.07, 0, X.sfx);
    },
    unlock(t, h) {
      for (let i = 0; i < 9; i++) mallet(inRange(pentaMidi(h.song, i), 67, 100) + (i >= 5 ? 12 : 0), t + i * 0.045, 0.09 + i * 0.006, (i % 2 ? 0.4 : -0.4), X.sfx);
      [0, 1, 2, 4].forEach((k, i) => bell(tone(h.song, h.c, k, 72, 86), t + 0.42 + i * 0.02, 0.06, X.sfx, 2.2));
      hiss(t + 0.35, 0.03, 1.3, 'highpass', 6500, 0, X.sfx);
    },
    // Makine çalıştı: o anki akorda hızlı arpej, ardından müzik yeni bir ölçüden I ile başlar.
    win(t, h) {
      const cs = [0, 1, 2];
      for (let i = 0; i < 6; i++) {
        const k = cs[i % 3], m = tone(h.song, h.c, k, 67, 79) + 12 * Math.floor(i / 3);
        mallet(m, t + i * S16 * 0.5, 0.12, (i % 2 ? 0.3 : -0.3), X.sfx);
        if (i >= 3) bell(m, t + i * S16 * 0.5, 0.05, X.sfx, 1.6);
      }
      [1, 2, 3].forEach((k, i) => keys(tone(h.song, h.c, k, 57, 77), t + 0.02 + i * 0.012, 0.05, 2.2, X.sfx));
      thump(t, 0.26, 125, 46, 0.3, X.sfx);
      hiss(t, 0.045, 1.5, 'highpass', 5200, 0, X.sfx);
      st.restart = true;
    },
  };

  // ------------------------------------------------------------ dışarıya açılan
  const A = {
    state: st,
    // Kullanıcı dokununca çağrılır (tarayıcı sesi ancak böyle açar).
    unlock() {
      if (!st.music && !st.sfx) return;
      if (!ensure()) return;
      resumeCtx();
      if (st.music && !st.playing && !st.paused) startMusic();
    },
    prefs(music, sfx) { st.music = !!music; st.sfx = !!sfx; },
    setMusic(on) {
      st.music = !!on;
      if (on) { if (ensure()) { resumeCtx(); startMusic(); } } else stopMusic();
    },
    setSfx(on) { st.sfx = !!on; },
    setLevel(id) {
      if (st.song.id === id && !st.next) return;
      const s = makeSong(id);
      if (st.playing) st.next = s; else { st.song = s; st.next = null; }
    },
    setMode(m) {
      if (!MODES[m]) return;
      st.want = m; if (!st.playing) st.mode = m;
      applyMode(m);
    },
    pause() {
      if (!X) return;
      st.paused = st.playing; stopMusic();
      if (X.ac.suspend) X.ac.suspend().catch(() => {});
    },
    resume() {
      if (!X) return;
      resumeCtx();
      if (st.paused && st.music) { st.paused = false; startMusic(); }
      st.paused = false;
    },
    play(name, o) {
      if (!st.sfx || !SFX[name] || !ensure()) return;
      resumeCtx();
      try { SFX[name](nowT() + 0.004, harmony(), o || {}); } catch (e) { /* ses opsiyonel */ }
    },
    // Testler: müziği (ve istenen sesleri) çevrimdışı çalar. script: [{ t, mode } | { t, level } | { t, sfx, o }]
    render(secs, script, sr) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const ac = new OAC(2, Math.ceil(secs * (sr || 44100)), sr || 44100);
      const keep = { X, st: Object.assign({}, st), log: chordLog.slice() };
      X = makeGraph(ac);
      Object.assign(st, { music: true, sfx: true, playing: true, step: 0, bar0: 0, nextT: 0.05, mode: 'build', want: 'build', next: null, restart: false });
      chordLog.length = 0;
      st.at = 0; applyMode('build', 0.01);
      const ev = (script || []).slice().sort((a, b) => a.t - b.t);
      let ei = 0;
      while (st.nextT < secs) {
        while (ei < ev.length && ev[ei].t <= st.nextT) {
          const e = ev[ei++]; st.at = e.t;
          if (e.level) A.setLevel(e.level);
          if (e.mode) A.setMode(e.mode);
          if (e.sfx) SFX[e.sfx](e.t, harmony(), e.o || {});
        }
        st.at = st.nextT; schedStep(st.step, st.nextT); st.step++; st.nextT += S16;
      }
      X = keep.X; Object.assign(st, keep.st); chordLog.length = 0; chordLog.push(...keep.log);
      return ac.startRendering();
    },
    _song: makeSong,
  };
  return A;
}));
