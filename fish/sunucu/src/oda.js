// One room: the waiting room, a shared pond for a five-minute round, and the results.
//
// The server decides everything that matters: who eats whom, bites, deaths, sizes and the
// wild fish. Each page moves its own koi (so it feels instant) and reports where it is; the
// server checks that the move is possible and corrects the page if it isn't.
//
// Page -> server:  merhaba {token, profil, kur, ekran}   k {x, y, a, v, h}   basla   ekran {e}
// Server -> page:  hos, oda, basla, dog, d (snapshot, 10 per second), isir, oldun, duz, son, hata
import { DurableObject } from 'cloudflare:workers';
import { oyuncu as kimlik } from './dogrula.js';
import * as K from './kurallar.js';

const TICK_MS = 50;              // simulation: 20 steps a second
const ANLIK_HER = 2;             // a snapshot every second step (10 a second)
const HEDEF = 15;                // wild fish kept around each koi, like the single-player pond
const EN_COK_NPC = 240;
const NABIZ = 2 * 60 * 1000;     // the room tells the lobby it is alive this often
const BOS_KAPAT = 30 * 1000;     // an empty room closes after this long

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const wrapA = a => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

// The same follow-the-leader spine as index.html: collisions use points 1, 3 and 5.
function initSpine(f, l) {
  const seg = l / 9;
  f.spine = [];
  for (let i = 0; i < 10; i++) f.spine.push({ x: f.x - Math.cos(f.angle) * seg * i, y: f.y - Math.sin(f.angle) * seg * i });
}
function updateSpine(f, l, hx, hy) {
  const s = f.spine, seg = l / 9;
  s[0].x = hx; s[0].y = hy;
  let prevA = f.angle + Math.PI;
  for (let i = 1; i < 10; i++) {
    const a = s[i - 1], b = s[i];
    let ang = Math.atan2(b.y - a.y, b.x - a.x);
    const d = wrapA(ang - prevA), lim = i === 1 ? .35 : .42;
    if (d > lim) ang = prevA + lim; else if (d < -lim) ang = prevA - lim;
    b.x = a.x + Math.cos(ang) * seg; b.y = a.y + Math.sin(ang) * seg;
    prevA = ang;
  }
}
function turnToward(o, a, rate) { o.angle += clamp(wrapA(a - o.angle), -rate, rate); }
function ekranAl(e) {
  const w = clamp(+(e && e[0]) || 390, 240, 3000), h = clamp(+(e && e[1]) || 844, 240, 3000);
  return { w, h };
}
function gonder(ws, m) {
  if (!ws) return;
  try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {}
}

