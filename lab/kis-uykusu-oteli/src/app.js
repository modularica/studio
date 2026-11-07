// ---------------------------------------------------------------------------
// App: screens, input, HUD, sheets, hints and the frame loop.
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('otel.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('otel.' + k, JSON.stringify(v)); } catch (e) { /* storage may be off */ } },
};
const lower = (s) => s.toLocaleLowerCase('tr-TR');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICON = {
  nut: (n = 20) => `<svg width="${n}" height="${n}" viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="11.6" rx="7" ry="6.6" fill="#A86F3A"/><path d="M2.4 9a7.6 4.6 0 0 1 15.2 0z" fill="#7C5030"/><ellipse cx="7.2" cy="12.4" rx="1.4" ry="2.2" fill="#fff" opacity=".25"/></svg>`,
  star: (on, n = 18) => `<svg width="${n}" height="${n}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.6 5.4 5.9.7-4.4 4 1.2 5.9L10 14.7l-5.3 2.9 1.2-5.9-4.4-4 5.9-.7z" fill="${on ? '#D7A23F' : 'rgba(44,42,39,.16)'}"/></svg>`,
  heart: (on, n = 16) => `<svg width="${n}" height="${n}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.6C4 13.2 1.6 10.2 1.6 6.8 1.6 4.2 3.6 2.3 6 2.3c1.7 0 3.1 1 4 2.4.9-1.4 2.3-2.4 4-2.4 2.4 0 4.4 1.9 4.4 4.5 0 3.4-2.4 6.4-8.4 10.8z" fill="${on ? '#C9523F' : 'rgba(44,42,39,.16)'}"/></svg>`,
  pause: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="4" y="3" width="3.6" height="12" rx="1.2" fill="#2C2A27"/><rect x="10.4" y="3" width="3.6" height="12" rx="1.2" fill="#2C2A27"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="2.4" rx="1.2" fill="#2C2A27"/><rect x="3" y="8.8" width="14" height="2.4" rx="1.2" fill="#2C2A27"/><rect x="3" y="13.1" width="14" height="2.4" rx="1.2" fill="#2C2A27"/></svg>',
  autumn: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2c4 3 5.5 6.5 4.5 10S10 17 10 17s-3.5-1.5-4.5-5S6 5 10 2z" fill="#C9733A"/><path d="M10 6v13" stroke="#7C5030" stroke-width="1.6" stroke-linecap="round"/></svg>',
  winter: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><g stroke="#4E6E8A" stroke-width="1.8" stroke-linecap="round"><path d="M10 2v16M3 6l14 8M3 14l14-8"/><path d="M8 3.5l2 1.5 2-1.5M8 16.5l2-1.5 2 1.5"/></g></svg>',
  spring: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><g fill="#E7B7C2"><circle cx="10" cy="5.5" r="3.2"/><circle cx="14.5" cy="9.6" r="3.2"/><circle cx="12.6" cy="14.6" r="3.2"/><circle cx="7.4" cy="14.6" r="3.2"/><circle cx="5.5" cy="9.6" r="3.2"/></g><circle cx="10" cy="10.6" r="2.6" fill="#D7A23F"/></svg>',
  summer: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4.4" fill="#E5A13F"/><g stroke="#E5A13F" stroke-width="1.8" stroke-linecap="round"><path d="M10 1.5v2.3M10 16.2v2.3M1.5 10h2.3M16.2 10h2.3M4 4l1.6 1.6M14.4 14.4L16 16M4 16l1.6-1.6M14.4 5.6L16 4"/></g></svg>',
  ilan: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="18" y="16" width="4" height="20" rx="1" fill="#7C5A3E"/><rect x="6" y="6" width="28" height="15" rx="3" fill="#C99A5B"/><rect x="10" y="10" width="14" height="2.4" rx="1.2" fill="#7C5030"/><rect x="10" y="14.4" width="20" height="2.4" rx="1.2" fill="#7C5030"/></svg>',
  duvar: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g fill="#8C6440"><rect x="4" y="8" width="32" height="6" rx="3"/><rect x="4" y="16" width="32" height="6" rx="3"/><rect x="4" y="24" width="32" height="6" rx="3"/></g><g fill="#C8A276"><circle cx="34" cy="11" r="2.2"/><circle cx="34" cy="19" r="2.2"/><circle cx="34" cy="27" r="2.2"/></g></svg>',
  yosun: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="30" rx="16" ry="5" fill="#6F8D52"/><g fill="#86A568"><circle cx="11" cy="25" r="6"/><circle cx="20" cy="22" r="7"/><circle cx="29" cy="25" r="6"/></g><g fill="#A9C27F"><circle cx="17" cy="20" r="2"/><circle cx="26" cy="23" r="1.6"/><circle cx="10" cy="23" r="1.4"/></g></svg>',
  ninni: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="18" width="26" height="15" rx="3" fill="#A9473B"/><rect x="7" y="15" width="26" height="5" rx="2" fill="#86362D"/><rect x="11" y="23" width="18" height="2" rx="1" fill="#F1E9DC"/><circle cx="30" cy="26" r="2" fill="#D7A23F"/><path d="M24 5v9.5" stroke="#2C2A27" stroke-width="2" stroke-linecap="round"/><ellipse cx="21.6" cy="14.4" rx="3" ry="2.2" fill="#2C2A27"/><path d="M24 5c2 1 4 1 5 3" stroke="#2C2A27" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  lantern: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3v6" stroke="#5A4A3E" stroke-width="2"/><circle cx="20" cy="22" r="14" fill="#F7CD6B" opacity=".3"/><rect x="13" y="10" width="14" height="21" rx="4" fill="#3E3A36"/><rect x="16" y="14" width="8" height="12" rx="2" fill="#F7CD6B"/></svg>',
  frame: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="7" width="30" height="22" rx="2" fill="#8A6A4A"/><rect x="8" y="10" width="24" height="16" fill="#CFE0E6"/><path d="M8 26l8-10 6 7 4-4 6 7z" fill="#6E8D7A"/><rect x="6" y="32" width="28" height="4" rx="2" fill="#C9B7D0"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" fill="#6A645D"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#6A645D" stroke-width="1.8" fill="none"/></svg>',
};
// Lab (uzigames.com) account hooks. All of them do nothing when the page runs on its own.
const lab = {
  note(t) { try { if (window.Hesap && window.Hesap.not) window.Hesap.not(t); } catch (e) { /* ignore */ } },
  ask: (where) => (window.Hesap ? `<button type="button" class="btn" data-nasildi="${where}">Nasıldı?</button>` : ''),
};

const SEASON_NAME = { autumn: 'Sonbahar', winter: 'Kış', spring: 'Bahar', summer: 'Yaz' };

const App = {
  save: null, game: null, screen: 'menu', paused: false,
  cv: null, ctx: null, dpr: 1, t: 0, dt: 0,
  qvis: new Map(), drags: new Map(), selected: null,
  wake: [], moneyHold: 0, shownMoney: -1,
  hand: null, hintUntil: 0, hintKeyed: 0,
  sheet: null, bgSeason: null, bgPrev: null, bgFade: 1,
  fxT: { tok: 0, snore: 0 }, hud: {},
};

function persist() { store.set('save', App.save); }

// ---- boot -------------------------------------------------------------------

