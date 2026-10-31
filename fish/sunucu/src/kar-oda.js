// One Kar Savaşı room: the waiting room, a co-op game against the waves, and the results.
//
// The rules live in lab/kar-savasi/oyun.js (shared with the page). The server runs the battle:
// waves, the kids and their throws, hits, falls, getting up, snow piles and cocoa. Each page walks
// its own player (so it feels instant) and reports where it is; the server checks the move and
// corrects the page if it isn't possible. The page keeps its own snowball pocket and says when it
// throws. The game goes on until everyone is down at the same time.
//
// Page -> server:  merhaba {token, profil, kur, surum}   k {x, y, vx, vy, g, h}   a {x, y, ux, uy, m, s}   basla
// Server -> page:  hos {ben, surum}   oda   basla {tohum, tur, kadro, ben, alinan, kakao}   s (snapshot, 15 a second)
//                  duz {x, y}   son {sonuc}   hata {neden}
import { DurableObject } from 'cloudflare:workers';
import { oyuncu as kimlik } from './dogrula.js';
import { Battle, K, VERSION, KIND_LIST } from '../../../lab/kar-savasi/oyun.js';

const TICK_MS = 33;              // 30 steps a second
const SNAP_EVERY = 2;            // a snapshot every second step (15 a second)
const NABIZ = 2 * 60 * 1000;     // the room tells the lobby it is alive this often
const BOS_KAPAT = 30 * 1000;     // an empty room closes after this long
const GERI_DONUS = 60 * 1000;    // a player who lost the connection keeps their place this long
const SONUC_BEKLE = 2500;        // after everyone is down, the results come this much later
const LOBI = 'kar';              // the room list (a Lobi object of its own)

const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function gonder(ws, m) {
  if (!ws) return;
  try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {}
}

