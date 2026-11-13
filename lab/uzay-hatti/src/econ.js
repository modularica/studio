/* ===== EKONOMI (pure functions, shared by game + simulation) ===== */
var ECON = (function () {
  var CFG = {
    A0: 0.5, Astep: 0.25, Acost0: 8, Agrowth: 1.12,
    C0: 0.4, Cstep: 0.2, Ccost0: 12, Cgrowth: 1.12,
    mEvery: 25,
    boardTime: 1.2, autoWait: 2.0, padClear: 0.8, maxWait: 5,
    seatGrowth: 1.14, seatCostK: 0.5,
    speedGrowth: 1.6, speedCostK: 1.2, speedMax: 15, speedStep: 0.92,
    fleetCostK: [8, 50], fleetMax: 3,
    shareBase: 1.6,
    offlineBaseH: 12
  };
  var ROUTES = [
    { id: 'ay',     name: 'Ay',      dat: "Ay'a",      price: 4,     trip: 6,  seats: 4,  value: 6,     color: '#d8d1c0' },
    { id: 'mars',   name: 'Mars',    dat: "Mars'a",    price: 30,    trip: 9,  seats: 6,  value: 500,   color: '#ff6a45' },
    { id: 'venus',  name: 'Venüs',   dat: "Venüs'e",   price: 220,   trip: 12, seats: 8,  value: 1e4,   color: '#f1c24f' },
    { id: 'europa', name: 'Europa',  dat: "Europa'ya", price: 1600,  trip: 16, seats: 10, value: 2.2e5, color: '#8fd4ff' },
    { id: 'saturn', name: 'Satürn',  dat: "Satürn'e",  price: 1.2e4, trip: 20, seats: 12, value: 5e6,   color: '#e9b37b' },
    { id: 'titan',  name: 'Titan',   dat: "Titan'a",   price: 9e4,   trip: 25, seats: 14, value: 1.2e8, color: '#ffa04a' },
    { id: 'neptun', name: 'Neptün',  dat: "Neptün'e",  price: 7e5,   trip: 30, seats: 16, value: 2e9,   color: '#5a86ff' },
    { id: 'pluton', name: 'Plüton',  dat: "Plüton'a",  price: 6e6,   trip: 36, seats: 18, value: 4e10,  color: '#f4b3c6' }
  ];
  function mm(L) { return Math.pow(2, Math.floor(L / CFG.mEvery)); }
  function mult(s, boost) {
    var r = s.research || {};
    var b = boost || {};
    return {
      ticket: (1 + 0.25 * (r.konfor || 0)) * (1 + 0.05 * ((s.souvenirs || []).length)) * (1 + 0.1 * (s.stars || 0)) * (b.ticket || 1),
      demand: (1 + 0.3 * (r.reklam || 0)) * (b.demand || 1),
      checkin: (1 + 0.3 * (r.checkin || 0)),
      trip: (1 - 0.06 * (r.motor || 0)) / (b.speed || 1),
      autoWait: Math.max(0.5, CFG.autoWait - 0.3 * (r.otopilot || 0)),
      autoMult: 1 + 0.1 * (r.otopilot || 0)
    };
  }
  function arrival(s, L, m) { L = L || s.lvA; m = m || mult(s); return (CFG.A0 + CFG.Astep * (L - 1)) * mm(L) * m.demand; }
  function checkin(s, L, m) { L = L || s.lvC; m = m || mult(s); return (CFG.C0 + CFG.Cstep * (L - 1)) * mm(L) * m.checkin; }
  function seats(i, L) { var R = ROUTES[i]; return Math.round(R.seats * (1 + 0.5 * (L - 1)) * mm(L)); }
  function trip(i, L, m) { var R = ROUTES[i]; return Math.max(3.6, R.trip * Math.pow(CFG.speedStep, L - 1) * (m ? m.trip : 1)); }
  function cap(s, i, m, rt) {
    rt = rt || s.routes[i]; m = m || mult(s);
    var K = seats(i, rt.seats), T = trip(i, rt.speed, m), w = m.autoWait;
    return Math.min(rt.fleet * K / (T + CFG.boardTime + w), K / (CFG.boardTime + w + CFG.padClear));
  }
  function shares(s) {
    var tot = 0, out = [];
    for (var i = 0; i < ROUTES.length; i++) { var w = s.routes[i].u ? Math.pow(CFG.shareBase, i) : 0; out.push(w); tot += w; }
    for (var j = 0; j < out.length; j++) out[j] = tot ? out[j] / tot : 0;
    return out;
  }
  // steady-state flow (passive, no tapping). Demand split by shares; overflow
  // rebooks to routes with free seats, most expensive first (never wastes a passenger
  // while any rocket has room).
  function flow(s, boost) {
    var m = mult(s, boost);
    var A = arrival(s, s.lvA, m), C = checkin(s, s.lvC, m);
    var Fin = Math.min(A, C), sh = shares(s);
    var caps = [], x = [], F = 0, i;
    for (i = 0; i < ROUTES.length; i++) {
      if (!s.routes[i].u) { caps.push(0); x.push(0); continue; }
      var c = cap(s, i, m); caps.push(c); F += c;
      x.push(Math.min(Fin * sh[i], c));
    }
    var used = 0; for (i = 0; i < x.length; i++) used += x[i];
    var over = Math.max(0, Fin - used);
    for (i = ROUTES.length - 1; i >= 0 && over > 1e-12; i--) {
      if (!s.routes[i].u) continue;
      var add = Math.min(over, caps[i] - x[i]); x[i] += add; over -= add;
    }
    var income = 0, carried = 0, per = [];
    for (i = 0; i < ROUTES.length; i++) {
      if (!s.routes[i].u) { per.push(null); continue; }
      income += x[i] * ROUTES[i].price * m.ticket * m.autoMult;
      carried += x[i];
      per.push({ cap: caps[i], demand: Fin * sh[i], carried: x[i], share: sh[i], full: x[i] >= caps[i] * 0.999 });
    }
    var bn = 'A', lo = A;
    if (C < lo * 0.999) { bn = 'C'; lo = C; }
    if (F < lo * 0.999) { bn = 'F'; lo = F; }
    return { A: A, C: C, F: F, Fin: Fin, bottleneck: bn, income: income, carried: carried, lost: over, per: per, m: m };
  }
  function geoCost(base, g, L, n) { return base * Math.pow(g, L - 1) * (Math.pow(g, n) - 1) / (g - 1); }
  function geoMax(base, g, L, money, cap) {
    var first = base * Math.pow(g, L - 1);
    if (money < first) return 0;
    var n = Math.floor(Math.log(money * (g - 1) / first + 1) / Math.log(g));
    if (cap != null) n = Math.min(n, cap);
    return Math.max(0, n);
  }
  var cost = {
    A: function (L, n) { return geoCost(CFG.Acost0, CFG.Agrowth, L, n || 1); },
    C: function (L, n) { return geoCost(CFG.Ccost0, CFG.Cgrowth, L, n || 1); },
    seats: function (i, L, n) { return geoCost(ROUTES[i].value * CFG.seatCostK, CFG.seatGrowth, L, n || 1); },
    speed: function (i, L, n) { return geoCost(ROUTES[i].value * CFG.speedCostK, CFG.speedGrowth, L, n || 1); },
    fleet: function (i, f) { return ROUTES[i].value * CFG.fleetCostK[f - 1]; },
    unlock: function (i) { return i === 0 ? 0 : ROUTES[i].value; }
  };
  var maxBuy = {
    A: function (L, money) { return geoMax(CFG.Acost0, CFG.Agrowth, L, money); },
    C: function (L, money) { return geoMax(CFG.Ccost0, CFG.Cgrowth, L, money); },
    seats: function (i, L, money) { return geoMax(ROUTES[i].value * CFG.seatCostK, CFG.seatGrowth, L, money); },
    speed: function (i, L, money) { return geoMax(ROUTES[i].value * CFG.speedCostK, CFG.speedGrowth, L, money, CFG.speedMax - L); }
  };
  function starsFor(runEarned) { return runEarned < 1e8 ? 0 : Math.floor(3 * Math.pow(runEarned / 1e8, 0.4)); }
  return { CFG: CFG, ROUTES: ROUTES, mm: mm, mult: mult, arrival: arrival, checkin: checkin, seats: seats, trip: trip, cap: cap, shares: shares, flow: flow, cost: cost, maxBuy: maxBuy, geoCost: geoCost, starsFor: starsFor };
})();
if (typeof module !== 'undefined') module.exports = ECON;
