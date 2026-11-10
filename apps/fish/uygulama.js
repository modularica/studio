/* App-only glue between the game and iOS. build.mjs copies this into www/ and loads it after
   Capacitor's core (capacitor.js) and before the game. On the web this file is never loaded.
   The game calls window.uygulama.titret(tur, guc) from its sound effects (see titret() in lab/fish/index.html),
   uygulama.skor(cm) when a round ends and uygulama.liderlik() from its Leaderboard buttons (Game Center).
   It also keeps the save in iCloud (kayit below) and plays the Uzi Games intro at launch (acilis below). */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var Haptics = C.registerPlugin('Haptics');
  // Our own small plugin: ios/App/App/GameCenterPlugin.swift (registered in MainViewController.swift).
  var GameCenter = C.registerPlugin('GameCenter');
  // Ours too: ios/App/App/ReviewPlugin.swift, Apple's rating prompt.
  var Review = C.registerPlugin('Review');
  // Ours too: ios/App/App/CloudSavePlugin.swift, copies of the save in iCloud and UserDefaults.
  var CloudSave = C.registerPlugin('CloudSave');
  var LIDERLIK = 'com.uzigames.fish.biggest'; // App Store Connect leaderboard ID; score = length in mm
  var sonYut = 0;
  function sessiz(p) { if (p && p.catch) p.catch(function () {}); return p; }
  function enIyi() { try { return +JSON.parse(localStorage.getItem('fish.best')) || 0; } catch (e) { return 0; } }
  function gonder(cm) {
    if (!window.uygulama.gameCenter || !(cm > 0)) return;
    GameCenter.submitScore({ leaderboardId: LIDERLIK, score: Math.round(cm * 10) }).then(
      function (r) { console.log('[gamecenter] score', Math.round(cm * 10), JSON.stringify(r)); },
      function (e) { console.log('[gamecenter] score failed', e && e.message); });
  }
  // Sign in at launch (iOS shows its own Game Center sheet the first time, a "Welcome back" banner after).
  // Then send the best length already on this device, so players who were here before 1.0 show up too.
  // If that fails (signed out, or sign-in sheet dismissed), the Leaderboard buttons try again.
  // console.log lines show up in Xcode's console when the app runs from Xcode.
  function girisYap() {
    return GameCenter.signIn().then(function (r) {
      console.log('[gamecenter] signIn', JSON.stringify(r));
      if (!r || !r.signedIn) return false;
      if (!window.uygulama.gameCenter) { window.uygulama.gameCenter = true; gonder(enIyi()); }
      return true;
    }, function (e) { console.log('[gamecenter] signIn failed', e && e.message); return false; });
  }
  girisYap();

  // ---- Save in iCloud -------------------------------------------------------------------------
  // The game keeps its progress in localStorage, which lives only inside this app on this device.
  // These keys are copied to iCloud key-value storage (same Apple account: iPhone and iPad share
  // progress, and it comes back after deleting the app) and to UserDefaults (survives iOS clearing
  // the web view's storage). The chosen water (fish.harita) and sound stay per device.
  // At launch the page stays hidden until the copies are merged; if the merge changes this
  // device's save, it is written to localStorage and the page reloads once.
  var KAYIT = ['fish.best', 'fish.toplam', 'fish.desen', 'fish.desenler', 'fish.inci'];
  function oku(s) { try { return s == null ? undefined : JSON.parse(s); } catch (e) { return undefined; } }
  function yerel() {
    var keys = {};
    KAYIT.forEach(function (k) { var v = localStorage.getItem(k); if (v != null) keys[k] = v; });
    return { t: +localStorage.getItem('koi.kayitT') || 0, keys: keys };
  }
  // Two saves into one, key by key: best length and fish eaten only grow (largest wins), bought
  // patterns add up, pearls and the worn pattern come from the newer save (pearls go down when spent).
  function birlestir(a, b) {
    var yeni = (a.t || 0) >= (b.t || 0) ? a : b, eski = yeni === a ? b : a, ka = a.keys || {}, kb = b.keys || {}, out = {};
    var best = Math.max(+oku(ka['fish.best']) || 0, +oku(kb['fish.best']) || 0);
    if (best > 0) out['fish.best'] = JSON.stringify(best);
    var tA = oku(ka['fish.toplam']) || {}, tB = oku(kb['fish.toplam']) || {}, t = {}, varT = false;
    Object.keys(tA).concat(Object.keys(tB)).forEach(function (k) { t[k] = Math.max(+tA[k] || 0, +tB[k] || 0); varT = true; });
    if (varT) out['fish.toplam'] = JSON.stringify(t);
    var d = [];
    [oku(ka['fish.desenler']), oku(kb['fish.desenler'])].forEach(function (x) { (Array.isArray(x) ? x : []).forEach(function (id) { if (d.indexOf(id) < 0) d.push(id); }); });
    if (d.length) out['fish.desenler'] = JSON.stringify(d);
    ['fish.desen', 'fish.inci'].forEach(function (k) {
      var v = yeni.keys && yeni.keys[k] != null ? yeni.keys[k] : eski.keys && eski.keys[k];
      if (v != null) out[k] = v;
    });
    var sirali = {};
    KAYIT.forEach(function (k) { if (out[k] != null) sirali[k] = out[k]; });
    return { t: Math.max(a.t || 0, b.t || 0), keys: sirali };
  }
  function ayni(a, b) { return JSON.stringify(a.keys) === JSON.stringify(b.keys); }
  function bos(x) { return !x || !x.keys || !Object.keys(x.keys).length; }
  var sonGiden = null; // the keys as last written to iCloud
  function yolla(zorla) {
    var y = yerel(), s = JSON.stringify(y.keys);
    if (bos(y) || (s === sonGiden && !zorla)) return;
    if (sonGiden !== null && s !== sonGiden) { y.t = Date.now(); localStorage.setItem('koi.kayitT', String(y.t)); }
    sonGiden = s;
    sessiz(CloudSave.set({ data: JSON.stringify({ v: 1, t: y.t, keys: y.keys }) }));
  }
  // Merges the copies into localStorage. Resolves true when it reloads the page.
  function esitle(r) {
    var simdi = yerel(), hepsi = simdi;
    [r && r.cloud, r && r.device].forEach(function (s) { var x = oku(s); if (!bos(x)) hepsi = birlestir(hepsi, x); });
    if (!ayni(hepsi, simdi)) {
      if (sessionStorage.getItem('koi.yenilendi')) { console.log('[kayit] merged save did not stick, not reloading again'); }
      else {
        KAYIT.forEach(function (k) { if (hepsi.keys[k] != null) localStorage.setItem(k, hepsi.keys[k]); });
        localStorage.setItem('koi.kayitT', String(hepsi.t || Date.now()));
        sessionStorage.setItem('koi.yenilendi', '1');
        console.log('[kayit] save restored from iCloud/device copy, reloading');
        location.reload();
        return true;
      }
    }
    sonGiden = null; yolla(true); // first write of this launch: brings both copies up to date
    return false;
  }
  var kayitHazir = new Promise(function (bitti) {
    var cevap = false;
    var bekle = setTimeout(function () { if (!cevap) { cevap = true; console.log('[kayit] no answer, starting with this device'); bitti(); } }, 1200);
    sessiz(CloudSave.get().then(function (r) {
      if (cevap) return; cevap = true; clearTimeout(bekle);
      if (!esitle(r)) bitti();
    }, function (e) { if (!cevap) { cevap = true; clearTimeout(bekle); console.log('[kayit] failed', e && e.message); bitti(); } }));
  });
  kayitHazir.then(function () {
    setInterval(function () { yolla(false); }, 10000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) yolla(false); });
    // Another device saved while this one sits on the start screen: merge now (reloads if needed).
    sessiz(CloudSave.addListener('change', function (r) {
      var bas = document.getElementById('startOv');
      if (bas && !bas.hidden) { sessionStorage.removeItem('koi.yenilendi'); esitle({ cloud: r && r.cloud }); }
    }));
  });
  // Rating prompt: after a round that set a new best length, once the player has finished 5 rounds,
  // at most every 60 days from our side (iOS itself shows it at most 3 times a year). Shown a moment
  // after the game over screen appears, never during play.
  function puanIste(rekor) {
    try {
      var turlar = (+localStorage.getItem('koi.turlar') || 0) + 1;
      localStorage.setItem('koi.turlar', String(turlar));
      var son = +localStorage.getItem('koi.puanSorusu') || 0;
      if (!rekor || turlar < 5 || Date.now() - son < 60 * 864e5) return;
      localStorage.setItem('koi.puanSorusu', String(Date.now()));
      setTimeout(function () { sessiz(Review.request()); }, 1800);
    } catch (e) {}
  }
  window.uygulama = {
    gameCenter: false, // true once the player is signed in to Game Center
    // a finished round's length in cm and whether it was a new best (gameOver in lab/fish/index.html)
    skor: function (cm, rekor) { gonder(cm); puanIste(rekor); setTimeout(function () { yolla(false); }, 300); },
    // Leaderboard buttons: resolves true if Game Center's leaderboard opened, false if the player isn't signed in.
    liderlik: function () {
      return (window.uygulama.gameCenter ? Promise.resolve(true) : girisYap()).then(function (girdi) {
        if (!girdi) return false;
        return GameCenter.showLeaderboard({ leaderboardId: LIDERLIK }).then(function (r) { return !!(r && r.shown); });
      }).catch(function (e) { console.log('[gamecenter] leaderboard failed', e && e.message); return false; });
    },
    // tur: yut (ate a fish, guc = its size next to yours, 0..1), isir (bitten), olum (game over),
    // seviye (level up, new food, new koi), inci (pearl). iPads have no Taptic Engine: these do nothing there.
    titret: function (tur, guc) {
      try {
        if (tur === 'yut') {
          var t = performance.now();
          if (t - sonYut < 45) return; // a school of minnows shouldn't turn into one long buzz
          sonYut = t;
          sessiz(Haptics.impact({ style: guc > 0.6 ? 'MEDIUM' : 'LIGHT' }));
        } else if (tur === 'isir') sessiz(Haptics.impact({ style: 'HEAVY' }));
        else if (tur === 'olum') sessiz(Haptics.notification({ type: 'ERROR' }));
        else if (tur === 'seviye') sessiz(Haptics.notification({ type: 'SUCCESS' }));
        else if (tur === 'inci') sessiz(Haptics.impact({ style: 'LIGHT' }));
      } catch (e) {}
    }
  };

  // ---- Uzi Games intro --------------------------------------------------------------------------
  // At every launch, on white (the launch screen and the web view are white too): dad's head, then
  // Uzay's, pop up; their arms draw down and meet as a U; "uzi games" comes up; Uzay hops once.
  // About 2.5 s; a tap skips it. The logo is designed on the "Uzi Games logo" canvas (El ele).
  var LOGO = '<svg viewBox="0 0 200 200" width="150" height="150" role="img" aria-label="Uzi Games" style="display: block; overflow: visible"><defs><clipPath id="Lacilis"><rect x="-20" y="-20" width="116.5" height="240"></rect></clipPath><clipPath id="Racilis"><rect x="103.5" y="-20" width="116.5" height="240"></rect></clipPath></defs><path d="M58 72 V118 A42 42 0 0 0 100 160" pathLength="100" class="u" fill="none" stroke="#151515" stroke-width="34" stroke-linecap="round" clip-path="url(#Lacilis)"></path><path d="M100 160 A42 42 0 0 0 142 118 V100" pathLength="100" class="u" fill="none" stroke="#151515" stroke-width="34" stroke-linecap="round" clip-path="url(#Racilis)"></path><g class="dad"><circle cx="58" cy="29" r="20" fill="#151515"></circle></g><g class="kid"><circle cx="142" cy="63" r="13.5" fill="#151515"></circle></g></svg>';
  var CSS = '#uziAcilis{position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;transition:opacity .35s ease;-webkit-user-select:none;user-select:none}'
    + '#uziAcilis.git{opacity:0;pointer-events:none}'
    + '#uziAcilis .w{display:flex;flex-direction:column;align-items:center;font-family:"Bagel Fat One",sans-serif;line-height:.86;color:#151515}'
    + '#uziAcilis .w1{font-size:68px}#uziAcilis .w2{font-size:42px;margin-top:7px}'
    + '#uziAcilis .dad,#uziAcilis .kid{transform-box:fill-box;transform-origin:50% 100%}'
    + '#uziAcilis .dad{animation:uzPop .45s cubic-bezier(.34,1.56,.64,1) both}'
    + '#uziAcilis .kid{animation:uzPop .45s .25s cubic-bezier(.34,1.56,.64,1) both,uzHop .5s 1.75s ease-in-out}'
    + '#uziAcilis .u{stroke-dasharray:100;animation:uzDraw .7s .5s cubic-bezier(.65,0,.35,1) both}'
    + '#uziAcilis .u:nth-of-type(2){animation-delay:.85s}'
    + '#uziAcilis .w1{animation:uzRise .5s 1.15s cubic-bezier(.34,1.56,.64,1) both}'
    + '#uziAcilis .w2{animation:uzRise .5s 1.3s cubic-bezier(.34,1.56,.64,1) both}'
    + '@keyframes uzPop{0%{transform:scale(0)}100%{transform:scale(1)}}'
    + '@keyframes uzDraw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}'
    + '@keyframes uzRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}'
    + '@keyframes uzHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-16px)}}'
    + '@media (prefers-reduced-motion:reduce){#uziAcilis *{animation:none!important}}';
  var kok = document.documentElement;
  kok.style.visibility = 'hidden'; // until the save is merged and the intro covers the page
  function govde(f) { if (document.body) f(); else document.addEventListener('DOMContentLoaded', f); }
  kayitHazir.then(function () {
    govde(function () {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      var el = document.createElement('div'); el.id = 'uziAcilis'; el.setAttribute('aria-label', 'Uzi Games');
      el.innerHTML = LOGO + '<div class="w" aria-hidden="true"><span class="w1">uzi</span><span class="w2">games</span></div>';
      document.body.appendChild(el);
      kok.style.visibility = '';
      var yavas = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var t1 = setTimeout(function () { window.uygulama.titret('inci'); }, 1950); // Uzay's hop
      var bitir = function () {
        clearTimeout(t1); clearTimeout(t2);
        if (el.classList.contains('git')) return;
        el.classList.add('git');
        setTimeout(function () { el.remove(); st.remove(); }, 400);
      };
      var t2 = setTimeout(bitir, yavas ? 900 : 2450);
      el.addEventListener('pointerdown', bitir);
    });
  });
})();
