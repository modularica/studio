// One room for the Lab games that don't need the server to run the game itself: Balon Yarışı,
// Kanyon, Rüzgâr Kaptanı, Sekme, Sur Muhafızı, SONGbox and Kelime Düellosu. The page side is hesap/oda.js.
//
// Every page plays its own game (the same seed for everyone) and tells the room how it's doing:
// a score, a small live state the other pages draw (a ghost jet, a balloon's height, a boat), and
// when it's done. The room keeps the waiting room, starts the round, passes the states around,
// ends the round and ranks everyone.
//
// A turn-based game (kayit) sends its moves as one-off events: the room also keeps them in the round's
// log and hands the log to a page that comes back, so it can catch up (Kelime Düellosu: two phones,
// one word at a time). Such a room keeps a lost player's place longer (geri).
//
// Page -> server:  merhaba {token, profil, kur, surum}   ayar {ayar} (host, waiting room)   basla (host)
//                  d {p, v} (my score and live state, up to 15 a second)   o {e} (a one-off event for the others)
//                  bitir {p, eser} (I'm done; eser = a finished piece of work to show at the end, e.g. a song)
//                  son (host: end the round now)   and the text 'ping'
// Server -> page:  hos {ben}   oda {id, durum, kurucu, oyuncular, ayar, en, tur, sira, sonra}
//                  basla {tohum, tur, ayar, kadro, gecen, sure, log (kayit: [[no, e], ...])}   s {g, k, p: [[no, puan, bitti, v], ...]}
//                  o {no, e}   son {sonuc, tur}   hata {neden}
import { DurableObject } from 'cloudflare:workers';
import { oyuncu as kimlik } from './dogrula.js';

// en: players per room. sure: the longest a round can last (seconds; the host may choose shorter).
// sonra: when the first player is done, the others get this many seconds more (0: no hurry).
// sira: 'sure' ranks who finished first, then the score; 'puan' ranks by the score.
// kayit: keep up to this many events (moves) in the round's log. geri: seconds a lost player keeps their place.
export const OYUNLAR = {
  balon: { en: 8, sure: 10 * 60, sonra: 45, sira: 'sure' },
  kanyon: { en: 8, sure: 15 * 60, sonra: 0, sira: 'puan' },
  yelken: { en: 8, sure: 10 * 60, sonra: 60, sira: 'sure' },
  sekme: { en: 8, sure: 15 * 60, sonra: 0, sira: 'puan' },
  sur: { en: 8, sure: 40 * 60, sonra: 0, sira: 'puan' },
  songbox: { en: 8, sure: 15 * 60, sonra: 0, sira: 'puan' },
  kelime: { en: 2, sure: 30 * 60, sonra: 0, sira: 'puan', kayit: 800, geri: 5 * 60 }
};

const TICK_MS = 100;             // the round's clock: 10 steps a second
const NABIZ = 2 * 60 * 1000;     // the room tells the lobby it is alive this often
const BOS_KAPAT = 30 * 1000;     // an empty room closes after this long
const GERI_DONUS = 60 * 1000;    // a player who lost the connection keeps their place this long
const SONUC_BEKLE = 1500;        // after everyone is done, the results come this much later
const EN_UZUN_V = 400;           // live state, as JSON
const EN_UZUN_ESER = 6000;       // a finished piece of work, as JSON
const EN_UZUN_AYAR = 800;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function gonder(ws, m) {
  if (!ws) return;
  try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {}
}
function json(v, en) {
  if (v === undefined) return null;
  try { const s = JSON.stringify(v); return s && s.length <= en ? s : null; } catch (e) { return null; }
}
function sayi(v) { v = +v; return Number.isFinite(v) ? clamp(v, -1e9, 1e9) : 0; }

