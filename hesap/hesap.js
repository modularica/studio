/* Hesap: Uzay'ın oyunları için ortak hesap sistemi (Supabase).
 *
 * Bir sayfaya eklemek için <head> içine:
 *   <script src="/hesap/supabase.js"></script>
 *   <script src="/hesap/hesap.js" data-oyun="fish"></script>
 *
 * data-oyun   Oyunun kısa adı (klasör adı). Varsa oynama süresi bu adla kaydedilir.
 * data-kapi   "oyuncu" (varsayılan): giriş yapılmış ve oyuncu seçilmiş olmalı.
 *             "oturum": sadece giriş yeterli.  "yok": kapı yok (giriş sayfası).
 * data-kayit  Oyunun localStorage anahtarları (boşlukla ayrılmış). Bunlar oyuncunun hesabıyla
 *             eşitlenir: oyun her zamanki gibi localStorage'a yazar, hesap.js bunları hesaba taşır,
 *             başka cihazda ya da başka oyuncuyla açılınca doğru kaydı geri yükler. Ses gibi cihaz
 *             tercihlerini buraya koyma.
 *
 * Oyunlar için:
 *   Hesap.hazir            Promise -> { kullanici, profil } (kapı geçilince)
 *   Hesap.profil           Seçili oyuncu: { id, name, color, owner_id }
 *   Hesap.yukle()          Bu oyunun kaydı (yoksa null)
 *   Hesap.kaydet(veri)     Bu oyunun kaydını yazar (JSON). Sık çağırma: seviye sonu, ders sonu gibi anlarda.
 *   Hesap.not('12. dalga') Oynama kaydına kısa bir ilerleme notu (takip sayfasında görünür)
 */
