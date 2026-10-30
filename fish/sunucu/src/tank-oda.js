// One Tank Arenası room: the waiting room, a three-minute round, and the results.
//
// The rules live in lab/tank/oyun.js (shared with the page). The server runs the arena: shots,
// hits, points, painting out, coming back, and the bots. Each page drives its own tank (so it
// feels instant) and reports where it is; the server checks the move and corrects the page if
// it isn't possible.
//
// Page -> server:  merhaba {token, profil, kur, surum}   k {x, y, vx, vy, g, tr, h}   a {x, y, a, s}
//                  basla   bot {n, z}
// Server -> page:  hos {ben, surum}   oda   basla {tohum, n, kalan, tur, tanklar}   s (snapshot, 15 a second)
//                  duz {x, y}   son {sonuc}   hata {neden}
import { DurableObject } from 'cloudflare:workers';
import { oyuncu as kimlik } from './dogrula.js';
import { Arena, K, SURUM, renkSec, BOT_ADLARI, itDuvar } from '../../../lab/tank/oyun.js';

const TICK_MS = 33;              // 30 steps a second
const ANLIK_HER = 2;             // a snapshot every second step (15 a second)
const NABIZ = 2 * 60 * 1000;     // the room tells the lobby it is alive this often
const BOS_KAPAT = 30 * 1000;     // an empty room closes after this long
const GERI_DONUS = 30 * 1000;    // a player who lost the connection keeps their tank and points this long
const LOBI = 'tank';             // the room list (a Lobi object of its own, separate from Fish's)

