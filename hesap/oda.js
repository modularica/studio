/* Odalar — "Arkadaşlarla oyna" for the Lab games that share one kind of room:
 * Balon Yarışı, Kanyon, Rüzgâr Kaptanı, Sekme, Sur Muhafızı, SONGbox.
 * Server: fish/sunucu/src/genel-oda.js (routes /<oyun>/lobi and /<oyun>/oda/<id>).
 *
 * Every page plays its own game, from the same seed, and tells the room its score and a small live
 * state; this script shows the room list, the waiting room, the invite link, a small live ranking,
 * the in-game room menu and the results, and passes the others' states to the game.
 *
 *   const oda = Oda.kur({
 *     oyun: 'balon',                 // the server's name for the game (OYUNLAR in genel-oda.js)
 *     ad: 'Balon Yarışı',            // for the invite text
 *     surum: 1,                      // bump when pages of different versions can't play together
 *     skor: 'balon-yarisi-oda',      // the round's score goes to `scores` under this game
 *     sira: 'sure' | 'puan',         // the same as on the server: who finished first, or the highest score
 *     dil: 'tr' | 'en',
 *     tema: { zemin, yazi, ana, anaYazi, satir, cizgi, kenar, dugme, dugmeYazi, kotu, baslik, govde, bildirimUst },
 *                                    // colours, fonts, how far down the notes go
 *     aciklama: 'Bir oda kur…',      // the lead on the room list
 *     ayarlar: [{ k: 'sure', ad: 'Süre', secenek: [{ d: 180, ad: '3 dk' }, …], v: 300 }],  // host's choices
 *     ayarYazi: (ayar) => '…',       // a short summary for the room list
 *     puanYazi: (p, x) => p + ' puan',
 *     canliYazi: (p, x) => p,        // a shorter one for the live ranking (default: puanYazi)
 *     canli: { top: '60px', right: '8px' },   // where the live ranking goes (false: none); oda.canliYer() moves it
 *     saat: false,                   // true: always show the round's clock under the live ranking
 *     izle: true,                    // after oda.bitir(), show "you're done, waiting for the others"
 *     basla(m) {},                   // a round starts: { tohum, tur, ayar, kadro, gecen (ms since it started), sure, ben }
 *     durum(liste, m) {},            // ~10 a second: [{ no, ad, renk, p, b (ms when done, 0 still playing), v, ben }]
 *     olay(no, e) {},                // someone sent oda.olay(e)
 *     bitti(sonuc) {},               // the round is over (sonuc null: it was cut off); stop playing
 *     girdi() {},                    // we're in a room now (e.g. hide the game's own start button)
 *     cikti() {}                     // we left the room: back to the game's menu
 *   });
 *   oda.dugme(el)        shows el ("Arkadaşlarla oyna") when rooms can be used; a click opens the list
 *   oda.ac()             the room list
 *   oda.menu(f)          the in-game room menu (the game goes on); f runs on "Oyuna dön" (e.g. to unpause)
 *   oda.gonder(p, v)     my score and live state (sent at most 10 times a second)
 *   oda.olay(e)          a one-off event for the others
 *   oda.bitir(p, eser, v, ust)   I'm done (ust: the waiting sheet's small title instead of "Bitirdin!")
 *   oda.aktif            a round is on and I'm in it        oda.ben   my number in the room
 *   oda.isim(no)         { ad, renk }
 *
 * An invite link is the game's own address with ?oda=<id>; it joins that room once signed in.
 * Testing against a local server: localStorage.setItem('oda.sunucu', 'ws://127.0.0.1:8787').
 */