export class GenelOda extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // { oyun, id, kurucu (profile id), durum: 'bekliyor' | 'oyunda', olusturma, tur, ayar, surum }
    this.meta = null;
    this.oyuncular = new Map();  // profile id -> { pid, no, ad, renk, giris, ws, gitti }
    this.no = 1;
    this.r = null;               // the round: { t0, sure, bitis, ilk, tohum, kadro: Map no -> { no, ad, renk, p, b, v, eser, son } }
    this.dongu = null;
    this.degisti = false;
    this.sonAnlik = 0;
    this.bittiT = 0;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      // A round can't survive a restart: it lived in memory.
      if (this.meta && this.meta.durum === 'oyunda') this.meta.durum = 'bekliyor';
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (a && a.pid) {
          this.oyuncular.set(a.pid, { pid: a.pid, no: a.no, ad: a.ad, renk: a.renk, giris: a.giris, ws, gitti: 0 });
          this.no = Math.max(this.no, a.no + 1);
        }
      }
    });
  }

  get ayarlar() { return OYUNLAR[this.meta && this.meta.oyun] || OYUNLAR.balon; }
  // how long a player who lost the connection keeps their place in a round
  get geriMs() { return this.ayarlar.geri ? this.ayarlar.geri * 1000 : GERI_DONUS; }

  async fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/([a-z]+)\/oda\/([a-z0-9]{8})$/);
    if (!m || !OYUNLAR[m[1]]) return new Response('bad room\n', { status: 400 });
    const [istemci, sunucu] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(sunucu);
    sunucu.serializeAttachment({ oyun: m[1], oda: m[2] });
    return new Response(null, { status: 101, webSocket: istemci });
  }

  /* ---------- connections ---------- */
  async webSocketMessage(ws, ham) {
    if (typeof ham !== 'string' || ham.length > 8192) return;
    let m;
    try { m = JSON.parse(ham); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const a = ws.deserializeAttachment() || {};
    if (!a.pid) {
      if (m.t === 'merhaba' && !a.bekliyor) {
        ws.serializeAttachment(Object.assign({}, a, { bekliyor: true }));
        await this.merhaba(ws, a, m);
      }
      return;
    }
    const o = this.oyuncular.get(a.pid);
    if (!o || o.ws !== ws) return;
    if (m.t === 'd') this.durum(o, m);
    else if (m.t === 'o') this.olay(o, m);
    else if (m.t === 'bitir') this.bitti(o, m);
    else if (m.t === 'ayar') this.ayar(o, m);
    else if (m.t === 'basla') this.basla(o);
    else if (m.t === 'son') { if (this.meta && this.meta.kurucu === o.pid && this.r) this.bitir(); }
  }

  async webSocketClose(ws) {
    await this.ayrildi(ws);
    try { ws.close(1000, 'bye'); } catch (e) {}
  }

  async webSocketError(ws) {
    await this.ayrildi(ws);
  }

  async merhaba(ws, a, m) {
    const kapat = (neden, kod) => { gonder(ws, { t: 'hata', neden }); try { ws.close(kod, neden); } catch (e) {} };
    const kim = await kimlik(this.env, m);
    if (!kim) return kapat('giris', 4001);
    const surum = String(m.surum == null ? '' : m.surum).slice(0, 20);
    if (!this.meta) {
      if (!m.kur) return kapat('yok', 4004);
      this.meta = { oyun: a.oyun, id: a.oda, kurucu: kim.pid, durum: 'bekliyor', olusturma: Date.now(), tur: 0, ayar: null, surum };
      await this.ctx.storage.put('meta', this.meta);
    }
    if (this.meta.oyun !== a.oyun) return kapat('yok', 4004);
    if (this.meta.surum !== surum) return kapat('surum', 4005);
    let o = this.oyuncular.get(kim.pid);
    if (o && o.ws && o.ws !== ws) {
      // The same player opened the room again (another tab or a new connection): keep the new one.
      const eski = o.ws;
      o.ws = null;
      gonder(eski, { t: 'hata', neden: 'baska' });
      try { eski.close(4009, 'replaced'); } catch (e) {}
    }
    if (!o) {
      if (this.bagliSayisi() >= this.ayarlar.en) return kapat('dolu', 4003);
      o = { pid: kim.pid, no: this.no++, ad: kim.ad, renk: kim.renk, giris: Date.now(), ws: null, gitti: 0 };
      this.oyuncular.set(kim.pid, o);
    }
    o.ad = kim.ad; o.renk = kim.renk; o.ws = ws; o.gitti = 0;
    ws.serializeAttachment({ oyun: a.oyun, oda: a.oda, pid: o.pid, no: o.no, ad: o.ad, renk: o.renk, giris: o.giris });
    this.kurucuSec();
    gonder(ws, { t: 'hos', ben: o.no });
    this.odaYayinla();
    if (this.meta.durum === 'oyunda' && this.r) {
      // joining (or coming back) in the middle of a round
      const k = this.r.kadro.get(o.no) || this.kadroya(o);
      k.ad = o.ad; k.renk = o.renk;
      this.degisti = true;
      gonder(ws, this.baslaMesaji(o));
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
    if (this.meta && this.meta.durum === 'oyunda' && this.r) o.gitti = Date.now(); // keeps the place for a while
    else this.oyuncular.delete(a.pid);
    if (!this.meta) return;
    this.kurucuSec();
    // an empty room closes soon, unless a round is on and the players may come back
    if (!this.bagliSayisi()) await this.ctx.storage.setAlarm(Date.now() + (this.r && this.ayarlar.geri ? this.geriMs : BOS_KAPAT));
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
    const meta = this.meta;
    this.meta = null;
    this.r = null;
    this.oyuncular.clear();
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (meta) { try { await this.lobi(meta.oyun).oda(meta.id, null); } catch (e) {} }
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

  lobi(oyun) { return this.env.LOBI.get(this.env.LOBI.idFromName(oyun || this.meta.oyun)); }

  async lobiyeBildir() {
    if (!this.meta) return;
    const k = this.oyuncular.get(this.meta.kurucu);
    const ayar = this.meta.ayar || {};
    try {
      await this.lobi().oda(this.meta.id, {
        kurucu: k ? k.ad : '?', renk: k ? k.renk : '#e4472d', n: this.bagliSayisi(), en: this.ayarlar.en,
        durum: this.meta.durum, bitis: this.r && this.r.bitis ? this.r.bitis : 0, olusturma: this.meta.olusturma,
        not: typeof ayar.yazi === 'string' ? ayar.yazi.slice(0, 60) : ''
      });
    } catch (e) {}
  }

  yayinla(m, haric) {
    const s = typeof m === 'string' ? m : JSON.stringify(m);
    for (const o of this.oyuncular.values()) if (o !== haric) gonder(o.ws, s);
  }

  odaMesaji() {
    const k = this.oyuncular.get(this.meta.kurucu);
    const liste = [...this.oyuncular.values()].filter((o) => o.ws).sort((a, b) => a.giris - b.giris)
      .map((o) => ({ no: o.no, ad: o.ad, renk: o.renk }));
    return {
      t: 'oda', id: this.meta.id, durum: this.meta.durum, kurucu: k ? k.no : 0, oyuncular: liste,
      ayar: this.meta.ayar, en: this.ayarlar.en, tur: this.meta.tur, sira: this.ayarlar.sira, sonra: this.ayarlar.sonra
    };
  }

  odaYayinla() { if (this.meta) this.yayinla(this.odaMesaji()); }

  /* ---------- the waiting room ---------- */
  ayar(o, m) {
    if (!this.meta || this.meta.durum !== 'bekliyor' || this.meta.kurucu !== o.pid) return;
    const s = json(m.ayar, EN_UZUN_AYAR);
    if (s == null || !m.ayar || typeof m.ayar !== 'object' || Array.isArray(m.ayar)) return;
    this.meta.ayar = JSON.parse(s);
    this.ctx.storage.put('meta', this.meta);
    this.odaYayinla();
    this.lobiyeBildir();
  }

  /* ---------- the round ---------- */
  kadroya(o) {
    const k = { no: o.no, ad: o.ad, renk: o.renk, p: 0, b: 0, v: null, eser: null, son: 0, olay: [] };
    this.r.kadro.set(o.no, k);
    return k;
  }

  kadro() { return [...this.r.kadro.values()].map((k) => ({ no: k.no, ad: k.ad, renk: k.renk })); }

  baslaMesaji(o) {
    const k = this.r.kadro.get(o.no);
    const m = {
      t: 'basla', tohum: this.r.tohum, tur: this.meta.tur, ayar: this.meta.ayar, kadro: this.kadro(),
      gecen: Date.now() - this.r.t0, sure: this.r.sure, ben: k ? { p: k.p, b: k.b, v: k.v } : null
    };
    if (this.ayarlar.kayit) m.log = this.r.log;
    return m;
  }

  basla(o) {
    if (!this.meta || this.meta.durum === 'oyunda' || this.meta.kurucu !== o.pid) return;
    for (const k of [...this.oyuncular.values()]) if (!k.ws) this.oyuncular.delete(k.pid);
    const bagli = [...this.oyuncular.values()].sort((a, b) => a.giris - b.giris);
    if (!bagli.length) return;
    const ayar = this.meta.ayar || {};
    const enUzun = this.ayarlar.sure;
    const sure = clamp(Math.round(+ayar.sure) || enUzun, 20, enUzun);
    const simdi = Date.now();
    this.r = { t0: simdi, sure, bitis: simdi + sure * 1000, ilk: 0, tohum: (Math.random() * 4294967296) >>> 0, kadro: new Map(), log: [] };
    for (const k of bagli) this.kadroya(k);
    this.meta.durum = 'oyunda';
    this.meta.tur = (this.meta.tur || 0) + 1;
    this.ctx.storage.put('meta', this.meta);
    this.bittiT = 0;
    this.degisti = true;
    for (const k of bagli) gonder(k.ws, this.baslaMesaji(k));
    this.odaYayinla();
    if (this.dongu) clearInterval(this.dongu);
    this.dongu = setInterval(() => this.tick(), TICK_MS);
    this.lobiyeBildir();
  }

  // The page's score and live state.
  durum(o, m) {
    if (!this.r || this.meta.durum !== 'oyunda') return;
    const k = this.r.kadro.get(o.no);
    if (!k || k.b) return;
    const simdi = Date.now();
    if (simdi - k.son < 50) return; // faster than 20 a second: skip
    k.son = simdi;
    if (m.p !== undefined) k.p = sayi(m.p);
    if (m.v !== undefined) { const s = json(m.v, EN_UZUN_V); if (s != null) k.v = JSON.parse(s); }
    this.degisti = true;
  }

  // A one-off moment the other pages may want to show (a bridge blown up, a level cleared).
  olay(o, m) {
    if (!this.r || this.meta.durum !== 'oyunda') return;
    const k = this.r.kadro.get(o.no);
    if (!k) return;
    const s = json(m.e, 300);
    if (s == null) return;
    const simdi = Date.now();
    k.olay = k.olay.filter((t) => simdi - t < 1000);
    if (k.olay.length >= 8) return; // at most 8 a second
    k.olay.push(simdi);
    if (this.ayarlar.kayit && this.r.log.length < this.ayarlar.kayit) this.r.log.push([o.no, JSON.parse(s)]);
    this.yayinla('{"t":"o","no":' + o.no + ',"e":' + s + '}', o);
  }

  bitti(o, m) {
    if (!this.r || this.meta.durum !== 'oyunda') return;
    const k = this.r.kadro.get(o.no);
    if (!k || k.b) return;
    const simdi = Date.now();
    if (m.p !== undefined) k.p = sayi(m.p);
    if (m.v !== undefined) { const s = json(m.v, EN_UZUN_V); if (s != null) k.v = JSON.parse(s); }
    if (m.eser !== undefined) { const s = json(m.eser, EN_UZUN_ESER); if (s != null) k.eser = JSON.parse(s); }
    k.b = Math.max(1, simdi - this.r.t0);
    if (!this.r.ilk) {
      this.r.ilk = simdi;
      const sonra = this.ayarlar.sonra;
      if (sonra && this.r.kadro.size > 1) {
        const bitis = simdi + sonra * 1000;
        if (bitis < this.r.bitis) { this.r.bitis = bitis; this.lobiyeBildir(); }
      }
    }
    this.degisti = true;
  }

  // Everyone who is still here (or may come back) is done.
  hepsiBitti() {
    let biri = false;
    for (const k of this.r.kadro.values()) {
      const o = [...this.oyuncular.values()].find((x) => x.no === k.no);
      if (!o) continue; // left for good
      biri = true;
      if (!k.b) return false;
    }
    return biri;
  }

  sonuc() {
    const sira = this.ayarlar.sira;
    const liste = [...this.r.kadro.values()].map((k) => ({ no: k.no, ad: k.ad, renk: k.renk, p: k.p, b: k.b, v: k.v, eser: k.eser }));
    liste.sort((a, b) => {
      if (sira === 'sure') {
        if (!!a.b !== !!b.b) return a.b ? -1 : 1;
        if (a.b && b.b && a.b !== b.b) return a.b - b.b;
      }
      return b.p - a.p || (a.b || 1e12) - (b.b || 1e12);
    });
    let onceki = null;
    liste.forEach((x, i) => {
      // the same place for a tie
      const ayni = onceki && (sira === 'sure' ? (x.b === onceki.b && (x.b || x.p === onceki.p)) : x.p === onceki.p);
      x.sira = ayni ? onceki.sira : i + 1;
      onceki = x;
    });
    return liste;
  }

  bitir() {
    if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
    if (!this.r) return;
    this.anlik();
    const sonuc = this.sonuc();
    this.r = null;
    this.meta.durum = 'bekliyor';
    this.ctx.storage.put('meta', this.meta);
    for (const o of [...this.oyuncular.values()]) if (!o.ws) this.oyuncular.delete(o.pid);
    const s = JSON.stringify({ t: 'son', sonuc, tur: this.meta.tur, sira: this.ayarlar.sira });
    if (s.length > 120000) {
      // too much finished work to send: leave it out
      for (const x of sonuc) x.eser = null;
      this.yayinla({ t: 'son', sonuc, tur: this.meta.tur, sira: this.ayarlar.sira });
    } else this.yayinla(s);
    this.kurucuSec();
    this.odaYayinla();
    this.lobiyeBildir();
  }

  tick() {
    if (!this.meta || this.meta.durum !== 'oyunda' || !this.r) {
      if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
      return;
    }
    const simdi = Date.now();
    // players who lost the connection for good leave the round
    for (const o of [...this.oyuncular.values()]) {
      if (o.ws || !o.gitti || simdi - o.gitti < this.geriMs) continue;
      this.oyuncular.delete(o.pid);
      this.degisti = true;
    }
    if (!this.bagliSayisi() && ![...this.oyuncular.values()].length) { this.bitir(); return; }
    if (simdi >= this.r.bitis) { this.bitir(); return; }
    if (this.hepsiBitti()) {
      if (!this.bittiT) this.bittiT = simdi;
      else if (simdi - this.bittiT >= SONUC_BEKLE) { this.bitir(); return; }
    } else this.bittiT = 0;
    if (this.degisti || simdi - this.sonAnlik >= 1000) this.anlik();
  }

  // g: ms since the start, k: ms left, p: [no, score, done (ms since the start, 0 = still playing), live state]
  anlik() {
    if (!this.r) return;
    const simdi = Date.now();
    this.degisti = false;
    this.sonAnlik = simdi;
    const p = [...this.r.kadro.values()].map((k) => [k.no, k.p, k.b, k.v]);
    this.yayinla({ t: 's', g: simdi - this.r.t0, k: Math.max(0, this.r.bitis - simdi), p });
  }
}