export class KarOda extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;            // { id, kurucu (profile id), durum: 'bekliyor' | 'oyunda', olusturma, tur }
    this.oyuncular = new Map();  // profile id -> { pid, no, ad, renk, giris, ws, gitti }
    this.savas = null;           // the Battle during a game
    this.no = 1;
    this.olaylar = [];
    this.dongu = null;
    this.tickNo = 0;
    this.sonTick = 0;
    this.bittiT = 0;
    this.sonDalga = 0;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      // A game can't survive a restart: the battle lived in memory.
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

  async fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/kar\/oda\/([a-z0-9]{8})$/);
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
    else if (m.t === 'a') this.at(o, m);
    else if (m.t === 'basla') this.basla(o);
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
      this.meta = { id: odaId, kurucu: kim.pid, durum: 'bekliyor', olusturma: Date.now(), tur: 0 };
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
      if (this.bagliSayisi() >= K.MAX_PLAYERS) return kapat('dolu', 4003);
      o = { pid: kim.pid, no: this.no++, ad: kim.ad, renk: kim.renk, giris: Date.now(), ws: null, gitti: 0 };
      this.oyuncular.set(kim.pid, o);
    }
    o.ad = kim.ad; o.renk = kim.renk; o.ws = ws; o.gitti = 0;
    ws.serializeAttachment({ oda: odaId, pid: o.pid, no: o.no, ad: o.ad, renk: o.renk, giris: o.giris });
    this.kurucuSec();
    gonder(ws, { t: 'hos', ben: o.no, surum: VERSION });
    if (this.meta.durum === 'oyunda' && this.savas) {
      // joining (or coming back) in the middle of a game: next to a teammate
      let p = this.savas.player(o.no);
      if (!p) p = this.savas.addPlayer({ no: o.no, name: o.ad, color: o.renk });
      p.away = false; // back after a dropped connection: where they were
      p.name = o.ad; p.color = o.renk;
      this.odaYayinla();
      gonder(ws, this.baslaMesaji(o));
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
    if (this.meta && this.meta.durum === 'oyunda' && this.savas) {
      // Steps out of the forest but keeps the place for a while in case the connection comes back.
      const p = this.savas.player(o.no);
      if (p) p.away = true;
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
    this.savas = null;
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

  lobi() { return this.env.LOBI.get(this.env.LOBI.idFromName(LOBI)); }

  async lobiyeBildir() {
    if (!this.meta) return;
    const k = this.oyuncular.get(this.meta.kurucu);
    try {
      await this.lobi().oda(this.meta.id, {
        kurucu: k ? k.ad : '?', renk: k ? k.renk : '#b4413a', n: this.bagliSayisi(), en: K.MAX_PLAYERS,
        durum: this.meta.durum, bitis: 0, olusturma: this.meta.olusturma, dalga: this.savas ? this.savas.wave : 0
      });
    } catch (e) {}
  }

  yayinla(m) {
    const s = JSON.stringify(m);
    for (const o of this.oyuncular.values()) gonder(o.ws, s);
  }

  kadro() { return this.savas ? this.savas.players.map((p) => ({ no: p.no, ad: p.name, renk: p.color })) : null; }

  odaMesaji() {
    const k = this.oyuncular.get(this.meta.kurucu);
    const liste = [...this.oyuncular.values()].filter((o) => o.ws).sort((a, b) => a.giris - b.giris)
      .map((o) => ({ no: o.no, ad: o.ad, renk: o.renk }));
    const m = { t: 'oda', id: this.meta.id, durum: this.meta.durum, kurucu: k ? k.no : 0, oyuncular: liste, en: K.MAX_PLAYERS };
    if (this.meta.durum === 'oyunda' && this.savas) { m.kadro = this.kadro(); m.dalga = this.savas.wave; }
    return m;
  }

  odaYayinla() { if (this.meta) this.yayinla(this.odaMesaji()); }

  // What a page needs to step into the forest: the seed, who is here, where it stands, and the
  // snow piles and cocoa as they are now.
  baslaMesaji(o) {
    const s = this.savas, p = s.player(o.no);
    const alinan = [];
    for (const [k, t] of s.world.taken) alinan.push([k, r1(t - s.clock)]);
    return {
      t: 'basla', tohum: s.seed, tur: this.meta.tur, kadro: this.kadro(),
      ben: p ? { x: r1(p.x), y: r1(p.y), h: p.life, can: p.hp, durum: p.state === 'alive' ? 1 : 2, devirdi: p.kills } : null,
      alinan, kakao: s.cocoa.map((c) => [c.id, r1(c.x), r1(c.y), r1(c.life)]),
      dalga: s.wave, puan: s.score
    };
  }

  /* ---------- the game ---------- */
  basla(o) {
    if (!this.meta || this.meta.durum === 'oyunda' || this.meta.kurucu !== o.pid) return;
    for (const k of [...this.oyuncular.values()]) if (!k.ws) this.oyuncular.delete(k.pid);
    const bagli = [...this.oyuncular.values()].sort((a, b) => a.giris - b.giris);
    if (!bagli.length) return;
    this.savas = new Battle((Math.random() * 4294967296) >>> 0);
    for (const k of bagli) this.savas.addPlayer({ no: k.no, name: k.ad, color: k.renk });
    this.olaylar = this.savas.takeEvents();
    this.meta.durum = 'oyunda';
    this.meta.tur = (this.meta.tur || 0) + 1;
    this.ctx.storage.put('meta', this.meta);
    this.tickNo = 0;
    this.sonTick = Date.now();
    this.bittiT = 0;
    this.sonDalga = 0;
    for (const k of bagli) gonder(k.ws, this.baslaMesaji(k));
    this.odaYayinla();
    if (this.dongu) clearInterval(this.dongu);
    this.dongu = setInterval(() => this.tick(), TICK_MS);
    this.lobiyeBildir();
  }

  bitir() {
    if (this.dongu) { clearInterval(this.dongu); this.dongu = null; }
    const sonuc = this.savas ? this.savas.result() : null;
    this.anlik();
    this.meta.durum = 'bekliyor';
    this.ctx.storage.put('meta', this.meta);
    this.savas = null;
    this.olaylar = [];
    for (const o of [...this.oyuncular.values()]) if (!o.ws) this.oyuncular.delete(o.pid);
    this.yayinla({ t: 'son', sonuc, tur: this.meta.tur });
    this.kurucuSec();
    this.odaYayinla();
    this.lobiyeBildir();
  }

  // Where the page says its player is. A move faster than anyone can go, or into a tree, is cut back.
  konum(o, m) {
    const s = this.savas;
    if (!s || this.meta.durum !== 'oyunda') return;
    const p = s.player(o.no);
    if (!p || p.away || m.h !== p.life) return;
    if (Number.isFinite(+m.g)) p.view = clamp(+m.g, 300, 1500);
    if (p.state !== 'alive') return; // lying in the snow: stays put
    let x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const simdi = Date.now();
    if (p.rt == null || p.rl !== p.life) { p.rx = p.x; p.ry = p.y; p.rt = simdi - 66; p.rl = p.life; }
    const dt = clamp((simdi - p.rt) / 1000, 0.02, 1), enFazla = (K.SPEED + 300) * 1.3 * dt + 30;
    const dx = x - p.rx, dy = y - p.ry, d = Math.hypot(dx, dy);
    let duz = false;
    if (d > enFazla) { x = p.rx + (dx / d) * enFazla; y = p.ry + (dy / d) * enFazla; duz = d - enFazla > 20; }
    const q = { x, y, r: K.R - 2 };
    s.world.collide(q);
    if (Math.hypot(q.x - x, q.y - y) > 12) duz = true;
    p.x = p.rx = q.x; p.y = p.ry = q.y; p.rt = simdi;
    const v = Math.hypot(+m.vx || 0, +m.vy || 0), vmax = K.SPEED * 1.2, k = v > vmax ? vmax / v : 1;
    p.vx = (+m.vx || 0) * k; p.vy = (+m.vy || 0) * k;
    if (duz) gonder(o.ws, { t: 'duz', x: r1(p.x), y: r1(p.y) });
  }

  // The page threw a snowball.
  at(o, m) {
    const s = this.savas;
    if (!s || this.meta.durum !== 'oyunda') return;
    const p = s.player(o.no);
    if (!p || p.away || p.state !== 'alive') return;
    const seq = Math.round(+m.s);
    if (!Number.isFinite(seq) || seq <= p.seq || seq > p.seq + 1000) return;
    if (p.cool > K.COOLDOWN - 0.06) return; // faster than anyone can throw
    const ux = +m.ux, uy = +m.uy, dist = +m.m;
    if (!Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(dist) || (!ux && !uy)) return;
    let x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - p.x, y - p.y) > 70) { x = p.x; y = p.y; }
    if (s.throwBall(p, x, y, ux, uy, dist, seq)) p.seq = seq;
  }

  tick() {
    const s = this.savas;
    if (!this.meta || this.meta.durum !== 'oyunda' || !s) { if (this.dongu) { clearInterval(this.dongu); this.dongu = null; } return; }
    const simdi = Date.now(), dt = clamp((simdi - this.sonTick) / 1000, 0.005, 0.1);
    this.sonTick = simdi;
    this.tickNo++;
    // players who lost the connection for good leave the table (their player stays away)
    for (const o of [...this.oyuncular.values()]) {
      if (o.ws || !o.gitti || simdi - o.gitti < GERI_DONUS) continue;
      this.oyuncular.delete(o.pid);
    }
    s.step(dt);
    for (const e of s.takeEvents()) if (e[0] !== 's') this.olaylar.push(e); // pages stop snowballs themselves
    if (s.wave !== this.sonDalga) { this.sonDalga = s.wave; this.lobiyeBildir(); }
    if (s.over) {
      if (!this.bittiT) this.bittiT = simdi;
      else if (simdi - this.bittiT >= SONUC_BEKLE) { this.bitir(); return; }
    }
    if (this.tickNo % SNAP_EVERY === 0) this.anlik();
  }

  /* ---------- snapshots ---------- */
  // w: [wave, seconds of break left (0 during a wave), score, kids left in this wave]
  // p: [no, x, y, vx, vy, hp, state (0 away, 1 up, 2 down), knocked over, getting up (0..100), streak, safe]
  // d: [id, kind, x, y, vx, vy, hp, flags (1 winding up a throw, 2 dizzy)]
  anlik() {
    const s = this.savas;
    if (!s) return;
    const p = s.players.map((q) => [
      q.no, r1(q.x), r1(q.y), Math.round(q.vx), Math.round(q.vy), q.hp, q.away ? 0 : q.state === 'alive' ? 1 : 2,
      q.kills, Math.round((q.lift / K.LIFT) * 100), q.combo, q.inv > 0 ? 1 : 0
    ]);
    const d = [];
    for (const e of s.enemies) {
      if (e.down) continue;
      d.push([e.id, KIND_LIST.indexOf(e.kind), r1(e.x), r1(e.y), Math.round(e.vx + e.kx), Math.round(e.vy + e.ky), e.hp,
        (e.wind > 0 ? 1 : 0) | (e.stun > 0 ? 2 : 0)]);
    }
    // a snowball's 9th field is when it was thrown; send how long ago instead (ms), so pages can catch up
    const e = this.olaylar.map((x) => (x[0] === 't' ? x.slice(0, 8).concat(Math.round((s.clock - x[8]) * 1000), x[9]) : x));
    this.olaylar = [];
    this.yayinla({ t: 's', w: [s.wave, s.calm > 0 ? Math.ceil(s.calm) : 0, s.score, s.left()], p, d, e });
  }
}
