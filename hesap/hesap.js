/* Hesap: Uzay'ın oyunları için ortak hesap sistemi (Supabase).
 *
 * Bir sayfaya eklemek için <head> içine:
 *   <script src="/hesap/supabase.js"></script>
 *   <script src="/hesap/hesap.js" data-oyun="fish"></script>
 *
 * data-oyun   Oyunun kısa adı (klasör adı). Varsa oynama süresi bu adla kaydedilir.
 * data-kapi   "oyuncu" (varsayılan): giriş yapılmış ve oyuncu seçilmiş olmalı.
 *             "oturum": sadece giriş yeterli.  "yok": kapı yok (giriş sayfası).
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
  var GIRIS = '/giris/';
  var NABIZ = 20000;              // oynama süresi bu aralıkla yazılır
  var YENI_OTURUM = 10 * 60000;   // bu kadar arka planda kalınca yeni oynama kaydı açılır

  var script = document.currentScript;
  var OYUN = (script && script.dataset.oyun) || null;
  var KAPI = (script && script.dataset.kapi) || 'oyuncu';
  var html = document.documentElement;

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
    html.classList.remove('hesap-bekle');
    hazirCoz({ kullanici: oturum ? oturum.user : null, profil: durum.profil });
    if (OYUN && durum.profil) oyunuBaslat();
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
      } else {
        if (oyun.gizlendi && Date.now() - oyun.gizlendi > YENI_OTURUM && !oyun.bekliyor) oyunuBaslat();
        else oyun.son = Date.now();
        oyun.gizlendi = 0;
      }
    });
    window.addEventListener('pagehide', function () { say(); birak(); });
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