const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function gonder(ws, m) {
  if (!ws) return;
  try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {}
}
export class TankOda extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;            // { id, kurucu (profile id), durum: 'bekliyor' | 'oyunda', bitis, olusturma, tur, bot, zorluk }
    this.oyuncular = new Map();  // profile id -> { pid, no, ad, renk, giris, ws, gitti }
    this.ar = null;              // the arena during a round
    this.no = 1;
    this.olaylar = [];
    this.dongu = null;
    this.tickNo = 0;
    this.sonTick = 0;
    this.tur = Math.max(10, +env.TANK_TUR || K.TUR);  // TANK_TUR: shorter rounds for local testing
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      // A round can't survive a restart: the arena lived in memory.
      if (this.meta && this.meta.durum === 'oyunda') { this.meta.durum = 'bekliyor'; this.meta.bitis = 0; }
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (a && a.pid) {
          this.oyuncular.set(a.pid, { pid: a.pid, no: a.no, ad: a.ad, renk: a.renk, giris: a.giris, ws, gitti: 0 });
          this.no = Math.max(this.no, a.no + 1);
        }
      }
    });
  }

  async fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/tank\/oda\/([a-z0-9]{8})$/);
    if (!m) return new Response('bad room\n', { status: 400 });
    const [istemci, sunucu] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(sunucu);
    sunucu.serializeAttachment({ oda: m[1] });
    return new Response(null, { status: 101, webSocket: istemci });
  }

  /* ---------- connections ---------- */
  async webSocketMessage(ws, ham) {
    if (typeof ham !== 'string' || ham.length > 2048) return;
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
    else if (m.t === 'a') this.ates(o, m);
    else if (m.t === 'basla') this.basla(o);
    else if (m.t === 'bot') this.botAyar(o, m);
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
      this.meta = { id: odaId, kurucu: kim.pid, durum: 'bekliyor', bitis: 0, olusturma: Date.now(), tur: 0, bot: 0, zorluk: 2 };
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
      o = { pid: kim.pid, no: this.no++, ad: kim.ad, renk: kim.renk, giris: Date.now(), ws: null, gitti: 0 };
      this.oyuncular.set(kim.pid, o);
    }
    o.ad = kim.ad; o.renk = kim.renk; o.ws = ws; o.gitti = 0;
    ws.serializeAttachment({ oda: odaId, pid: o.pid, no: o.no, ad: o.ad, renk: o.renk, giris: o.giris });
    this.kurucuSec();
    this.botSigdir();
    gonder(ws, { t: 'hos', ben: o.no, surum: SURUM });
    if (this.meta.durum === 'oyunda' && this.ar) {
      // joining (or coming back) in the middle of a round
      let t = this.ar.tank(o.no);
      if (!t) {
        if (this.ar.tanklar.length >= K.EN_COK) {
          const bot = this.ar.tanklar.find(x => x.bot);
          if (bot) this.ar.sil(bot);
        }
        t = this.ar.ekle({ no: o.no, ad: o.ad, renk: o.renk, bot: 0 });
        t.uzak = true;
      }
      t.ad = o.ad; t.renk = o.renk;
      if (t.durum === 'yok') this.ar.dogur(t);
      this.odaYayinla();
      gonder(ws, this.baslaMesaji());
    } else {
      this.odaYayinla();
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
    if (this.meta && this.meta.durum === 'oyunda' && this.ar) {
      // Leaves the arena, but keeps the points for a while in case the connection comes back.
      const t = this.ar.tank(o.no);
      if (t) this.ar.cikar(t);
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
    this.ar = null;
    this.oyuncular.clear();
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (id) { try { await this.lobi().oda(id, null); } catch (e) {} }
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

  // Players and bots together never go over EN_COK.
  botSigdir() {
    if (!this.meta) return;
    const en = Math.max(0, K.EN_COK - this.bagliSayisi());
    if (this.meta.bot > en) { this.meta.bot = en; this.ctx.storage.put('meta', this.meta); }
  }

  lobi() { return this.env.LOBI.get(this.env.LOBI.idFromName(LOBI)); }

  async lobiyeBildir() {
    if (!this.meta) return;
    const k = this.oyuncular.get(this.meta.kurucu);
    try {
      await this.lobi().oda(this.meta.id, {
        kurucu: k ? k.ad : '?', renk: k ? k.renk : '#e4572e', n: this.bagliSayisi(), en: K.EN_COK,
        durum: this.meta.durum, bitis: this.meta.bitis, olusturma: this.meta.olusturma
      });
    } catch (e) {}
  }

  yayinla(m) {
    const s = JSON.stringify(m);
    for (const o of this.oyuncular.values()) gonder(o.ws, s);
  }

  kalan() { return this.meta && this.meta.bitis ? Math.max(0, this.meta.bitis - Date.now()) : 0; }

  kadro() { return this.ar ? this.ar.tanklar.map(t => ({ no: t.no, ad: t.ad, renk: t.renk, bot: t.bot })) : null; }

  odaMesaji() {
    const k = this.oyuncular.get(this.meta.kurucu);
    const liste = [...this.oyuncular.values()].filter(o => o.ws).sort((a, b) => a.giris - b.giris)
      .map(o => ({ no: o.no, ad: o.ad, renk: o.renk }));
    const m = { t: 'oda', id: this.meta.id, durum: this.meta.durum, kurucu: k ? k.no : 0, oyuncular: liste, bot: this.meta.bot || 0,
      zorluk: this.meta.zorluk || 2, kalan: this.kalan(), en: K.EN_COK };
    if (this.meta.durum === 'oyunda' && this.ar) m.tanklar = this.kadro();
    return m;
  }

  odaYayinla() { if (this.meta) this.yayinla(this.odaMesaji()); }

  baslaMesaji() {
    return { t: 'basla', tohum: this.ar.m.tohum, n: this.ar.n, kalan: this.kalan(), tur: this.meta.tur, tanklar: this.kadro() };
  }

  /* ---------- waiting room ---------- */
  botAyar(o, m) {
    if (!this.meta || this.meta.durum === 'oyunda' || this.meta.kurucu !== o.pid) return;
    const en = Math.max(0, K.EN_COK - this.bagliSayisi());
    this.meta.bot = clamp(Math.round(+m.n) || 0, 0, en);
    this.meta.zorluk = clamp(Math.round(+m.z) || 2, 1, 3);
    this.ctx.storage.put('meta', this.meta);
    this.odaYayinla();
  }

  /* ---------- the round ---------- */
  basla(o) {
    if (!this.meta || this.meta.durum === 'oyunda' || this.meta.kurucu !== o.pid) return;
    for (const k of [...this.oyuncular.values()]) if (!k.ws) this.oyuncular.delete(k.pid);
    const bagli = [...this.oyuncular.values()].sort((a, b) => a.giris - b.giris);
    this.botSigdir();
    const botN = this.meta.bot || 0, n = bagli.length + botN;
    if (n < 2) return;
    const tohum = (Math.random() * 4294967296) >>> 0;
    this.ar = new Arena(n, tohum, { sure: this.tur, pay: 4 });
    for (const k of bagli) { const t = this.ar.ekle({ no: k.no, ad: k.ad, renk: k.renk, bot: 0 }); t.uzak = true; }
    const renkler = renkSec(bagli.map(k => k.renk), botN);
    const adlar = BOT_ADLARI.filter(a => !bagli.some(k => k.ad.toLocaleLowerCase('tr') === a.toLocaleLowerCase('tr'))).sort(() => Math.random() - .5);
    for (let i = 0; i < botN; i++) this.ar.ekle({ no: 100 + i, ad: adlar[i % adlar.length], renk: renkler[i], bot: this.meta.zorluk || 2 });
    this.ar.baslat();
    this.olaylar = this.ar.olaylariAl();
    this.meta.durum = 'oyunda';
    this.meta.bitis = Date.now() + this.tur * 1000;
    this.meta.tur = (this.meta.tur || 0) + 1;
    this.ctx.storage.put('meta', this.meta);
    this.tickNo = 0;
    this.sonTick = Date.now();
    this.yayinla(this.baslaMesaji());
    this.odaYayinla();
    if (this.dongu) clearInterval(this.dongu);
    this.dongu = setInterval(() => this.tick(), TICK_MS);
    this.lobiyeBildir();
  }

  bitir() {
    if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
    const sonuc = this.ar ? this.ar.sonuc() : [];
    this.anlik();
    this.meta.durum = 'bekliyor';
    this.meta.bitis = 0;
    this.ctx.storage.put('meta', this.meta);
    this.ar = null;
    this.olaylar = [];
    for (const o of [...this.oyuncular.values()]) if (!o.ws) this.oyuncular.delete(o.pid);
    this.yayinla({ t: 'son', sonuc, tur: this.meta.tur });
    this.kurucuSec();
    this.botSigdir();
    this.odaYayinla();
    this.lobiyeBildir();
  }

  // Where the page says its tank is. A move faster than a tank can go, or into a wall, is cut back.
  konum(o, m) {
    const ar = this.ar;
    if (!ar || this.meta.durum !== 'oyunda') return;
    const t = ar.tank(o.no);
    if (!t || t.durum !== 'canli' || m.h !== t.hayat) return;
    let x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const simdi = Date.now();
    if (t.rx == null || t.rh !== t.hayat) { t.rx = t.x; t.ry = t.y; t.rt = simdi - 66; t.rh = t.hayat; }
    const dt = clamp((simdi - t.rt) / 1000, .02, 1), enFazla = K.HIZ * 1.35 * dt + 30;
    const dx = x - t.rx, dy = y - t.ry, d = Math.hypot(dx, dy);
    let duz = false;
    if (d > enFazla) { x = t.rx + dx / d * enFazla; y = t.ry + dy / d * enFazla; duz = d - enFazla > 20; }
    const p = { x, y };
    itDuvar(p, ar.m);
    if (Math.hypot(p.x - x, p.y - y) > 12) duz = true;
    t.x = t.rx = p.x; t.y = t.ry = p.y; t.rt = simdi; t.rapor = 0;
    const v = Math.hypot(+m.vx || 0, +m.vy || 0), vmax = K.HIZ * 1.2, k = v > vmax ? vmax / v : 1;
    t.vx = (+m.vx || 0) * k; t.vy = (+m.vy || 0) * k;
    if (Number.isFinite(+m.g)) t.g = +m.g;
    if (Number.isFinite(+m.tr)) t.tr = +m.tr;
    if (duz) gonder(o.ws, { t: 'duz', x: r1(p.x), y: r1(p.y) });
  }

  ates(o, m) {
    const ar = this.ar;
    if (!ar || this.meta.durum !== 'oyunda') return;
    const t = ar.tank(o.no);
    if (!t || t.durum !== 'canli') return;
    const s = Math.round(+m.s), a = +m.a;
    if (!Number.isFinite(s) || s <= (t.sonSeq || 0) || s > (t.sonSeq || 0) + 1000 || !Number.isFinite(a)) return;
    let x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - t.x, y - t.y) > 70) { x = t.x; y = t.y; }
    if (ar.ates(t, a, x, y, s)) t.sonSeq = s;
  }

  tick() {
    const ar = this.ar;
    if (!this.meta || this.meta.durum !== 'oyunda' || !ar) { if (this.dongu) { clearInterval(this.dongu); this.dongu = null; } return; }
    const simdi = Date.now(), dt = clamp((simdi - this.sonTick) / 1000, .005, .1);
    this.sonTick = simdi;
    this.tickNo++;
    // players who lost the connection for good leave the arena (and the table)
    for (const o of [...this.oyuncular.values()]) {
      if (o.ws || !o.gitti || simdi - o.gitti < GERI_DONUS) continue;
      const t = ar.tank(o.no);
      if (t) ar.sil(t);
      this.oyuncular.delete(o.pid);
    }
    ar.adim(dt);
    for (const e of ar.olaylariAl()) this.olaylar.push(e);
    if (ar.kalan <= 0 || simdi >= this.meta.bitis) { this.bitir(); return; }
    if (this.tickNo % ANLIK_HER === 0) this.anlik();
  }

  /* ---------- snapshots ---------- */
  // p: [no, x, y, vx, vy, g, tr, can, durum (0 out, 1 alive, 2 shielded, 3 painted), puan, boyandi, hayat, boyadi]
  anlik() {
    const ar = this.ar;
    if (!ar) return;
    const p = ar.tanklar.map(t => [
      t.no, r1(t.x), r1(t.y), Math.round(t.vx), Math.round(t.vy), r2(t.g), r2(t.tr), t.can,
      t.durum === 'yok' ? 0 : t.durum === 'olu' ? 3 : t.koruma > 0 ? 2 : 1, t.puan, t.boyandi, t.hayat, t.boyadi
    ]);
    // a shot's last field is when it was fired; send how long ago instead (ms), so pages can catch up
    const e = this.olaylar.map(x => x[0] === 'm' ? x.slice(0, 6).concat(Math.round((ar.saat - x[6]) * 1000)) : x);
    this.olaylar = [];
    this.yayinla({ t: 's', k: r1(this.kalan() / 1000), p, e });
  }
}