function init() {
  App.cv = $('cv'); App.ctx = App.cv.getContext('2d');
  Sound.on = store.get('sound', true) !== false;
  App.save = cleanSave(store.get('save', null));
  App.game = new Game(App.save);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

  const cv = App.cv;
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onCancel);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  $('nutIcon').innerHTML = ICON.nut(20);
  $('playBtn').addEventListener('click', play);
  $('helpBtn').addEventListener('click', () => { Sound.unlock(); openHelp(); });
  $('soundBtn').addEventListener('click', () => { Sound.unlock(); Sound.setOn(!Sound.on); store.set('sound', Sound.on); updateMenu(); });
  $('newBtn').addEventListener('click', confirmNew);
  $('pauseBtn').addEventListener('click', openPause);
  $('shopBtn').addEventListener('click', () => { Sound.unlock(); openShop(); });
  $('startBtn').addEventListener('click', () => { Sound.unlock(); startYear(); });
  $('starsChip').addEventListener('click', starInfo);
  $('hint').addEventListener('click', hideHint);
  $('sheetWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && App.sheet) { App.sheet.on(b.dataset.act, b); return; }
    if (e.target === $('sheetWrap') && App.sheet && !App.sheet.modal) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (App.sheet && !App.sheet.modal) closeSheet(); else if (App.screen === 'game' && !App.sheet) openPause(); }
  });
  const hero = $('menuHero');
  for (const sp of ['kirpi', 'ayi', 'fare']) {
    const c = animalIcon(sp, sp === 'ayi' ? 96 : 66, false); c.style.width = c.style.height = (sp === 'ayi' ? 96 : 66) + 'px';
    hero.appendChild(c);
  }
  updateMenu();
  if (document.fonts && document.fonts.load) document.fonts.load('600 20px Fredoka').catch(() => {});
  if (store.get('debug', false) || location.hash === '#debug') window.__otel = { App, TUNE, Game, cleanSave, newSave, LAY, innerRect, wpPos, queueSlot, cellAt };
  requestAnimationFrame(frame);
}

function insets() {
  const cs = getComputedStyle($('insetProbe'));
  return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  App.dpr = Math.min(2.5, window.devicePixelRatio || 1);
  App.cv.width = Math.round(w * App.dpr); App.cv.height = Math.round(h * App.dpr);
  computeLayout(w, h, insets());
  App.bgPrev = null; App.bgFade = 1;
}

function updateMenu() {
  const s = App.save, started = s.year > 1 || s.total.guests > 0;
  $('playBtn').textContent = started ? `Devam et · Yıl ${s.year}` : 'Oyna';
  $('newBtn').hidden = !started;
  $('soundBtn').textContent = Sound.on ? 'Ses açık' : 'Ses kapalı';
}

function play() {
  Sound.unlock();
  App.screen = 'game';
  $('menu').hidden = true; $('hud').hidden = false;
  App.game = new Game(App.save);
  App.qvis.clear(); App.wake = []; App.moneyHold = 0; fx.length = 0;
  if (App.save.year === 1 && App.save.total.guests === 0) startYear();
  else { showSummer(false); }
}

function toMenu() {
  closeSheet(); hideHint();
  App.screen = 'menu'; App.paused = false;
  App.game = new Game(App.save);
  App.qvis.clear(); App.drags.clear(); App.selected = null; App.wake = []; App.moneyHold = 0; fx.length = 0;
  $('menu').hidden = false; $('hud').hidden = true; $('summerBar').hidden = true;
  updateMenu();
}

function startYear() {
  if (App.game.phase !== 'summer') return;
  closeSheet(); hideHint();
  $('summerBar').hidden = true;
  App.qvis.clear(); App.selected = null;
  App.game.startAutumn();
  const s = App.save;
  lab.note(`Yıl ${s.year} başladı · ${s.grid.filter((g) => g.room).length} oda, ${starsFor(s.fame)} yıldız, ${s.money} fındık`);
  for (const e of App.game.takeEvents()) onEvent(e);
}

function showSummer(withBanner) {
  $('summerBar').hidden = false;
  if (withBanner) banner('Yaz', 'Oteli büyütme zamanı');
  if (App.save.year === 2) {
    hint('summer1', '<b>Oteli büyüt!</b> Kesikli çizgili toprağa dokunup kaz, sonra içine oda yap.', { time: 10, hand: { kind: 'tap', at: () => { const i = App.save.grid.findIndex((g, k) => canDig(App.save, k)); return i < 0 ? null : centerOf(i); } } });
  } else if (App.save.year >= 4 && App.save.money >= STAFF.sincap.cost[0] && !App.save.staff.sincap) {
    hint('shop', '<b>Dükkânda yardımcılar var.</b> Sincap düşen battaniyeleri kendisi örter.', { time: 8 });
  } else hint(null, 'Hazır olunca <b>Sonbaharı başlat</b>. Misafirler yola çıkmak için bekliyor.', { time: 5 });
}

function autoPause() {
  if (App.screen === 'game' && !App.paused && (App.game.phase === 'autumn' || App.game.phase === 'winter')) openPause();
}

// ---- events from the simulation ------------------------------------------------

