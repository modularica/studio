// ---------------------------------------------------------------------------
// Sound: everything is synthesised with WebAudio, so there are no files.
// These are placeholders until the studio's own music and effects arrive.
// ---------------------------------------------------------------------------

const Sound = {
  ctx: null, master: null, music: null, wind: null, noiseBuf: null,
  on: true, step: 0, nextAt: 0, playing: false, rich: false,

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = this.on ? 0.9 : 0; this.master.connect(c.destination);
        this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
        const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch (e) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05);
  },

  tone(f, dur, o) {
    const c = this.ctx; if (!c || !this.on) return;
    o = o || {};
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
    node.connect(g); g.connect(o.bus || this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },

  noise(dur, o) {
    const c = this.ctx; if (!c || !this.on) return;
    o = o || {};
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.freq || 800; f.Q.value = o.q || 0.7;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = c.createGain(), v = o.vol == null ? 0.15 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  },

  play(name) {
    if (!this.ctx || !this.on) return;
    switch (name) {
      case 'arrive': this.tone(988, 0.5, { vol: 0.09, type: 'triangle' }); this.tone(1319, 0.7, { vol: 0.07, type: 'triangle', delay: 0.12 }); break;
      case 'place': this.noise(0.25, { freq: 900, to: 300, vol: 0.12 }); this.tone(330, 0.3, { vol: 0.08, to: 260 }); break;
      case 'tuck': this.noise(0.22, { freq: 1400, to: 400, vol: 0.12 }); this.tone(523, 0.25, { vol: 0.05, delay: 0.05 }); break;
      case 'slip': this.noise(0.18, { freq: 600, to: 1500, vol: 0.06 }); break;
      case 'roll': this.tone(180, 0.3, { vol: 0.1, type: 'triangle', to: 120 }); this.noise(0.2, { freq: 700, vol: 0.06, delay: 0.1 }); break;
      case 'log': this.tone(95, 0.22, { vol: 0.25, to: 60 }); this.noise(0.5, { freq: 3000, type: 'highpass', vol: 0.05, delay: 0.05 }); break;
      case 'tok': for (let k = 0; k < 3; k++) this.tone(1050, 0.06, { vol: 0.12, type: 'triangle', delay: k * 0.09 }); break;
      case 'shoo': for (let k = 0; k < 4; k++) this.noise(0.06, { freq: 2200, type: 'bandpass', q: 2, vol: 0.12, delay: k * 0.05 }); break;
      case 'hoot': this.tone(392, 0.35, { vol: 0.08, to: 370 }); this.tone(392, 0.5, { vol: 0.07, delay: 0.4, to: 350 }); break;
      case 'snore': this.tone(75, 0.9, { vol: 0.13, type: 'sawtooth', lp: 260, attack: 0.3, to: 60 }); this.noise(0.9, { freq: 400, vol: 0.05, attack: 0.3 }); break;
      case 'woke': this.tone(300, 0.4, { vol: 0.12, type: 'square', lp: 900, to: 160 }); this.tone(200, 0.5, { vol: 0.1, type: 'square', lp: 700, delay: 0.25, to: 110 }); break;
      case 'coin': this.tone(1568, 0.16, { vol: 0.07, type: 'triangle' }); this.tone(2093, 0.22, { vol: 0.06, type: 'triangle', delay: 0.06 }); break;
      case 'heart': this.tone(880, 0.3, { vol: 0.05 }); break;
      case 'buy': [784, 988, 1175].forEach((f, k) => this.tone(f, 0.35, { vol: 0.08, type: 'triangle', delay: k * 0.08 })); break;
      case 'dig': this.noise(0.3, { freq: 500, vol: 0.18 }); this.noise(0.25, { freq: 450, vol: 0.15, delay: 0.25 }); break;
      case 'build': for (let k = 0; k < 3; k++) this.tone(220 + k * 30, 0.1, { vol: 0.16, type: 'triangle', delay: k * 0.13 }); break;
      case 'no': this.tone(220, 0.18, { vol: 0.08, type: 'triangle', to: 190 }); break;
      case 'season': [523, 659, 784, 1047].forEach((f, k) => this.tone(f, 0.8, { vol: 0.05, type: 'triangle', delay: k * 0.12 })); break;
      case 'ayaz': this.noise(2.4, { freq: 500, to: 1400, type: 'bandpass', q: 1.5, vol: 0.14, attack: 0.8 }); break;
      case 'leave': this.tone(440, 0.25, { vol: 0.05, to: 330 }); break;
    }
  },

  // Winter: soft wind plus a music-box lullaby. Called every frame.
  tick(phase, rich) {
    const c = this.ctx; if (!c) return;
    const want = phase === 'winter';
    if (want !== this.playing) {
      this.playing = want;
      this.music.gain.setTargetAtTime(want ? 1 : 0, c.currentTime, want ? 0.6 : 0.3);
      if (want) { this.step = 0; this.nextAt = c.currentTime + 0.3; this.startWind(); } else this.stopWind();
    }
    this.rich = rich;
    if (!want || !this.on) return;
    const beat = 60 / 76 / 2;
    while (this.nextAt < c.currentTime + 0.2) {
      const k = this.step % LULLABY.length, n = LULLABY[k];
      const delay = Math.max(0, this.nextAt - c.currentTime);
      if (n) this.box(n, delay, 0.05);
      if (k % 8 === 0) {
        const b = LULLABY_BASS[(k / 8) % LULLABY_BASS.length];
        this.box(b, delay, this.rich ? 0.05 : 0.03);
        if (this.rich) this.box(b + 7, delay + beat, 0.025);
      }
      if (this.rich && n && k % 4 === 2) this.box(n - 5, delay, 0.02);
      this.step++; this.nextAt += beat;
    }
  },
  box(midi, delay, vol) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    this.tone(f, 1.4, { vol, delay, bus: this.music, attack: 0.004 });
    this.tone(f * 2, 0.6, { vol: vol * 0.3, delay, bus: this.music, attack: 0.004 });
    this.tone(f * 3.01, 0.25, { vol: vol * 0.12, delay, bus: this.music, attack: 0.002 });
  },
  startWind() {
    const c = this.ctx; if (!c || this.wind) return;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.9;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.035, c.currentTime, 1.2);
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.wind = { src, g, lfo };
  },
  stopWind() {
    const w = this.wind; if (!w) return;
    this.wind = null;
    const t = this.ctx.currentTime;
    w.g.gain.setTargetAtTime(0.0001, t, 0.4);
    w.src.stop(t + 1.6); w.lfo.stop(t + 1.6);
  },
};

// An original eight-bar lullaby in C major, one entry per half beat.
const LULLABY = [
  64, null, 67, null, 69, 67, 64, null,
  62, null, 64, null, 60, null, null, null,
  64, null, 67, null, 69, 72, 71, null,
  69, null, 67, null, 67, null, null, null,
  72, null, 71, null, 69, 67, 64, null,
  65, null, 64, null, 62, null, null, null,
  64, null, 62, null, 60, 62, 64, null,
  62, null, 60, null, 60, null, null, null,
];
const LULLABY_BASS = [48, 43, 45, 43, 41, 43, 48, 43];
