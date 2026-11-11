// Kelime Tenisi sesleri: hepsi WebAudio ile üretilir, ses dosyası yok.
const Sfx = (function () {
  let ctx = null, master = null, noiseBuf = null, enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 2);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, at, dur, type, vol, glideTo) {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.02);
  }

  function noise(at, dur, vol, ftype, f0, f1, q, attack) {
    const c = ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = ftype || 'bandpass';
    f.frequency.setValueAtTime(f0, at);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    f.Q.value = q || 1;
    const a = attack || 0.005;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(at, Math.random() * 1.2); s.stop(at + dur + 0.02);
  }

  function now() { const c = ensure(); return c ? c.currentTime + 0.005 : null; }

  return {
    unlock() { ensure(); },
    setEnabled(v) { enabled = !!v; if (!enabled && ctx) ctx.suspend(); else if (enabled) ensure(); },
    get enabled() { return enabled; },
    // racket on ball: short pitched "pok" + a little string noise
    hit(strength) {
      const t = now(); if (t === null) return;
      const s = strength || 1;
      tone(520 * (0.9 + 0.2 * Math.random()), t, 0.08, 'sine', 0.42 * s, 170);
      tone(1250, t, 0.03, 'triangle', 0.08 * s, 900);
      noise(t, 0.04, 0.22 * s, 'bandpass', 3200, 1800, 1.2);
    },
    bounce() {
      const t = now(); if (t === null) return;
      tone(300, t, 0.07, 'sine', 0.18, 140);
      noise(t, 0.03, 0.06, 'lowpass', 900, 500, 0.7);
    },
    serve() {
      const t = now(); if (t === null) return;
      noise(t, 0.18, 0.08, 'bandpass', 900, 2400, 1.5, 0.05);
      tone(560, t + 0.12, 0.08, 'sine', 0.38, 180);
    },
    tap() { const t = now(); if (t === null) return; tone(880, t, 0.035, 'triangle', 0.06); },
    key() { const t = now(); if (t === null) return; tone(620 + Math.random() * 60, t, 0.03, 'triangle', 0.05); },
    err() {
      const t = now(); if (t === null) return;
      tone(190, t, 0.12, 'square', 0.05, 150);
      tone(150, t + 0.09, 0.16, 'square', 0.05, 110);
    },
    tick(urgent) { const t = now(); if (t === null) return; tone(urgent ? 1500 : 1150, t, 0.035, 'square', urgent ? 0.05 : 0.03); },
    smash() {
      const t = now(); if (t === null) return;
      noise(t, 0.22, 0.16, 'bandpass', 600, 3800, 1.2, 0.08);
      tone(420, t + 0.16, 0.12, 'sine', 0.6, 120);
      noise(t + 0.16, 0.06, 0.3, 'bandpass', 2600, 1400, 1);
      tone(784, t + 0.32, 0.18, 'triangle', 0.12);
      tone(1175, t + 0.42, 0.28, 'triangle', 0.1);
    },
    miss() {
      const t = now(); if (t === null) return;
      tone(140, t, 0.22, 'sine', 0.3, 70);
      noise(t, 0.5, 0.05, 'lowpass', 700, 300, 0.7, 0.12);   // crowd "ooh"
    },
    point(good) {
      const t = now(); if (t === null) return;
      noise(t, 0.9, 0.06, 'bandpass', 700, 1100, 0.6, 0.25); // crowd
      if (good) { tone(659, t + 0.05, 0.16, 'triangle', 0.12); tone(988, t + 0.17, 0.26, 'triangle', 0.1); }
    },
    game() {
      const t = now(); if (t === null) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.22, 'triangle', 0.12));
      noise(t + 0.1, 1.1, 0.07, 'bandpass', 900, 1300, 0.5, 0.3);
    },
    match() {
      const t = now(); if (t === null) return;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.3, 'triangle', 0.12));
      for (let i = 0; i < 26; i++) noise(t + 0.2 + i * 0.055 + Math.random() * 0.03, 0.05, 0.08 + Math.random() * 0.05, 'bandpass', 1500 + Math.random() * 1500, null, 0.8);
    },
  };
})();