function onEvent(e) {
  const g = App.game, run = g.run;
  switch (e.type) {
    case 'autumn':
      banner('Sonbahar', `Yıl ${run.year} · Misafirler geliyor`); Sound.play('season');
      break;
    case 'arrive': {
      App.qvis.set(e.id, { x: -LAY.guestS, y: LAY.groundY - 2 });
      Sound.play('arrive');
      if (run.year === 1 && e.id === 1) {
        hint('drag', '<b>İlk misafirin geldi!</b> Parmağınla sürükleyip boş bir yaprak yuvasına bırak.', {
          time: 14, tag: 'drag', hand: { kind: 'drag', from: () => { const v = App.qvis.get(1); return v && g.run.queue.some((q) => q.id === 1) ? { x: v.x, y: v.y - LAY.guestS * 0.4 } : null; }, to: () => { const i = g.freeRoomFor('fare'); return i < 0 ? null : centerOf(i); } },
        });
      }
      break;
    }
    case 'placed': {
      const I = innerRect(e.cell);
      for (let k = 0; k < 6; k++) addFx({ kind: 'puff', x: I.x + I.w * (0.3 + Math.random() * 0.4), y: I.y + I.h * (0.6 + Math.random() * 0.25), vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, size: I.w * 0.07, life: 0.6 });
      App.qvis.delete(e.id);
      Sound.play('place');
      solved('drag');
      break;
    }
    case 'left': {
      const v = App.qvis.get(e.id);
      if (v) addFx({ kind: 'guest', sp: e.sp, x: v.x, y: v.y, vx: -LAY.slotW * 2.2, vy: 0, size: LAY.guestS, life: 2.2, flip: true, grumpy: true });
      App.qvis.delete(e.id);
      if (App.selected === e.id) App.selected = null;
      for (const [pid, d] of App.drags) if (d.qid === e.id) App.drags.delete(pid);
      Sound.play('leave');
      if (e.why === 'noRoom') {
        if (!hint('noRoom', `<b>${esc(SPECIES[e.sp].name)} yer bulamadı.</b> Ona ${esc(lower(ROOMS[SPECIES[e.sp].room].name))} lazım. Yazın yapabilirsin.`, { time: 7 }))
          toast(`${esc(SPECIES[e.sp].name)} için boş ${esc(lower(ROOMS[SPECIES[e.sp].room].name))} yoktu.`);
      } else toast(`${esc(SPECIES[e.sp].name)} beklemekten sıkıldı, gitti.`);
      break;
    }
    case 'winter':
      banner('Kış', 'Misafirler uyuyor. Uykularını bozma!'); Sound.play('season');
      App.selected = null; App.drags.clear();
      if (run.year === 1) hint('winter1', '<b>Kış geldi.</b> Herkes uyuyor. Altlarındaki çubuk dolu kalsın, baharda iyi uyuyan çok öder.', { time: 7 });
      break;
    case 'blanket':
      Sound.play('slip');
      hint('blanket', `<b>${esc(SPECIES[e.sp].name)} üşüyor!</b> Battaniyesi düştü. Odasına dokun, üstünü ört.`, { time: 8, tag: 'blanket', hand: { kind: 'tap', at: () => { const x = g.roomGuest(e.cell); return x && !x.blanket ? centerOf(e.cell) : null; } } });
      break;
    case 'tucked': {
      const I = innerRect(e.cell);
      for (let k = 0; k < 4; k++) addFx({ kind: 'puff', x: I.x + I.w * (0.35 + Math.random() * 0.3), y: I.y + I.h * 0.65, vx: (Math.random() - 0.5) * 24, vy: -18, size: I.w * 0.06, life: 0.5 });
      Sound.play('tuck');
      solved('blanket');
      break;
    }
    case 'snore':
      hint('snore', `<b>${esc(SPECIES[e.sp].name)} horluyor!</b> Yanındakiler uyanacak. Ona dokun, yan dönsün.`, { time: 8, tag: 'snore', hand: { kind: 'tap', at: () => { const x = g.roomGuest(e.cell); return x && x.snore > 0 ? centerOf(e.cell) : null; } } });
      break;
    case 'rolled': {
      const I = innerRect(e.cell);
      addFx({ kind: 'text', text: 'hımm', x: I.x + I.w * 0.5, y: I.y + I.h * 0.3, vy: -14, size: Math.max(12, I.h * 0.16), col: PAL.inkSoft, life: 0.9 });
      Sound.play('roll');
      solved('snore');
      break;
    }
    case 'wp':
      Sound.play('tok');
      hint('wp', '<b>Ağaçkakan!</b> Gürültüsü altındaki odalara iniyor. Kuşa dokun, kovala.', { time: 8, tag: 'wp', hand: { kind: 'tap', at: () => { const w = g.run && g.run.wps && g.run.wps.find((x) => x.id === e.id); return w ? wpPos(w.col) : null; } } });
      break;
    case 'shoo': {
      const p = wpPos(e.col);
      for (let k = 0; k < 5; k++) addFx({ kind: 'puff', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 40, size: 3, col: 'rgba(40,40,40,0.6)', life: 0.6, g: 120 });
      addFx({ kind: 'bird', x: p.x, y: p.y, life: 1.2, update: (f, dt) => { f.x += 160 * dt * (e.col < 2 ? -1 : 1); f.y -= 110 * dt; }, side: e.col < 2 ? -1 : 1 });
      Sound.play(e.by === 'baykus' ? 'hoot' : 'shoo');
      solved('wp');
      break;
    }
    case 'wpGone': {
      const p = wpPos(e.col);
      addFx({ kind: 'bird', x: p.x, y: p.y, life: 1.2, update: (f, dt) => { f.x += 120 * dt; f.y -= 90 * dt; }, side: 1 });
      break;
    }
    case 'log': {
      const C = LAY.cabin, to = { x: C.x + C.w * 0.64, y: C.y + C.h * 0.6 };
      const from = e.by === 'geyik' ? deerPos() : { x: C.x + C.w + 6, y: C.y + C.h * 0.85 };
      addFx({ kind: 'log', x: from.x, y: from.y, size: Math.max(5, C.w * 0.06), life: 0.45, update: (f) => { const p = easeOut(f.t / f.life); f.x = lerp(from.x, to.x, p); f.y = lerp(from.y, to.y, p) - Math.sin(p * Math.PI) * C.h * 0.4; } });
      if (e.by === 'geyik' && run.deer) run.deer.anim = App.t;
      Sound.play('log');
      if (e.by === 'player') solved('cold');
      break;
    }
    case 'cold':
      hint('cold', '<b>Soba sönüyor, otel soğudu!</b> Kulübeye dokun, sobaya odun at. Termometre yeşilde kalsın.', { time: 9, tag: 'cold', hand: { kind: 'tap', at: () => ({ x: LAY.cabin.x + LAY.cabin.w * 0.62, y: LAY.cabin.y + LAY.cabin.h * 0.5 }) } });
      break;
    case 'hot':
      hint('hot', '<b>Çok sıcak oldu!</b> Termometre kırmızıda. Biraz bekle, soba kendi kendine soğur.', { time: 7 });
      break;
    case 'woke': {
      const I = innerRect(e.cell);
      addFx({ kind: 'cloud', x: I.x + I.w * 0.45, y: I.y + I.h * 0.25, size: Math.min(I.w, I.h) * 0.3, life: 1.6, vy: -8 });
      addFx({ kind: 'guest', sp: e.sp, x: I.x + I.w / 2, y: I.y + I.h * 0.87, vx: I.w * 0.5, vy: 0, size: guestGeom(e.sp, I).s, life: 1.4, grumpy: true });
      Sound.play('woke');
      toast(`<b>${esc(SPECIES[e.sp].name)} uyandı!</b> Kızdı ve gitti, ödeme yapmayacak.`, 4);
      break;
    }
    case 'ayazWarn':
      banner('Ayaz!', 'Soba birazdan çok hızlı soğuyacak', true);
      Sound.play('ayaz');
      hint('ayaz', '<b>Ayaz geliyor.</b> Birkaç saniye soba çok çabuk soğur, sık sık odun at.', { time: 6 });
      break;
    case 'spring': springStart(e.results); break;
    case 'summary': openSummary(e.results); break;
    case 'summer': showSummer(true); break;
  }
}

function centerOf(i) { const I = innerRect(i); return { x: I.x + I.w / 2, y: I.y + I.h * 0.55 }; }
function deerPos() { const C = LAY.cabin; return { x: C.x - C.w * 0.62, y: LAY.groundY }; }

function springStart(res) {
  banner('Bahar', 'Günaydın! Ödeme zamanı'); Sound.play('season');
  hideHint();
  App.wake = [];
  App.moneyHold = res.pay + res.tip;
  const woke = res.rows.filter((r) => r.woke).length;
  lab.note(`Yıl ${res.year} bitti · ${res.rows.length} misafir, ${res.hearts} kalp, +${res.pay + res.tip} fındık${woke ? `, ${woke} uyandı` : ''}${res.left ? `, ${res.left} gitti` : ''}`);
  let k = 0;
  for (const row of res.rows) {
    if (row.woke) continue;
    App.wake.push({ row, start: App.t + 0.6 + k * 0.32, done: false });
    k++;
  }
  persist();
}

function popPayment(w) {
  const row = w.row, I = innerRect(row.cell), val = row.pay + row.tip;
  for (let k = 0; k < row.hearts; k++) {
    addFx({ kind: 'heart', x: I.x + I.w * (0.38 + k * 0.12), y: I.y + I.h * 0.3, vy: -26, size: Math.max(6, I.w * 0.07), life: 1.4 + k * 0.1 });
  }
  if (row.hearts) setTimeout(() => Sound.play('heart'), 60);
  const chip = $('moneyChip').getBoundingClientRect();
  const to = { x: chip.left + 22, y: chip.top + chip.height / 2 };
  const n = Math.max(1, Math.min(5, Math.ceil(val / 8)));
  let left = val;
  for (let k = 0; k < n; k++) {
    const v = k === n - 1 ? left : Math.round(val / n); left -= v;
    const from = { x: I.x + I.w * (0.4 + Math.random() * 0.2), y: I.y + I.h * 0.55 };
    const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 80, y: Math.min(from.y, to.y) - 60 };
    addFx({
      kind: 'nut', x: from.x, y: from.y, size: Math.max(5, I.w * 0.06), life: 0.9 + k * 0.08, fade: false,
      update: (f) => { const p = easeOut(f.t / f.life), a = 1 - p; f.x = a * a * from.x + 2 * a * p * mid.x + p * p * to.x; f.y = a * a * from.y + 2 * a * p * mid.y + p * p * to.y; },
      done: () => { App.moneyHold = Math.max(0, App.moneyHold - v); Sound.play('coin'); bumpMoney(); },
    });
  }
  if (row.tip) addFx({ kind: 'text', text: 'bahşiş!', x: I.x + I.w * 0.5, y: I.y + I.h * 0.2, vy: -16, size: Math.max(11, I.h * 0.15), col: PAL.mustard, life: 1.3 });
}

