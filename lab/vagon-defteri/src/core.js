// Vagon Defteri çekirdeği: DOM yok, Node'da da çalışır (test/core.test.js).
//   - sarsıntı ölçer (ivme ölçerden ani sarsıntı pencereleri + titreşim düzeyi)
//   - çizgi temizleme (sarsıntı anındaki sıçramayı atıp iki ucu birleştirir)
//   - yumuşatma, sadeleştirme, kodlama
//   - durak sezici (titreşim düşünce "durdu", artınca "kalktı")
//   - Marmaray istasyonları
(function (root) {
  'use strict';

  var PAGE_W = 1200, PAGE_H = 2000;   // 3:5, telefonun dikey ekranına yakın

  // Ayarlar: Marmaray kayıtlarına bakıp buradan düzeltilecek.
  var TUNE = {
    // sarsıntı: yüksek geçiren süzgeç (Hz) ve eşikler (m/s²)
    joltHp: 1.5,
    joltLevels: {                 // ayarlardaki "Sarsıntı süzgeci"
      az:   { min: 2.4, k: 5.0 },
      orta: { min: 1.6, k: 4.0 },
      cok:  { min: 0.8, k: 2.6 },
    },
    joltRelease: 0.55,            // eşiğin bu katının altına inince pencere kapanır
    joltBaseTau: 4,               // taban titreşim ortalaması (sn)
    // temizleme: parmak sarsıntıya geç tepki verir, toparlanması da sürer
    pre: 30, post: 170,           // ms
    maxWindow: 650,               // bundan uzun sarsıntıda çizgi silinmez (uzun sarsıntılı yol)
    spike: 2.4,                   // uçlardaki parça: hız ortancanın bu katını geçerse atılır
    // durak: titreşimin yüksek frekanslı kısmı (el hareketi değil, tren)
    vibHp: 6,
    vibTau: 1.5,
    stopRatio: 0.38, goRatio: 0.62,
    stopAbs: 0.035,               // m/s²: bunun altı her zaman "duruyor"
    stopHold: 6, goHold: 3,       // sn
    minMove: 25,                  // sn: iki durak arası en az bu kadar gidilmiş olmalı
    levelTau: 90,                 // "giderken" titreşim düzeyinin ortalaması (sn)
  };

  /* ---------------- Marmaray ---------------- */
  var LINES = {
    marmaray: {
      name: 'Marmaray',
      ends: ['Gebze', 'Halkalı'],
      stations: ['Gebze', 'Darıca', 'Osmangazi', 'Fatih', 'Çayırova', 'Tuzla', 'İçmeler', 'Aydıntepe',
        'Güzelyalı', 'Tersane', 'Kaynarca', 'Pendik', 'Yunus', 'Kartal', 'Başak', 'Atalar', 'Cevizli',
        'Maltepe', 'Süreyya Plajı', 'İdealtepe', 'Küçükyalı', 'Bostancı', 'Suadiye', 'Erenköy', 'Göztepe',
        'Feneryolu', 'Söğütlüçeşme', 'Ayrılık Çeşmesi', 'Üsküdar', 'Sirkeci', 'Yenikapı', 'Kazlıçeşme',
        'Zeytinburnu', 'Yenimahalle', 'Bakırköy', 'Ataköy', 'Yeşilyurt', 'Yeşilköy', 'Florya Akvaryum',
        'Florya', 'Küçükçekmece', 'Mustafa Kemal', 'Halkalı'],
    },
  };

  // Yolculuk: { line, at (şu anki ya da son geçilen durağın sırası), dir (+1 Halkalı, -1 Gebze), moving }
  function tripStation(trip, i) {
    var L = LINES[trip.line];
    if (!L) return 'Durak ' + (i + 1);
    return L.stations[i] || null;
  }
  function tripNext(trip) {
    var L = LINES[trip.line];
    var n = trip.at + trip.dir;
    if (!L) return n;
    return n >= 0 && n < L.stations.length ? n : null;
  }
  // Sayfa başlığı: duraktayken "Göztepe", yoldayken "Göztepe → Feneryolu"
  function tripTitle(trip) {
    if (!trip) return '';
    var a = tripStation(trip, trip.at);
    var n = tripNext(trip);
    if (!trip.moving || n == null) return a;
    return a + ' → ' + tripStation(trip, n);
  }

  /* ---------------- birinci dereceden süzgeçler ---------------- */
  function HighPass(fc) { this.fc = fc; this.prevX = null; this.y = 0; }
  HighPass.prototype.push = function (x, dt) {
    if (this.prevX === null) { this.prevX = x; this.y = 0; return 0; }
    var rc = 1 / (2 * Math.PI * this.fc), a = rc / (rc + dt);
    this.y = a * (this.y + x - this.prevX);
    this.prevX = x;
    return this.y;
  };

  /* ---------------- sarsıntı ölçer ----------------
   * push(t ms, ax, ay, az) -> { m, thr, jolt, vib }
   *  m    ani sarsıntı ölçüsü (yüksek geçirilmiş, ekran düzlemi ağırlıklı)
   *  vib  titreşim düzeyi (6 Hz üstü, durak sezmek için)
   */
  function MotionMeter(level) {
    this.setLevel(level || 'orta');
    this.hp = [new HighPass(TUNE.joltHp), new HighPass(TUNE.joltHp), new HighPass(TUNE.joltHp)];
    // titreşim: iki kat yüksek geçiren (el hareketi 1–3 Hz, tren 6 Hz üstü)
    this.hv = [0, 1, 2, 3, 4, 5].map(function () { return new HighPass(TUNE.vibHp); });
    this.base2 = 0.05;            // taban m² (ilk değer: sakin bir tren)
    this.vib2 = 0;
    this.lastT = null;
    this.open = null;             // açık sarsıntı penceresi
    this.below = 0;
    this.windows = [];            // { t0, t1, peak } son birkaç saniye
    this.samples = 0;
  }
  MotionMeter.prototype.setLevel = function (level) {
    this.level = TUNE.joltLevels[level] ? level : 'orta';
    this.cfg = TUNE.joltLevels[this.level];
  };
  MotionMeter.prototype.push = function (t, ax, ay, az) {
    var dt = this.lastT === null ? 1 / 60 : Math.max(0.002, Math.min(0.2, (t - this.lastT) / 1000));
    this.lastT = t;
    this.samples++;
    var hx = this.hp[0].push(ax, dt), hy = this.hp[1].push(ay, dt), hz = this.hp[2].push(az, dt);
    var m = Math.sqrt(hx * hx + hy * hy + 0.5 * hz * hz);
    var hv = this.hv;
    var vx = hv[3].push(hv[0].push(ax, dt), dt), vy = hv[4].push(hv[1].push(ay, dt), dt), vz = hv[5].push(hv[2].push(az, dt), dt);
    var v2 = vx * vx + vy * vy + vz * vz;
    var av = 1 - Math.exp(-dt / TUNE.vibTau);
    this.vib2 += av * (v2 - this.vib2);

    var rms = Math.sqrt(this.base2);
    var thr = Math.max(this.cfg.min, this.cfg.k * rms);
    var jolt = false;
    if (this.open) {
      this.open.peak = Math.max(this.open.peak, m);
      if (m < thr * TUNE.joltRelease) {
        if (++this.below >= 2) { this.open.t1 = t; this.open = null; }
        else jolt = true;
      } else { this.below = 0; jolt = true; }
      if (this.open) this.open.t1 = t;
    } else if (m > thr && this.samples > 20) {
      this.open = { t0: t, t1: t, peak: m };
      this.windows.push(this.open);
      this.below = 0;
      jolt = true;
    }
    // taban: sarsıntı anları ortalamayı şişirmesin
    if (!jolt) {
      var ab = 1 - Math.exp(-dt / TUNE.joltBaseTau);
      this.base2 += ab * (Math.min(m * m, 4 * this.base2 + 0.02) - this.base2);
    }
    while (this.windows.length && this.windows[0].t1 < t - 15000) this.windows.shift();
    return { m: m, thr: thr, jolt: jolt, vib: Math.sqrt(this.vib2) };
  };
  // [t0, t1] aralığına değen pencereler (açık olan da dahil)
  MotionMeter.prototype.windowsIn = function (t0, t1) {
    var out = [];
    for (var i = 0; i < this.windows.length; i++) {
      var w = this.windows[i];
      if (w.t1 + TUNE.post >= t0 && w.t0 - TUNE.pre <= t1) out.push({ t0: w.t0, t1: w.t1, open: w === this.open });
    }
    return out;
  };

  /* ---------------- geometri ---------------- */
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    var u = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
    u = Math.max(0, Math.min(1, u));
    var x = a.x + u * dx - p.x, y = a.y + u * dy - p.y;
    return Math.sqrt(x * x + y * y);
  }
  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[s.length >> 1];
  }
  function speeds(pts) {
    var v = [];
    for (var i = 1; i < pts.length; i++) {
      var dt = Math.max(4, pts[i].t - pts[i - 1].t);
      v.push(dist(pts[i], pts[i - 1]) / dt);
    }
    return v;
  }
  // i noktasındaki yön, k nokta geriye (dir=-1) ya da ileriye (dir=+1) bakarak
  function tangent(pts, i, dir, lo, hi) {
    var j = i, steps = 0, a = pts[i];
    while (steps < 4) {
      var n = j + dir;
      if (n < lo || n > hi) break;
      j = n; steps++;
      if (dist(pts[j], a) > 18) break;
    }
    if (j === i) return { x: 0, y: 0 };
    var b = pts[j], L = dist(a, b) || 1;
    // ileriye doğru birim yön
    return dir < 0 ? { x: (a.x - b.x) / L, y: (a.y - b.y) / L } : { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  }
  function hermite(p0, m0, p1, m1, n) {
    var out = [];
    for (var k = 1; k < n; k++) {
      var s = k / n, s2 = s * s, s3 = s2 * s;
      var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      out.push({
        x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
        y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
        t: p0.t + s * (p1.t - p0.t), bridge: true,
      });
    }
    return out;
  }

  /* ---------------- çizgi temizleme ----------------
   * pts: [{x, y, t}] sayfa birimi + ms, windows: [{t0, t1, open}]
   * opt.minDev: sayfa biriminde "sapma" eşiği (ekranda ~3 px)
   * opt.live: çizim sürüyor; açık pencereden sonrası şimdilik gösterilmez
   * -> { pts, fixes: [{ a, b }] (temiz dizide köprü aralığı), held }
   */
  function cleanStroke(pts, windows, opt) {
    opt = opt || {};
    var minDev = opt.minDev || 8;
    var n = pts.length;
    if (n < 2 || !windows || !windows.length) return { pts: pts.slice(), fixes: [], held: 0 };
    var bad = new Uint8Array(n), any = false, held = 0;
    for (var w = 0; w < windows.length; w++) {
      var W = windows[w];
      if (W.t1 - W.t0 > TUNE.maxWindow && !W.open) continue;
      var a = W.t0 - TUNE.pre, b = W.open ? Infinity : W.t1 + TUNE.post;
      for (var i = 0; i < n; i++) if (pts[i].t >= a && pts[i].t <= b) { bad[i] = W.open ? 2 : 1; any = true; }
    }
    if (!any) return { pts: pts.slice(), fixes: [], held: 0 };

    var v = speeds(pts), med = median(v) || 0.01;
    var out = [], fixes = [];
    var i0 = 0;
    while (i0 < n) {
      if (!bad[i0]) { out.push(pts[i0]); i0++; continue; }
      var i1 = i0;
      while (i1 + 1 < n && bad[i1 + 1]) i1++;
      var open = false;
      for (var q = i0; q <= i1; q++) if (bad[q] === 2) open = true;
      var hasBefore = i0 > 0, hasAfter = i1 < n - 1;
      if (!hasAfter) {
        // uç kısım (çizim bitti ya da sarsıntı sürüyor)
        if (open && opt.live) { held = i1 - i0 + 1; break; }
        if (!hasBefore || spiky(pts, v, i0, i1, med)) { if (hasBefore) fixes.push({ a: out.length - 1, b: out.length - 1, cut: true }); break; }
        for (var r = i0; r <= i1; r++) out.push(pts[r]);
        break;
      }
      if (!hasBefore) {
        // baştaki kısım: sıçrama varsa at, çizgi sarsıntıdan sonra başlasın
        if (spiky(pts, v, i0, i1 + 1, med) && (n - i1 - 1) >= 2) { i0 = i1 + 1; continue; }
        for (var s = i0; s <= i1; s++) out.push(pts[s]);
        i0 = i1 + 1; continue;
      }
      var P0 = pts[i0 - 1], P1 = pts[i1 + 1], dev = 0;
      for (var k = i0; k <= i1; k++) dev = Math.max(dev, segDist(pts[k], P0, P1));
      if (dev < minDev) {
        for (var z = i0; z <= i1; z++) out.push(pts[z]);
      } else {
        var chord = dist(P0, P1);
        var t0 = tangent(pts, i0 - 1, -1, 0, i0 - 1), t1 = tangent(pts, i1 + 1, +1, i1 + 1, n - 1);
        var sc = chord * 0.9;
        var m0 = { x: t0.x * sc, y: t0.y * sc }, m1 = { x: t1.x * sc, y: t1.y * sc };
        var steps = Math.max(2, Math.ceil(chord / 4));
        var br = hermite(P0, m0, P1, m1, steps);
        var a0 = out.length - 1;
        for (var bI = 0; bI < br.length; bI++) out.push(br[bI]);
        fixes.push({ a: a0, b: out.length, dev: dev });
      }
      i0 = i1 + 1;
    }
    return { pts: out, fixes: fixes, held: held };
  }
  // Uçtaki sarsıntı parçası gerçekten sıçramış mı: hız birden artmış ya da yön birden dönmüş mü?
  function spiky(pts, v, i0, i1, med) {
    var mx = 0;
    for (var i = Math.max(0, i0 - 1); i <= Math.min(v.length - 1, i1); i++) mx = Math.max(mx, v[i]);
    if (mx > TUNE.spike * med && mx > 0.25) return true;     // 0.25 birim/ms ≈ telefonda hızlı bir kayma
    // yön: 4 birim aralıklı noktalarla, çizginin geri kalanındaki dönüşle karşılaştır
    var lo = Math.max(0, i0 - 4), hi = Math.min(pts.length - 1, i1);
    var part = resample(pts.slice(lo, hi + 1), 4), all = resample(pts, 4);
    var turnMax = maxTurn(part, false), turnMed = maxTurn(all, true);
    return turnMax > Math.max(0.5, 4 * turnMed);
  }
  // 8 birimlik kirişlerle yön değişimi (köşe iki ara noktaya bölünmesin)
  function maxTurn(p, med) {
    var t = [];
    for (var i = 2; i + 2 < p.length; i++) {
      var a = Math.atan2(p[i].y - p[i - 2].y, p[i].x - p[i - 2].x);
      var b = Math.atan2(p[i + 2].y - p[i].y, p[i + 2].x - p[i].x);
      var d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d;
      t.push(d);
    }
    if (!t.length) return 0;
    return med ? median(t) : Math.max.apply(null, t);
  }

  /* ---------------- yumuşatma ve sadeleştirme ---------------- */
  function resample(pts, step) {
    if (pts.length < 2) return pts.slice();
    var out = [pts[0]], acc = 0, prev = pts[0];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], d = dist(prev, p);
      while (acc + d >= step) {
        var u = (step - acc) / d;
        var q = { x: prev.x + (p.x - prev.x) * u, y: prev.y + (p.y - prev.y) * u, t: prev.t + (p.t - prev.t) * u };
        out.push(q);
        prev = q; d = dist(prev, p); acc = 0;
      }
      acc += d; prev = p;
    }
    var last = pts[pts.length - 1];
    if (dist(out[out.length - 1], last) > 0.01) out.push(last);
    return out;
  }
  // r: kaç örnek yanına bakılsın (0 = kapalı). Uçlar yerinde kalır.
  function smooth(pts, r) {
    if (!r || pts.length < 3) return pts.slice();
    var rs = resample(pts, 2.5);
    var n = rs.length, out = new Array(n);
    for (var i = 0; i < n; i++) {
      var k = Math.min(r, i, n - 1 - i);
      var sx = 0, sy = 0, sw = 0;
      for (var j = -k; j <= k; j++) {
        var w = 1 - Math.abs(j) / (k + 1);
        sx += rs[i + j].x * w; sy += rs[i + j].y * w; sw += w;
      }
      out[i] = { x: sx / sw, y: sy / sw, t: rs[i].t };
    }
    return out;
  }
  // Ramer–Douglas–Peucker
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    var stack = [[0, pts.length - 1]];
    while (stack.length) {
      var s = stack.pop(), a = s[0], b = s[1], idx = -1, md = eps;
      for (var i = a + 1; i < b; i++) {
        var d = segDist(pts[i], pts[a], pts[b]);
        if (d > md) { md = d; idx = i; }
      }
      if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    var out = [];
    for (var j = 0; j < pts.length; j++) if (keep[j]) out.push(pts[j]);
    return out;
  }
  // kayıt biçimi: yarım birim tamsayı, farklar
  function encode(pts) {
    var out = [], px = 0, py = 0;
    for (var i = 0; i < pts.length; i++) {
      var x = Math.round(pts[i].x * 2), y = Math.round(pts[i].y * 2);
      out.push(x - px, y - py); px = x; py = y;
    }
    return out;
  }
  function decode(arr) {
    var pts = [], x = 0, y = 0;
    for (var i = 0; i + 1 < arr.length; i += 2) { x += arr[i]; y += arr[i + 1]; pts.push({ x: x / 2, y: y / 2 }); }
    return pts;
  }

  /* ---------------- durak sezici ----------------
   * push(t ms, vib) -> 'stop' | 'go' | null
   */
  function StopDetector() {
    this.state = 'unknown';       // unknown | moving | stopped
    this.level = null;            // giderken tipik titreşim
    this.since = null;            // durum ne zamandır
    this.cand = null; this.candT = 0;
    this.lastT = null;
    this.warm = 0;
  }
  StopDetector.prototype.push = function (t, vib) {
    var dt = this.lastT === null ? 0.1 : Math.max(0.01, Math.min(2, (t - this.lastT) / 1000));
    this.lastT = t;
    this.warm += dt;
    if (this.level === null) this.level = Math.max(vib, TUNE.stopAbs * 3);
    var lowThr = Math.max(TUNE.stopAbs, TUNE.stopRatio * this.level);
    var highThr = Math.max(TUNE.stopAbs * 1.6, TUNE.goRatio * this.level);
    var low = vib < lowThr, high = vib > highThr;
    if (this.state !== 'stopped' && vib > lowThr) {
      var a = 1 - Math.exp(-dt / (this.warm < 30 ? 8 : TUNE.levelTau));
      this.level += a * (vib - this.level);
    }
    var ev = null;
    if (this.state === 'unknown') {
      if (high) this.hold('moving', t, 4) && (this.set('moving', t));
      else if (low) this.hold('stopped', t, TUNE.stopHold) && (this.set('stopped', t));
      else this.cand = null;
    } else if (this.state === 'moving') {
      if (low) {
        if (this.hold('stopped', t, TUNE.stopHold) && (t - this.since) / 1000 >= TUNE.minMove + TUNE.stopHold) {
          this.set('stopped', t); ev = 'stop';
        }
      } else this.cand = null;
    } else if (this.state === 'stopped') {
      if (high) { if (this.hold('moving', t, TUNE.goHold)) { this.set('moving', t); ev = 'go'; } }
      else this.cand = null;
    }
    return ev;
  };
  StopDetector.prototype.hold = function (s, t, secs) {
    if (this.cand !== s) { this.cand = s; this.candT = t; }
    return (t - this.candT) / 1000 >= secs;
  };
  StopDetector.prototype.set = function (s, t) { this.state = s; this.since = t; this.cand = null; };

  var api = {
    PAGE_W: PAGE_W, PAGE_H: PAGE_H, TUNE: TUNE, LINES: LINES,
    tripStation: tripStation, tripNext: tripNext, tripTitle: tripTitle,
    MotionMeter: MotionMeter, StopDetector: StopDetector, HighPass: HighPass,
    cleanStroke: cleanStroke, smooth: smooth, simplify: simplify, resample: resample,
    encode: encode, decode: decode, dist: dist, segDist: segDist,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VD_CORE = api;
})(this);