(function () {
  'use strict';

  var API = 'https://cuihsjlhhbmwnzhldqvp.supabase.co';
  var KEY = 'sb_publishable_vm_w7wu4c5SrNsQXe0CHGA_t2B3YR_i';
  var PROFIL_KEY = 'uzay.oyuncu';
  // Supabase Auth needs an e-mail. Players sign up with a username only; it becomes
  // <username>@KULLANICI_ALANI behind the scenes. No mail is ever sent there ("Confirm email" is off).
  // Never change this: existing accounts would stop matching their usernames.
  var KULLANICI_ALANI = 'oyuncu.bringthepoint.com';
  var GIRIS = '/giris/';
  var NABIZ = 20000;              // oynama süresi bu aralıkla yazılır
  var YENI_OTURUM = 10 * 60000;   // bu kadar arka planda kalınca yeni oynama kaydı açılır

  var script = document.currentScript;
  var OYUN = (script && script.dataset.oyun) || null;
  var KAPI = (script && script.dataset.kapi) || 'oyuncu';
  var KAYITLAR = ((script && script.dataset.kayit) || '').split(/[\s,]+/).filter(Boolean);
  var SENK = !!OYUN && KAYITLAR.length > 0 && KAPI === 'oyuncu';
  var META_KEY = 'hesap.senk.' + OYUN;
  var html = document.documentElement;

  /* The game script runs before the account answers, so remember now which player the local
     save belonged to and stop its writes from being uploaded until the first sync decides. */
  var lsSet = Storage.prototype.setItem, lsRemove = Storage.prototype.removeItem;
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function metaOku() { try { return JSON.parse(lsGet(META_KEY) || 'null'); } catch (e) { return null; } }
  function metaYaz(m) { try { lsSet.call(window.localStorage, META_KEY, JSON.stringify(m)); } catch (e) {} }
  var ilkMeta = SENK ? metaOku() : null;
  var senk = { hazir: false, surum: 0, zamanlayici: null };
  if (SENK) {
    var izlenen = function (depo, k) {
      try { return depo === window.localStorage && KAYITLAR.indexOf(k) >= 0; } catch (e) { return false; }
    };
    Storage.prototype.setItem = function (k, v) {
      lsSet.call(this, k, v);
      if (izlenen(this, k)) kirlendi();
    };
    Storage.prototype.removeItem = function (k) {
      lsRemove.call(this, k);
      if (izlenen(this, k)) kirlendi();
    };
  }

  if (KAPI !== 'yok') {
    var st = document.createElement('style');
    st.textContent = 'html.hesap-bekle body{visibility:hidden}';
    document.head.appendChild(st);
    html.classList.add('hesap-bekle');
  }

  var durum = { oturum: null, profil: null };
  var hazirCoz;
  var hazir = new Promise(function (res) { hazirCoz = res; });

  function okuProfil() {
    try { return JSON.parse(localStorage.getItem(PROFIL_KEY) || 'null'); } catch (e) { return null; }
  }
  function yazProfil(p) {
    try {
      if (p) localStorage.setItem(PROFIL_KEY, JSON.stringify({ id: p.id, name: p.name, color: p.color, owner_id: p.owner_id }));
      else localStorage.removeItem(PROFIL_KEY);
    } catch (e) {}
    durum.profil = p || null;
  }
  function girise() {
    var geri = location.pathname + location.search + location.hash;
    location.replace(GIRIS + '?geri=' + encodeURIComponent(geri));
  }
  function hataGoster(metin) {
    var go = function () {
      var d = document.createElement('div');
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#fbfcfe;color:#1d2433;' +
        'font:600 17px/1.5 system-ui,sans-serif;text-align:center;visibility:visible;z-index:2147483647';
      d.textContent = metin;
      document.body.appendChild(d);
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }

  if (!window.supabase || !window.supabase.createClient) {
    hataGoster('Oyunlara bağlanılamadı. İnternet bağlantını kontrol edip sayfayı yenile.');
    return;
  }

  var istemci = window.supabase.createClient(API, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'uzay.oturum' }
  });

  istemci.auth.onAuthStateChange(function (olay, oturum) {
    durum.oturum = oturum || null;
    if (olay === 'SIGNED_OUT') {
      yazProfil(null);
      if (KAPI !== 'yok') girise();
    }
  });

  istemci.auth.getSession().then(function (r) {
    var oturum = r && r.data ? r.data.session : null;
    durum.oturum = oturum;
    var p = okuProfil();
    if (oturum && p && p.owner_id === oturum.user.id) durum.profil = p;
    if (KAPI !== 'yok') {
      if (!oturum) return girise();
      if (KAPI === 'oyuncu' && !durum.profil) return girise();
    }
    (SENK ? senkBaslat() : Promise.resolve(true)).then(function (goster) {
      if (!goster) return; // the page is reloading with the account's save
      html.classList.remove('hesap-bekle');
      hazirCoz({ kullanici: oturum ? oturum.user : null, profil: durum.profil });
      if (OYUN && durum.profil) oyunuBaslat();
    });
  }, function () {
    hataGoster('Giriş bilgisi okunamadı. Sayfayı yenile.');
  });

  /* ---------- oynama süresi ---------- */
  var oyun = { id: null, ms: 0, son: 0, gizlendi: 0, not: null, gonderilen: -1, notGonderilen: null, bekliyor: false };

  function oyunuBaslat() {
    oyun.id = null; oyun.ms = 0; oyun.son = Date.now(); oyun.gizlendi = 0;
    oyun.gonderilen = -1; oyun.notGonderilen = null; oyun.bekliyor = true;
    istemci.from('plays').insert({ profile_id: durum.profil.id, game: OYUN }).select('id').single().then(function (r) {
      oyun.bekliyor = false;
      if (r.error) {
        // Oyuncu silinmiş ya da başka hesaba ait: yeniden seçtir.
        if (/foreign key|row-level security/i.test(r.error.message || '')) { yazProfil(null); girise(); }
        return;
      }
      oyun.id = r.data.id;
    });
  }
  function say() {
    var t = Date.now();
    if (oyun.son) oyun.ms += Math.min(t - oyun.son, NABIZ * 3);
    oyun.son = document.hidden ? 0 : t;
  }
  function govde() {
    var g = { seconds: Math.min(86400, Math.floor(oyun.ms / 1000)), last_seen: new Date().toISOString() };
    if (oyun.not !== null) g.note = oyun.not;
    return g;
  }
  function nabiz() {
    if (!oyun.id) return;
    say();
    var g = govde();
    if (g.seconds === oyun.gonderilen && oyun.not === oyun.notGonderilen) return;
    oyun.gonderilen = g.seconds; oyun.notGonderilen = oyun.not;
    istemci.from('plays').update(g).eq('id', oyun.id).then(function () {});
  }
  function birak() {
    // Sayfa kapanırken de gitsin diye keepalive ile doğrudan istek.
    if (!oyun.id || !durum.oturum) return;
    try {
      fetch(API + '/rest/v1/plays?id=eq.' + oyun.id, {
        method: 'PATCH', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + durum.oturum.access_token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(govde())
      }).catch(function () {});
    } catch (e) {}
  }
  if (OYUN) {
    setInterval(function () { if (!document.hidden) nabiz(); }, NABIZ);
    document.addEventListener('visibilitychange', function () {
      if (!durum.profil) return;
      if (document.hidden) {
        say(); birak(); oyun.gizlendi = Date.now();
        if (SENK) senkBirak();
      } else {
        if (oyun.gizlendi && Date.now() - oyun.gizlendi > YENI_OTURUM && !oyun.bekliyor) oyunuBaslat();
        else oyun.son = Date.now();
        oyun.gizlendi = 0;
      }
    });
    window.addEventListener('pagehide', function () { say(); birak(); if (SENK) senkBirak(); });
  }

  /* ---------- kayıt senkronu (data-kayit) ---------- */
  function yerelVeri() {
    var o = {}, dolu = false;
    KAYITLAR.forEach(function (k) { var v = lsGet(k); if (v !== null) { o[k] = v; dolu = true; } });
    return dolu ? o : null;
  }
  function yereleYaz(keys) {
    KAYITLAR.forEach(function (k) {
      try {
        if (keys && typeof keys[k] === 'string') lsSet.call(window.localStorage, k, keys[k]);
        else lsRemove.call(window.localStorage, k);
      } catch (e) {}
    });
  }
  function esit(a, b) {
    a = a || {}; b = b || {};
    return KAYITLAR.every(function (k) { return (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]); });
  }
  function yenidenYukle() {
    // Guard against a reload loop if storage misbehaves.
    var anahtar = 'hesap.yenile.' + OYUN, simdi = Date.now(), once = 0;
    try { once = +sessionStorage.getItem(anahtar) || 0; } catch (e) {}
    if (simdi - once < 15000) return false;
    try { sessionStorage.setItem(anahtar, String(simdi)); } catch (e) {}
    location.reload();
    return true;
  }
  function kirlendi() {
    if (!senk.hazir || !durum.profil) return;
    senk.surum++;
    var m = metaOku() || {};
    metaYaz({
      profil: durum.profil.id, guncel: m.profil === durum.profil.id ? (m.guncel || null) : null,
      kirli: true, degisti: new Date().toISOString()
    });
    clearTimeout(senk.zamanlayici);
    senk.zamanlayici = setTimeout(gonder, 1500);
  }
  function gonder() {
    if (!senk.hazir || !durum.profil) return Promise.resolve();
    clearTimeout(senk.zamanlayici);
    var surum = senk.surum, zaman = new Date().toISOString(), profil = durum.profil.id;
    return istemci.from('saves')
      .upsert({ profile_id: profil, game: OYUN, data: { v: 1, keys: yerelVeri() || {} }, updated_at: zaman })
      .then(function (r) {
        if (r.error) return;
        var temiz = senk.surum === surum, m = metaOku() || {};
        metaYaz({ profil: profil, guncel: zaman, kirli: !temiz, degisti: temiz ? null : (m.degisti || null) });
        if (!temiz) senk.zamanlayici = setTimeout(gonder, 1500);
      }, function () {});
  }
  function senkBirak() {
    // Leaving the page: send what we have with keepalive; the next load reconciles it.
    var m = metaOku();
    if (!senk.hazir || !durum.profil || !durum.oturum || !m || !m.kirli) return;
    clearTimeout(senk.zamanlayici);
    var govde = JSON.stringify({ profile_id: durum.profil.id, game: OYUN, data: { v: 1, keys: yerelVeri() || {} }, updated_at: new Date().toISOString() });
    if (govde.length > 60000) { gonder(); return; }
    try {
      fetch(API + '/rest/v1/saves?on_conflict=profile_id,game', {
        method: 'POST', keepalive: true,
        headers: {
          apikey: KEY, Authorization: 'Bearer ' + durum.oturum.access_token,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: govde
      }).catch(function () {});
    } catch (e) {}
  }
  // Decides, before the game is shown, whether this device's save or the account's save wins.
  // Resolves true to show the game, false when the page is reloading with the account's save.
  function senkBaslat() {
    var profil = durum.profil.id;
    var sorgu = istemci.from('saves').select('data,updated_at').eq('profile_id', profil).eq('game', OYUN).maybeSingle();
    var zamanAsimi = new Promise(function (res) { setTimeout(function () { res({ zamanAsimi: true }); }, 6000); });
    return Promise.race([sorgu, zamanAsimi]).then(function (r) {
      if (r.zamanAsimi || r.error) return true; // offline: play from the local save, decide next time
      var kayit = r.data, m = ilkMeta, yerel = yerelVeri();
      var ayni = !!m && m.profil === profil;
      var hesapta = kayit && kayit.data && kayit.data.keys ? kayit.data.keys : null;
      if (!kayit) {
        if (m && !ayni) {
          // The local save belongs to another player on this device: this player starts fresh.
          metaYaz({ profil: profil, guncel: null, kirli: false });
          if (yerel) { yereleYaz(null); if (yenidenYukle()) return false; }
          senk.hazir = true;
          return true;
        }
        // First time with accounts on this device (old progress moves into the account),
        // or an earlier upload never landed.
        metaYaz({ profil: profil, guncel: null, kirli: !!yerel, degisti: null });
        senk.hazir = true;
        if (yerel) gonder();
        return true;
      }
      if (ayni && esit(yerel, hesapta)) {
        metaYaz({ profil: profil, guncel: kayit.updated_at, kirli: false });
        senk.hazir = true;
        return true;
      }
      if (ayni && m.kirli && (m.guncel === kayit.updated_at || (m.degisti && m.degisti > kayit.updated_at))) {
        // This device has changes the account has not seen yet.
        senk.hazir = true;
        gonder();
        return true;
      }
      // The account wins: put its save on this device and start the game again with it.
      yereleYaz(hesapta);
      metaYaz({ profil: profil, guncel: kayit.updated_at, kirli: false });
      if (yenidenYukle()) return false;
      senk.hazir = true;
      return true;
    }, function () { return true; });
  }

  /* ---------- kullanıcı adı ---------- */
  var TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  function kullaniciKimligi(ad) {
    return String(ad || '').trim().toLocaleLowerCase('tr')
      .replace(/[çğıöşüâîû]/g, function (c) { return TR[c]; })
      .replace(/\s+/g, '_');
  }
  // Username rules: 3-20 characters, letters (Turkish too), digits, _ . -
  function kullaniciAdiHatasi(ad) {
    var a = String(ad || '').trim();
    if (a.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı.';
    if (a.length > 20) return 'Kullanıcı adı en fazla 20 karakter olabilir.';
    if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜâîûÂÎÛ_. -]+$/.test(a)) return 'Kullanıcı adında sadece harf, rakam, boşluk, nokta, alt çizgi ve tire olabilir.';
    var id = kullaniciKimligi(a);
    if (!/^[a-z0-9]/.test(id)) return 'Kullanıcı adı bir harf ya da rakamla başlamalı.';
    if (/\.\.|\.$/.test(id)) return 'Kullanıcı adı noktayla bitemez, iki nokta yan yana olamaz.';
    return '';
  }
  // Login field takes a username or, for parents who want it, a real e-mail.
  function epostaya(girdi) {
    var g = String(girdi || '').trim();
    return g.indexOf('@') > 0 ? g.toLowerCase() : kullaniciKimligi(g) + '@' + KULLANICI_ALANI;
  }
  function gorunenAd(user) {
    if (!user) return '';
    var m = user.user_metadata || {};
    if (m.kullanici_adi) return m.kullanici_adi;
    var e = user.email || '';
    return e.slice(-(KULLANICI_ALANI.length + 1)) === '@' + KULLANICI_ALANI ? e.slice(0, e.indexOf('@')) : e;
  }

  /* ---------- dışarıya açılanlar ---------- */
  var oyunListesi = null;
  window.Hesap = {
    istemci: istemci,
    hazir: hazir,
    oyun: OYUN,
    get profil() { return durum.profil; },
    get kullanici() { return durum.oturum ? durum.oturum.user : null; },

    profilSec: function (p) { yazProfil(p); },
    kullaniciAdiHatasi: kullaniciAdiHatasi,
    epostaya: epostaya,
    gorunenAd: gorunenAd,

    yukle: function (oyunAdi) {
      oyunAdi = oyunAdi || OYUN;
      return hazir.then(function () {
        if (!durum.profil) return { data: null };
        return istemci.from('saves').select('data').eq('profile_id', durum.profil.id).eq('game', oyunAdi).maybeSingle();
      }).then(function (r) {
        if (r.error) throw r.error;
        return r.data ? r.data.data : null;
      });
    },

    kaydet: function (veri, oyunAdi) {
      oyunAdi = oyunAdi || OYUN;
      return hazir.then(function () {
        if (!durum.profil) throw new Error('Oyuncu seçilmedi');
        return istemci.from('saves').upsert({
          profile_id: durum.profil.id, game: oyunAdi, data: veri, updated_at: new Date().toISOString()
        });
      }).then(function (r) {
        if (r.error) throw r.error;
        return true;
      });
    },

    not: function (metin) {
      oyun.not = metin == null ? null : String(metin).slice(0, 80);
    },

    // Records a finished round's score for the leaderboard (one row per round).
    skor: function (deger, ayrinti, oyunAdi) {
      oyunAdi = oyunAdi || OYUN;
      return hazir.then(function () {
        if (!durum.profil) throw new Error('Oyuncu seçilmedi');
        return istemci.from('scores').insert({ profile_id: durum.profil.id, game: oyunAdi, score: deger, detail: ayrinti || {} });
      }).then(function (r) {
        if (r.error) throw r.error;
        return true;
      });
    },

    // Best score per player. secenek: { hafta: true } for this week (from Monday 00:00), limit (default 10).
    siralama: function (secenek) {
      secenek = secenek || {};
      var since = null;
      if (secenek.hafta) {
        var d = new Date(); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        since = d.toISOString();
      }
      return hazir.then(function () {
        return istemci.rpc('leaderboard', { p_game: secenek.oyun || OYUN, p_since: since, p_limit: secenek.limit || 10 });
      }).then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    cikis: function () {
      yazProfil(null);
      return istemci.auth.signOut().finally(function () { location.replace(GIRIS); });
    },

    oyunlar: function () {
      if (!oyunListesi) {
        oyunListesi = fetch('/oyunlar.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : []; })
          .catch(function () { return []; });
      }
      return oyunListesi;
    },

    // Oyuncunun yuvarlak rozeti (baş harfi, kendi renginde). Sayfa .rozet sınıfını biçimler.
    rozet: function (p, sinif) {
      var harf = (p && p.name ? p.name.trim().charAt(0) : '?').toLocaleUpperCase('tr');
      var renk = p && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#596379';
      var el = document.createElement('span');
      el.className = 'rozet' + (sinif ? ' ' + sinif : '');
      el.style.setProperty('--rc', renk);
      el.textContent = harf;
      el.setAttribute('aria-hidden', 'true');
      return el;
    }
  };
})();