function bumpMoney() {
  const el = $('moneyChip'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ---- input --------------------------------------------------------------------------

function pt(e) { const r = App.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

function queueAt(p) {
  const run = App.game.run;
  let best = null, bd = Infinity;
  for (const q of run.queue) {
    const v = App.qvis.get(q.id); if (!v) continue;
    const d = Math.hypot(p.x - v.x, p.y - (v.y - LAY.guestS * 0.4));
    if (d < Math.max(30, LAY.guestS * 0.75) && d < bd) { bd = d; best = q; }
  }
  return best;
}
function wpAt(p) {
  const run = App.game.run;
  let best = null, bd = Infinity;
  for (const w of run.wps) {
    const q = wpPos(w.col), d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < Math.max(36, LAY.cellW * 0.4) && d < bd) { bd = d; best = w; }
  }
  return best;
}
function inCabin(p) {
  const C = LAY.cabin;
  return p.x > C.x - C.w * 0.3 && p.x < C.x + C.w * 1.08 && p.y > C.y - C.h * 0.5 && p.y < LAY.groundY + 6;
}

function onDown(e) {
  if (App.screen !== 'game' || App.paused || App.sheet) return;
  Sound.unlock();
  const p = pt(e), g = App.game;
  if (g.phase === 'autumn') {
    const q = queueAt(p);
    if (q) {
      App.drags.set(e.pointerId, { qid: q.id, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false });
      try { App.cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      return;
    }
    const cell = cellAt(p.x, p.y);
    if (cell >= 0 && App.selected != null) { tryPlace(App.selected, cell); App.selected = null; }
  } else if (g.phase === 'winter') {
    const wp = wpAt(p);
    if (wp) { g.shoo(wp.id); return; }
    if (inCabin(p)) { g.addLog(); return; }
    const cell = cellAt(p.x, p.y);
    if (cell >= 0) g.tapRoom(cell);
  } else if (g.phase === 'summer') {
    if (inCabin(p)) { openShop(); return; }
    const cell = cellAt(p.x, p.y);
    if (cell >= 0) openCell(cell);
  }
}
function onMove(e) {
  const d = App.drags.get(e.pointerId); if (!d) return;
  const p = pt(e);
  d.x = p.x; d.y = p.y;
  if (Math.hypot(d.x - d.sx, d.y - d.sy) > 10) d.moved = true;
}
function onUp(e) {
  const d = App.drags.get(e.pointerId); if (!d) return;
  App.drags.delete(e.pointerId);
  const p = pt(e);
  if (d.moved) {
    const cell = cellAt(p.x, p.y - LAY.guestS * 0.35);
    const cell2 = cell >= 0 ? cell : cellAt(p.x, p.y);
    if (cell2 >= 0) tryPlace(d.qid, cell2);
  } else {
    App.selected = App.selected === d.qid ? null : d.qid;
    if (App.selected != null) {
      const q = App.game.run.queue.find((x) => x.id === d.qid);
      if (q) toast(`${esc(SPECIES[q.sp].name)} seçildi. Şimdi boş bir ${esc(lower(ROOMS[SPECIES[q.sp].room].name))} seç.`, 3);
    }
  }
}
function onCancel(e) { App.drags.delete(e.pointerId); }

function tryPlace(qid, cell) {
  const g = App.game, q = g.run.queue.find((x) => x.id === qid);
  if (!q) return;
  const r = g.placeGuest(qid, cell);
  if (r === 'ok') return;
  Sound.play('no');
  const need = ROOMS[SPECIES[q.sp].room].name;
  if (r === 'wrongRoom' || r === 'noRoomHere') toast(`${esc(SPECIES[q.sp].name)} için <b>${esc(lower(need))}</b> lazım.`);
  else if (r === 'occupied') toast('Bu oda dolu. Boş bir oda seç.');
  for (const e of g.takeEvents()) onEvent(e);
}

// ---- rendering ------------------------------------------------------------------------

function seasonNow() {
  if (App.screen === 'menu') return 'winter';
  const p = App.game.phase;
  return p === 'autumn' ? 'autumn' : p === 'winter' ? 'winter' : (p === 'spring' || p === 'summary') ? 'spring' : 'summer';
}

function drawBg(ctx, season, dt) {
  if (season !== App.bgSeason) {
    if (App.bgSeason && bgCache.canvas && bgCache.key) {
      const prev = App.bgPrev || document.createElement('canvas');
      prev.width = bgCache.canvas.width; prev.height = bgCache.canvas.height;
      prev.getContext('2d').drawImage(bgCache.canvas, 0, 0);
      App.bgPrev = prev; App.bgFade = 0;
    }
    App.bgSeason = season;
  }
  drawBackground(ctx, season, App.dpr);
  if (App.bgPrev && App.bgFade < 1) {
    App.bgFade = Math.min(1, App.bgFade + dt / 1.2);
    ctx.globalAlpha = 1 - App.bgFade;
    ctx.drawImage(App.bgPrev, 0, 0, LAY.w, LAY.h);
    ctx.globalAlpha = 1;
  }
}

function render(dt) {
  const ctx = App.ctx, g = App.game, s = App.save, run = g.run, t = App.t;
  ctx.setTransform(App.dpr, 0, 0, App.dpr, 0, 0);
  const season = seasonNow(), phase = App.screen === 'menu' ? 'menu' : g.phase;
  drawBg(ctx, season, dt);
  if (season === 'winter') drawAurora(ctx, t);
  drawWeather(ctx, season);
  drawTrees(ctx, season);

  const winterRun = phase === 'winter' && run;
  const temp = winterRun ? run.temp : 55;
  const fire = phase === 'menu' ? 0.7 : winterRun ? clamp01((run.temp + g.pendingHeat() * 0.5) / 75) : 0.3;
  if (s.staff.geyik && phase !== 'autumn') {
    const dp = deerPos(), busy = winterRun && run.deer && run.deer.anim != null && t - run.deer.anim < 0.6;
    drawDeer(ctx, dp.x, dp.y, Math.min(LAY.cellW * 0.6, LAY.surfH * 0.5), busy ? t - run.deer.anim : t, busy);
  }
  drawCabin(ctx, season, { t, fire, temp: winterRun ? temp : 55 });
  if (season !== 'winter' && phase !== 'menu') { /* thermometer only in winter */ }
  drawGround(ctx, season);

  // woodpeckers and their noise
  if (winterRun) {
    const ws = Math.max(14, Math.min(LAY.cellW * 0.22, LAY.treeH * 0.17));
    for (const w of run.wps) {
      const p = wpPos(w.col);
      fillCirc(ctx, p.x, p.y, ws * (1.25 + Math.sin(t * 7) * 0.08), 'rgba(194,85,61,0.18)');
      drawWoodpecker(ctx, p.x, p.y, ws, t, p.side);
    }
  }

  // hill
  drawTunnels(ctx, s);
  const canDigMap = phase === 'summer' ? s.grid.map((x, i) => canDig(s, i)) : [];
  for (let i = 0; i < s.grid.length; i++) drawCell(ctx, s, i, { season, canDig: canDigMap });
  if (phase === 'summer') drawCellPrices(ctx, canDigMap);

  if (winterRun) drawNoise(ctx, run, t);

  // highlight rooms a dragged or selected guest can use
  let carrying = null;
  for (const d of App.drags.values()) if (d.moved) carrying = d;
  const holdQ = phase === 'autumn' && run ? run.queue.find((q) => q.id === (carrying ? carrying.qid : App.selected)) : null;
  if (holdQ) {
    const type = SPECIES[holdQ.sp].room, hover = carrying ? cellAt(carrying.x, carrying.y - LAY.guestS * 0.35) : -1;
    for (let i = 0; i < s.grid.length; i++) {
      if (s.grid[i].room !== type || g.roomGuest(i)) continue;
      const I = innerRect(i);
      ctx.save();
      ctx.strokeStyle = hover === i ? PAL.good : `rgba(111,148,104,${0.55 + Math.sin(t * 6) * 0.3})`;
      ctx.lineWidth = hover === i ? 5 : 3;
      archPath(ctx, I.x - 2, I.y - 2, I.w + 4, I.h + 4, Math.min(I.w, I.h) * 0.45, Math.min(I.w, I.h) * 0.14); ctx.stroke();
      ctx.restore();
    }
  }

  // guests in rooms
  if (phase === 'menu') drawMenuGuests(ctx, t);
  else if (run && (phase === 'autumn' || phase === 'winter')) {
    for (const x of run.guests) {
      if (x.gone) continue;
      const I = innerRect(x.cell);
      drawRoomGuest(ctx, s, x, I, t, {});
      if (phase === 'winter') drawSleepBar(ctx, I, x.sleep);
    }
    if (phase === 'winter') for (const x of run.guests) {
      if (x.gone) continue;
      const I = innerRect(x.cell), r = Math.max(12, Math.min(I.w, I.h) * 0.16);
      const kind = !x.blanket && SPECIES[x.sp].blanket ? 'blanket' : x.snore > 0 ? 'snore' : null;
      if (kind) drawBubble(ctx, I.x + I.w * 0.83, I.y + r * 1.05, r, kind, t, x.sleep < 35);
    }
  } else if (run && phase === 'spring') drawWake(ctx, t);

  // cabin bubble
  if (winterRun) {
    const C = LAY.cabin, r = Math.max(13, C.w * 0.13), bx = C.x + C.w * 0.5, by = C.y - C.h * 0.62 - r;
    if (run.temp + g.pendingHeat() < 40) drawBubble(ctx, bx, by, r, 'log', t, run.temp < TUNE.ZONE[0]);
    else if (run.temp > TUNE.ZONE[1]) drawBubble(ctx, bx, by, r, 'hot', t, true);
  }

  drawStaff(ctx, s, run, phase, t);

  // queue
  if (phase === 'autumn' && run) drawQueue(ctx, run, t, dt);

  drawFx(ctx);
  for (const f of fx) if (f.kind === 'bird') { ctx.save(); ctx.globalAlpha = 1 - f.t / f.life; drawWoodpecker(ctx, f.x, f.y, Math.max(12, LAY.cellW * 0.18), t, f.side); ctx.restore(); }

  // the carried guest, under the finger
  if (phase === 'autumn' && run) for (const d of App.drags.values()) {
    if (!d.moved) continue;
    const q = run.queue.find((x) => x.id === d.qid); if (!q) continue;
    drawAnimal(ctx, q.sp, d.x, d.y - LAY.guestS * 0.12, LAY.guestS * 1.2, { awake: true, t });
  }
  drawHand(ctx, t);
}

function drawCellPrices(ctx, canDigMap) {
  const cost = digCost(dugCount(App.save));
  ctx.save();
  ctx.font = `600 ${Math.round(Math.max(12, Math.min(LAY.cellW, LAY.cellH) * 0.15))}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < canDigMap.length; i++) {
    if (!canDigMap[i]) continue;
    const I = innerRect(i), y = I.y + I.h * 0.8, x = I.x + I.w / 2;
    const tw = ctx.measureText(String(cost)).width, r = Math.max(5, I.h * 0.07);
    ctx.fillStyle = 'rgba(251,248,242,0.85)'; rrPath(ctx, x - tw / 2 - r * 2.2, y - r * 1.5, tw + r * 3.6, r * 3, r * 1.5); ctx.fill();
    drawNut(ctx, x - tw / 2 - r * 0.6, y, r);
    ctx.fillStyle = PAL.ink; ctx.fillText(String(cost), x + r * 0.6, y + 1);
  }
  ctx.restore();
}

function drawNoise(ctx, run, t) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const w of run.wps) {
    for (let r = 0; r < ROWS; r++) {
      const i = cellIdx(r, w.col), x = App.game.roomGuest(i);
      if (!x) continue;
      const I = innerRect(i), a = TUNE.wpFalloff[r] * (0.45 + 0.35 * Math.sin(t * 14));
      ctx.strokeStyle = `rgba(194,85,61,${a})`; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(I.x + I.w * 0.5, I.y - I.h * 0.05, I.w * (0.16 + k * 0.1), 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); }
    }
  }
  for (const x of run.guests) {
    if (x.gone || x.snore <= 0) continue;
    const I = innerRect(x.cell), a = 0.4 + 0.3 * Math.sin(t * 8);
    ctx.strokeStyle = `rgba(44,42,39,${a})`; ctx.lineWidth = 2;
    for (const n of neighbours(x.cell)) {
      if (!App.game.roomGuest(n)) continue;
      const J = innerRect(n), cx = (I.x + I.w / 2 + J.x + J.w / 2) / 2, cy = (I.y + I.h * 0.55 + J.y + J.h * 0.55) / 2;
      const horiz = Math.abs(J.y - I.y) < 2, dir = horiz ? Math.sign(J.x - I.x) : Math.sign(J.y - I.y);
      for (let k = 0; k < 2; k++) {
        const rr = Math.min(I.w, I.h) * (0.1 + k * 0.08);
        ctx.beginPath();
        if (horiz) ctx.arc(cx - dir * rr * 0.6, cy, rr, dir > 0 ? -0.35 * Math.PI : 0.65 * Math.PI, dir > 0 ? 0.35 * Math.PI : 1.35 * Math.PI);
        else ctx.arc(cx, cy - dir * rr * 0.6, rr, dir > 0 ? 0.15 * Math.PI : 1.15 * Math.PI, dir > 0 ? 0.85 * Math.PI : 1.85 * Math.PI);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawQueue(ctx, run, t, dt) {
  const k0 = Math.min(1, dt * 6);
  run.queue.forEach((q, k) => {
    const v = App.qvis.get(q.id); if (!v) return;
    const slot = queueSlot(k);
    const moving = Math.abs(v.x - slot.x) > 1.5;
    v.x += (slot.x - v.x) * (moving ? Math.min(1, dt * 2.6) : k0);
    v.y = slot.y;
    const dragging = [...App.drags.values()].some((d) => d.qid === q.id && d.moved);
    if (dragging) return;
    const s = LAY.guestS;
    if (App.selected === q.id) { ctx.save(); ctx.strokeStyle = PAL.good; ctx.lineWidth = 3; ell(ctx, v.x, v.y, s * 0.5, s * 0.12); ctx.stroke(); ctx.restore(); }
    drawAnimal(ctx, q.sp, v.x, v.y, s, { awake: true, t: t + q.id, walk: moving });
    // suitcase
    if (q.sp !== 'yarasa') { ctx.fillStyle = PAL.mustard; rrPath(ctx, v.x + s * 0.22, v.y - s * 0.2, s * 0.22, s * 0.17, 2); ctx.fill(); ctx.fillStyle = '#8C6440'; ctx.fillRect(v.x + s * 0.29, v.y - s * 0.24, s * 0.08, s * 0.04); }
    // patience
    const left = 1 - q.wait / q.patience, py = v.y - s * 1.02, pr = Math.max(6, s * 0.14);
    const noRoom = App.game.freeRoomFor(q.sp) < 0;
    if (noRoom) {
      ctx.save();
      fillCirc(ctx, v.x, py, pr * 1.3, '#FBF8F2');
      ctx.fillStyle = PAL.bad; ctx.font = `700 ${Math.round(pr * 1.7)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', v.x, py + 1);
      ctx.restore();
    } else if (left < 0.999) {
      ctx.save();
      ctx.lineWidth = Math.max(3, pr * 0.45); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(44,42,39,0.18)'; circ(ctx, v.x, py, pr); ctx.stroke();
      ctx.strokeStyle = left > 0.5 ? PAL.good : left > 0.25 ? PAL.warn : PAL.bad;
      ctx.beginPath(); ctx.arc(v.x, py, pr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
      ctx.restore();
    }
  });
}

function drawWake(ctx, t) {
  for (const w of App.wake) {
    const row = w.row, I = innerRect(row.cell);
    const p = t - w.start;
    if (p >= 0 && !w.done) { w.done = true; popPayment(w); }
    if (p > 2.2) continue;
    const g = { sp: row.sp, cell: row.cell, blanket: p < 0, snore: 0 };
    const extra = p < 0 ? {} : { awake: true, stretch: Math.sin(Math.min(1, p / 0.8) * Math.PI), alpha: p > 1.5 ? Math.max(0, 1 - (p - 1.5) / 0.7) : 1 };
    drawRoomGuest(ctx, App.save, g, I, t, extra);
  }
}

function drawMenuGuests(ctx, t) {
  const s = App.save;
  for (let i = 0; i < s.grid.length; i++) {
    const room = s.grid[i].room; if (!room) continue;
    const sps = ROOMS[room].species, sp = sps[i % sps.length];
    drawRoomGuest(ctx, s, { sp, cell: i, blanket: true, snore: 0 }, innerRect(i), t, {});
  }
}

function drawStaff(ctx, s, run, phase, t) {
  const live = phase === 'winter' && run && run.squirrels;
  const ss = Math.max(14, LAY.cellH * 0.34);
  if (live) {
    for (const sq of run.squirrels) {
      const p = gridToPx(sq.x, sq.y);
      const moving = sq.state === 'go' || sq.state === 'home';
      const dir = sq._px != null ? (p.x < sq._px - 0.1 ? -1 : p.x > sq._px + 0.1 ? 1 : sq._dir || 1) : 1;
      sq._px = p.x; sq._dir = dir;
      drawSquirrel(ctx, p.x, p.y, ss, t + sq.k, moving || sq.state === 'tuck', dir);
    }
  } else {
    for (let k = 0; k < s.staff.sincap; k++) { const h = SQ_HOME(k), p = gridToPx(h.x, h.y); drawSquirrel(ctx, p.x, p.y, ss, t, false, -1); }
  }
  if (s.staff.baykus) {
    const C = LAY.cabin, perch = { x: C.x + C.w * 0.36, y: C.y - C.h * 0.27 };
    const os = Math.max(16, C.w * 0.26);
    const owl = live && run.owl;
    if (owl && owl.state !== 'perch') {
      const target = wpPos(owl.col);
      const p = clamp01(owl.t / TUNE.baykusFly), q = owl.state === 'fly' ? p : 1 - p;
      const x = lerp(perch.x, target.x, q), y = lerp(perch.y, target.y, q) - Math.sin(q * Math.PI) * C.h * 0.5;
      drawOwl(ctx, x, y, os, t, true);
    } else drawOwl(ctx, perch.x, perch.y, os, t, false);
  }
}

function drawHand(ctx, t) {
  const h = App.hand;
  if (!h || t > h.until) { App.hand = null; return; }
  let p = null, press = 0;
  if (h.kind === 'tap') {
    p = h.at(); if (!p) return;
    const k = (t * 1.2) % 1; press = k < 0.25 ? k / 0.25 : k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.3);
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 3; circ(ctx, p.x, p.y, 12 + k * 26); ctx.stroke(); ctx.restore();
  } else {
    const a = h.from(), b = h.to(); if (!a || !b) return;
    const k = (t * 0.55) % 1, q = easeOut(clamp01((k - 0.15) / 0.6));
    p = { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q) - Math.sin(q * Math.PI) * 30 };
    press = k > 0.1 && k < 0.8 ? 1 : 0;
    ctx.save(); ctx.globalAlpha = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
  }
  const r = 15 - press * 2;
  fillCirc(ctx, p.x + 2, p.y + 4, r, 'rgba(20,20,30,0.25)');
  fillCirc(ctx, p.x, p.y, r, '#FFFFFF');
  fillCirc(ctx, p.x, p.y, r * 0.45, 'rgba(169,71,59,0.85)');
  if (h.kind !== 'tap') ctx.restore();
}

