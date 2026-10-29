// The room list. Pages keep a websocket open while the "Rooms" screen is showing; rooms
// report their changes here (Oda -> lobi.oda(...)) and the list is pushed to every page.
import { DurableObject } from 'cloudflare:workers';
import { kullanici } from './dogrula.js';

const ESKI = 5 * 60 * 1000; // a room that hasn't reported for this long is dropped
const EN_COK_ODA = 40;

export class Lobi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.odalar = {};
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.odalar = (await ctx.storage.get('odalar')) || {};
    });
  }

  async fetch(req) {
    const cift = new WebSocketPair();
    const [istemci, sunucu] = Object.values(cift);
    this.ctx.acceptWebSocket(sunucu);
    sunucu.serializeAttachment({ ok: false });
    return new Response(null, { status: 101, webSocket: istemci });
  }

  async webSocketMessage(ws, ham) {
    if (typeof ham !== 'string' || ham.length > 8192) return;
    let m;
    try { m = JSON.parse(ham); } catch (e) { return; }
    if (m.t !== 'merhaba') return;
    const kim = await kullanici(this.env, m.token);
    if (!kim) {
      try { ws.send(JSON.stringify({ t: 'hata', neden: 'giris' })); ws.close(4001, 'sign in'); } catch (e) {}
      return;
    }
    ws.serializeAttachment({ ok: true });
    try { ws.send(this.listeMesaji()); } catch (e) {}
  }

  async webSocketClose(ws, kod) {
    try { ws.close(kod === 1005 ? 1000 : kod, 'bye'); } catch (e) {}
  }

  async webSocketError(ws) {
    try { ws.close(1011, 'error'); } catch (e) {}
  }

  // Called by a room (RPC). bilgi = null removes the room from the list.
  async oda(id, bilgi) {
    if (!/^[a-z0-9]{8}$/.test(String(id))) return;
    if (bilgi) this.odalar[id] = Object.assign({}, bilgi, { id, guncel: Date.now() });
    else delete this.odalar[id];
    this.temizle();
    await this.ctx.storage.put('odalar', this.odalar);
    this.yayinla();
  }

  temizle() {
    const simdi = Date.now();
    for (const id in this.odalar) if (simdi - this.odalar[id].guncel > ESKI) delete this.odalar[id];
    const ids = Object.keys(this.odalar).sort((a, b) => this.odalar[b].olusturma - this.odalar[a].olusturma);
    for (const id of ids.slice(EN_COK_ODA)) delete this.odalar[id];
  }

  listeMesaji() {
    this.temizle();
    const liste = Object.values(this.odalar)
      .filter(o => o.n > 0)
      .sort((a, b) => b.olusturma - a.olusturma)
      .map(o => ({ id: o.id, kurucu: o.kurucu, renk: o.renk, n: o.n, en: o.en, durum: o.durum, kalan: o.bitis ? Math.max(0, o.bitis - Date.now()) : 0 }));
    return JSON.stringify({ t: 'liste', odalar: liste });
  }

  yayinla() {
    const mesaj = this.listeMesaji();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.ok) { try { ws.send(mesaj); } catch (e) {} }
    }
  }
}
