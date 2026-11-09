// Vagon Defteri: arayüz, dokunma, çizim, sayfalar, yolculuk, kayıt.
(function () {
  'use strict';
  var C = window.VD_CORE;
  var W = C.PAGE_W, H = C.PAGE_H;
  var $ = function (id) { return document.getElementById(id); };

  /* ================= ayarlar ================= */
  var DEFAULTS = { mode: 'nib', gain: 0.6, hand: 'R', smooth: 1, jolt: 'orta', autoStop: 1, paper: 'dots', rec: 1, brush: 1, color: 0, size: 1, sensor: 0, intro: 0 };
  var ENUMS = { mode: ['finger', 'nib', 'pad'], gain: [1, 0.6, 0.35], hand: ['R', 'L'], smooth: [0, 1, 2, 3], jolt: ['kapali', 'az', 'orta', 'cok'], autoStop: [0, 1], paper: ['plain', 'dots', 'grid'], rec: [0, 1], brush: [0, 1, 2], color: [0, 1, 2, 3, 4, 5], size: [0, 1, 2], sensor: [0, 1], intro: [0, 1] };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  var S = (function () {
    var o = {}, raw = {};
    try { raw = JSON.parse(lsGet('vagon.ayar') || '{}') || {}; } catch (e) {}
    for (var k in DEFAULTS) o[k] = ENUMS[k].indexOf(raw[k]) >= 0 ? raw[k] : DEFAULTS[k];
    return o;
  })();
  function saveS() { lsSet('vagon.ayar', JSON.stringify(S)); }

  var COLORS = ['#23262d', '#8a8f98', '#d64541', '#2f6fd6', '#2e9a62', '#f0b22e'];
  var COLOR_NAMES = ['Siyah', 'Gri', 'Kırmızı', 'Mavi', 'Yeşil', 'Sarı'];
  var BRUSHES = [
    { name: 'Kurşun', w: 4.5, alpha: 0.8 },
    { name: 'Kalem', w: 6.5, taper: true },
    { name: 'Keçeli', w: 24, alpha: 0.4, multiply: true },
  ];
  var SIZES = [{ name: 'İnce', k: 0.6 }, { name: 'Orta', k: 1 }, { name: 'Kalın', k: 1.8 }];
  var SMOOTH_R = [0, 2, 4, 7];
  var MODE_NAMES = { finger: 'Parmak', nib: 'Uç', pad: 'Trackpad' };
  var HOLD = 260;                 // Uç: bu kadar durunca mürekkep açılır (ms)
  var DESK = '#1b1f27', PAPER = '#fbf8f1';

  /* ================= depo (IndexedDB, olmazsa bellek) ================= */
  var DB = (function () {
    var dbp = null, mem = { pages: new Map(), rec: new Map() }, memId = 1, useMem = false;
    function open() {
      if (!dbp) dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('IndexedDB yok'));
        var r = indexedDB.open('vagon-defteri', 1);
        r.onupgradeneeded = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains('pages')) d.createObjectStore('pages', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('rec')) d.createObjectStore('rec', { autoIncrement: true });
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      }).catch(function (e) { useMem = true; throw e; });
      return dbp;
    }
    function run(store, mode, fn) {
      return open().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction(store, mode), q = fn(tx.objectStore(store));
          tx.oncomplete = function () { res(q && 'result' in q ? q.result : undefined); };
          tx.onerror = tx.onabort = function () { rej(tx.error); };
        });
      });
    }
    function memDo(store, op, v) {
      var m = mem[store];
      if (op === 'all') return Promise.resolve(Array.from(m.values()));
      if (op === 'put') { m.set(v.id, v); return Promise.resolve(); }
      if (op === 'add') { m.set(memId++, v); return Promise.resolve(); }
      if (op === 'del') { m.delete(v); return Promise.resolve(); }
      if (op === 'clear') { m.clear(); return Promise.resolve(); }
    }
    function wrap(store, op, v, fn) {
      if (useMem) return memDo(store, op, v);
      return run(store, op === 'all' ? 'readonly' : 'readwrite', fn).catch(function () { useMem = true; return memDo(store, op, v); });
    }
    return {
      all: function (s) { return wrap(s, 'all', null, function (o) { return o.getAll(); }); },
      put: function (s, v) { return wrap(s, 'put', v, function (o) { return o.put(v); }); },
      add: function (s, v) { return wrap(s, 'add', v, function (o) { return o.add(v); }); },
      del: function (s, k) { return wrap(s, 'del', k, function (o) { return o.delete(k); }); },
      clear: function (s) { return wrap(s, 'clear', null, function (o) { return o.clear(); }); },
      mem: function () { return useMem; },
    };
  })();

  /* ================= sayfalar ================= */
  var pages = [], page = null;
  var ptsCache = new WeakMap(), boxCache = new WeakMap();
  function strokePts(st) {
    var p = ptsCache.get(st);
    if (!p) { p = C.decode(st.p); ptsCache.set(st, p); }
    return p;
  }
  function strokeBox(st) {
    var b = boxCache.get(st);
    if (!b) {
      var p = strokePts(st), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < p.length; i++) { x0 = Math.min(x0, p[i].x); y0 = Math.min(y0, p[i].y); x1 = Math.max(x1, p[i].x); y1 = Math.max(y1, p[i].y); }
      b = { x0: x0, y0: y0, x1: x1, y1: y1, r: brushW(st) / 2 };
      boxCache.set(st, b);
    }
    return b;
  }
  function brushW(st) { return BRUSHES[st.b].w * SIZES[st.s].k; }
  function newPage(title) {
    var n = 0;
    for (var i = 0; i < pages.length; i++) n = Math.max(n, pages[i].n || 0);
    var pg = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n: n + 1, created: Date.now(), updated: Date.now(), title: title || '', strokes: [] };
    pages.push(pg);
    return pg;
  }
  var saveTimer = null;
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!page) return;
    page.updated = Date.now();
    DB.put('pages', page).catch(function () {});
    lsSet('vagon.sayfa', page.id);
  }
  function setPage(pg, anim) {
    if (page && page !== pg) saveNow();
    page = pg;
    lsSet('vagon.sayfa', pg.id);
    baseDirty = true;
    if (anim) { stage.classList.remove('turn'); void stage.offsetWidth; stage.classList.add('turn'); setTimeout(function () { stage.classList.remove('turn'); }, 420); }
    updateChip(); updateUndo(); redraw();
  }
  function pageFixes(pg) { var n = 0; for (var i = 0; i < pg.strokes.length; i++) n += pg.strokes[i].j || 0; return n; }

  /* ================= yolculuk ================= */
  var trip = null, tripHist = [], manualAt = -1e9, pendingTurn = null, stopSnap = null;
  try { trip = JSON.parse(lsGet('vagon.yolculuk') || 'null'); } catch (e) { trip = null; }
  if (trip && (typeof trip.at !== 'number' || !(trip.dir === 1 || trip.dir === -1))) trip = null;
  function saveTrip() { lsSet('vagon.yolculuk', trip ? JSON.stringify(trip) : null); }
  function stationName(i) { return trip && trip.line === 'sayi' ? (i + 1) + '. durak' : C.tripStation(trip, i); }
  function tripTitle(tr) {
    tr = tr || trip;
    if (!tr) return '';
    if (tr.line === 'sayi') {
      var a = (tr.at + 1) + '. durak';
      return tr.moving ? a + ' → ' + (tr.at + 2) + '. durak' : a;
    }
    return C.tripTitle(tr);
  }
  function tripNext() { return trip.line === 'sayi' ? trip.at + 1 : C.tripNext(trip); }

  /* ================= tuval ve görünüm ================= */
  var stage = $('stage'), board = $('board'), ctx = board.getContext('2d');
  var base = document.createElement('canvas'), bctx = base.getContext('2d');
  var CW = 0, CH = 0, DPR = 1, rect = { left: 0, top: 0 };
  var view = { s: 1, ox: 0, oy: 0 }, fitted = true;
  var baseDirty = true, baseView = null, baseAt = 0;
  function fitScale() { return Math.min((CW - 24) / W, (CH - 24) / H); }
  function fit() {
    view.s = fitScale();
    view.ox = (CW - W * view.s) / 2; view.oy = (CH - H * view.s) / 2;
    fitted = true; baseDirty = true;
  }
  function clampView() {
    var pw = W * view.s, ph = H * view.s, m = 80;
    view.ox = Math.max(Math.min(0, CW - pw) - m, Math.min(Math.max(0, CW - pw) + m, view.ox));
    view.oy = Math.max(Math.min(0, CH - ph) - m, Math.min(Math.max(0, CH - ph) + m, view.oy));
  }
  function resize() {
    DPR = Math.min(3, window.devicePixelRatio || 1);
    var r = stage.getBoundingClientRect();
    rect = r; CW = r.width; CH = r.height;
    board.width = base.width = Math.max(1, Math.round(CW * DPR));
    board.height = base.height = Math.max(1, Math.round(CH * DPR));
    if (fitted) fit(); else clampView();
    baseDirty = true; redraw();
  }
  function toPage(x, y) { return { x: (x - view.ox) / view.s, y: (y - view.oy) / view.s }; }
  function toScreen(x, y) { return { x: view.ox + x * view.s, y: view.oy + y * view.s }; }
  function zoomAt(f, cx, cy) {
    var s0 = view.s, fs = fitScale();
    var s1 = Math.max(fs * 0.9, Math.min(fs * 10, s0 * f));
    view.ox = cx - (cx - view.ox) * (s1 / s0); view.oy = cy - (cy - view.oy) * (s1 / s0);
    view.s = s1; fitted = Math.abs(s1 - fs) < fs * 0.02;
    if (fitted) fit(); else clampView();
    baseDirty = true; redraw();
  }

  /* ---------- çizim yardımcıları ---------- */
  function pageTransform(c, v) { c.setTransform(DPR * v.s, 0, 0, DPR * v.s, DPR * v.ox, DPR * v.oy); }
  var MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  function dateStr(ms) {
    var d = new Date(ms), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + hh + ':' + mm;
  }
  // c'nin dönüşümü sayfa birimine ayarlı olmalı
  function drawPaper(c, pg, paper) {
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    if (paper === 'dots') {
      c.fillStyle = '#d3ccbc';
      for (var y = 120; y < H - 60; y += 50) for (var x = 50; x < W; x += 50) { c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill(); }
    } else if (paper === 'grid') {
      c.strokeStyle = '#e6dfd1'; c.lineWidth = 1.4; c.beginPath();
      for (var gx = 50; gx < W; gx += 50) { c.moveTo(gx, 95); c.lineTo(gx, H - 40); }
      for (var gy = 120; gy < H - 40; gy += 50) { c.moveTo(0, gy); c.lineTo(W, gy); }
      c.stroke();
    }
    c.fillStyle = '#958e7f';
    c.font = '600 30px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillText(pg.title || ('Sayfa ' + pg.n), 44, 66, W * 0.62);
    c.font = '500 23px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText(dateStr(pg.created), W - 44, 64);
    c.textAlign = 'center';
    c.fillText('— ' + pg.n + ' —', W / 2, H - 30);
    c.textAlign = 'left';
  }
  function tracePath(c, p) {
    c.beginPath();
    c.moveTo(p[0].x, p[0].y);
    if (p.length === 2) { c.lineTo(p[1].x, p[1].y); return; }
    for (var i = 1; i < p.length - 1; i++) {
      var mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
      c.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }
  // st: { b, c, s }; p: noktalar (sayfa birimi)
  function drawStroke(c, p, st) {
    if (!p.length) return;
    var br = BRUSHES[st.b], w = brushW(st), col = COLORS[st.c];
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = col; c.fillStyle = col;
    if (br.alpha) c.globalAlpha = br.alpha;
    if (br.multiply) c.globalCompositeOperation = 'multiply';
    if (p.length === 1 || (p.length === 2 && C.dist(p[0], p[1]) < 0.5)) {
      c.beginPath(); c.arc(p[0].x, p[0].y, w * (br.taper ? 0.6 : 0.5), 0, Math.PI * 2); c.fill();
    } else if (br.taper) {
      // uçlara doğru incelen mürekkep: parça parça (sadeleşmiş seyrek noktalar önce sıklaştırılır)
      p = C.resample(p, 6);
      var L = [0], tot = 0;
      for (var i = 1; i < p.length; i++) { tot += C.dist(p[i - 1], p[i]); L.push(tot); }
      var tl = Math.min(34, tot * 0.3);
      var wAt = function (l) { var u = Math.min(1, Math.min(l, tot - l) / (tl || 1)); return w * (0.38 + 0.62 * Math.sqrt(u)); };
      var px = p[0].x, py = p[0].y;
      for (var k = 1; k < p.length; k++) {
        var ex, ey;
        if (k < p.length - 1) { ex = (p[k].x + p[k + 1].x) / 2; ey = (p[k].y + p[k + 1].y) / 2; } else { ex = p[k].x; ey = p[k].y; }
        c.lineWidth = wAt(L[k]);
        c.beginPath(); c.moveTo(px, py);
        if (k < p.length - 1) c.quadraticCurveTo(p[k].x, p[k].y, ex, ey); else c.lineTo(ex, ey);
        c.stroke();
        px = ex; py = ey;
      }
    } else {
      c.lineWidth = w; tracePath(c, p); c.stroke();
    }
    c.restore();
  }
  function renderBase() {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = DESK; bctx.fillRect(0, 0, base.width, base.height);
    // sayfa gölgesi
    bctx.save();
    bctx.shadowColor = 'rgba(0,0,0,.45)'; bctx.shadowBlur = 18 * DPR; bctx.shadowOffsetY = 4 * DPR;
    bctx.fillStyle = PAPER;
    bctx.fillRect(DPR * view.ox, DPR * view.oy, DPR * W * view.s, DPR * H * view.s);
    bctx.restore();
    pageTransform(bctx, view);
    bctx.save(); bctx.beginPath(); bctx.rect(0, 0, W, H); bctx.clip();
    drawPaper(bctx, page, S.paper);
    for (var i = 0; i < page.strokes.length; i++) drawStroke(bctx, strokePts(page.strokes[i]), page.strokes[i]);
    bctx.restore();
    baseView = { s: view.s, ox: view.ox, oy: view.oy };
    baseDirty = false; baseAt = performance.now();
  }
  function appendToBase(st) {
    if (baseDirty || !sameView()) { baseDirty = true; return; }
    pageTransform(bctx, view);
    bctx.save(); bctx.beginPath(); bctx.rect(0, 0, W, H); bctx.clip();
    drawStroke(bctx, strokePts(st), st);
    bctx.restore();
  }
  function sameView() { return baseView && baseView.s === view.s && baseView.ox === view.ox && baseView.oy === view.oy; }

  /* ---------- kare döngüsü ---------- */
  var raf = 0, flashes = [], lastSeis = 0, seisDirty = false;
  function redraw() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!page) return;
    var now = performance.now();
    var busy = !!gesture;
    if (baseDirty && (!busy || now - baseAt > 180)) renderBase();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (sameView()) ctx.drawImage(base, 0, 0);
    else {
      var k = view.s / baseView.s;
      ctx.fillStyle = DESK; ctx.fillRect(0, 0, board.width, board.height);
      ctx.setTransform(k, 0, 0, k, DPR * (view.ox - baseView.ox * k), DPR * (view.oy - baseView.oy * k));
      ctx.drawImage(base, 0, 0);
      baseDirty = true;
    }
    var anim = false;
    if (ink && ink.tool === 'pen') drawActive(now);
    if (flashes.length) { drawFlashes(now); anim = true; }
    anim = drawPointers(now) || anim;
    if (aim && !aim.on && now - aim.at >= HOLD && ptrs.has(aim.id)) { inkOnNib(now); anim = true; }
    if (!sameView() && !busy) anim = true;
    if (seisDirty && now - lastSeis > 55) { drawSeis(now); lastSeis = now; seisDirty = false; }
    if (seisDirty) anim = true;
    if (anim) redraw();
  }
  function liveStroke(k, final) {
    var wins = useJolt() ? meter.windowsIn(k.t0, Infinity) : [];
    var res = C.cleanStroke(k.pts, wins, { minDev: 3.5 / k.s, live: !final });
    return { res: res, pts: C.smooth(res.pts, SMOOTH_R[S.smooth]) };
  }
  function drawActive() {
    var L = liveStroke(ink, false);
    if (!L.pts.length) return;
    pageTransform(ctx, view);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawStroke(ctx, L.pts, { b: ink.b, c: ink.c, s: ink.z });
    if (L.res.held) {
      // sarsıntı sürüyor: bekletilen kuyruğu soluk göster
      var tail = ink.pts.slice(ink.pts.length - L.res.held - 1);
      ctx.globalAlpha = 0.25; ctx.setLineDash([6 / view.s, 6 / view.s]);
      drawStroke(ctx, tail, { b: 0, c: 1, s: 0 });
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  function drawFlashes(now) {
    pageTransform(ctx, view);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    flashes = flashes.filter(function (f) { return now < f.until; });
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i], u = (f.until - now) / 1400;
      ctx.globalAlpha = 0.65 * Math.min(1, u * 1.5);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 14 / view.s;
      tracePath(ctx, f.pts); ctx.stroke();
    }
    ctx.restore();
  }
  function ring(x, y, r, col, w) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
  function cross(x, y, r, col) {
    ctx.beginPath();
    ctx.moveTo(x - r - 5, y); ctx.lineTo(x - r + 2, y); ctx.moveTo(x + r - 2, y); ctx.lineTo(x + r + 5, y);
    ctx.moveTo(x, y - r - 5); ctx.lineTo(x, y - r + 2); ctx.moveTo(x, y + r - 2); ctx.lineTo(x, y + r + 5);
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
  }
  function drawPointers(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var anim = false, acc = '#ff7a45', col = eraserOn ? '#ffffff' : COLORS[S.color];
    if (eraserOn && ink && ink.tool === 'eraser' && ink.screen) {
      ring(ink.screen.x, ink.screen.y, 12, '#00000066', 3); ring(ink.screen.x, ink.screen.y, 12, '#ffffff', 1.5);
    }
    if (S.mode === 'nib' && aim) {
      ctx.save(); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(aim.fx, aim.fy); ctx.lineTo(aim.nx, aim.ny);
      ctx.strokeStyle = '#ff7a4588'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      ring(aim.nx, aim.ny, 10, '#00000040', 4);
      if (aim.on) { ctx.beginPath(); ctx.arc(aim.nx, aim.ny, 3.2, 0, Math.PI * 2); ctx.fillStyle = eraserOn ? '#999' : col; ctx.fill(); ring(aim.nx, aim.ny, 10, acc, 2); }
      else {
        var u = Math.min(1, (now - aim.at) / HOLD);
        ring(aim.nx, aim.ny, 10, '#ff7a4555', 2);
        ctx.beginPath(); ctx.arc(aim.nx, aim.ny, 10, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.strokeStyle = acc; ctx.lineWidth = 2.6; ctx.stroke();
        cross(aim.nx, aim.ny, 10, acc);
        anim = true;
      }
    }
    if (S.mode === 'pad') {
      var c = toScreen(cursor.x, cursor.y), on = !!ink;
      ring(c.x, c.y, 9, '#00000040', 4);
      ring(c.x, c.y, 9, acc, on ? 2.6 : 1.8);
      cross(c.x, c.y, 9, acc);
      ctx.beginPath(); ctx.arc(c.x, c.y, on ? 3.4 : 2, 0, Math.PI * 2); ctx.fillStyle = eraserOn ? '#999' : col; ctx.fill();
      if (eraserOn) ring(c.x, c.y, 12, '#ffffffaa', 1.2);
    }
    return anim;
  }

  /* ================= sensör ================= */
  var meter = new C.MotionMeter(S.jolt === 'kapali' ? 'orta' : S.jolt);
  var stopper = new C.StopDetector();
  var sensorOn = false, listening = false, motionN = 0, motionT0 = 0, rate = 0, lastVibT = 0;
  var motionRing = [], seisBuf = [];
  var vibLog = [], vibSec = null;
  function useJolt() { return sensorOn && S.jolt !== 'kapali'; }
  function evTime(e) {
    var now = performance.now(), ts = e && e.timeStamp;
    return (typeof ts === 'number' && ts > 0 && Math.abs(ts - now) < 3000) ? ts : now;
  }
  function onMotion(e) {
    var a = e.acceleration && e.acceleration.x != null ? e.acceleration
      : (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x != null ? e.accelerationIncludingGravity : null);
    if (!a) return;
    var t = evTime(e);
    if (!sensorOn) { sensorOn = true; motionT0 = t; motionN = 0; updateSensorText(); updateChip(); }
    motionN++;
    if (t - motionT0 > 2000) { rate = motionN * 1000 / (t - motionT0); motionT0 = t; motionN = 0; }
    var r = meter.push(t, a.x || 0, a.y || 0, a.z || 0);
    var rr = e.rotationRate || {};
    motionRing.push({ t: t, ax: a.x || 0, ay: a.y || 0, az: a.z || 0, ra: rr.alpha || 0, rb: rr.beta || 0, rg: rr.gamma || 0 });
    while (motionRing.length && motionRing[0].t < t - 25000) motionRing.shift();
    seisBuf.push({ t: t, m: r.m, thr: r.thr, j: r.jolt });
    while (seisBuf.length && seisBuf[0].t < t - 3200) seisBuf.shift();
    seisDirty = true;
    // saniyelik titreşim günlüğü (durak sezicisini ayarlamak için)
    if (!vibSec) vibSec = { t: t, v: 0, n: 0, m: 0 };
    vibSec.v += r.vib; vibSec.n++; vibSec.m = Math.max(vibSec.m, r.m);
    if (t - lastVibT >= 100) {
      lastVibT = t;
      var ev = stopper.push(t, r.vib);
      if (ev) onStopEvent(ev, t);
    }
    if (t - vibSec.t >= 1000) {
      if (S.rec) vibLog.push([Math.round(vibSec.t), Date.now(), +(vibSec.v / vibSec.n).toFixed(4), +vibSec.m.toFixed(3), stopper.state.charAt(0)]);
      vibSec = null;
      if (vibLog.length >= 60) flushVib();
    }
    if (ink || seisDirty) redraw();
  }
  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('devicemotion', onMotion);
    setTimeout(function () { updateSensorText(); if (!sensorOn) updateChip(); }, 2500);
  }
  function needsPermission() { return window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function'; }
  // izin bir dokunuşun içinde istenmeli (iOS)
  function askSensor() {
    if (!window.DeviceMotionEvent) { S.sensor = 0; saveS(); updateSensorText('Bu tarayıcıda hareket sensörü yok.'); return Promise.resolve(false); }
    var p;
    try { p = needsPermission() ? DeviceMotionEvent.requestPermission() : Promise.resolve('granted'); } catch (e) { p = Promise.reject(e); }
    return p.then(function (r) {
      if (r === 'granted') { S.sensor = 1; saveS(); listen(); return true; }
      S.sensor = 0; saveS(); updateSensorText();
      toast('Sensör izni verilmedi, sarsıntı süzgeci kapalı. Ayarlardan yeniden isteyebilirsin.');
      return false;
    }, function () { updateSensorText('İzin istenemedi. Safari ayarlarında “Hareket ve Yön Erişimi”ni aç.'); return false; });
  }
  function startSensor() {
    if (!S.sensor) return;
    if (!needsPermission()) { listen(); return; }
    // iOS: önceki izin bu oturumda geçerli değil; ilk dokunuşta sessizce yeniden iste
    var once = function () {
      document.removeEventListener('touchend', once, true);
      document.removeEventListener('click', once, true);
      if (!listening) askSensor();
    };
    document.addEventListener('touchend', once, true);
    document.addEventListener('click', once, true);
  }
  var seis = $('seis'), sctx = seis.getContext('2d');
  function drawSeis(now) {
    var w = seis.clientWidth || 66, h = seis.clientHeight || 40;
    if (seis.width !== Math.round(w * DPR)) { seis.width = Math.round(w * DPR); seis.height = Math.round(h * DPR); }
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.clearRect(0, 0, w, h);
    if (!sensorOn) {
      sctx.fillStyle = '#6c7380'; sctx.font = '600 10px ui-rounded, system-ui, sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(S.sensor ? 'sensör…' : 'sensör yok', w / 2, h / 2 + 3);
      return;
    }
    var span = 3000, thr = seisBuf.length ? seisBuf[seisBuf.length - 1].thr : 1.6, mx = Math.max(2.4, thr * 1.7);
    var Y = function (m) { return h - 4 - Math.min(1, m / mx) * (h - 8); };
    sctx.setLineDash([2, 3]); sctx.strokeStyle = '#ffd23f66'; sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(0, Y(thr)); sctx.lineTo(w, Y(thr)); sctx.stroke(); sctx.setLineDash([]);
    sctx.beginPath();
    for (var i = 0; i < seisBuf.length; i++) {
      var s = seisBuf[i], x = w - (now - s.t) / span * w;
      if (i === 0) sctx.moveTo(x, Y(s.m)); else sctx.lineTo(x, Y(s.m));
    }
    sctx.strokeStyle = '#efe9dccc'; sctx.lineWidth = 1.3; sctx.stroke();
    for (var j = 0; j < seisBuf.length; j++) {
      if (!seisBuf[j].j) continue;
      var sx = w - (now - seisBuf[j].t) / span * w;
      sctx.fillStyle = '#ffd23f'; sctx.fillRect(sx - 1, Y(seisBuf[j].m) - 1, 2.5, h);
    }
  }
  setInterval(function () { if (sensorOn) { seisDirty = true; redraw(); } else drawSeis(performance.now()); }, 500);

  /* ================= kayıt ================= */
  var recStats = (function () { try { return JSON.parse(lsGet('vagon.kayit') || 'null') || null; } catch (e) { return null; } })() || { strokes: 0, jolts: 0, fixes: 0, reverts: 0, stations: 0, since: 0 };
  function bumpRec(k, n) { if (!recStats.since) recStats.since = Date.now(); recStats[k] = (recStats[k] || 0) + (n || 1); lsSet('vagon.kayit', JSON.stringify(recStats)); }
  function recAdd(obj) { if (!S.rec) return; obj.w = obj.w || Date.now(); DB.add('rec', obj).catch(function () {}); }
  function flushVib() { if (vibLog.length) { recAdd({ k: 'vib', rows: vibLog }); vibLog = []; } }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function recStroke(k, res, wins, t1) {
    if (!S.rec || !sensorOn) return;
    var pid = page.id, title = page.title;
    setTimeout(function () {
      var a = k.t0 - 600, b = t1 + 450, mot = [];
      for (var i = 0; i < motionRing.length; i++) {
        var s = motionRing[i];
        if (s.t >= a && s.t <= b) mot.push([Math.round(s.t - k.t0), r2(s.ax), r2(s.ay), r2(s.az), r1(s.ra), r1(s.rb), r1(s.rg)]);
      }
      var raw = [];
      for (var j = 0; j < k.pts.length; j++) raw.push(r1(k.pts[j].x), r1(k.pts[j].y), Math.round(k.pts[j].t - k.t0));
      recAdd({
        k: 'stroke', t0: Math.round(k.t0), t1: Math.round(t1), mode: k.mode, tool: k.tool, s: +k.s.toFixed(4), gain: k.gain, level: S.jolt, smooth: S.smooth,
        raw: raw, mot: mot,
        wins: wins.map(function (w) { return [Math.round(w.t0 - k.t0), Math.round(w.t1 - k.t0)]; }),
        fixes: res ? res.fixes.map(function (f) { return { a: f.a, b: f.b, dev: f.dev ? r1(f.dev) : 0, cut: !!f.cut }; }) : [],
        page: pid, title: title,
      });
      bumpRec('strokes'); if (wins.length) bumpRec('jolts', wins.length); if (res && res.fixes.length) bumpRec('fixes', res.fixes.length);
    }, 520);
  }

  /* ================= dokunma ================= */
  var ptrs = new Map();
  var ink = null, gesture = null, aim = null, eraserOn = false;
  var pad = { mover: null, inkPtr: null };
  var cursor = { x: W / 2, y: H / 2 };
  var lastTap = { t: -1e9, x: 0, y: 0 };
  var taps = { max: 0, t0: 0, moved: 0, inked: false };

  function startInk(pid, pt, t, screen) {
    ink = { pid: pid, tool: eraserOn ? 'eraser' : 'pen', pts: [{ x: pt.x, y: pt.y, t: t }], t0: t, len: 0, mode: S.mode, s: view.s, gain: S.gain, b: S.brush, c: S.color, z: S.size, screen: screen };
    taps.inked = true;
    if (ink.tool === 'eraser') { ink.erased = []; eraseSeg(pt, pt); }
    hideHint();
  }
  function addInk(pt, t, screen) {
    var last = ink.pts[ink.pts.length - 1];
    var d = Math.hypot(pt.x - last.x, pt.y - last.y) * view.s;
    if (screen) ink.screen = screen;
    if (d < 0.35) return;
    ink.len += d;
    ink.pts.push({ x: pt.x, y: pt.y, t: t });
    if (ink.tool === 'eraser') eraseSeg(last, pt);
  }
  function cancelInk() {
    if (ink && ink.tool === 'eraser' && ink.erased.length) {
      for (var k = ink.erased.length - 1; k >= 0; k--) page.strokes.splice(ink.erased[k].i, 0, ink.erased[k].st);
      baseDirty = true;
    }
    ink = null;
  }
  function endInk(t) {
    var k = ink; ink = null;
    if (!k) return;
    if (k.tool === 'eraser') {
      if (k.erased.length) { pushUndo({ t: 'erase', items: k.erased }); queueSave(); }
      recStroke(k, null, [], t);
      afterInk(); return;
    }
    var wins = useJolt() ? meter.windowsIn(k.t0, t) : [];
    var res = C.cleanStroke(k.pts, wins, { minDev: 3.5 / k.s });
    var st = makeStroke(k, res.pts);
    if (res.fixes.length) st.j = res.fixes.length;
    page.strokes.push(st);
    pushUndo({ t: 'add', st: st });
    appendToBase(st);
    queueSave();
    if (res.fixes.length) {
      var until = performance.now() + 1400;
      for (var i = 0; i < res.fixes.length; i++) {
        var f = res.fixes[i];
        var seg = f.cut ? res.pts.slice(Math.max(0, f.a - 3), f.a + 1) : res.pts.slice(f.a, f.b + 1);
        if (seg.length > 1) flashes.push({ pts: seg, until: until });
      }
      var rawSt = makeStroke(k, k.pts);
      var t0 = k.t0;
      toast(res.fixes.length === 1 ? 'Sarsıntı düzeltildi' : res.fixes.length + ' sarsıntı düzeltildi', {
        kind: 'jolt', ms: 5000,
        action: { label: 'Geri al', fn: function () {
          var i = page.strokes.indexOf(st);
          if (i < 0) return;
          page.strokes[i] = rawSt;
          pushUndo({ t: 'replace', before: st, after: rawSt });
          baseDirty = true; queueSave(); redraw();
          recAdd({ k: 'revert', t0: Math.round(t0) }); bumpRec('reverts');
        } },
      });
    }
    recStroke(k, res, wins, t);
    afterInk();
  }
  function makeStroke(k, pts) {
    var sm = C.smooth(pts, SMOOTH_R[S.smooth]);
    var simp = C.simplify(sm, 0.45);
    var st = { b: k.b, c: k.c, s: k.z, p: C.encode(simp) };
    return st;
  }
  function afterInk() {
    redraw();
    if (pendingTurn) { var pt = pendingTurn; pendingTurn = null; maybeTurn(pt.how, pt.before); }
  }
  function eraseSeg(a, b) {
    var r = 12 / view.s, hit = false;
    var steps = Math.max(1, Math.ceil(C.dist(a, b) / (r * 0.5)));
    for (var i = page.strokes.length - 1; i >= 0; i--) {
      var st = page.strokes[i], bx = strokeBox(st), rr = r + bx.r;
      if (Math.max(a.x, b.x) < bx.x0 - rr || Math.min(a.x, b.x) > bx.x1 + rr || Math.max(a.y, b.y) < bx.y0 - rr || Math.min(a.y, b.y) > bx.y1 + rr) continue;
      var p = strokePts(st), got = false;
      for (var s = 0; s <= steps && !got; s++) {
        var u = s / steps, q = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
        if (p.length === 1) { got = C.dist(q, p[0]) < rr; break; }
        for (var j = 1; j < p.length; j++) if (C.segDist(q, p[j - 1], p[j]) < rr) { got = true; break; }
      }
      if (got) { page.strokes.splice(i, 1); ink.erased.push({ i: i, st: st }); hit = true; }
    }
    if (hit) baseDirty = true;
  }

  function local(e) { return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
  board.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { board.setPointerCapture(e.pointerId); } catch (er) {}
    var t = evTime(e), q = local(e);
    ptrs.set(e.pointerId, { x: q.x, y: q.y, sx: q.x, sy: q.y, t0: t, moved: 0, mouse: e.pointerType === 'mouse' });
    if (ptrs.size === 1) taps = { max: 1, t0: t, moved: 0, inked: false };
    else taps.max = Math.max(taps.max, ptrs.size);
    var mode = e.pointerType === 'mouse' ? 'finger' : S.mode;
    if (mode === 'finger') downFinger(e.pointerId, q, t);
    else if (mode === 'nib') downNib(e.pointerId, q, t);
    else downPad(e.pointerId, q, t);
    redraw();
  });
  board.addEventListener('pointermove', function (e) {
    var p = ptrs.get(e.pointerId);
    if (!p) return;
    var list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    if (!list.length) list = [e];
    var mode = p.mouse ? 'finger' : S.mode;
    for (var i = 0; i < list.length; i++) {
      var ce = list[i], q = local(ce), t = evTime(ce);
      var dx = q.x - p.x, dy = q.y - p.y;
      p.x = q.x; p.y = q.y;
      p.moved = Math.max(p.moved, Math.hypot(q.x - p.sx, q.y - p.sy));
      if (mode === 'finger') moveFinger(e.pointerId, q, t);
      else if (mode === 'nib') moveNib(e.pointerId, q, t);
      else movePad(e.pointerId, dx, dy, t);
    }
    taps.moved = Math.max(taps.moved, p.moved);
    redraw();
  });
  function onUp(e) {
    var p = ptrs.get(e.pointerId);
    if (!p) return;
    var t = evTime(e), mode = p.mouse ? 'finger' : S.mode;
    if (e.type === 'pointercancel' && ink && ink.pid === e.pointerId && ink.len < 4) cancelInk();
    if (mode === 'finger') upFinger(e.pointerId, t);
    else if (mode === 'nib') upNib(e.pointerId, p, t);
    else upPad(e.pointerId, p, t);
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      // iki parmakla dokun: geri al, üç parmakla: yinele (Parmak ve Uç'ta)
      if (S.mode !== 'pad' && taps.max >= 2 && t - taps.t0 < 320 && taps.moved < 16 && !taps.committed) {
        if (taps.max === 2) undo(); else redo();
      }
    }
    redraw();
  }
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  board.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---- Parmak ---- */
  function downFinger(id, q, t) {
    if (ptrs.size === 1) { startInk(id, toPage(q.x, q.y), t, q); return; }
    if (ptrs.size === 2) {
      if (ink && (t - ink.t0 < 250 || ink.len < 30)) { cancelInk(); startPinch(); }
      else if (!ink) startPinch();
    }
  }
  function moveFinger(id, q, t) {
    if (gesture) { if (gesture.ids.indexOf(id) >= 0) pinchMove(); return; }
    if (ink && ink.pid === id) addInk(toPage(q.x, q.y), t, q);
  }
  function upFinger(id, t) {
    if (gesture && gesture.ids.indexOf(id) >= 0) { endPinch(); return; }
    if (ink && ink.pid === id) { if (taps.max >= 2 && ink.len < 16) cancelInk(); else { taps.committed = true; endInk(t); } }
  }
  /* ---- Uç ---- */
  function nibOffset() { return S.hand === 'L' ? { x: 24, y: -62 } : { x: -24, y: -62 }; }
  function downNib(id, q, t) {
    if (ptrs.size === 1) {
      var o = nibOffset();
      aim = { id: id, fx: q.x, fy: q.y, nx: q.x + o.x, ny: q.y + o.y, ax: q.x, ay: q.y, at: t, on: false };
      if (t - lastTap.t < 380 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 50) inkOnNib(t);
      return;
    }
    if (ptrs.size === 2) {
      if (aim && !aim.on) { aim = null; startPinch(); }
      else if (aim && aim.on && ink && t - ink.t0 < 220 && ink.len < 20) { cancelInk(); aim = null; startPinch(); }
    }
  }
  function inkOnNib(t) { if (!aim || aim.on) return; aim.on = true; startInk(aim.id, toPage(aim.nx, aim.ny), t, { x: aim.nx, y: aim.ny }); }
  function moveNib(id, q, t) {
    if (gesture) { if (gesture.ids.indexOf(id) >= 0) pinchMove(); return; }
    if (!aim || aim.id !== id) return;
    var o = nibOffset();
    aim.fx = q.x; aim.fy = q.y; aim.nx = q.x + o.x; aim.ny = q.y + o.y;
    if (aim.on) { if (ink) addInk(toPage(aim.nx, aim.ny), t, { x: aim.nx, y: aim.ny }); return; }
    if (Math.hypot(q.x - aim.ax, q.y - aim.ay) > 7) { aim.ax = q.x; aim.ay = q.y; aim.at = t; }
  }
  function upNib(id, p, t) {
    if (gesture && gesture.ids.indexOf(id) >= 0) { endPinch(); return; }
    if (!aim || aim.id !== id) return;
    if (aim.on) { if (ink) { taps.committed = true; endInk(t); } }
    else if (t - p.t0 < 250 && p.moved < 12) lastTap = { t: t, x: p.x, y: p.y };
    aim = null;
  }
  /* ---- Trackpad ---- */
  function downPad(id, q, t) {
    if (pad.mover === null) {
      pad.mover = id;
      if (t - lastTap.t < 340 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 70) {
        startInk(id, { x: cursor.x, y: cursor.y }, t);
        lastTap.t = -1e9;
      }
    } else if (pad.inkPtr === null && !ink) {
      pad.inkPtr = id;
      startInk(id, { x: cursor.x, y: cursor.y }, t);
    }
  }
  function movePad(id, dx, dy, t) {
    if (id !== pad.mover) return;
    var g = S.gain / view.s;
    cursor.x = Math.max(0, Math.min(W, cursor.x + dx * g));
    cursor.y = Math.max(0, Math.min(H, cursor.y + dy * g));
    autoPan();
    if (ink) addInk({ x: cursor.x, y: cursor.y }, t);
  }
  function upPad(id, p, t) {
    if (id === pad.inkPtr) { pad.inkPtr = null; if (ink) endInk(t); return; }
    if (id !== pad.mover) return;
    var inked = !!ink || (taps.inked && ptrs.size === 1);
    if (ink) endInk(t);
    if (!inked && t - p.t0 < 220 && p.moved < 10) lastTap = { t: t, x: p.x, y: p.y };
    pad.mover = null;
    if (pad.inkPtr !== null) { pad.mover = pad.inkPtr; pad.inkPtr = null; }
  }
  function autoPan() {
    var c = toScreen(cursor.x, cursor.y), m = Math.min(70, CW * 0.18), dx = 0, dy = 0;
    if (c.x < m) dx = m - c.x; else if (c.x > CW - m) dx = CW - m - c.x;
    if (c.y < m) dy = m - c.y; else if (c.y > CH - m) dy = CH - m - c.y;
    if (dx || dy) {
      var ox = view.ox, oy = view.oy;
      view.ox += dx; view.oy += dy; clampView();
      if (view.ox !== ox || view.oy !== oy) { fitted = false; baseDirty = true; }
    }
  }
  function centerCursor() {
    var c = toPage(CW / 2, CH / 2);
    cursor.x = Math.max(40, Math.min(W - 40, c.x)); cursor.y = Math.max(120, Math.min(H - 60, c.y));
  }
  /* ---- iki parmakla yaklaşma ---- */
  function startPinch() {
    var ids = Array.from(ptrs.keys()).slice(0, 2), a = ptrs.get(ids[0]), b = ptrs.get(ids[1]);
    gesture = { ids: ids, d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s0: view.s, ox0: view.ox, oy0: view.oy };
  }
  function pinchMove() {
    var a = ptrs.get(gesture.ids[0]), b = ptrs.get(gesture.ids[1]);
    if (!a || !b) return;
    var d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, fs = fitScale();
    var s1 = Math.max(fs * 0.9, Math.min(fs * 10, gesture.s0 * d / gesture.d0));
    var px = (gesture.cx - gesture.ox0) / gesture.s0, py = (gesture.cy - gesture.oy0) / gesture.s0;
    view.s = s1; view.ox = cx - px * s1; view.oy = cy - py * s1;
    fitted = false; clampView();
  }
  function endPinch() {
    gesture = null;
    var fs = fitScale();
    if (Math.abs(view.s - fs) < fs * 0.08) fit();
    baseDirty = true; redraw();
  }

  /* ================= geri al ================= */
  var hists = new Map();
  function hist() { var h = hists.get(page.id); if (!h) { h = { u: [], r: [] }; hists.set(page.id, h); } return h; }
  function pushUndo(op) { var h = hist(); h.u.push(op); if (h.u.length > 300) h.u.shift(); h.r.length = 0; updateUndo(); }
  function undo() { var h = hist(), op = h.u.pop(); if (!op) return; applyOp(op, true); h.r.push(op); updateUndo(); }
  function redo() { var h = hist(), op = h.r.pop(); if (!op) return; applyOp(op, false); h.u.push(op); updateUndo(); }
  function applyOp(op, rev) {
    var S2 = page.strokes, i;
    if (op.t === 'add') {
      if (rev) { i = S2.lastIndexOf(op.st); if (i >= 0) S2.splice(i, 1); } else S2.push(op.st);
    } else if (op.t === 'erase') {
      if (rev) { for (var k = op.items.length - 1; k >= 0; k--) S2.splice(op.items[k].i, 0, op.items[k].st); }
      else op.items.forEach(function (it) { var j = S2.indexOf(it.st); if (j >= 0) S2.splice(j, 1); });
    } else if (op.t === 'replace') {
      var from = rev ? op.after : op.before, to = rev ? op.before : op.after;
      i = S2.indexOf(from); if (i >= 0) S2[i] = to;
    }
    baseDirty = true; queueSave(); redraw();
  }
  function updateUndo() {
    if (!page) return;
    var h = hist();
    $('b-undo').disabled = !h.u.length; $('b-redo').disabled = !h.r.length;
  }

  /* ================= duraklar ================= */
  function onStopEvent(ev, t) {
    recAdd({ k: 'station', how: 'auto', ev: ev, t: Math.round(t), trip: trip ? tripTitle() : null });
    if (!trip || !S.autoStop) return;
    if (ev === 'stop' && trip.moving) {
      if (t - manualAt < 60000) return;          // az önce elle geçildi
      var n = tripNext();
      if (n == null) return;
      pushTrip(); stopSnap = JSON.stringify(trip);
      trip.at = n; trip.moving = false; saveTrip();
      updateChip();
      $('trip-chip').classList.remove('pulse'); void $('trip-chip').offsetWidth; $('trip-chip').classList.add('pulse');
      toast(stationName(n) + ' durağındasın', { kind: 'station', ms: 3500 });
    } else if (ev === 'go' && !trip.moving) {
      pushTrip();
      var before = stopSnap || JSON.stringify(trip);
      stopSnap = null;
      trip.moving = true; saveTrip();
      maybeTurn('auto', before);
    }
  }
  function pushTrip() { tripHist.push(JSON.stringify(trip)); if (tripHist.length > 8) tripHist.shift(); }
  // before: yolculuğun bu sayfa çevrilmeden önceki hâli ("Geri al" onu da geri getirir)
  function maybeTurn(how, before) {
    var title = tripTitle();
    if (title === page.title) { updateChip(); return; }
    if (ink) { pendingTurn = { how: how, before: before }; return; }
    turnPage(title, how, before);
  }
  function turnPage(title, how, before) {
    if (!page.strokes.length) {
      page.title = title; page.trip = trip ? { line: trip.line, at: trip.at, dir: trip.dir } : null;
      baseDirty = true; saveNow(); updateChip(); redraw();
      return;
    }
    var prev = page;
    notePage(prev);
    saveNow();
    var pg = newPage(title);
    pg.trip = trip ? { line: trip.line, at: trip.at, dir: trip.dir } : null;
    setPage(pg, true);
    saveNow();
    toast('Yeni sayfa · ' + title, {
      kind: 'station', ms: 5000,
      action: { label: 'Geri al', fn: function () {
        if (page !== pg || pg.strokes.length) return;
        pages.splice(pages.indexOf(pg), 1); DB.del('pages', pg.id);
        if (before) { try { trip = JSON.parse(before); saveTrip(); } catch (e) {} }
        setPage(prev, true);
        recAdd({ k: 'station', how: 'geri-sayfa', from: how, t: Math.round(performance.now()), trip: tripTitle() });
      } },
    });
  }
  function notePage(pg) {
    if (!pg.strokes.length || pg.noted === pg.strokes.length) return;
    pg.noted = pg.strokes.length;
    var j = pageFixes(pg);
    labNote('s. ' + pg.n + ' · ' + (pg.title || 'başlıksız') + ' · ' + pg.strokes.length + ' çizgi' + (j ? ' · ' + j + ' sarsıntı düzeltildi' : '') + ' · ' + MODE_NAMES[S.mode]);
  }
  function labNote(s) { try { if (window.Hesap && typeof window.Hesap.not === 'function') window.Hesap.not(s); } catch (e) {} }

  /* ================= arayüz ================= */
  var toastsEl = $('toasts');
  function toast(text, opt) {
    opt = opt || {};
    var el = document.createElement('div');
    el.className = 'toast ' + (opt.kind || '');
    var tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = text; el.appendChild(tx);
    if (opt.action) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = opt.action.label;
      b.addEventListener('click', function () { opt.action.fn(); kill(); });
      el.appendChild(b);
    }
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 2) toastsEl.removeChild(toastsEl.firstChild);
    var tm = setTimeout(kill, opt.ms || 3200);
    function kill() { clearTimeout(tm); el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }
    return el;
  }
  var hintEl = $('hint'), hintTm = null;
  var HINTS = {
    finger: '<b>Parmak</b> · Parmağının altına çizer. İki parmakla yaklaş; iki parmakla dokunursan geri alır.',
    nib: '<b>Uç</b> · Uç parmağının üstünde. Ucu yerine getir, bir an bekle: halka dolunca çizer. Hızlısı: iki kez dokun, ikincide sürükle.',
    pad: '<b>Trackpad</b> · Bir parmak imleci sürer, ikinci parmağı basılı tutunca çizer. Tek elle: iki kez dokun, ikincide sürükle. Yaklaşmak için sağdaki +.',
  };
  function showHint(html, ms) {
    if (CH && CH < 420) ms = Math.min(ms || 5000, 3200);
    hintEl.innerHTML = html; hintEl.hidden = false;
    clearTimeout(hintTm); hintTm = setTimeout(hideHint, ms || 5000);
  }
  function hideHint() { if (!hintEl.hidden) { hintEl.hidden = true; clearTimeout(hintTm); } }

  function updateChip() {
    if (!page) return;
    $('trip-t').textContent = trip ? (tripTitle() || ('Sayfa ' + page.n)) : (page.title || ('Sayfa ' + page.n));
    var sub;
    if (trip) sub = 's. ' + page.n + ' · ' + (S.autoStop && sensorOn ? 'durakta sayfa kendiliğinden' : 'durakta buraya dokun');
    else sub = 's. ' + page.n + ' · yolculuk seç';
    $('trip-s').textContent = sub;
  }
  function updateMode() {
    var bs = document.querySelectorAll('#modes button');
    for (var i = 0; i < bs.length; i++) { var on = bs[i].dataset.mode === S.mode; bs[i].classList.toggle('on', on); bs[i].setAttribute('aria-checked', on ? 'true' : 'false'); }
  }
  function updatePen() {
    $('pen-dot').style.background = COLORS[S.color];
    $('pen-dot').style.transform = 'scale(' + [0.7, 0.85, 1][S.size] + ')';
    $('b-pen').classList.toggle('on', !eraserOn);
    $('b-eraser').classList.toggle('on', eraserOn);
  }
  function setMode(m) {
    if (ink) return;
    S.mode = m; saveS(); aim = null; pad.mover = pad.inkPtr = null;
    if (m === 'pad') centerCursor();
    updateMode(); showHint(HINTS[m], 6000); redraw();
  }
  document.querySelectorAll('#modes button').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });

  function openSheet(id) { closeSheets(); $(id).hidden = false; }
  function closeSheets() { document.querySelectorAll('.sheet').forEach(function (s) { s.hidden = true; }); }
  document.querySelectorAll('.sheet').forEach(function (s) {
    s.addEventListener('click', function (e) { if (e.target === s && s.id !== 'intro') s.hidden = true; });
  });

  // kalem
  function buildPen() {
    var pc = $('pen-colors'); pc.innerHTML = '';
    COLORS.forEach(function (c, i) {
      var b = document.createElement('button'); b.className = 'sw' + (i === S.color ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', COLOR_NAMES[i]);
      b.addEventListener('click', function () { S.color = i; saveS(); eraserOn = false; buildPen(); updatePen(); redraw(); });
      pc.appendChild(b);
    });
    var pb = $('pen-brushes'); pb.innerHTML = '';
    BRUSHES.forEach(function (br, i) {
      var b = document.createElement('button'); b.textContent = br.name; if (i === S.brush) b.className = 'on';
      b.addEventListener('click', function () { S.brush = i; saveS(); eraserOn = false; buildPen(); updatePen(); });
      pb.appendChild(b);
    });
    var ps = $('pen-sizes'); ps.innerHTML = '';
    SIZES.forEach(function (sz, i) {
      var b = document.createElement('button'); b.textContent = sz.name; if (i === S.size) b.className = 'on';
      b.addEventListener('click', function () { S.size = i; saveS(); buildPen(); updatePen(); });
      ps.appendChild(b);
    });
  }
  $('b-pen').addEventListener('click', function () {
    if (eraserOn) { eraserOn = false; updatePen(); redraw(); return; }
    buildPen(); openSheet('sheet-pen');
  });
  $('b-eraser').addEventListener('click', function () { eraserOn = !eraserOn; updatePen(); redraw(); });
  $('b-undo').addEventListener('click', undo);
  $('b-redo').addEventListener('click', redo);
  $('z-in').addEventListener('click', function () { var c = zoomCenter(); zoomAt(1.6, c.x, c.y); });
  $('z-out').addEventListener('click', function () { var c = zoomCenter(); zoomAt(1 / 1.6, c.x, c.y); });
  $('z-fit').addEventListener('click', function () { fit(); redraw(); });
  function zoomCenter() { return S.mode === 'pad' ? toScreen(cursor.x, cursor.y) : { x: CW / 2, y: CH / 2 }; }

  // ayarlar
  function syncSettings() {
    document.querySelectorAll('[data-set]').forEach(function (g) {
      var k = g.dataset.set;
      g.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', String(S[k]) === b.dataset.v); });
    });
    updateSensorText();
  }
  document.querySelectorAll('[data-set]').forEach(function (g) {
    var k = g.dataset.set;
    g.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.v, num = Number(v);
        S[k] = ENUMS[k].indexOf(num) >= 0 ? num : v; saveS();
        if (k === 'jolt' && S.jolt !== 'kapali') meter.setLevel(S.jolt);
        if (k === 'paper') baseDirty = true;
        if (k === 'rec' && !S.rec) flushVib();
        if (k === 'jolt' && S.jolt !== 'kapali' && !listening) askSensor();
        syncSettings(); updateChip(); redraw();
      });
    });
  });
  function updateSensorText(msg) {
    var el = $('sensor-state'); if (!el) return;
    if (msg) el.textContent = msg;
    else if (sensorOn) el.textContent = 'Sensör açık' + (rate ? ' · ' + Math.round(rate) + ' Hz' : '') + '. Üstteki küçük ekran sarsıntıyı gösterir; sarı çizgi eşik.';
    else if (listening) el.textContent = 'Sensörden veri gelmiyor (bilgisayarda olur). Telefonda dene.';
    else el.textContent = 'Sensör kapalı: süzgeç çalışmıyor.';
    $('sensor-ask-row').hidden = sensorOn || listening;
  }
  $('sensor-ask').addEventListener('click', function () { askSensor().then(syncSettings); });
  $('b-set').addEventListener('click', function () { syncSettings(); openSheet('sheet-set'); });
  $('b-seis').addEventListener('click', function () { syncSettings(); openSheet('sheet-set'); });
  $('b-help').addEventListener('click', function () { openSheet('intro'); });

  // yolculuk
  var tripDraft = { line: 'marmaray', dir: 1 };
  function buildTrip() {
    $('trip-on').hidden = !trip; $('trip-off').hidden = !!trip;
    if (trip) {
      $('trip-h').textContent = trip.line === 'sayi' ? 'Yolculuk' : 'Marmaray · ' + (trip.dir > 0 ? 'Halkalı' : 'Gebze') + ' yönü';
      $('trip-now').textContent = tripTitle();
      var nx = nextTitle();
      $('t-next-sub').textContent = nx ? 'yeni sayfa: ' + nx : 'hat bitti';
      $('t-next').disabled = !nx;
      $('t-prev').disabled = !tripHist.length;
      $('trip-auto-note').textContent = !S.autoStop ? 'Sayfayı sen çeviriyorsun (Ayarlar → Durakta sayfa çevir).'
        : sensorOn ? 'Tren durup kalkınca sayfa kendiliğinden çevrilir. Yanlış olursa “Bir geri”.'
        : 'Sensör kapalı: durakta “Yeni sayfa”ya bas.';
    } else {
      document.querySelectorAll('#trip-line button').forEach(function (b) { b.classList.toggle('on', b.dataset.line === tripDraft.line); });
      document.querySelectorAll('#trip-dir button').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.dir) === tripDraft.dir); });
      var mar = tripDraft.line === 'marmaray';
      $('trip-from').hidden = !mar; $('trip-dir').hidden = !mar;
      document.querySelector('label[for="trip-from"]').hidden = !mar;
      $('trip-h').textContent = 'Yolculuk';
      var sel = $('trip-from');
      if (!sel.options.length) C.LINES.marmaray.stations.forEach(function (s, i) { var o = document.createElement('option'); o.value = i; o.textContent = s; sel.appendChild(o); });
      var last = lsGet('vagon.binis');
      if (last != null && sel.value === '0') sel.value = last;
    }
  }
  function nextTitle() {
    if (!trip) return null;
    var tr = { line: trip.line, at: trip.at, dir: trip.dir, moving: true };
    if (trip.moving) { var n = trip.line === 'sayi' ? trip.at + 1 : C.tripNext(trip); if (n == null) return null; tr.at = n; }
    var t = tripTitle(tr);
    return t.indexOf('→') >= 0 ? t : null;
  }
  $('trip-chip').addEventListener('click', function () { buildTrip(); openSheet('sheet-trip'); });
  document.querySelectorAll('#trip-line button').forEach(function (b) { b.addEventListener('click', function () { tripDraft.line = b.dataset.line; buildTrip(); }); });
  document.querySelectorAll('#trip-dir button').forEach(function (b) { b.addEventListener('click', function () { tripDraft.dir = Number(b.dataset.dir); buildTrip(); }); });
  $('t-start').addEventListener('click', function () {
    var at = tripDraft.line === 'marmaray' ? Number($('trip-from').value) : 0;
    lsSet('vagon.binis', String(at));
    trip = { line: tripDraft.line, at: at, dir: tripDraft.dir, moving: true, start: Date.now() };
    if (trip.line === 'marmaray' && C.tripNext(trip) == null) trip.dir = -trip.dir;
    tripHist = []; saveTrip();
    recAdd({ k: 'trip', start: tripTitle(), line: trip.line, at: trip.at, dir: trip.dir });
    labNote('Yolculuk: ' + tripTitle() + (trip.line === 'marmaray' ? ' (' + (trip.dir > 0 ? 'Halkalı' : 'Gebze') + ' yönü)' : ''));
    closeSheets();
    maybeTurn('baslangic', JSON.stringify(trip));
    updateChip();
  });
  $('t-next').addEventListener('click', function () {
    if (!trip) return;
    var before = JSON.stringify(trip);
    pushTrip();
    if (trip.moving) { var n = tripNext(); if (n == null) return; trip.at = n; }
    trip.moving = true; saveTrip();
    manualAt = performance.now();
    recAdd({ k: 'station', how: 'elle', t: Math.round(manualAt), trip: tripTitle() }); bumpRec('stations');
    closeSheets(); maybeTurn('elle', before);
  });
  $('t-prev').addEventListener('click', function () {
    var s = tripHist.pop(); if (!s) return;
    trip = JSON.parse(s); saveTrip();
    recAdd({ k: 'station', how: 'geri', t: Math.round(performance.now()), trip: tripTitle() });
    page.title = tripTitle(); baseDirty = true; saveNow();
    updateChip(); buildTrip(); redraw();
  });
  $('t-flip').addEventListener('click', function () {
    pushTrip(); trip.dir = -trip.dir; saveTrip();
    page.title = tripTitle(); baseDirty = true; saveNow(); updateChip(); buildTrip(); redraw();
  });
  $('t-end').addEventListener('click', function () {
    notePage(page);
    trip = null; tripHist = []; saveTrip(); closeSheets(); updateChip();
  });

  /* ================= defter ================= */
  var thumbs = new Map(), menuPage = null, ready = { png: null, svg: null }, recBlob = null;
  function drawPageTo(c, w, pg, paper) {
    var k = w / W;
    c.setTransform(k, 0, 0, k, 0, 0);
    drawPaper(c, pg, paper);
    for (var i = 0; i < pg.strokes.length; i++) drawStroke(c, strokePts(pg.strokes[i]), pg.strokes[i]);
  }
  function openBook() {
    saveNow(); notePage(page); flushVib();
    $('book').hidden = false;
    $('book-nasildi').hidden = !window.Hesap;
    renderPages();
    updateRecInfo();
    prepareRec();
  }
  function renderPages() {
    var box = $('pages'); box.innerHTML = '';
    var list = pages.slice().sort(function (a, b) { return b.created - a.created; });
    var tw = 160, dpr = Math.min(2, DPR);
    list.forEach(function (pg) {
      var card = document.createElement('button'); card.type = 'button'; card.className = 'pg' + (pg === page ? ' cur' : '');
      var cv = document.createElement('canvas'); cv.width = Math.round(tw * dpr); cv.height = Math.round(tw * dpr * H / W);
      var key = pg.id + ':' + pg.updated + ':' + pg.strokes.length + ':' + S.paper;
      var cached = thumbs.get(pg.id);
      if (cached && cached.key === key) cv.getContext('2d').drawImage(cached.cv, 0, 0);
      else { drawPageTo(cv.getContext('2d'), cv.width, pg, S.paper); var cp = document.createElement('canvas'); cp.width = cv.width; cp.height = cv.height; cp.getContext('2d').drawImage(cv, 0, 0); thumbs.set(pg.id, { key: key, cv: cp }); }
      var j = pageFixes(pg);
      var t1 = document.createElement('div'); t1.className = 'pt'; t1.textContent = pg.title || ('Sayfa ' + pg.n);
      var t2 = document.createElement('div'); t2.className = 'ps'; t2.textContent = 's. ' + pg.n + ' · ' + pg.strokes.length + ' çizgi' + (j ? ' · ' + j + ' düzeltme' : '');
      card.appendChild(cv); card.appendChild(t1); card.appendChild(t2);
      card.addEventListener('click', function () { openPageMenu(pg); });
      box.appendChild(card);
    });
  }
  function openPageMenu(pg) {
    menuPage = pg;
    $('pm-title').textContent = (pg.title || ('Sayfa ' + pg.n)) + ' · s. ' + pg.n;
    $('pm-del').textContent = 'Sil'; $('pm-del').dataset.arm = '';
    ready = { png: null, svg: null };
    // paylaşım dosyalarını önceden hazırla (iOS paylaşımı dokunuşun içinde ister)
    var cv = document.createElement('canvas'); cv.width = 1500; cv.height = Math.round(1500 * H / W);
    drawPageTo(cv.getContext('2d'), 1500, pg, S.paper);
    cv.toBlob(function (b) { if (menuPage === pg) ready.png = b; }, 'image/png');
    ready.svg = new Blob([pageSVG(pg)], { type: 'image/svg+xml' });
    openSheet('sheet-page');
  }
  function fileName(pg, ext) {
    var d = new Date(pg.created), p2 = function (n) { return String(n).padStart(2, '0'); };
    return 'vagon-defteri-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-s' + pg.n + '.' + ext;
  }
  function shareBlob(blob, name, title) {
    if (!blob) { toast('Hazırlanıyor, bir daha bas.'); return; }
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: title }).catch(function (e) { if (e && e.name !== 'AbortError') download(blob, name); });
      return;
    }
    download(blob, name);
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pageSVG(pg) {
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">',
      '<rect width="' + W + '" height="' + H + '" fill="' + PAPER + '"/>',
      '<text x="44" y="66" font-family="system-ui, sans-serif" font-weight="600" font-size="30" fill="#958e7f">' + esc(pg.title || ('Sayfa ' + pg.n)) + '</text>',
      '<text x="' + (W - 44) + '" y="64" text-anchor="end" font-family="system-ui, sans-serif" font-size="23" fill="#958e7f">' + esc(dateStr(pg.created)) + '</text>'];
    pg.strokes.forEach(function (st) {
      var p = strokePts(st), br = BRUSHES[st.b], w = brushW(st), d;
      if (p.length < 2) { out.push('<circle cx="' + p[0].x + '" cy="' + p[0].y + '" r="' + (w / 2).toFixed(1) + '" fill="' + COLORS[st.c] + '"/>'); return; }
      d = 'M' + p[0].x.toFixed(1) + ' ' + p[0].y.toFixed(1);
      for (var i = 1; i < p.length - 1; i++) d += 'Q' + p[i].x.toFixed(1) + ' ' + p[i].y.toFixed(1) + ' ' + ((p[i].x + p[i + 1].x) / 2).toFixed(1) + ' ' + ((p[i].y + p[i + 1].y) / 2).toFixed(1);
      d += 'L' + p[p.length - 1].x.toFixed(1) + ' ' + p[p.length - 1].y.toFixed(1);
      out.push('<path d="' + d + '" fill="none" stroke="' + COLORS[st.c] + '" stroke-width="' + w.toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"' +
        (br.alpha ? ' stroke-opacity="' + br.alpha + '"' : '') + (br.multiply ? ' style="mix-blend-mode:multiply"' : '') + '/>');
    });
    out.push('</svg>');
    return out.join('\n');
  }
  $('b-book').addEventListener('click', openBook);
  $('book-x').addEventListener('click', function () { $('book').hidden = true; redraw(); });
  $('book-new').addEventListener('click', function () {
    var pg = page.strokes.length ? newPage(trip ? tripTitle() : '') : page;
    if (pg !== page) { notePage(page); setPage(pg, false); saveNow(); }
    $('book').hidden = true; redraw();
  });
  $('book-trip').addEventListener('click', function () { $('book').hidden = true; buildTrip(); openSheet('sheet-trip'); });
  $('pm-open').addEventListener('click', function () { if (menuPage) { setPage(menuPage, false); closeSheets(); $('book').hidden = true; } });
  $('pm-png').addEventListener('click', function () { if (menuPage) shareBlob(ready.png, fileName(menuPage, 'png'), menuPage.title || 'Vagon Defteri'); });
  $('pm-svg').addEventListener('click', function () { if (menuPage) shareBlob(ready.svg, fileName(menuPage, 'svg'), menuPage.title || 'Vagon Defteri'); });
  $('pm-del').addEventListener('click', function () {
    var b = $('pm-del'), pg = menuPage;
    if (!pg) return;
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Silmek için bir daha bas'; setTimeout(function () { b.dataset.arm = ''; b.textContent = 'Sil'; }, 3000); return; }
    pages.splice(pages.indexOf(pg), 1); DB.del('pages', pg.id); thumbs.delete(pg.id);
    if (pg === page) {
      var rest = pages.slice().sort(function (a, c) { return c.created - a.created; });
      setPage(rest[0] || newPage(trip ? tripTitle() : ''), false); saveNow();
    }
    closeSheets(); renderPages();
  });
  function updateRecInfo() {
    var r = recStats;
    if (!r.strokes && !r.stations) { $('rec-info').textContent = S.rec ? 'Henüz kayıt yok. Sensör açıkken çizdikçe dolar.' : 'Kayıt kapalı (Ayarlar).'; }
    else {
      $('rec-info').textContent = r.strokes + ' çizgi, ' + (r.jolts || 0) + ' sarsıntı, ' + (r.fixes || 0) + ' düzeltme' + (r.reverts ? ', ' + r.reverts + ' geri alınan düzeltme' : '') +
        (r.stations ? ', elle ' + r.stations + ' durak' : '') + (r.since ? ' · ' + dateStr(r.since) + "'dan beri" : '') + '. Paylaşıp Claude’a gönderirsen süzgeci ve durak sezmeyi buna göre ayarlarız.';
    }
  }
  function prepareRec() {
    recBlob = null;
    $('rec-share').disabled = true;
    DB.all('rec').then(function (rows) {
      var payload = { app: 'vagon-defteri', v: 1, exported: new Date().toISOString(), ua: navigator.userAgent, screen: [screen.width, screen.height, DPR], tune: C.TUNE, settings: S, stats: recStats, records: rows };
      recBlob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      $('rec-share').disabled = !rows.length;
      if (rows.length) $('rec-share').textContent = 'Kaydı paylaş (' + Math.max(1, Math.round(recBlob.size / 1024)) + ' KB)';
    });
  }
  $('rec-share').addEventListener('click', function () {
    var d = new Date(), p2 = function (n) { return String(n).padStart(2, '0'); };
    shareBlob(recBlob, 'vagon-kayit-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.json', 'Vagon Defteri kaydı');
  });
  $('rec-clear').addEventListener('click', function () {
    var b = $('rec-clear');
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Emin misin? Bir daha bas'; setTimeout(function () { b.dataset.arm = ''; b.textContent = 'Temizle'; }, 3000); return; }
    b.dataset.arm = ''; b.textContent = 'Temizle';
    DB.clear('rec'); vibLog = [];
    recStats = { strokes: 0, jolts: 0, fixes: 0, reverts: 0, stations: 0, since: 0 }; lsSet('vagon.kayit', JSON.stringify(recStats));
    updateRecInfo(); prepareRec();
  });

  /* ================= tanıtım ================= */
  $('intro-sensor').addEventListener('click', function () {
    S.intro = 1; saveS(); closeSheets();
    askSensor().then(function () { showHint(HINTS[S.mode], 7000); updateChip(); });
  });
  $('intro-go').addEventListener('click', function () { S.intro = 1; saveS(); closeSheets(); showHint(HINTS[S.mode], 7000); });

  /* ================= klavye (bilgisayarda deneme) ================= */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  });

  /* ================= yaşam döngüsü ================= */
  document.addEventListener('visibilitychange', function () { if (document.hidden) { saveNow(); flushVib(); } else redraw(); });
  window.addEventListener('pagehide', function () { saveNow(); flushVib(); notePage(page); });
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  function init(list) {
    pages = (list || []).filter(function (p) { return p && p.id && Array.isArray(p.strokes); });
    var cur = lsGet('vagon.sayfa');
    page = pages.filter(function (p) { return p.id === cur; })[0] || pages.slice().sort(function (a, b) { return b.created - a.created; })[0];
    if (!page) page = newPage(trip ? tripTitle() : '');
    if (trip && !page.strokes.length && page.title !== tripTitle()) page.title = tripTitle();
    resize(); fit(); centerCursor();
    updateMode(); updatePen(); updateChip(); updateUndo();
    if (!S.intro) openSheet('intro');
    else showHint(HINTS[S.mode], 4500);
    startSensor();
    drawSeis(performance.now());
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    redraw();
    window.__vagon.ready = true;
  }

  // deneme kancası
  window.__vagon = {
    C: C, S: S, meter: meter, stopper: stopper, view: view, cursor: cursor,
    get page() { return page; }, get pages() { return pages; }, get trip() { return trip; }, get ink() { return ink; },
    get sensorOn() { return sensorOn; }, get flashes() { return flashes; },
    toPage: toPage, toScreen: toScreen, undo: undo, redo: redo, setMode: setMode, openBook: openBook,
    feedMotion: function (t, ax, ay, az) { onMotion({ timeStamp: t, acceleration: { x: ax, y: ay, z: az }, rotationRate: { alpha: 0, beta: 0, gamma: 0 } }); },
    stopEvent: onStopEvent, recStats: function () { return recStats; }, dbMem: DB.mem,
    ready: false,
  };
  DB.all('pages').then(init, function () { init([]); });
})();