// ---- ambient life -----------------------------------------------------------------

function ambient(dt) {
  const g = App.game, run = g.run; if (!run) return;
  if (g.phase === 'winter' || g.phase === 'autumn') {
    for (const x of run.guests) {
      if (x.gone) continue;
      x._z = (x._z == null ? Math.random() * 2 : x._z) - dt;
      if (x._z <= 0) {
        const snore = x.snore > 0;
        x._z = snore ? 0.5 : 1.3 + Math.random() * 1.5;
        if (!snore && (!x.blanket || x.sleep < 40)) continue;
        const I = innerRect(x.cell);
        addFx({ kind: snore ? 'Z' : 'z', x: I.x + I.w * 0.62, y: I.y + I.h * 0.42, vx: 8, vy: -I.h * 0.28, size: Math.max(10, Math.min(I.w, I.h) * (snore ? 0.22 : 0.15)), life: snore ? 1.1 : 1.7, col: snore ? PAL.ink : undefined });
      }
    }
  }
  if (g.phase === 'winter') {
    const T = App.fxT;
    T.tok -= dt;
    if (run.wps.length && T.tok <= 0) {
      T.tok = 0.95; Sound.play('tok');
      for (const w of run.wps) { const p = wpPos(w.col); addFx({ kind: 'text', text: 'tak', x: p.x - p.side * LAY.cellW * 0.22, y: p.y - 12, vy: -18, size: Math.max(11, LAY.cellW * 0.13), col: PAL.bad, life: 0.7 }); }
    }
    T.snore -= dt;
    if (T.snore <= 0 && run.guests.some((x) => !x.gone && x.snore > 0)) { T.snore = 2.3; Sound.play('snore'); }
  }
}

