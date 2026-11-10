/* App-only glue between the game and iOS. build.mjs copies this into www/ and loads it after
   Capacitor's core (capacitor.js) and before the game. On the web this file is never loaded.
   The game calls window.uygulama.titret(tur, guc) from its sound effects (see titret() in lab/fish/index.html),
   uygulama.skor(cm) when a round ends and uygulama.liderlik() from its Leaderboard buttons (Game Center). */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var Haptics = C.registerPlugin('Haptics');
  // Our own small plugin: ios/App/App/GameCenterPlugin.swift (registered in MainViewController.swift).
  var GameCenter = C.registerPlugin('GameCenter');
  // Ours too: ios/App/App/ReviewPlugin.swift, Apple's rating prompt.
  var Review = C.registerPlugin('Review');
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
    skor: function (cm, rekor) { gonder(cm); puanIste(rekor); },
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
})();
