// Kelime Düellosu sesleri: hepsi WebAudio ile üretilir, ses dosyası yok.
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
    // the word leaves: a soft swish and a "pop"
    send() {
      const t = now(); if (t === null) return;
      noise(t, 0.12, 0.07, 'bandpass', 1200, 3200, 1.4, 0.03);
      tone(560 * (0.92 + 0.16 * Math.random()), t + 0.04, 0.09, 'sine', 0.32, 260);
    },
    // the word lands in front of the other player
    land() {
      const t = now(); if (t === null) return;
      tone(420, t, 0.06, 'triangle', 0.1, 300);
    },
    // the first word of a point
    start() {
      const t = now(); if (t === null) return;
      noise(t, 0.18, 0.07, 'bandpass', 900, 2400, 1.5, 0.05);
      tone(523, t + 0.1, 0.1, 'triangle', 0.16);
      tone(659, t + 0.18, 0.14, 'triangle', 0.14);
    },
    tap() { const t = now(); if (t === null) return; tone(880, t, 0.035, 'triangle', 0.06); },
    key() { const t = now(); if (t === null) return; tone(620 + Math.random() * 60, t, 0.03, 'triangle', 0.05); },
    err() {
      const t = now(); if (t === null) return;
      tone(190, t, 0.12, 'square', 0.05, 150);
      tone(150, t + 0.09, 0.16, 'square', 0.05, 110);
    },
    tick(urgent) { const t = now(); if (t === null) return; tone(urgent ? 1500 : 1150, t, 0.035, 'square', urgent ? 0.05 : 0.03); },
    // a word with no way out
    deadEnd() {
      const t = now(); if (t === null) return;
      noise(t, 0.2, 0.12, 'bandpass', 600, 3800, 1.2, 0.06);
      tone(392, t + 0.12, 0.12, 'triangle', 0.2);
      tone(587, t + 0.22, 0.14, 'triangle', 0.18);
      tone(784, t + 0.32, 0.18, 'triangle', 0.14);
      tone(1175, t + 0.44, 0.3, 'triangle', 0.1);
    },
    timeUp() {
      const t = now(); if (t === null) return;
      tone(196, t, 0.18, 'triangle', 0.22, 130);
      tone(147, t + 0.16, 0.26, 'triangle', 0.18, 98);
    },
    point(good) {
      const t = now(); if (t === null) return;
      if (good) { tone(659, t + 0.05, 0.16, 'triangle', 0.12); tone(988, t + 0.17, 0.26, 'triangle', 0.1); }
      else tone(440, t + 0.05, 0.2, 'triangle', 0.08, 392);
    },
    win() {
      const t = now(); if (t === null) return;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.3, 'triangle', 0.12));
      for (let i = 0; i < 10; i++) tone(1568 + Math.random() * 1200, t + 0.8 + i * 0.07, 0.08, 'sine', 0.03);
    },
  };
})();