// ---- HUD ----------------------------------------------------------------------------

function setText(id, v) { if (App.hud[id] !== v) { App.hud[id] = v; $(id).textContent = v; } }
function setHtml(id, v) { if (App.hud[id] !== v) { App.hud[id] = v; $(id).innerHTML = v; } }

function updateHud() {
  if (App.screen !== 'game') return;
  const g = App.game, s = App.save, run = g.run;
  const phase = g.phase, season = seasonNow();
  const year = phase === 'summer' ? s.year : phase === 'spring' || phase === 'summary' ? run.results.year : run.year;
  setHtml('seasonIcon', ICON[season]);
  setText('seasonText', SEASON_NAME[season]);
  setText('yearText', `Yıl ${year}`);
  let bar = 0;
  if (phase === 'autumn') bar = (run.nextId - 1 - run.queue.length) / Math.max(1, run.nextId - 1 + run.plan.length);
  else if (phase === 'winter') bar = run.t / run.len;
  else if (phase === 'spring' || phase === 'summary') bar = 1;
  const bw = Math.round(bar * 100) + '%';
  if (App.hud.bar !== bw) { App.hud.bar = bw; $('seasonBar').style.width = bw; }
  const m = Math.max(0, s.money - App.moneyHold);
  setText('money', String(m));
  const st = starsFor(s.fame);
  setHtml('stars', `<span class="full">${[1, 2, 3, 4, 5].map((k) => ICON.star(k <= st, 17)).join('')}</span><span class="mini">${ICON.star(true, 17)}${st}</span>`);
  setHtml('fame', `<span class="full">${s.fame} kalp</span><span class="mini">${ICON.heart(true, 13)}${s.fame}</span>`);
  setHtml('pauseBtn', phase === 'summer' ? ICON.menu : ICON.pause);
  const showBar = phase === 'summer' && !App.sheet;
  if ($('summerBar').hidden === showBar) $('summerBar').hidden = !showBar;
  if (!$('hint').hidden && App.t > App.hintUntil) hideHint();
}

function banner(title, sub, small) {
  const b = $('banner');
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || '';
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  b.style.top = small ? '22%' : '';
  clearTimeout(banner.tm); banner.tm = setTimeout(() => { b.hidden = true; }, 2300);
}