export class Oda extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;            // { id, kurucu (profile id), durum: 'bekliyor' | 'oyunda', bitis, olusturma, tur }
    this.oyuncular = new Map();  // profile id -> koi
    this.canli = [];             // koi in the pond this step
    this.npc = [];
    this.npcNo = 1;
    this.no = 1;                 // short number for the next koi (used in snapshots)
    this.olaylar = [];
    this.dongu = null;
    this.tickNo = 0;
    this.R = 900;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      // A round can't survive a restart: the pond lived in memory.
      if (this.meta && this.meta.durum === 'oyunda') { this.meta.durum = 'bekliyor'; this.meta.bitis = 0; }
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (a && a.pid) {
          this.oyuncular.set(a.pid, this.yeniKoi(a, ws));
          this.no = Math.max(this.no, a.no + 1);
        }
      }
    });
  }

  async fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/oda\/([a-z0-9]{8})$/);
    if (!m) return new Response('bad room\n', { status: 400 });
    const [istemci, sunucu] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(sunucu);
    sunucu.serializeAttachment({ oda: m[1] });
    return new Response(null, { status: 101, webSocket: istemci });
  }

  /* ---------- connections ---------- */
  async webSocketMessage(ws, ham) {
    if (typeof ham !== 'string' || ham.length > 4096) return;
    let m;
    try { m = JSON.parse(ham); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const a = ws.deserializeAttachment() || {};
    if (!a.pid) {
      if (m.t === 'merhaba' && !a.bekliyor) {
        ws.serializeAttachment(Object.assign({}, a, { bekliyor: true }));
        await this.merhaba(ws, a.oda, m);
      }
      return;
    }
    const o = this.oyuncular.get(a.pid);
    if (!o || o.ws !== ws) return;
    if (m.t === 'k') this.konum(o, m);
    else if (m.t === 'basla') this.basla(o);
    else if (m.t === 'ekran') { o.ekran = ekranAl(m.e); if (o.canli) this.gorus(o); }
  }

  async webSocketClose(ws) {
    await this.ayrildi(ws);
    try { ws.close(1000, 'bye'); } catch (e) {}
  }

  async webSocketError(ws) {
    await this.ayrildi(ws);
  }

  async merhaba(ws, odaId, m) {
    const kapat = (neden, kod) => { gonder(ws, { t: 'hata', neden }); try { ws.close(kod, neden); } catch (e) {} };
    const kim = await kimlik(this.env, m);
    if (!kim) return kapat('giris', 4001);
    if (!this.meta) {
      if (!m.kur) return kapat('yok', 4004);
      this.meta = { id: odaId, kurucu: kim.pid, durum: 'bekliyor', bitis: 0, olusturma: Date.now(), tur: 0 };
      await this.ctx.storage.put('meta', this.meta);
    }
    let o = this.oyuncular.get(kim.pid);
    if (o && o.ws && o.ws !== ws) {
      // The same player opened the room again (another tab or a new connection): keep the new one.
      const eski = o.ws;
      o.ws = null;
      gonder(eski, { t: 'hata', neden: 'baska' });
      try { eski.close(4009, 'replaced'); } catch (e) {}
    }
    if (!o) {
      if (this.bagliSayisi() >= K.EN_COK) return kapat('dolu', 4003);
      o = this.yeniKoi({ pid: kim.pid, no: this.no++, ad: kim.ad, renk: kim.renk, giris: Date.now() }, ws);
      this.oyuncular.set(kim.pid, o);
    }
    o.ad = kim.ad; o.renk = kim.renk;
    o.ws = ws; o.gitti = 0; o.ekran = ekranAl(m.ekran);
    ws.serializeAttachment({ oda: odaId, pid: o.pid, no: o.no, ad: o.ad, renk: o.renk, giris: o.giris });
    this.kurucuSec();
    gonder(ws, { t: 'hos', ben: o.no });
    this.odaYayinla();
    if (this.meta.durum === 'oyunda') {
      gonder(ws, this.baslaMesaji());
      if (o.canli) gonder(ws, this.dogMesaji(o));
      else if (o.olumT <= 0) this.dogur(o, null, o.geriL || K.BASLANGIC);
    }
    await this.ctx.storage.setAlarm(Date.now() + NABIZ);
    await this.lobiyeBildir();
  }

  async ayrildi(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.pid) return;
    const o = this.oyuncular.get(a.pid);
    if (!o || o.ws !== ws) return;
    o.ws = null;
    if (this.meta && this.meta.durum === 'oyunda') {
      // Leaves the pond, but keeps its size for a little while in case the connection comes back.
      if (o.canli) { o.geriL = o.l; o.canli = false; o.olumT = 0; }
      o.gitti = Date.now();
    } else {
      this.oyuncular.delete(a.pid);
    }
    if (!this.meta) return;
    this.kurucuSec();
    if (!this.bagliSayisi()) await this.ctx.storage.setAlarm(Date.now() + BOS_KAPAT);
    this.odaYayinla();
    await this.lobiyeBildir();
  }

  async alarm() {
    if (!this.meta) return;
    if (!this.bagliSayisi()) return this.kapat();
    await this.lobiyeBildir();
    await this.ctx.storage.setAlarm(Date.now() + NABIZ);
  }

  async kapat() {
    if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
    const id = this.meta && this.meta.id;
    this.meta = null;
    this.oyuncular.clear();
    this.npc = [];
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (id) { try { await this.lobi().oda(id, null); } catch (e) {} }
  }

  yeniKoi(a, ws) {
    return {
      pid: a.pid, no: a.no, ad: a.ad, renk: a.renk, giris: a.giris || Date.now(), ws, gitti: 0, ekran: { w: 390, h: 844 },
      x: 0, y: 0, ex: 0, ey: 0, angle: 0, v: 0, rt: 0, l: K.BASLANGIC, can: K.CAN, canli: false, olumT: 0,
      koruma: 0, invuln: 0, hayat: 0, spine: null, hw: 40, hh: 80, spawnT: 0, geriL: 0,
      enBuyuk: K.BASLANGIC, yedigi: 0, koi: 0, tally: {}
    };
  }

  bagliSayisi() { let n = 0; for (const o of this.oyuncular.values()) if (o.ws) n++; return n; }

  kurucuSec() {
    if (!this.meta) return;
    const k = this.oyuncular.get(this.meta.kurucu);
    if (k && k.ws) return;
    let en = null;
    for (const o of this.oyuncular.values()) if (o.ws && (!en || o.giris < en.giris)) en = o;
    if (en && en.pid !== this.meta.kurucu) {
      this.meta.kurucu = en.pid;
      this.ctx.storage.put('meta', this.meta);
    }
  }

  lobi() { return this.env.LOBI.get(this.env.LOBI.idFromName('lobi')); }

  async lobiyeBildir() {
    if (!this.meta) return;
    const k = this.oyuncular.get(this.meta.kurucu);
    try {
      await this.lobi().oda(this.meta.id, {
        kurucu: k ? k.ad : '?', renk: k ? k.renk : '#f27a32', n: this.bagliSayisi(), en: K.EN_COK,
        durum: this.meta.durum, bitis: this.meta.bitis, olusturma: this.meta.olusturma
      });
    } catch (e) {}
  }

  yayinla(m) {
    const s = JSON.stringify(m);
    for (const o of this.oyuncular.values()) gonder(o.ws, s);
  }

  kalan() { return this.meta && this.meta.bitis ? Math.max(0, this.meta.bitis - Date.now()) : 0; }

  odaMesaji() {
    const k = this.oyuncular.get(this.meta.kurucu);
    const liste = [...this.oyuncular.values()].filter(o => o.ws).sort((a, b) => a.giris - b.giris)
      .map(o => ({ no: o.no, ad: o.ad, renk: o.renk }));
    return { t: 'oda', id: this.meta.id, durum: this.meta.durum, kurucu: k ? k.no : 0, oyuncular: liste, kalan: this.kalan(), en: K.EN_COK };
  }

  odaYayinla() { if (this.meta) this.yayinla(this.odaMesaji()); }

  baslaMesaji() { return { t: 'basla', R: this.R, kalan: this.kalan(), tur: this.meta.tur }; }

  dogMesaji(o) {
    return { t: 'dog', x: r1(o.x), y: r1(o.y), a: r2(o.angle), l: r2(o.l), h: o.hayat, can: o.can, R: this.R };
  }

  /* ---------- round ---------- */
  basla(o) {
    if (!this.meta || this.meta.durum === 'oyunda' || this.meta.kurucu !== o.pid) return;
    for (const k of [...this.oyuncular.values()]) if (!k.ws) this.oyuncular.delete(k.pid);
    const bagli = [...this.oyuncular.values()].sort((a, b) => a.giris - b.giris);
    this.meta.durum = 'oyunda';
    this.meta.bitis = Date.now() + K.TUR_SURESI;
    this.meta.tur = (this.meta.tur || 0) + 1;
    this.ctx.storage.put('meta', this.meta);
    this.npc = []; this.olaylar = []; this.tickNo = 0;
    this.R = K.golYaricap(bagli.length, 0);
    this.yayinla(this.baslaMesaji());
    // Start everyone on a ring around the middle: apart, but not far apart.
    const a0 = rand(-Math.PI, Math.PI);
    bagli.forEach((k, i) => {
      Object.assign(k, { enBuyuk: K.BASLANGIC, yedigi: 0, koi: 0, tally: {}, hayat: 0, geriL: 0, olumT: 0 });
      const ang = a0 + i * TAU / bagli.length, d = bagli.length > 1 ? this.R * .3 : 0;
      this.dogur(k, { x: Math.cos(ang) * d, y: Math.sin(ang) * d }, K.BASLANGIC);
    });
    this.odaYayinla();
    if (this.dongu) clearInterval(this.dongu);
    this.dongu = setInterval(() => this.tick(), TICK_MS);
    this.lobiyeBildir();
  }

  bitir() {
    if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
    const sonuc = [...this.oyuncular.values()]
      .sort((a, b) => b.enBuyuk - a.enBuyuk || b.yedigi - a.yedigi)
      .map(o => ({ no: o.no, ad: o.ad, renk: o.renk, enBuyuk: r1(o.enBuyuk), yedigi: o.yedigi, koi: o.koi, tally: o.tally }));
    this.meta.durum = 'bekliyor';
    this.meta.bitis = 0;
    this.ctx.storage.put('meta', this.meta);
    this.npc = []; this.olaylar = []; this.canli = [];
    for (const o of [...this.oyuncular.values()]) {
      if (!o.ws) this.oyuncular.delete(o.pid);
      else { o.canli = false; o.olumT = 0; o.l = K.BASLANGIC; }
    }
    this.yayinla({ t: 'son', sonuc, tur: this.meta.tur });
    this.kurucuSec();
    this.odaYayinla();
    this.lobiyeBildir();
  }

  // Puts a koi (back) in the pond.
  dogur(o, yer, l) {
    l = l || K.BASLANGIC;
    const p = yer || this.guvenliYer(l);
    o.x = o.ex = p.x; o.y = o.ey = p.y; o.angle = rand(-Math.PI, Math.PI); o.v = 0; o.rt = Date.now();
    o.l = l; o.can = K.CAN; o.canli = true; o.koruma = K.KORUMA; o.invuln = 0; o.hayat++; o.geriL = 0; o.olumT = 0;
    o.enBuyuk = Math.max(o.enBuyuk, l);
    initSpine(o, l);
    this.gorus(o);
    gonder(o.ws, this.dogMesaji(o));
    for (let i = 0; i < 4; i++) this.grupDogur(o, true, true);
    for (let i = 0; i < 2; i++) this.grupDogur(o, true, false);
  }

  // A spot far from koi big enough to eat a newcomer.
  guvenliYer(l) {
    const s = this.R * .85;
    let en = null, enPuan = -1;
    for (let t = 0; t < 24; t++) {
      const x = rand(-s, s), y = rand(-s, s);
      let puan = 1e9;
      for (const o of this.canli) if (o.canli && o.l > l * K.TEHLIKE) puan = Math.min(puan, Math.hypot(o.ex - x, o.ey - y) / o.l);
      if (puan > enPuan) { enPuan = puan; en = { x, y }; }
      if (puan > 12) break;
    }
    return en;
  }

  // How much of the pond this koi's screen shows (the page uses the same camera formula).
  gorus(o) {
    const sc = K.olcek(o.ekran.w, o.ekran.h, o.l);
    o.hw = o.ekran.w / 2 / sc; o.hh = o.ekran.h / 2 / sc;
  }

  konum(o, m) {
    if (!this.meta || this.meta.durum !== 'oyunda' || !o.canli || m.h !== o.hayat) return;
    let x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const simdi = Date.now(), dt = clamp((simdi - o.rt) / 1000, .02, 1);
    const enFazla = K.HIZ * o.l * K.hizCarpani(o.l) * 1.5 * dt + o.l * .6;
    const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
    let duz = false;
    if (d > enFazla) { x = o.x + dx / d * enFazla; y = o.y + dy / d * enFazla; duz = d - enFazla > o.l * .5; }
    const s = this.R - o.l * .3;
    if (Math.abs(x) > s || Math.abs(y) > s) {
      const nx = clamp(x, -s, s), ny = clamp(y, -s, s);
      duz = duz || Math.hypot(nx - x, ny - y) > o.l * .5;
      x = nx; y = ny;
    }
    o.x = x; o.y = y; o.rt = simdi;
    o.angle = wrapA(+m.a || 0);
    o.v = clamp(+m.v || 0, 0, K.HIZ * o.l * K.hizCarpani(o.l) * 1.3);
    if (duz) gonder(o.ws, { t: 'duz', x: r1(x), y: r1(y) });
  }

  tick() {
    if (!this.meta || this.meta.durum !== 'oyunda') { if (this.dongu) { clearInterval(this.dongu); this.dongu = null; } return; }
    const simdi = Date.now(), dt = TICK_MS / 1000;
    this.tickNo++;
    if (simdi >= this.meta.bitis) { this.bitir(); return; }
    let enBuyuk = 0;
    this.canli = [];
    for (const o of [...this.oyuncular.values()]) {
      if (!o.ws) { if (simdi - o.gitti > K.GERI_DONUS) this.oyuncular.delete(o.pid); continue; }
      if (!o.canli) {
        o.olumT -= dt;
        if (o.olumT <= 0) this.dogur(o, null, K.BASLANGIC);
        if (!o.canli) continue;
      }
      o.koruma = Math.max(0, o.koruma - dt);
      o.invuln = Math.max(0, o.invuln - dt);
      // Reports arrive 15 times a second; guess where the koi is right now.
      const ileri = Math.min(.15, (simdi - o.rt) / 1000) * o.v;
      o.ex = o.x + Math.cos(o.angle) * ileri; o.ey = o.y + Math.sin(o.angle) * ileri;
      updateSpine(o, o.l, o.ex, o.ey);
      this.gorus(o);
      enBuyuk = Math.max(enBuyuk, o.l);
      this.canli.push(o);
    }
    const R = Math.ceil(enBuyuk * 5.5 / 10) * 10;
    if (R > this.R) this.R = R;
    this.npcGuncelle(dt);
    this.carpisma();
    this.npcYonet(dt);
    if (this.tickNo % ANLIK_HER === 0) this.anlik();
  }

  /* ---------- wild fish ---------- */
  npcYap(l, x, y, a) {
    const f = {
      id: this.npcNo++, tur: K.turIcin(l), l, x, y, angle: a, speed: l * rand(.7, 1.1) * K.hizCarpani(l), cruise: l * rand(.7, 1.15) * K.hizCarpani(l),
      wander: a, wanderT: rand(1, 3), chaseT: 0, cool: rand(0, 2), hungry: Math.random() < .65,
      juke: 0, jukeT: 0, dead: false, hedef: 0, ox: x, oy: y, spine: null
    };
    initSpine(f, l);
    this.npc.push(f);
    return f;
  }

  boyCek(o) {
    const L = o.l;
    if (o.koruma > 0) return L * rand(.3, .8);
    const dangerP = .22 + Math.min(.12, L / 1200), u = Math.random();
    let r;
    if (u < dangerP) r = rand(1.15, 2.3);
    else if (u < dangerP + .1) r = rand(.9, 1.1);
    else r = .28 + Math.pow(Math.random(), .85) * .58;
    return Math.max(3, L * r);
  }

  // spawnGroup() from index.html, around one koi and inside the pond.
  grupDogur(o, gorunur, yenir) {
    const l = Math.max(3, yenir ? o.l * rand(.3, .8) : this.boyCek(o));
    const tur = K.turIcin(l), T = K.TURLER[tur], R = this.R, hw = o.hw, hh = o.hh;
    const icinde = (x, y) => Math.abs(x) < R - l && Math.abs(y) < R - l;
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      if (gorunur) {
        x = o.ex + rand(-.85, .85) * hw; y = o.ey + rand(-.8, .8) * hh;
        ok = Math.hypot(x - o.ex, y - o.ey) > o.l * 2.2 && icinde(x, y);
      } else {
        const m = l * 1.1 + hw * .02, u = Math.random() * (4 * hw + 4 * hh);
        if (u < 2 * hw) { x = o.ex + rand(-hw, hw); y = o.ey - hh - m; }
        else if (u < 4 * hw) { x = o.ex + rand(-hw, hw); y = o.ey + hh + m; }
        else if (u < 4 * hw + 2 * hh) { x = o.ex - hw - m; y = o.ey + rand(-hh, hh); }
        else { x = o.ex + hw + m; y = o.ey + rand(-hh, hh); }
        ok = icinde(x, y);
      }
    }
    // The screen is bigger than the pond (a huge koi): anywhere in the water, not on top of it.
    for (let t = 0; t < 8 && !ok; t++) {
      x = rand(-(R - l), R - l); y = rand(-(R - l), R - l);
      ok = Math.hypot(x - o.ex, y - o.ey) > o.l * 4;
    }
    if (!ok) return;
    const head = gorunur ? rand(-Math.PI, Math.PI) : Math.atan2(o.ey - y, o.ex - x) + rand(-.6, .6);
    const n = (l < o.l * .6 && T.max <= 45 && Math.random() < .5) ? 2 + (Math.random() * 3 | 0) : 1;
    for (let k = 0; k < n && this.npc.length < EN_COK_NPC; k++) {
      const ll = clamp(l * rand(.88, 1.12), Math.max(3, T.min), T.max - .01), s = R - ll;
      this.npcYap(ll, clamp(x + rand(-1, 1) * l * 1.4, -s, s), clamp(y + rand(-1, 1) * l * 1.4, -s, s), head + rand(-.25, .25));
    }
  }

  npcGuncelle(dt) {
    const ps = this.canli, R = this.R, iz = this.tickNo % 3 === 0;
    for (const f of this.npc) {
      if (f.dead) continue;
      const tr = clamp(4.6 * Math.pow(8 / f.l, .25), 1.5, 6);
      let ta = f.angle, ts = f.cruise, turn = tr, kac = null, kd = Infinity, av = null, ad = Infinity;
      f.cool -= dt;
      for (const o of ps) {
        const dx = o.ex - f.x, dy = o.ey - f.y, d = Math.hypot(dx, dy), rel = f.l / o.l;
        if (rel < K.YE) { if (d < o.l * 2.4 + f.l * 2 && d < kd) { kac = o; kd = d; } }
        else if (rel > K.TEHLIKE && f.hungry && f.cool <= 0 && o.invuln <= 0 && o.koruma <= 0 && d < f.l * 2.2 + o.l * 3 && d < ad) { av = o; ad = d; }
      }
      f.hedef = 0;
      if (kac) {
        f.jukeT -= dt;
        if (f.jukeT <= 0) { f.juke = rand(-.75, .75); f.jukeT = rand(.3, .8); }
        ta = Math.atan2(f.y - kac.ey, f.x - kac.ex) + f.juke; ts = f.l * 3.1 * K.hizCarpani(f.l); turn = tr * 1.3;
      } else if (av) {
        const dx = av.ex - f.x, dy = av.ey - f.y, lead = Math.min(.5, ad / (f.l * 4));
        ta = Math.atan2(dy + Math.sin(av.angle) * av.v * lead, dx + Math.cos(av.angle) * av.v * lead);
        ts = Math.min(f.l * 2.6 * K.hizCarpani(f.l), K.HIZ * av.l * K.hizCarpani(av.l) * .86); f.hedef = av.no;
        f.chaseT += dt;
        if (f.chaseT > 3.8) { f.cool = rand(3.5, 6); f.chaseT = 0; }
      } else {
        f.wanderT -= dt;
        if (f.wanderT <= 0) { f.wander = f.angle + rand(-1.1, 1.1); f.wanderT = rand(1.5, 4); }
        ta = f.wander;
      }
      // Near the bank, turn back toward open water.
      const kenar = R - f.l * 2;
      if (Math.abs(f.x) > kenar || Math.abs(f.y) > kenar) {
        const ic = Math.atan2(-f.y, -f.x);
        if (Math.abs(wrapA(ta - ic)) > Math.PI / 2) { ta = ic + f.juke * .5; f.wander = ta; }
        turn = Math.max(turn, 3);
      }
      turnToward(f, ta, turn * dt);
      f.speed += (ts - f.speed) * (1 - Math.exp(-dt * 2.6));
      if (iz) { f.ox = f.x; f.oy = f.y; }
      const s = R - f.l * .3;
      f.x = clamp(f.x + Math.cos(f.angle) * f.speed * dt, -s, s);
      f.y = clamp(f.y + Math.sin(f.angle) * f.speed * dt, -s, s);
      updateSpine(f, f.l, f.x, f.y);
    }
  }

  npcYonet(dt) {
    const ps = this.canli;
    const yakin = (f, o) => Math.abs(f.x - o.ex) <= o.hw * 1.6 + f.l * 2 && Math.abs(f.y - o.ey) <= o.hh * 1.6 + f.l * 2;
    for (let i = this.npc.length - 1; i >= 0; i--) {
      const f = this.npc[i];
      let tut = !f.dead;
      if (tut) { tut = false; for (const o of ps) if (yakin(f, o)) { tut = true; break; } }
      if (!tut) this.npc.splice(i, 1);
    }
    for (const o of ps) {
      o.spawnT -= dt;
      if (o.spawnT > 0 || this.npc.length >= EN_COK_NPC) continue;
      let n = 0;
      for (const f of this.npc) if (yakin(f, o)) n++;
      if (n < HEDEF) { this.grupDogur(o, false, false); o.spawnT = .18; }
    }
  }

  /* ---------- eating and biting ---------- */
  agizDegdi(s, hx, hy, hr, fw, ox, oy) {
    for (const i of [1, 3, 5]) {
      const dx = s[i].x + ox - hx, dy = s[i].y + oy - hy, r = hr + fw * (i === 5 ? .85 : 1.05);
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  carpisma() {
    const ps = this.canli;
    for (const o of ps) {
      if (!o.canli) continue;
      const L = o.l, a = o.angle, os = o.spine, pw = K.KOI_W * L;
      // the mouth is a little bigger than on the page: what the page shows is a moment old
      const hx = o.ex + Math.cos(a) * L * .03, hy = o.ey + Math.sin(a) * L * .03, hr = L * .13 * 1.25;
      for (const f of this.npc) {
        if (f.dead) continue;
        const ddx = f.x - o.ex, ddy = f.y - o.ey, reach = (f.l + L) * 1.3;
        if (ddx * ddx + ddy * ddy > reach * reach) continue;
        const rel = f.l / L, s = f.spine, fw = K.TURLER[f.tur].w * f.l;
        if (rel < K.YE) {
          if (this.agizDegdi(s, hx, hy, hr, fw, 0, 0) || this.agizDegdi(s, hx, hy, hr, fw, f.ox - f.x, f.oy - f.y)) this.yeNpc(o, f);
        } else if (rel > K.TEHLIKE) {
          if (o.invuln > 0 || o.koruma > 0) continue;
          const fhx = f.x + Math.cos(f.angle) * f.l * .03, fhy = f.y + Math.sin(f.angle) * f.l * .03, r = f.l * .1 * .85 + pw * .85;
          let degdi = false;
          for (const i of [1, 3, 5]) {
            const dx = os[i].x - fhx, dy = os[i].y - fhy;
            if (dx * dx + dy * dy < r * r) { degdi = true; break; }
          }
          if (degdi) { this.isir(o, f); if (!o.canli) break; }
        } else {
          // about the same size: the wild fish gets nudged aside
          const dx = s[3].x - os[3].x, dy = s[3].y - os[3].y, d = Math.hypot(dx, dy) || 1, r = (fw + pw) * 1.6;
          if (d < r) { f.x += dx / d * (r - d); f.y += dy / d * (r - d); }
        }
      }
      if (!o.canli) continue;
      for (const p of ps) {
        if (p === o || !p.canli || p.koruma > 0 || p.l / o.l >= K.YE) continue;
        const ddx = p.ex - o.ex, ddy = p.ey - o.ey, reach = (p.l + o.l) * 1.3;
        if (ddx * ddx + ddy * ddy > reach * reach) continue;
        if (this.agizDegdi(p.spine, hx, hy, hr * 1.1, K.KOI_W * p.l, 0, 0)) this.yeKoi(o, p);
      }
    }
  }

  buyut(o, l) {
    o.l = K.buyu(o.l, l);
    o.enBuyuk = Math.max(o.enBuyuk, o.l);
  }

  yeNpc(o, f) {
    f.dead = true;
    this.buyut(o, f.l);
    o.yedigi++;
    const ad = K.TURLER[f.tur].ad;
    o.tally[ad] = (o.tally[ad] || 0) + 1;
    this.olaylar.push(['y', o.no, f.id, f.tur, r1(f.spine[2].x), r1(f.spine[2].y), r2(f.l)]);
  }

  yeKoi(o, p) {
    const m = p.spine[3];
    this.buyut(o, p.l);
    o.koi++;
    this.olaylar.push(['k', o.no, p.no, r1(m.x), r1(m.y), r2(p.l)]);
    this.oldur(p, { no: o.no, ad: o.ad }, false);
  }

  isir(o, f) {
    o.can--;
    f.cool = rand(5, 8); f.chaseT = 0;
    if (o.can <= 0) { f.cool = 12; this.oldur(o, { tur: f.tur }, true); return; }
    o.invuln = 2.2;
    const dx = o.ex - f.x, dy = o.ey - f.y, d = Math.hypot(dx, dy) || 1, it = o.l * .4;
    o.x += dx / d * it; o.y += dy / d * it;
    gonder(o.ws, { t: 'isir', dx: r1(dx / d * it), dy: r1(dy / d * it), can: o.can, tur: f.tur });
    this.olaylar.push(['i', o.no, r1(o.x), r1(o.y), r2(o.l)]);
  }

  // kimden: { tur } for a wild fish, { no, ad } for a koi. A koi eaten by a wild fish
  // breaks up into little fish that anyone can eat.
  oldur(o, kimden, dagil) {
    const m = o.spine[3], tur = kimden.tur == null ? -1 : kimden.tur;
    o.canli = false; o.olumT = K.DOGMA_BEKLE; o.v = 0; o.x = m.x; o.y = m.y;
    if (dagil) {
      const n = o.l > 40 ? 8 : 6;
      for (let i = 0; i < n && this.npc.length < EN_COK_NPC; i++) {
        const f = this.npcYap(Math.max(3, o.l * rand(.28, .4)), m.x + rand(-1, 1) * o.l * .4, m.y + rand(-1, 1) * o.l * .4, rand(-Math.PI, Math.PI));
        f.hungry = false; f.speed = f.l * 2 * K.hizCarpani(f.l);
      }
    }
    gonder(o.ws, { t: 'oldun', tur, ad: kimden.ad || null, l: r2(o.l), sure: K.DOGMA_BEKLE });
    this.olaylar.push(['o', o.no, tur, kimden.no || 0, r1(m.x), r1(m.y), r2(o.l)]);
    o.l = K.BASLANGIC;
  }

  /* ---------- snapshots ---------- */
  anlik() {
    const kalan = Math.ceil(this.kalan() / 1000);
    const p = [];
    for (const o of this.oyuncular.values()) {
      if (!o.ws) continue;
      const d = o.canli ? (o.koruma > 0 || o.invuln > 0 ? 2 : 1) : 0;
      p.push([o.no, r1(o.canli ? o.ex : o.x), r1(o.canli ? o.ey : o.y), r2(o.angle), r2(o.l), r1(o.canli ? o.v : 0), d]);
    }
    const ust = '{"t":"d","R":' + this.R + ',"k":' + kalan + ',"p":' + JSON.stringify(p) + ',"e":' + JSON.stringify(this.olaylar);
    this.olaylar = [];
    for (const o of this.oyuncular.values()) {
      if (!o.ws) continue;
      const cx = o.canli ? o.ex : o.x, cy = o.canli ? o.ey : o.y, zx = o.hw * 1.7, zy = o.hh * 1.7;
      const f = [];
      for (const n of this.npc) {
        if (n.dead || Math.abs(n.x - cx) > zx + n.l * 2 || Math.abs(n.y - cy) > zy + n.l * 2) continue;
        f.push([n.id, r1(n.x), r1(n.y), r2(n.angle), r2(n.l), r1(n.speed), n.tur, n.hedef === o.no ? 1 : 0]);
      }
      const m = [o.can, o.yedigi, o.koi, r2(o.enBuyuk)];
      gonder(o.ws, ust + ',"f":' + JSON.stringify(f) + ',"m":' + JSON.stringify(m) + '}');
    }
  }
}
