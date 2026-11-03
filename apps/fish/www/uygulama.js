/* App-only glue between the game and iOS. build.mjs copies this into www/ and loads it after
   Capacitor's core (capacitor.js) and before the game. On the web this file is never loaded.
   The game calls window.uygulama.titret(tur, guc) from its sound effects (see titret() in lab/fish/index.html). */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var Haptics = C.registerPlugin('Haptics');
  var sonYut = 0;
  function sessiz(p) { if (p && p.catch) p.catch(function () {}); }
  window.uygulama = {
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