function hint(key, html, o) {
  o = o || {};
  if (key) {
    if (App.save.seen[key]) return false;
    App.save.seen[key] = 1; persist();
    App.hintKeyed = App.t;
  } else if (App.t - App.hintKeyed < 4 && !$('hint').hidden) return true;
  const el = $('hint');
  el.innerHTML = html; el.hidden = false;
  App.hintUntil = App.t + (o.time || 6);
  App.hintTag = o.tag || null;
  App.hand = o.hand ? Object.assign({ until: App.t + (o.time || 6) }, o.hand) : (key ? null : App.hand);
  return true;
}
function solved(tag) { if (App.hintTag === tag && !$('hint').hidden) { App.hintUntil = Math.min(App.hintUntil, App.t + 0.8); App.hand = null; } }
function toast(html, time) { hint(null, html, { time: time || 3.5 }); }
function hideHint() { $('hint').hidden = true; App.hand = null; }

function starInfo() {
  const s = App.save, next = STAR_AT.find((x) => x > s.fame);
  if (next == null) { toast(`Otelin 5 yıldızlı! Toplam ${s.fame} kalp topladın.`); return; }
  const room = ROOM_ORDER.find((t) => ROOMS[t].fame === next);
  toast(`Bir sonraki yıldız için <b>${next} kalp</b> lazım, sende ${s.fame} var.${room ? ` O zaman <b>${esc(lower(ROOMS[room].name))}</b> açılır.` : ''}`, 5);
}

// ---- sheets ----------------------------------------------------------------------------

function openSheet(html, on, modal) {
  const el = $('sheet');
  el.innerHTML = html;
  fillIcons(el);
  $('sheetWrap').hidden = false;
  el.scrollTop = 0;
  App.sheet = { on, modal: !!modal };
  hideHint();
}
function closeSheet() { $('sheetWrap').hidden = true; App.sheet = null; }

function fillIcons(root) {
  root.querySelectorAll('[data-sp]').forEach((el) => {
    const list = el.dataset.sp.split(','), size = list.length > 1 ? 30 : 48;
    for (const sp of list) { const c = animalIcon(sp, size, el.dataset.awake === '1'); el.appendChild(c); }
  });
  root.querySelectorAll('[data-staff]').forEach((el) => el.appendChild(spriteIcon(el.dataset.staff, 48)));
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICON[el.dataset.icon]; });
}

