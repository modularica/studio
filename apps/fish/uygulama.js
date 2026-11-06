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
  var LIDERLIK = 'com.uzigames.fish.biggest'; // App Store Connect leaderboard ID; score = length in mm
  var sonYut = 0;
  function sessiz(p) { if (p && p.catch) p.catch(function () {}); return p; }
  function enIyi() { try { return +JSON.parse(localStorage.getItem('fish.best')) || 0; } catch (e) { return 0; } }
  function gonder(cm) {
    if (!window.uygulama.gameCenter || !(cm > 0)) return;
    sessiz(GameCenter.submitScore({ leaderboardId: LIDERLIK, score: Math.round(cm * 10) }));
  }
  // Sign in at launch (iOS shows its own Game Center sheet the first time, a "Welcome back" banner after).
  // Then send the best length already on this device, so players who were here before 1.0 show up too.
  sessiz(GameCenter.signIn().then(function (r) {
    if (!r || !r.signedIn) return;
    window.uygulama.gameCenter = true;
    gonder(enIyi());
    window.dispatchEvent(new Event('gamecenter'));
  }));
  window.uygulama = {
    gameCenter: false, // true once the player is signed in to Game Center
    // a finished round's length in cm (gameOver in lab/fish/index.html)
    skor: function (cm) { gonder(cm); },
    liderlik: function () { sessiz(GameCenter.showLeaderboard({ leaderboardId: LIDERLIK })); },
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