(function () {
  'use strict';
  if (window.Oda) return;

  const SUNUCU = (() => { try { return localStorage.getItem('oda.sunucu') || ''; } catch (e) { return ''; } })() || 'wss://fish-odalar.umutguncan.workers.dev';
  const COARSE = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();

  /* ---------- words ---------- */
  const SESLI = 'aeıioöuü';
  function sonSesli(s) { const k = s.toLocaleLowerCase('tr'); for (let i = k.length - 1; i >= 0; i--) if (SESLI.includes(k[i])) return k[i]; return 'e'; }
  function ninki(ad) { // Uzay'ın, Ali'nin, Umut'un
    const s = String(ad || '').trim() || 'Biri';
    const n = SESLI.includes(s.toLocaleLowerCase('tr').slice(-1)) ? 'n' : '';
    return s + "'" + n + ({ a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' }[sonSesli(s)]);
  }
  function sureYazi(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  const YAZI = {
    tr: {
      ust: 'Arkadaşlarla oyna', odalar: 'Odalar', bakiliyor: 'Odalara bakılıyor…',
      aciklama: 'Bir oda kur ya da arkadaşının odasına katıl. Bir odada en çok 8 kişi olur.',
      bos: 'Şu an açık oda yok. Bir oda kur, sonra “Arkadaşını çağır” ile linki gönder.',
      kur: 'Oda kur', geri: 'Geri', katil: 'Katıl', dolu: 'Dolu',
      odasi: (n) => ninki(n) + ' odası', kisi: (n) => n + ' kişi', bekliyor: 'başlamayı bekliyor', oyunda: 'oyun sürüyor',
      kuruluyor: 'Odan kuruluyor…', katiliniyor: 'Katılınıyor…',
      bekleme: 'Bekleme odası', baslat: 'Oyunu başlat', cagir: 'Arkadaşını çağır', cik: 'Odadan çık',
      kurucu: 'kurucu', sen: 'sen',
      notTek: 'Arkadaşlarına “Arkadaşını çağır” ile link gönder ya da oyunda “Arkadaşlarla oyna”ya bassınlar.',
      notHazir: (n) => n + ' kişi hazır. Herkes gelince oyunu başlat.',
      notBekle: (n) => n + ' oyunu başlatacak', gecGelen: 'Oyun başladıktan sonra gelen de katılabilir.',
      kopyalandi: 'Link kopyalandı. Arkadaşına gönder, açınca bu odaya gelir.',
      davet: (h, oyun) => ninki(h) + ' ' + oyun + ' odasına gel, birlikte oynayalım!',
      odadasin: 'Odadasın', suruyor: 'Oyun sürüyor', menuLead: 'Diğerleri oynamaya devam ediyor.', don: 'Oyuna dön', turuBitir: 'Turu bitir',
      bitirdin: 'Bitirdin!', siradasin: (s) => s + '. sıradasın', beklen: 'Herkes bitirince sonuçlar gelecek.',
      kalan: (t) => 'Kalan süre ' + t, turBitti: 'Tur bitti', birinci: 'Birinci oldun!', oldun: (s) => s + '. oldun',
      kazandi: (n) => n + ' kazandı', devam: 'Devam', nasildi: 'Nasıldı?', bitiremedi: 'bitiremedi',
      geldi: (n) => n + ' geldi', gitti: (n) => n + ' çıktı', bitirdi: (n) => n + ' bitirdi!',
      koptu: 'Bağlantı koptu · yeniden bağlanılıyor…', listeKoptu: 'Oda listesi koptu, yeniden deneniyor…',
      listeHata: 'Odalar yüklenemedi.', listeGiris: 'Odaları görmek için yeniden giriş yap.',
      hata: {
        yok: 'O oda kapanmış. Başka bir odaya katıl ya da kendi odanı kur.',
        dolu: 'O oda dolu. Başka bir odaya bak.',
        giris: 'Odalarda oynamak için yeniden giriş yap.',
        baska: 'Bu odayı başka bir yerde açtın.',
        surum: 'Oyunun yeni sürümü çıktı. Sayfayı yenile.',
        ag: 'Odaya ulaşılamadı. Bağlantını kontrol edip yeniden dene.',
        genel: 'Odaya katılınamadı.'
      }
    },
    en: {
      ust: 'Play with friends', odalar: 'Rooms', bakiliyor: 'Looking for rooms…',
      aciklama: 'Start a room or join a friend’s. Up to 8 players in a room.',
      bos: 'No open rooms right now. Start one, then send the link with “Invite a friend”.',
      kur: 'Start a room', geri: 'Back', katil: 'Join', dolu: 'Full',
      odasi: (n) => (String(n || '').trim() || 'Someone') + '’s room', kisi: (n) => n + (n === 1 ? ' player' : ' players'),
      bekliyor: 'waiting to start', oyunda: 'playing',
      kuruluyor: 'Starting your room…', katiliniyor: 'Joining…',
      bekleme: 'Waiting room', baslat: 'Start the game', cagir: 'Invite a friend', cik: 'Leave the room',
      kurucu: 'host', sen: 'you',
      notTek: 'Send your friends a link with “Invite a friend”, or they can tap “Play with friends” in the game.',
      notHazir: (n) => n + ' players here. Start when everyone has arrived.',
      notBekle: (n) => n + ' will start the game', gecGelen: 'Friends can still join after it starts.',
      kopyalandi: 'Link copied. Send it to a friend; it opens this room.',
      davet: (h, oyun) => 'Come to ' + h + '’s ' + oyun + ' room and play with us!',
      odadasin: 'In a room', suruyor: 'The game is on', menuLead: 'The others are still playing.', don: 'Back to the game', turuBitir: 'End the round',
      bitirdin: 'You’re done!', siradasin: (s) => 'You’re ' + sira(s), beklen: 'The results come when everyone is done.',
      kalan: (t) => t + ' left', turBitti: 'Round over', birinci: 'You won!', oldun: (s) => 'You came ' + sira(s),
      kazandi: (n) => n + ' won', devam: 'Continue', nasildi: 'How was it?', bitiremedi: 'didn’t finish',
      geldi: (n) => n + ' joined', gitti: (n) => n + ' left', bitirdi: (n) => n + ' is done!',
      koptu: 'Connection lost · reconnecting…', listeKoptu: 'Lost the room list, trying again…',
      listeHata: 'Couldn’t load the rooms.', listeGiris: 'Sign in again to see the rooms.',
      hata: {
        yok: 'That room has closed. Join another one or start your own.',
        dolu: 'That room is full. Try another one.',
        giris: 'Sign in again to play in rooms.',
        baska: 'You opened this room somewhere else.',
        surum: 'There’s a new version of the game. Reload the page.',
        ag: 'Couldn’t reach the room. Check your connection and try again.',
        genel: 'Couldn’t join the room.'
      }
    }
  };
  function sira(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /* ---------- looks ---------- */
  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
[hidden]{display:none!important}
.kok{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:flex-end;justify-content:center;font-family:var(--govde);color:var(--yazi);-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.perde{position:absolute;inset:0;background:rgba(18,24,36,.45);animation:sis .2s ease}
.kart{position:relative;width:100%;max-width:480px;max-height:calc(100% - 16px);overflow-y:auto;overscroll-behavior:contain;background:var(--zemin);border:2.5px solid var(--kenar);border-bottom:0;border-radius:24px 24px 0 0;padding:20px 18px calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;flex-direction:column;gap:12px;box-shadow:0 -10px 40px rgba(18,24,36,.25);animation:gel .26s cubic-bezier(.2,.9,.3,1.1)}
@media (min-width:640px) and (min-height:560px){.kok{align-items:center}.kart{border-bottom:2.5px solid var(--kenar);border-radius:24px}}
@keyframes gel{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes sis{from{opacity:0}}
.ust{margin:0;font:700 12px/1.2 var(--govde);letter-spacing:.14em;text-transform:uppercase;opacity:.6}
h2{margin:-4px 0 0;font:800 30px/1.1 var(--baslik);letter-spacing:-.01em;text-wrap:balance}
p{margin:0;font-size:15px;line-height:1.42}
.durum{min-height:1.4em;font-size:14px;opacity:.75}
.durum.kotu{opacity:1;color:var(--kotu);font-weight:600}
.liste{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.liste li{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 10px;background:var(--satir);border-radius:14px}
.liste li.ben{box-shadow:inset 0 0 0 2.5px var(--ana)}
.liste li.bos{display:block;text-align:center;font-size:14px;line-height:1.45;opacity:.8;padding:14px 10px;background:transparent;box-shadow:inset 0 0 0 1.5px var(--cizgi)}
.liste .ad{flex:1;min-width:0;font-weight:600;font-size:16px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.liste .ad small{display:block;font-weight:500;font-size:13px;opacity:.65;overflow:hidden;text-overflow:ellipsis}
.liste li.oyunda .ad small{opacity:1;color:var(--ana)}
.liste .deger{font:800 20px/1 var(--baslik);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.liste .deger small{display:block;margin-top:3px;font:600 11px/1.1 var(--govde);letter-spacing:.04em;opacity:.6}
.no{flex:none;width:26px;font:800 22px/1 var(--baslik);text-align:center;font-variant-numeric:tabular-nums}
.no.n1{color:#d99a00}.no.n2{color:#8a96a6}.no.n3{color:#b06a37}
.rozet{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:800 17px/1 var(--baslik);background:var(--c);color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.rozet.acik{color:#1d2433}
.etiket{flex:none;font:700 11px/1 var(--govde);letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:8px;background:var(--cizgi)}
.etiket.kurucu{background:var(--ana);color:var(--anaYazi)}
.secimler{display:grid;gap:10px}
.secim b{display:block;font-size:13px;font-weight:700;margin-bottom:6px;opacity:.75}
.secim div{display:flex;flex-wrap:wrap;gap:6px}
.cip{border:2px solid var(--kenar);background:var(--dugme);color:var(--dugmeYazi);border-radius:999px;padding:7px 12px;font:600 14px/1.15 var(--govde);cursor:pointer}
.cip[aria-pressed="true"]{background:var(--ana);border-color:var(--ana);color:var(--anaYazi)}
.cip:disabled{cursor:default}
.ozet{font-size:14px;font-weight:600;padding:8px 12px;border-radius:12px;background:var(--satir)}
.sira{display:flex;flex-wrap:wrap;gap:10px}
.btn{flex:1 1 140px;min-height:50px;border:2.5px solid var(--kenar);border-radius:15px;background:var(--dugme);color:var(--dugmeYazi);font:800 18px/1.1 var(--baslik);padding:8px 14px;cursor:pointer;box-shadow:0 4px 0 var(--kenar)}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--kenar)}
.btn.ana{background:var(--ana);color:var(--anaYazi)}
.btn:disabled{opacity:.45;cursor:default;transform:none;box-shadow:0 4px 0 var(--kenar)}
.mini{flex:none;border:2px solid var(--yazi);border-radius:11px;background:var(--yazi);color:var(--zemin);font:800 15px/1 var(--baslik);padding:9px 13px;cursor:pointer}
.mini:disabled{opacity:.4;cursor:default}
.mini.acik{background:var(--dugme);color:var(--dugmeYazi);border-color:var(--kenar)}
button:focus-visible{outline:3px solid var(--ana);outline-offset:2px}
.link{word-break:break-all;font-size:13px;user-select:text;-webkit-user-select:text}
.nokta::after{content:'';animation:nokta 1.4s steps(4) infinite}
@keyframes nokta{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.canli{position:fixed;z-index:2147481000;display:flex;flex-direction:column;gap:4px;pointer-events:none;font:600 13px/1 var(--govde);color:#1d2433}
.canli div{display:flex;align-items:center;gap:6px;padding:3px 9px 3px 3px;border-radius:999px;background:rgba(255,255,255,.88);box-shadow:0 1px 4px rgba(0,0,0,.18);max-width:150px;white-space:nowrap}
.canli div.ben{box-shadow:0 0 0 2px var(--ana),0 1px 4px rgba(0,0,0,.18)}
.canli div.saat{padding:4px 9px;font-variant-numeric:tabular-nums}
.canli i{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font:800 11px/1 var(--baslik);font-style:normal;background:var(--c);color:#fff}
.canli span{overflow:hidden;text-overflow:ellipsis;min-width:0}
.canli b{margin-left:auto;padding-left:4px;font-variant-numeric:tabular-nums}
.canli .bitti b::after{content:' ✓'}
.bildirim{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + var(--bildirimUst,64px));z-index:2147482500;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.bildirim div{padding:8px 14px;border-radius:999px;background:rgba(29,36,51,.9);color:#fff;font:600 14px/1.2 var(--govde);white-space:nowrap;animation:bil 2.6s ease forwards}
@keyframes bil{0%{opacity:0;transform:translateY(-8px)}10%,80%{opacity:1;transform:none}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.kart,.perde,.bildirim div{animation:none}}
`;

  function mk(tag, cls, metin) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (metin != null) e.textContent = metin;
    return e;
  }
  const renkOk = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  function acikMi(c) {
    if (!renkOk(c)) return false;
    const n = parseInt(c.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62;
  }
  function rozet(ad, renk, cls) {
    const b = mk(cls === 'i' ? 'i' : 'span', cls === 'i' ? '' : 'rozet', (String(ad || '?').trim()[0] || '?').toLocaleUpperCase('tr'));
    b.style.setProperty('--c', renkOk(renk) ? renk : '#3a7ca5');
    if (acikMi(renk)) { if (cls === 'i') b.style.color = '#1d2433'; else b.classList.add('acik'); }
    return b;
  }
  function yeniId() {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(8);
    try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 8; i++) b[i] = Math.random() * 256; }
    return Array.from(b, (x) => abc[x % abc.length]).join('');
  }
  function anahtar() {
    try { return window.Hesap && Hesap.anahtar ? Hesap.anahtar().catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  }
  function profil() {
    const p = window.Hesap && Hesap.profil;
    return p ? { id: p.id, ad: p.name || 'Oyuncu', renk: renkOk(p.color) ? p.color : '#e4472d' } : null;
  }
  function not(t) { try { if (window.Hesap && Hesap.not) Hesap.not(t); } catch (e) { /* ignore */ } }

  // Ranks a list the way the server does: 'sure' = finished first, then the score; 'puan' = the score.
  function sirala(liste, tur) {
    liste.sort((a, b) => {
      if (tur === 'sure') {
        if (!!a.b !== !!b.b) return a.b ? -1 : 1;
        if (a.b && b.b && a.b !== b.b) return a.b - b.b;
      }
      return b.p - a.p || (a.b || 1e12) - (b.b || 1e12);
    });
    let onceki = null;
    liste.forEach((x, i) => {
      const ayni = onceki && (tur === 'sure' ? x.b === onceki.b && (x.b || x.p === onceki.p) : x.p === onceki.p);
      x.sira = ayni ? onceki.sira : i + 1;
      onceki = x;
    });
    return liste;
  }

  /* ---------- one game's rooms ---------- */
  function kur(cfg) {
    cfg = Object.assign({ dil: 'tr', sira: 'puan', izle: true, canli: { top: '64px', right: '8px' }, ayarlar: [] }, cfg || {});
    const Y = YAZI[cfg.dil] || YAZI.tr;
    const tema = Object.assign({
      zemin: '#fffaf0', yazi: '#1d2433', ana: '#e4472d', anaYazi: '#fff', satir: '#fff', cizgi: 'rgba(29,36,51,.12)', kotu: '#c2362b',
      bildirimUst: '64px',
      baslik: 'ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      govde: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
    }, cfg.tema || {});
    if (!tema.kenar) tema.kenar = tema.yazi;          // borders and button shadows
    if (!tema.dugme) tema.dugme = '#fff';             // button background
    if (!tema.dugmeYazi) tema.dugmeYazi = tema.yazi;
    const puanYazi = (p, x) => (cfg.puanYazi ? cfg.puanYazi(p, x) : String(Math.round(p)));
    const canliYazi = (p, x) => (cfg.canliYazi ? cfg.canliYazi(p, x) : puanYazi(p, x)); // shorter, for the live ranking

    // the shadow root that holds the sheet, the live ranking and the notes
    const host = document.createElement('div');
    host.setAttribute('data-oda', cfg.oyun);
    const kok = host.attachShadow({ mode: 'open' });
    const stil = document.createElement('style');
    stil.textContent = CSS + ':host{' + Object.keys(tema).map((k) => '--' + k + ':' + tema[k]).join(';') + '}';
    kok.appendChild(stil);
    const sahne = mk('div', 'kok'); sahne.hidden = true; sahne.lang = cfg.dil;
    const perde = mk('div', 'perde');
    const kart = mk('div', 'kart');
    kart.setAttribute('role', 'dialog'); kart.setAttribute('aria-modal', 'true');
    sahne.append(perde, kart);
    const canli = mk('div', 'canli'); canli.hidden = true;
    if (cfg.canli) for (const k of ['top', 'right', 'bottom', 'left']) if (cfg.canli[k] != null) canli.style[k] = cfg.canli[k];
    const bildirim = mk('div', 'bildirim');
    canli.lang = bildirim.lang = cfg.dil;
    kok.append(sahne, canli, bildirim);
    // the game's own keys and pointers must not see what happens on the sheet
    for (const t of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'click', 'wheel', 'contextmenu']) {
      kok.addEventListener(t, (e) => e.stopPropagation());
    }
    window.addEventListener('keydown', (e) => {
      if (sahne.hidden || e.composedPath().includes(host)) return;
      if (e.key === 'Escape' && o.ekran === 'menu') menuKapat();
      e.stopImmediatePropagation();
    }, true);
    const ekle = () => { if (!host.isConnected) document.body.appendChild(host); };
    if (document.body) ekle(); else document.addEventListener('DOMContentLoaded', ekle);

    const o = {
      cfg, ekran: null, lobi: null, lobiPing: 0, odalarListe: [], satirlar: new Map(),
      ws: null, ping: 0, id: null, kurmak: false, ben: 0, kurucu: 0, durumAd: null, kisiler: [], adlar: new Map(),
      ayar: null, tur: 0, aktif: false, bittiBen: false, ayrilma: false, deneme: 0, sira: cfg.sira, sonra: 0,
      son: null, sonucBen: null, sonGonder: 0, bekleyen: null, gonderT: 0, canliListe: [], kalan: 0, bitenler: new Set()
    };

    /* the sheet */
    function sayfa(ad, kur) {
      if (ad !== 'menu') o.menuCb = null;
      o.ekran = ad;
      kart.replaceChildren();
      kur(kart);
      sahne.hidden = false;
      const ilk = kart.querySelector('button:not(:disabled)');
      if (ilk && !COARSE) setTimeout(() => { try { ilk.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    }
    function kapatSayfa() { sahne.hidden = true; o.ekran = null; o.menuCb = null; }
    // "back to the game" from the room menu
    function menuKapat() {
      const f = o.menuCb;
      kapatSayfa();
      if (f) { try { f(); } catch (e) { console.error(e); } }
    }
    function baslik(k, ust, h, lead) {
      if (ust) k.append(mk('p', 'ust', ust));
      const h2 = mk('h2', '', h); h2.id = 'oda-h'; k.append(h2);
      kart.setAttribute('aria-labelledby', 'oda-h');
      if (lead) k.append(mk('p', '', lead));
      return h2;
    }
    function dugme(metin, cls, f) {
      const b = mk('button', 'btn' + (cls ? ' ' + cls : ''), metin);
      b.type = 'button';
      b.addEventListener('click', f);
      return b;
    }
    function nasildiDugme() {
      if (!window.Hesap || !Hesap.nasildi) return null;
      return dugme(Y.nasildi, '', () => { try { Hesap.nasildi({ yer: 'oda' }); } catch (e) { /* ignore */ } });
    }
    function bildir(t) {
      const d = mk('div', '', t);
      bildirim.append(d);
      setTimeout(() => d.remove(), 2700);
      while (bildirim.children.length > 3) bildirim.firstChild.remove();
    }

    /* ---------- the room list ---------- */
    function ac(mesaj, baglanma) {
      sayfa('liste', (k) => {
        baslik(k, Y.ust, Y.odalar, cfg.aciklama || Y.aciklama);
        const ol = mk('ol', 'liste'); ol.id = 'odalar';
        const d = mk('p', 'durum'); d.id = 'odaDurum'; d.setAttribute('role', 'status');
        const sira = mk('div', 'sira');
        const kurB = dugme(Y.kur, 'ana', () => katil(yeniId(), true)); kurB.id = 'odaKur';
        sira.append(kurB, dugme(Y.geri, '', () => { lobiKapat(); kapatSayfa(); }));
        k.append(ol, d, sira);
      });
      o.satirlar.clear();
      soyle(mesaj || Y.bakiliyor, !!mesaj);
      if (!baglanma) lobiBaglan();
    }
    function soyle(t, kotu) {
      const e = kok.getElementById('odaDurum');
      if (!e) return;
      e.textContent = t || '';
      e.classList.toggle('kotu', !!kotu);
    }
    async function lobiBaglan() {
      lobiKapat();
      const tk = await anahtar();
      if (o.ekran !== 'liste') return;
      let ws;
      try { ws = new WebSocket(SUNUCU + '/' + cfg.oyun + '/lobi'); } catch (e) { soyle(Y.hata.ag, true); return; }
      o.lobi = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'merhaba', token: tk }));
      ws.onmessage = (e) => {
        if (e.data === 'pong' || o.lobi !== ws) return;
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.t === 'liste') { o.odalarListe = m.odalar || []; listeCiz(); }
        else if (m.t === 'hata') soyle(m.neden === 'giris' ? Y.listeGiris : Y.listeHata, true);
      };
      ws.onclose = () => {
        if (o.lobi !== ws) return;
        o.lobi = null;
        if (o.ekran === 'liste') {
          soyle(Y.listeKoptu, true);
          setTimeout(() => { if (o.ekran === 'liste' && !o.lobi && !o.ws) lobiBaglan(); }, 3000);
        }
      };
      clearInterval(o.lobiPing);
      o.lobiPing = setInterval(() => { try { if (ws.readyState === 1) ws.send('ping'); } catch (e) { /* ignore */ } }, 25000);
    }
    function lobiKapat() {
      clearInterval(o.lobiPing);
      const ws = o.lobi; o.lobi = null;
      if (ws) { try { ws.close(1000); } catch (e) { /* ignore */ } }
    }
    function listeCiz() {
      const ol = kok.getElementById('odalar');
      if (!ol) return;
      soyle('');
      if (!o.odalarListe.length) {
        o.satirlar.clear();
        ol.replaceChildren(mk('li', 'bos', Y.bos));
        return;
      }
      const bos = ol.querySelector('.bos'); if (bos) bos.remove();
      const tut = new Set();
      for (const r of o.odalarListe) {
        tut.add(r.id);
        let s = o.satirlar.get(r.id);
        if (!s) {
          s = { li: mk('li'), ad: mk('span', 'ad'), kucuk: mk('small'), b: mk('button', 'mini'), rz: null, r };
          s.b.type = 'button';
          s.b.addEventListener('click', () => katil(s.r.id, false));
          s.rz = rozet(r.kurucu, r.renk);
          s.li.append(s.rz, s.ad, s.b);
          o.satirlar.set(r.id, s);
        }
        s.r = r;
        s.li.classList.toggle('oyunda', r.durum === 'oyunda');
        s.ad.replaceChildren(Y.odasi(r.kurucu), s.kucuk);
        s.kucuk.textContent = [Y.kisi(r.n), r.durum === 'oyunda' ? Y.oyunda : Y.bekliyor, r.not].filter(Boolean).join(' · ');
        const yeni = rozet(r.kurucu, r.renk);
        if (yeni.textContent !== s.rz.textContent || yeni.style.cssText !== s.rz.style.cssText) { s.rz.replaceWith(yeni); s.rz = yeni; }
        const dolu = r.n >= (r.en || 8);
        s.b.textContent = dolu ? Y.dolu : Y.katil; s.b.disabled = dolu;
        ol.append(s.li);
      }
      for (const [id, s] of o.satirlar) if (!tut.has(id)) { s.li.remove(); o.satirlar.delete(id); }
    }

    /* ---------- joining ---------- */
    function katil(id, kurmak) {
      lobiKapat(); baglantiKapat();
      Object.assign(o, { id, kurmak, ben: 0, durumAd: null, ayrilma: false, deneme: 0, kisiler: [], aktif: false, son: null });
      o.adlar.clear();
      if (o.ekran !== 'liste') ac(null, true);
      soyle(kurmak ? Y.kuruluyor : Y.katiliniyor);
      const b = kok.getElementById('odaKur'); if (b) b.disabled = true;
      baglan();
    }
    async function baglan() {
      const tk = await anahtar();
      const p = profil();
      if (!p) { hata('giris'); return; }
      let ws;
      try { ws = new WebSocket(SUNUCU + '/' + cfg.oyun + '/oda/' + o.id); } catch (e) { hata('ag'); return; }
      o.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'merhaba', token: tk, profil: p.id, ad: p.ad, renk: p.renk, kur: o.kurmak, surum: cfg.surum || 1 }));
      ws.onmessage = (e) => {
        if (e.data === 'pong' || o.ws !== ws) return;
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        mesaj(m);
      };
      ws.onclose = (e) => {
        if (o.ws !== ws) return;
        o.ws = null; clearInterval(o.ping);
        if (o.ayrilma) return;
        // dropped: try to get back in (the room keeps our place for a minute)
        if (e.code < 4000 && o.ben && o.deneme < 6) {
          o.deneme++; o.kurmak = false;
          if (o.aktif) bildir(Y.koptu);
          setTimeout(() => { if (!o.ws && !o.ayrilma && o.id) baglan(); }, 700 * o.deneme);
          return;
        }
        if (e.code < 4000) hata('ag');
      };
      clearInterval(o.ping);
      o.ping = setInterval(() => { try { if (ws.readyState === 1) ws.send('ping'); } catch (e) { /* ignore */ } }, 25000);
    }
    function yolla(m) {
      const ws = o.ws;
      if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); return true; } catch (e) { /* ignore */ } }
      return false;
    }
    function baglantiKapat() {
      clearInterval(o.ping); clearTimeout(o.gonderT); o.gonderT = 0; o.bekleyen = null;
      const ws = o.ws; o.ws = null;
      if (ws) { try { ws.close(1000); } catch (e) { /* ignore */ } }
    }
    function oyunuBirak(sonuc) {
      canli.hidden = true;
      if (!o.aktif) return;
      o.aktif = false;
      try { if (cfg.bitti) cfg.bitti(sonuc || null); } catch (e) { console.error(e); }
    }
    function hata(neden) {
      o.ayrilma = true; baglantiKapat();
      const vardi = o.ben;
      oyunuBirak(null);
      o.id = null; o.ben = 0;
      if (vardi) { try { if (cfg.cikti) cfg.cikti(); } catch (e) { console.error(e); } }
      ac(Y.hata[neden] || Y.hata.genel);
    }
    function cik() {
      o.ayrilma = true; baglantiKapat();
      oyunuBirak(null);
      o.id = null; o.ben = 0;
      kapatSayfa();
      try { if (cfg.cikti) cfg.cikti(); } catch (e) { console.error(e); }
    }

    function mesaj(m) {
      switch (m.t) {
        case 'hos': {
          const yeni = !o.ben;
          o.ben = m.ben; o.deneme = 0;
          if (yeni && cfg.girdi) { try { cfg.girdi(); } catch (e) { console.error(e); } }
          break;
        }
        case 'oda': odaBilgi(m); break;
        case 'basla': basla(m); break;
        case 's': anlik(m); break;
        case 'o': try { if (cfg.olay) cfg.olay(m.no, m.e); } catch (e) { console.error(e); } break;
        case 'son': sonuc(m); break;
        case 'hata': hata(m.neden); break;
      }
    }
    function odaBilgi(m) {
      const once = new Set(o.kisiler.map((x) => x.no));
      const ilk = o.durumAd == null;
      o.durumAd = m.durum; o.kurucu = m.kurucu; o.kisiler = m.oyuncular || []; o.ayar = m.ayar || null;
      if (m.sira) o.sira = m.sira;
      o.sonra = m.sonra || 0;
      for (const x of o.kisiler) o.adlar.set(x.no, { ad: x.ad, renk: x.renk });
      if (!ilk) {
        for (const x of o.kisiler) if (!once.has(x.no) && x.no !== o.ben) bildir(Y.geldi(x.ad));
        const simdi = new Set(o.kisiler.map((x) => x.no));
        for (const no of once) if (!simdi.has(no) && no !== o.ben) bildir(Y.gitti((o.adlar.get(no) || {}).ad || '?'));
      }
      // the host creating the room: send the default choices
      if (o.ben === o.kurucu && !o.ayar && m.durum === 'bekliyor') ayarYolla(varsayilanAyar());
      // back after a dropped connection and the round has ended meanwhile (or the room restarted)
      if (o.aktif && m.durum !== 'oyunda') oyunuBirak(null);
      if (m.durum !== 'oyunda' && o.ekran !== 'sonuc') bekle();
      else if (o.ekran === 'bekle') bekle();
    }
    function varsayilanAyar() {
      const a = {};
      for (const g of cfg.ayarlar) a[g.k] = g.v;
      return a;
    }
    function ayarYolla(a) {
      a = Object.assign({}, a);
      delete a.yazi;
      let yazi = '';
      try { yazi = cfg.ayarYazi ? cfg.ayarYazi(a) : cfg.ayarlar.map((g) => ((g.secenek.find((s) => s.d === a[g.k]) || {}).ad || '')).filter(Boolean).join(' · '); } catch (e) { /* ignore */ }
      if (yazi) a.yazi = String(yazi).slice(0, 60);
      o.ayar = a;
      yolla({ t: 'ayar', ayar: a });
    }

    /* ---------- the waiting room ---------- */
    function bekle() {
      const kurucuAd = (o.adlar.get(o.kurucu) || {}).ad || '';
      const benKurucu = o.ben === o.kurucu, n = o.kisiler.length;
      sayfa('bekle', (k) => {
        baslik(k, Y.bekleme, Y.odasi(kurucuAd));
        const ol = mk('ol', 'liste');
        for (const x of o.kisiler) {
          const li = mk('li', x.no === o.ben ? 'ben' : '');
          li.append(rozet(x.ad, x.renk), mk('span', 'ad', x.ad));
          if (x.no === o.kurucu) li.append(mk('span', 'etiket kurucu', Y.kurucu));
          else if (x.no === o.ben) li.append(mk('span', 'etiket', Y.sen));
          ol.append(li);
        }
        k.append(ol);
        if (cfg.ayarlar.length) {
          const a = o.ayar || varsayilanAyar();
          if (benKurucu) {
            const s = mk('div', 'secimler');
            for (const g of cfg.ayarlar) {
              const kutu = mk('div', 'secim'), cipler = mk('div');
              kutu.append(mk('b', '', g.ad), cipler);
              for (const se of g.secenek) {
                const c = mk('button', 'cip', se.ad);
                c.type = 'button';
                c.setAttribute('aria-pressed', String(a[g.k] === se.d));
                c.addEventListener('click', () => { const y = Object.assign({}, o.ayar || varsayilanAyar()); y[g.k] = se.d; ayarYolla(y); bekle(); });
                cipler.append(c);
              }
              s.append(kutu);
            }
            k.append(s);
          } else if (a && a.yazi) k.append(mk('p', 'ozet', a.yazi));
        }
        const d = mk('p', 'durum'); d.setAttribute('role', 'status');
        if (benKurucu) d.textContent = (n < 2 ? Y.notTek : Y.notHazir(n)) + ' ' + Y.gecGelen;
        else { d.append(Y.notBekle(kurucuAd)); d.append(mk('span', 'nokta')); }
        const davetNot = mk('p', 'durum'); davetNot.hidden = true;
        const sira = mk('div', 'sira');
        if (benKurucu) sira.append(dugme(Y.baslat, 'ana', () => yolla({ t: 'basla' })));
        sira.append(dugme(Y.cagir, '', () => davet(davetNot)), dugme(Y.cik, '', cik));
        k.append(d, sira, davetNot);
      });
    }
    async function davet(not) {
      if (!o.id) return;
      const url = location.origin + location.pathname + '?oda=' + o.id;
      const metin = Y.davet((o.adlar.get(o.kurucu) || {}).ad || '', cfg.ad || document.title);
      try { if (navigator.share && COARSE) { await navigator.share({ title: cfg.ad || document.title, text: metin, url }); return; } }
      catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(url); not.textContent = Y.kopyalandi; not.classList.remove('link'); }
      catch (e) { not.textContent = url; not.classList.add('link'); }
      not.hidden = false;
    }

    /* ---------- the round ---------- */
    function basla(m) {
      for (const x of m.kadro || []) o.adlar.set(x.no, { ad: x.ad, renk: x.renk });
      if (o.aktif && o.tur === m.tur) return; // back after a dropped connection, same round: carry on
      o.tur = m.tur; o.aktif = true; o.bittiBen = !!(m.ben && m.ben.b); o.son = null; o.sonucBen = null;
      o.bitenler = new Set(); o.canliListe = []; o.kalan = 0;
      if (m.ayar) o.ayar = m.ayar;
      kapatSayfa(); lobiKapat();
      canli.hidden = !cfg.canli; canli.replaceChildren();
      not((cfg.dil === 'en' ? 'Room: ' : 'Odada: ') + Y.odasi((o.adlar.get(o.kurucu) || {}).ad || '?') + (o.ayar && o.ayar.yazi ? ' · ' + o.ayar.yazi : ''));
      try { cfg.basla(m); } catch (e) { console.error(e); }
    }
    function liste(p) {
      return p.map(([no, puan, b, v]) => {
        const n = o.adlar.get(no) || {};
        return { no, ad: n.ad || '?', renk: n.renk || '#888', p: puan, b, v, ben: no === o.ben };
      });
    }
    function anlik(m) {
      if (!o.aktif) return;
      const l = liste(m.p || []);
      sirala(l, o.sira);
      o.canliListe = l; o.kalan = m.k || 0; o.kalanT = performance.now();
      for (const x of l) {
        if (x.b && !o.bitenler.has(x.no)) {
          o.bitenler.add(x.no);
          if (!x.ben && o.sira === 'sure') bildir(Y.bitirdi(x.ad));
        }
      }
      try { if (cfg.durum) cfg.durum(l, m); } catch (e) { console.error(e); }
      canliCiz();
      if (o.ekran === 'izle') izleCiz();
    }
    function canliCiz() {
      if (!cfg.canli || canli.hidden) return;
      const l = o.canliListe;
      canli.replaceChildren();
      if (l.length > 1) {
        const goster = l.slice(0, 4);
        const ben = l.find((x) => x.ben);
        if (ben && !goster.includes(ben)) goster.push(ben);
        for (const x of goster) {
          const d = mk('div', (x.ben ? 'ben' : '') + (x.b ? ' bitti' : ''));
          d.append(rozet(x.ad, x.renk, 'i'), mk('span', '', x.ad), mk('b', '', o.sira === 'sure' && x.b ? sureYazi(x.b) : canliYazi(x.p, x)));
          canli.append(d);
        }
      }
      // the clock, when time is short or someone has finished and the others are hurrying
      const kalan = o.kalan;
      if (kalan && (cfg.saat || kalan < 120000 || (o.sonra && o.bitenler.size))) canli.append(mk('div', 'saat', '⏱ ' + sureYazi(kalan)));
    }
    function gonder(p, v) {
      if (!o.aktif || o.bittiBen) return;
      o.bekleyen = { t: 'd', p, v };
      if (o.gonderT) return;
      const bekle = Math.max(0, 100 - (performance.now() - o.sonGonder));
      o.gonderT = setTimeout(() => {
        o.gonderT = 0;
        if (o.bekleyen && yolla(o.bekleyen)) o.sonGonder = performance.now();
        o.bekleyen = null;
      }, bekle);
    }
    function olay(e) { if (o.aktif) yolla({ t: 'o', e }); }
    function bitir(p, eser, v, ust) {
      if (!o.aktif || o.bittiBen) return;
      clearTimeout(o.gonderT); o.gonderT = 0; o.bekleyen = null;
      o.bittiBen = true;
      o.izleUst = ust || null;
      const m = { t: 'bitir', p };
      if (eser !== undefined) m.eser = eser;
      if (v !== undefined) m.v = v;
      yolla(m);
      if (cfg.izle) setTimeout(() => { if (o.aktif && o.bittiBen && !o.ekran) izle(); }, 1400);
    }
    // "you're done": the live ranking while the others play on
    function izle() {
      sayfa('izle', (k) => {
        baslik(k, o.izleUst || Y.bitirdin, '…');
        const ol = mk('ol', 'liste'); ol.id = 'izleListe';
        const d = mk('p', 'durum'); d.id = 'izleNot';
        const sira = mk('div', 'sira');
        if (o.ben === o.kurucu) sira.append(dugme(Y.turuBitir, '', () => yolla({ t: 'son' })));
        sira.append(dugme(Y.cik, '', cik));
        k.append(ol, d, sira);
      });
      izleCiz();
    }
    function izleCiz() {
      const ol = kok.getElementById('izleListe');
      if (!ol) return;
      const ben = o.canliListe.find((x) => x.ben);
      const h = kok.getElementById('oda-h');
      if (h) h.textContent = ben && o.canliListe.length > 1 ? Y.siradasin(ben.sira) : o.izleUst || Y.bitirdin;
      ol.replaceChildren(...o.canliListe.map(satir));
      const kalan = Math.max(0, o.kalan - (performance.now() - (o.kalanT || 0)));
      kok.getElementById('izleNot').textContent = Y.beklen + (kalan && kalan < 30 * 60000 ? ' ' + Y.kalan(sureYazi(kalan)) : '');
    }
    function satir(x) {
      const li = mk('li', x.ben ? 'ben' : '');
      const no = mk('span', 'no' + (x.sira <= 3 ? ' n' + x.sira : ''), String(x.sira));
      const deger = mk('span', 'deger');
      if (o.sira === 'sure') {
        if (x.b) { deger.append(sureYazi(x.b)); deger.append(mk('small', '', puanYazi(x.p, x))); }
        else { deger.append(puanYazi(x.p, x)); deger.append(mk('small', '', o.aktif ? '…' : Y.bitiremedi)); }
      } else deger.textContent = puanYazi(x.p, x);
      li.append(no, rozet(x.ad, x.renk), mk('span', 'ad', x.ad), deger);
      if (cfg.sonucDugme && x.eser && !o.aktif) {
        const b = mk('button', 'mini acik', cfg.sonucDugme.ad);
        b.type = 'button';
        b.addEventListener('click', () => { try { cfg.sonucDugme.tikla(x, b); } catch (e) { console.error(e); } });
        li.append(b);
      }
      return li;
    }
    function sonuc(m) {
      const l = (m.sonuc || []).map((x) => Object.assign({}, x, { ben: x.no === o.ben }));
      for (const x of l) if (!o.adlar.has(x.no)) o.adlar.set(x.no, { ad: x.ad, renk: x.renk });
      if (m.sira) o.sira = m.sira;
      o.son = l;
      const ben = l.find((x) => x.ben);
      oyunuBirak(l);
      if (ben) {
        const ayrinti = { mod: 'oda', sira: ben.sira, oyuncu: l.length };
        if (ben.b) ayrinti.sure = Math.round(ben.b / 100) / 10;
        if (cfg.skorAyrinti) { try { Object.assign(ayrinti, cfg.skorAyrinti(ben)); } catch (e) { /* ignore */ } }
        if (cfg.skor && window.Hesap && Hesap.skor) { try { Promise.resolve(Hesap.skor(ben.p, ayrinti, cfg.skor)).catch(() => {}); } catch (e) { /* ignore */ } }
        not((cfg.dil === 'en' ? 'Room round over · ' + sira(ben.sira) : 'Oda turu bitti · ' + ben.sira + '. sıra') + ' · ' + puanYazi(ben.p, ben));
      }
      sonucGoster();
    }
    function sonucGoster() {
      const l = o.son || [];
      const ben = l.find((x) => x.ben), kazanan = l.find((x) => x.sira === 1);
      let ust = Y.turBitti, h = Y.turBitti;
      if (l.length <= 1) { if (ben) h = puanYazi(ben.p, ben); }
      else if (ben && ben.sira === 1) h = Y.birinci;
      else if (ben) { ust = Y.oldun(ben.sira); if (kazanan) h = Y.kazandi(kazanan.ad); }
      else if (kazanan) h = Y.kazandi(kazanan.ad);
      sayfa('sonuc', (k) => {
        baslik(k, ust, h);
        const ol = mk('ol', 'liste');
        for (const x of l) ol.append(satir(x));
        k.append(ol);
        const sira = mk('div', 'sira');
        sira.append(dugme(Y.devam, 'ana', () => { if (o.ws) bekle(); else ac(); }));
        const nb = nasildiDugme(); if (nb) sira.append(nb);
        sira.append(dugme(Y.cik, '', cik));
        k.append(sira);
      });
    }

    function menu(kapaninca) {
      if (!o.id) return;
      if (!o.aktif) { if (o.son && o.ekran !== 'bekle') sonucGoster(); else bekle(); return; } // between rounds
      if (o.bittiBen) { izle(); return; }
      sayfa('menu', (k) => {
        baslik(k, Y.odadasin, Y.suruyor, Y.menuLead);
        const sira = mk('div', 'sira');
        sira.append(dugme(Y.don, 'ana', menuKapat));
        if (o.ben === o.kurucu) sira.append(dugme(Y.turuBitir, '', () => { yolla({ t: 'son' }); }));
        const nb = nasildiDugme(); if (nb) sira.append(nb);
        sira.append(dugme(Y.cik, '', cik));
        k.append(sira);
      });
      o.menuCb = typeof kapaninca === 'function' ? kapaninca : null;
    }

    function kullanilir() { return !!(window.Hesap && Hesap.profil && 'WebSocket' in window && cfg.oyun); }

    const api = {
      get aktif() { return o.aktif; },
      get odada() { return !!o.id; },
      get id() { return o.id; },
      get ben() { return o.ben; },
      get ayar() { return o.ayar; },
      get acik() { return !sahne.hidden; },
      get liste() { return o.canliListe; },
      kullanilir,
      isim(no) { return o.adlar.get(no) || { ad: '?', renk: '#888' }; },
      ac() { if (kullanilir()) ac(); },
      katil(id) { if (kullanilir() && /^[a-z0-9]{8}$/.test(id)) katil(id, false); },
      menu, gonder, olay, bitir, izle, cik,
      kapat: kapatSayfa,
      // where the live ranking goes, e.g. after the game's canvas moved: { top, right, bottom, left }
      canliYer(yer) { for (const k of ['top', 'right', 'bottom', 'left']) canli.style[k] = yer && yer[k] != null ? yer[k] : ''; },
      dugme(el) {
        if (!el) return;
        el.hidden = true;
        el.addEventListener('click', () => { if (o.id) menu(); else api.ac(); }); // in a room: the room's own menu
        hazir.then(() => { el.hidden = !kullanilir(); });
      },
      ninki, sureYazi
    };

    // an invite link: <game>/?oda=<id>
    const hazir = window.Hesap && Hesap.hazir ? Promise.resolve(Hesap.hazir).catch(() => null) : Promise.resolve(null);
    hazir.then(() => {
      let id = null;
      try { id = new URLSearchParams(location.search).get('oda'); } catch (e) { /* ignore */ }
      if (!id || !/^[a-z0-9]{8}$/.test(id)) return;
      try { const u = new URL(location.href); u.searchParams.delete('oda'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* ignore */ }
      if (kullanilir()) setTimeout(() => katil(id, false), 0);
    });
    return api;
  }

  window.Oda = { kur, ninki, sureYazi };
})();