const priceHtml = (n) => `<span class="price">${ICON.nut(17)}${n}</span>`;
const speciesList = (type) => {
  const names = ROOMS[type].species.map((sp) => SPECIES[sp].name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ve ${lower(names[names.length - 1])}` : names[0];
};

function openCell(i) {
  const s = App.save, g = s.grid[i];
  if (!g.dug) {
    if (!canDig(s, i)) { toast('Buraya ulaşmak için önce yanındaki toprağı kaz.'); Sound.play('no'); return; }
    const cost = digCost(dugCount(s)), ok = s.money >= cost;
    openSheet(`<h2>Toprağı kaz</h2><p>Burayı kazarsan içine yeni bir oda yapabilirsin. Derindeki odalar ağaçkakanı daha az duyar.</p>
      ${ok ? '' : `<p class="muted">${cost - s.money} fındık daha lazım.</p>`}
      <div class="actions"><button class="btn primary" data-act="dig" ${ok ? '' : 'disabled'}>Kaz · ${priceHtml(cost)}</button><button class="btn" data-act="close">Vazgeç</button></div>`,
    (act) => {
      if (act === 'dig' && App.game.dig(i) === 'ok') { Sound.play('dig'); dust(i); persist(); closeSheet(); openCell(i); return; }
      closeSheet();
    });
    return;
  }
  if (!g.room) {
    const items = ROOM_ORDER.map((type) => {
      const R = ROOMS[type], open = roomUnlocked(s, type), ok = open && s.money >= R.cost;
      const stars = STAR_AT.indexOf(R.fame) + 1;
      return `<div class="item ${open ? '' : 'locked'}"><span class="ic ${R.species.length > 1 ? 'pair' : ''}" data-sp="${R.species.join(',')}"></span>
        <div class="tx"><b>${esc(R.name)}</b><span>${open ? esc(speciesList(type)) + ' uyur.' : `${stars} yıldızda açılır (${R.fame} kalp).`}</span></div>
        <button class="btn small ${ok ? 'primary' : ''}" data-act="build" data-type="${type}" ${ok ? '' : 'disabled'}>${open ? priceHtml(R.cost) : ICON.lock}</button></div>`;
    }).join('');
    openSheet(`<h2>Oda yap</h2><p class="muted">Sende ${s.money} fındık var.</p><div class="list">${items}</div>
      <div class="actions"><button class="btn" data-act="close">Kapat</button></div>`,
    (act, b) => {
      if (act === 'build' && App.game.build(i, b.dataset.type) === 'ok') { Sound.play('build'); dust(i); persist(); }
      closeSheet();
    });
    return;
  }
  const R = ROOMS[g.room], L = LEVELS[g.lvl];
  let up = '';
  if (g.lvl < 3) {
    const cost = upgradeCost(g.room, g.lvl), ok = s.money >= cost, nx = LEVELS[g.lvl + 1];
    up = `<div class="item"><span class="ic" data-icon="${g.lvl === 1 ? 'lantern' : 'frame'}"></span><div class="tx"><b>${nx.name} oda yap</b><span>Misafir ${Math.round((nx.pay - 1) * 100)}% daha çok öder, daha derin uyur. ${g.lvl === 1 ? 'Bir fener asılır.' : 'Duvara tablo, yere halı.'}</span></div>
      <button class="btn small ${ok ? 'primary' : ''}" data-act="up" ${ok ? '' : 'disabled'}>${priceHtml(cost)}</button></div>`;
  } else up = '<p class="muted">Bu oda en güzel hâlinde. Daha fazla güzelleşemez.</p>';
  const back = Math.round(R.cost / 2);
  openSheet(`<h2>${esc(R.name)}</h2><p class="muted">${esc(speciesList(g.room))} uyur · ${L.name} oda</p><div class="list">${up}</div>
    <div class="actions"><button class="btn" data-act="close">Kapat</button><button class="btn small ghost" data-act="demolish">Odayı yık</button></div>`,
  (act) => {
    if (act === 'up' && App.game.upgradeRoom(i) === 'ok') { Sound.play('buy'); dust(i); persist(); closeSheet(); return; }
    if (act === 'demolish') {
      openSheet(`<h2>Oda yıkılsın mı?</h2><p>${esc(R.name)} yıkılır, ${back} fındık geri alırsın. Yerine başka oda yapabilirsin.</p>
        <div class="actions"><button class="btn primary" data-act="yes">Yık · +${priceHtml(back)}</button><button class="btn" data-act="close">Vazgeç</button></div>`,
      (a2) => { if (a2 === 'yes' && App.game.demolish(i) === 'ok') { Sound.play('dig'); dust(i); persist(); } closeSheet(); });
      return;
    }
    closeSheet();
  });
}

function dust(i) {
  const I = innerRect(i);
  for (let k = 0; k < 8; k++) addFx({ kind: 'puff', x: I.x + I.w * Math.random(), y: I.y + I.h * (0.4 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, size: I.w * 0.08, col: 'rgba(210,190,160,0.85)', life: 0.7 });
}

function openShop() {
  if (App.game.phase !== 'summer') return;
  const s = App.save, g = App.game;
  const staff = STAFF_ORDER.map((id) => {
    const S = STAFF[id], n = s.staff[id], cost = g.itemCost(id), ok = cost != null && s.money >= cost;
    const have = S.max > 1 ? `Sende ${n} / ${S.max}. ` : n ? 'Sende var. ' : '';
    return `<div class="item"><span class="ic" data-staff="${id}"></span><div class="tx"><b>${esc(S.name)}</b><span>${have}${esc(S.note)}</span></div>
      ${cost == null ? '<button class="btn small" disabled>Alındı</button>' : `<button class="btn small ${ok ? 'primary' : ''}" data-act="buy" data-id="${id}" ${ok ? '' : 'disabled'}>${priceHtml(cost)}</button>`}</div>`;
  }).join('');
  const ups = UPGRADE_ORDER.map((id) => {
    const U = UPGRADES[id], cost = g.itemCost(id), ok = cost != null && s.money >= cost;
    return `<div class="item"><span class="ic" data-icon="${id}"></span><div class="tx"><b>${esc(U.name)}</b><span>${esc(U.note)}</span></div>
      ${cost == null ? '<button class="btn small" disabled>Alındı</button>' : `<button class="btn small ${ok ? 'primary' : ''}" data-act="buy" data-id="${id}" ${ok ? '' : 'disabled'}>${priceHtml(cost)}</button>`}</div>`;
  }).join('');
  openSheet(`<h2>Dükkân</h2><p class="muted">Sende ${s.money} fındık var. Yardımcılar kışın kendi kendine çalışır.</p>
    <h3>Yardımcılar</h3><div class="list">${staff}</div><h3>Geliştirmeler</h3><div class="list">${ups}</div>
    <div class="actions"><button class="btn" data-act="close">Kapat</button></div>`,
  (act, b) => {
    if (act === 'buy') { if (App.game.buy(b.dataset.id) === 'ok') { Sound.play('buy'); persist(); const sc = $('sheet').scrollTop; openShop(); $('sheet').scrollTop = sc; } return; }
    closeSheet();
  });
}

function openSummary(res) {
  App.moneyHold = 0;
  const words = (r) => (r.woke ? 'Uyandı, kızıp gitti' : r.hearts === 3 ? 'Mışıl mışıl uyudu' : r.hearts === 2 ? 'İyi uyudu' : 'Pek uyuyamadı');
  const rows = res.rows.map((r) => `<div class="res"><span class="ic" data-sp="${r.sp}"></span>
    <div class="nm">${esc(SPECIES[r.sp].name)}<small>${words(r)}${r.woke ? '' : ` · uyku ${r.sleep}%`}</small></div>
    <div class="hearts">${[1, 2, 3].map((k) => ICON.heart(k <= r.hearts, 15)).join('')}</div>
    <div class="got">${r.woke ? '0' : `+${r.pay + r.tip}`}${ICON.nut(15)}</div></div>`).join('');
  const news = [];
  if (res.starsAfter > res.starsBefore) news.push(`Otel ${res.starsAfter} yıldız oldu!`);
  for (const t of res.unlocked) news.push(`Yeni oda açıldı: <b>${esc(ROOMS[t].name)}</b>. Artık ${esc(lower(speciesList(t)))} de gelebilir.`);
  const tips = [];
  if (res.left) tips.push(`${res.left} misafir yer bulamadı ya da beklemekten sıkıldı. Daha çok oda yapabilirsin.`);
  if (res.rows.some((r) => r.woke)) tips.push('Uyanan misafir ödeme yapmaz. Dükkândaki yardımcılar işini kolaylaştırır.');
  const empty = !res.rows.length;
  openSheet(`<h2>Bahar geldi · Yıl ${res.year}</h2>
    ${empty ? '<p>Bu kış otelde kimse uyumadı. Sonbaharda misafirleri sürükleyip odalarına bırakmayı unutma.</p>' : `<div class="list">${rows}</div>`}
    <div class="total"><div>${ICON.nut(22)}+${res.pay + res.tip}<small>${res.tip ? `${res.tip} bahşiş` : 'fındık'}</small></div><div>${ICON.heart(true, 20)}+${res.hearts}<small>kalp</small></div></div>
    ${news.map((n) => `<div class="news">${n}</div>`).join('')}
    ${tips.map((x) => `<p class="muted">${x}</p>`).join('')}
    <div class="actions"><button class="btn primary" data-act="go">Yaza geç</button>${lab.ask('yil-sonu')}</div>`,
  (act) => { if (act === 'go') { closeSheet(); App.game.toSummer(); for (const e of App.game.takeEvents()) onEvent(e); } }, true);
}

function openPause() {
  if (App.screen !== 'game') return;
  const g = App.game, mid = g.phase === 'autumn' || g.phase === 'winter';
  if (App.sheet) return;
  App.paused = true;
  App.drags.clear();
  openSheet(`<h2>${mid ? 'Durakladı' : 'Menü'}</h2>${mid ? '<p class="muted">Ana menüye dönersen bu yıl baştan başlar. Fındıkların ve otelin kayıtlı.</p>' : ''}
    <div class="actions"><button class="btn primary" data-act="resume">${mid ? 'Devam et' : 'Kapat'}</button><button class="btn" data-act="help">Nasıl oynanır</button><button class="btn" data-act="sound">${Sound.on ? 'Sesi kapat' : 'Sesi aç'}</button>${lab.ask('mola')}<button class="btn" data-act="menu">Ana menü</button></div>`,
  (act) => {
    if (act === 'resume') { App.paused = false; closeSheet(); }
    else if (act === 'help') { openHelp(() => { closeSheet(); App.paused = false; openPause(); }); }
    else if (act === 'sound') { Sound.setOn(!Sound.on); store.set('sound', Sound.on); closeSheet(); App.paused = false; openPause(); }
    else if (act === 'menu') toMenu();
  }, true);
}

function openHelp(back) {
  openSheet(`<h2>Nasıl oynanır</h2><ul class="steps">
    <li><b>Sonbahar</b><span>Misafirler kulübenin önünde sıraya girer. Her birini parmağınla sürükleyip kendi odasına bırak. Kirpi ile fındık faresi yaprak yuvasında, ayı mağarada uyur.</span></li>
    <li><b>Kış</b><span>Herkes uyur. Battaniyesi düşene dokun, horlayanı çevir, ağaçkakanı kov. Kulübeye dokununca sobaya odun atarsın: termometre yeşilde kalsın.</span></li>
    <li><b>Bahar</b><span>İyi uyuyan çok fındık öder ve 3 kalp bırakır. Kalpler otele yıldız getirir, yeni yıldızlarda yeni misafirler gelir.</span></li>
    <li><b>Yaz</b><span>Toprağı kaz, oda yap, odaları güzelleştir. Dükkândan yardımcı al: sincap, baykuş ve ren geyiği kışın sana yardım eder.</span></li>
    <li><b>İki kişi</b><span>Aynı ekranda iki kişi birden dokunabilir. Biri sobaya baksın, öteki misafirlere.</span></li></ul>
    <div class="actions"><button class="btn primary" data-act="ok">Anladım</button></div>`,
  () => { if (back) back(); else closeSheet(); }, !!back);
}

function confirmNew() {
  Sound.unlock();
  openSheet(`<h2>Yeni otel kurulsun mu?</h2><p>Şu anki otelin, fındıkların ve kalplerin silinir. Bu geri alınamaz.</p>
    <div class="actions"><button class="btn primary" data-act="yes">Yeni otel kur</button><button class="btn" data-act="close">Vazgeç</button></div>`,
  (act) => {
    if (act === 'yes') { App.save = newSave(); persist(); App.game = new Game(App.save); updateMenu(); }
    closeSheet();
  });
}

// ---- loop ------------------------------------------------------------------------------------

let lastTs = 0;
function frame(ts) {
  const dt = lastTs ? Math.min(0.05, Math.max(0, (ts - lastTs) / 1000)) : 0.016;
  lastTs = ts;
  App.t += dt; App.dt = dt;
  const g = App.game;
  if (App.screen === 'game' && !App.paused) {
    g.update(dt);
    for (const e of g.takeEvents()) onEvent(e);
    ambient(dt);
  }
  updateWeather(seasonNow(), dt);
  if (!App.paused) updateFx(dt);
  try { render(dt); } catch (err) { if (!frame.err) { frame.err = true; console.error(err); } }
  updateHud();
  Sound.tick(App.screen === 'game' && !App.paused ? g.phase : 'none', !!App.save.upgrades.ninni);
  requestAnimationFrame(frame);
}

init();
