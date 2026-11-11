// Kelime Tenisi arayüzü: menü, iki kişi tek ekran (karşılıklı), bota karşı, kayıt ve Lab bağlantıları.
(function () {
  'use strict';

  const SAVE_KEY = 'kelime-tenisi.v1';         // hesaba eşitlenir: istatistikler
  const DEVICE_KEY = 'kelime-tenisi.device';   // cihazda kalır: ses, dil, son ayarlar, adlar
  const DEBUG = (() => { try { return localStorage.getItem('kelime-tenisi.debug') === '1'; } catch (e) { return false; } })();
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- texts ----------
  const T = {
    tr: {
      title: 'Kelime Tenisi', tagline: 'Tek harfini değiştir, geri gönder.',
      duo: 'İki kişi', duoSub: 'Tek ekran, karşılıklı otur', bot: 'Bota karşı', botSub: 'Tek başına antrenman',
      level: 'Bot', kolay: 'Kolay', orta: 'Orta', zor: 'Zor', bonus: 'Ek süre (handikap)',
      word: 'Kelime', len3: '3 harf', len4: '4 harf', pace: 'Süre', rahat: 'Rahat', normal: 'Normal', hizli: 'Hızlı',
      format: 'Maç', short: 'Kısa · 1 oyun', long: "Uzun · 3'te 2", start: 'Başla', how: 'Nasıl oynanır?',
      soundOn: 'Ses açık', soundOff: 'Ses kapalı', paused: 'Mola', resume: 'Devam', quit: 'Ana menü',
      nasildi: 'Nasıldı?', again: 'Rövanş', menu: 'Ana menü', gotIt: 'Anladım',
      rotate: 'Oyun dik ekran için. Telefonu dik tut.',
      p1: 'Oyuncu 1', p2: 'Oyuncu 2', botName: 'Bot', you: 'Sen',
      serveYou: 'Servis sende: bir kelime seç', serveWait: '{name} servis atıyor',
      firstTurn: 'Önce değiştireceğin harfe, sonra yeni harfe dokun', yourTurn: 'Bir harfini değiştir',
      pickKey: 'Şimdi yeni harfi seç', pickTile: 'Önce değiştireceğin harfe dokun',
      thinking: '{name} düşünüyor', sentBy: '{name} gönderdi',
      errUsed: '{w} bu sayıda oynandı', errUnknown: '{w} sözlükte yok',
      point: 'Sayı {name}!', pointYou: 'Sayı senin!', smash: 'SMAÇ!', smashYou: 'Smaç! {w} kelimesinin dönüşü yok.',
      smashThem: '{w} kelimesinin dönüşü yoktu.', timeUp: 'Süre bitti.',
      could: 'Şunları yazabilirdin:', couldRare: 'Sözlükte bir de:', none: 'Bu kelimenin dönüşü yoktu.',
      game: 'Oyun {name}!', golden: 'Altın sayı', gamePoint: 'Oyun sayısı · {name}', matchPoint: 'Maç sayısı · {name}',
      servesFirst: 'Yazı tura: {name} başlıyor', serving: 'Servis: {name}',
      winTitle: '{name} kazandı!', youWin: 'Kazandın!', botWins: 'Bot kazandı',
      score: 'Skor', games: 'Oyunlar',
      statLongest: 'En uzun ralli: <b>{n} kelime</b>', statSmash: 'Smaç: <b>{a}</b>', statWords: 'Gönderilen kelime: <b>{a}</b>',
      record: 'Bota karşı: {w} galibiyet, {l} yenilgi', recordRally: 'En uzun ralli: {n} kelime',
      how1: '<b>Servis:</b> üç kelimeden birini seç, karşıya gönder.',
      how2: '<b>Dönüş:</b> gelen kelimenin <b>tek harfini</b> değiştir. Önce harfe, sonra yeni harfe dokun.',
      how3: '<b>Süre</b> her vuruşta biraz kısalır; süresinde dönemeyen sayıyı kaybeder. Bir kelime bir sayıda bir kez oynanır.',
      how4: '<b>Smaç:</b> dönüşü hiç olmayan bir kelime gönderirsen sayı hemen senin.',
      how5: '<b>Sayı</b> tenisteki gibi: 15, 30, 40, oyun. 40-40\'ta sıradaki sayı oyunu alır.',
      demo: ['kasa', 'kara', 'kare'],
    },
    en: {
      title: 'Word Tennis', tagline: 'Change one letter, send it back.',
      duo: 'Two players', duoSub: 'One screen, face to face', bot: 'Against the bot', botSub: 'Practice on your own',
      level: 'Bot', kolay: 'Easy', orta: 'Medium', zor: 'Hard', bonus: 'Extra time (handicap)',
      word: 'Words', len3: '3 letters', len4: '4 letters', pace: 'Time', rahat: 'Relaxed', normal: 'Normal', hizli: 'Fast',
      format: 'Match', short: 'Short · 1 game', long: 'Long · best of 3', start: 'Play', how: 'How to play',
      soundOn: 'Sound on', soundOff: 'Sound off', paused: 'Paused', resume: 'Resume', quit: 'Main menu',
      nasildi: 'How was it?', again: 'Rematch', menu: 'Main menu', gotIt: 'Got it',
      rotate: 'This game is played upright. Turn your phone.',
      p1: 'Player 1', p2: 'Player 2', botName: 'Bot', you: 'You',
      serveYou: 'Your serve: pick a word', serveWait: '{name} is serving',
      firstTurn: 'Tap the letter to change, then the new letter', yourTurn: 'Change one letter',
      pickKey: 'Now pick the new letter', pickTile: 'First tap the letter you want to change',
      thinking: '{name} is thinking', sentBy: '{name} sent',
      errUsed: '{w} was already played this point', errUnknown: '{w} is not in the dictionary',
      point: 'Point {name}!', pointYou: 'Your point!', smash: 'SMASH!', smashYou: 'Smash! There is no way back from {w}.',
      smashThem: 'There was no way back from {w}.', timeUp: 'Out of time.',
      could: 'You could have played:', couldRare: 'The dictionary also has:', none: 'There was no way back from that word.',
      game: 'Game {name}!', golden: 'Golden point', gamePoint: 'Game point · {name}', matchPoint: 'Match point · {name}',
      servesFirst: 'Coin toss: {name} serves', serving: 'Serving: {name}',
      winTitle: '{name} wins!', youWin: 'You win!', botWins: 'The bot wins',
      score: 'Score', games: 'Games',
      statLongest: 'Longest rally: <b>{n} words</b>', statSmash: 'Smashes: <b>{a}</b>', statWords: 'Words sent: <b>{a}</b>',
      record: 'Against the bot: {w} won, {l} lost', recordRally: 'Longest rally: {n} words',
      how1: '<b>Serve:</b> pick one of three words and send it over.',
      how2: '<b>Return:</b> change <b>one letter</b> of the word that comes to you. Tap the letter, then the new letter.',
      how3: '<b>Time</b> gets a little shorter every shot; miss it and you lose the point. A word can be played once per point.',
      how4: '<b>Smash:</b> send a word that has no way back and the point is yours at once.',
      how5: '<b>Scoring</b> as in tennis: 15, 30, 40, game. At 40-40 the next point wins the game.',
      demo: ['cold', 'cord', 'word'],
    },
  };
  const t = (k, vars) => {
    let s = (T[S.lang] && T[S.lang][k]) || T.tr[k] || k;
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const U = w => KT.upper(w, S.lang);

  // ---------- settings ----------
  const S = Object.assign({
    lang: (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en',
    mode: 'duo', level: 'orta', len: 4, pace: 'normal', format: 1,
    names: ['', ''], bonus: [0, 0], sound: true, seenHow: false,
  }, readJSON(DEVICE_KEY) || {});
  if (!T[S.lang]) S.lang = 'tr';
  if (![3, 4].includes(+S.len)) S.len = 4;
  S.len = +S.len; S.format = +S.format === 2 ? 2 : 1;
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function saveDevice() { try { localStorage.setItem(DEVICE_KEY, JSON.stringify(S)); } catch (e) {} }
  function loadSave() {
    const d = readJSON(SAVE_KEY) || {};
    d.v = 1;
    d.bot = d.bot || {};
    for (const l of ['kolay', 'orta', 'zor']) d.bot[l] = Object.assign({ w: 0, l: 0 }, d.bot[l] || {});
    d.duo = d.duo || 0; d.longest = d.longest || 0; d.longestWords = d.longestWords || []; d.smashes = d.smashes || 0;
    return d;
  }
  Sfx.setEnabled(S.sound);

  // ---------- Lab ----------
  const H = () => window.Hesap || null;
  function labNote(s) { try { const h = H(); if (h && h.not) h.not(s); } catch (e) {} }
  if (H() && H().hazir) {
    H().hazir.then(r => {
      const p = r && r.profil;
      if (p && p.name && !S.names[0]) { S.names[0] = p.name; $('#name1').value = p.name; }
    }).catch(() => {});
  } else {
    document.documentElement.classList.add('standalone');
    $$('.nasildi').forEach(b => b.remove());
  }

  // ---------- lexicons ----------
  const lexCache = {};
  const lexFor = (lang, len) => lexCache[lang + len] || (lexCache[lang + len] = new KT.Lexicon(WORDS, lang, len));

  // ---------- menu ----------
  function applyTexts() {
    document.documentElement.lang = S.lang;
    document.title = t('title');
    $$('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    $('#name1').placeholder = t('p1');
    $('#name2').placeholder = t('p2');
    $('#soundBtn').textContent = S.sound ? t('soundOn') : t('soundOff');
    const save = loadSave();
    const w = save.bot.kolay.w + save.bot.orta.w + save.bot.zor.w, l = save.bot.kolay.l + save.bot.orta.l + save.bot.zor.l;
    const parts = [];
    if (w + l) parts.push(t('record', { w, l }));
    if (save.longest) parts.push(t('recordRally', { n: save.longest }));
    $('#record').textContent = parts.join(' · ');
    $('#howList').innerHTML = ['how1', 'how2', 'how3', 'how4', 'how5'].map(k => '<li>' + t(k) + '</li>').join('');
  }
  function syncMenu() {
    $$('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
    $$('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
    $('#setupBot').classList.toggle('on', S.mode === 'bot');
    $('#setupDuo').classList.toggle('on', S.mode === 'duo');
    const val = { level: S.level, len: String(S.len), pace: S.pace, format: String(S.format), bonus0: String(S.bonus[0]), bonus1: String(S.bonus[1]) };
    $$('[data-set]').forEach(g => $$('.chip', g).forEach(c => c.classList.toggle('on', c.dataset.v === val[g.dataset.set])));
    $('#name1').value = S.names[0] || '';
    $('#name2').value = S.names[1] || '';
    applyTexts();
  }
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => { S.lang = b.dataset.lang; saveDevice(); syncMenu(); Sfx.tap(); }));
  $$('.mode').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; saveDevice(); syncMenu(); Sfx.tap(); }));
  $$('[data-set]').forEach(g => $$('.chip', g).forEach(c => c.addEventListener('click', () => {
    const k = g.dataset.set, v = c.dataset.v;
    if (k === 'level') S.level = v;
    else if (k === 'len') S.len = +v;
    else if (k === 'pace') S.pace = v;
    else if (k === 'format') S.format = +v;
    else if (k === 'bonus0') S.bonus[0] = +v;
    else if (k === 'bonus1') S.bonus[1] = +v;
    saveDevice(); syncMenu(); Sfx.tap();
  })));
  $('#name1').addEventListener('input', e => { S.names[0] = e.target.value.trim(); saveDevice(); });
  $('#name2').addEventListener('input', e => { S.names[1] = e.target.value.trim(); saveDevice(); });
  $('#soundBtn').addEventListener('click', () => { S.sound = !S.sound; Sfx.setEnabled(S.sound); saveDevice(); applyTexts(); Sfx.tap(); });
  $('#howBtn').addEventListener('click', () => openHow());
  $('#howOk').addEventListener('click', () => { closeHow(); });
  $('#startBtn').addEventListener('click', () => { Sfx.unlock(); startMatch(); });
  document.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

  // ---------- how-to demo ----------
  let demoTimer = null;
  function openHow() {
    $('#howSheet').hidden = false;
    const demo = $('#demo'), seq = t('demo');
    let step = 0;
    const show = () => {
      const a = seq[Math.floor(step / 3) % (seq.length - 1)], b = seq[Math.floor(step / 3) % (seq.length - 1) + 1];
      const at = [...a].findIndex((c, i) => c !== b[i]);
      const phase = step % 3;
      const word = phase === 2 ? b : a;
      demo.innerHTML = '<div class="tiles">' + [...word].map((c, i) =>
        `<div class="tile${phase === 1 && i === at ? ' sel' : ''}${phase === 2 && i === at ? ' new' : ''}">${esc(U(c))}</div>`).join('') + '</div>' +
        `<div class="arrow">${esc(U(a))} → ${esc(U(b))}</div>`;
      step++;
    };
    show();
    clearInterval(demoTimer);
    demoTimer = setInterval(show, 900);
  }
  function closeHow() { $('#howSheet').hidden = true; clearInterval(demoTimer); if (!S.seenHow) { S.seenHow = true; saveDevice(); } }

  // ================= GAME =================
  let G = null;

  function playerName(i) {
    if (G && G.mode === 'bot') return i === 0 ? (S.names[0] || t('you')) : t('botName');
    return S.names[i] || (i === 0 ? t('p1') : t('p2'));
  }
  const isBot = i => !!(G && G.bots[i]);
  const panelOf = i => G.panels[i];

  function startMatch(firstServer) {
    stopGame();
    const lex = lexFor(S.lang, S.len);
    const mode = S.mode;
    const players = [0, 1].map(i => ({ name: '', bonus: mode === 'duo' ? S.bonus[i] : 0 }));
    const fs = firstServer !== undefined ? firstServer : (mode === 'bot' ? 0 : (Math.random() < 0.5 ? 0 : 1));
    const m = new KT.Match({ lex, players, gamesToWin: S.format, pace: S.pace, firstServer: fs });
    G = {
      m, lex, mode, firstServer: fs,
      bots: [null, mode === 'bot' ? new KT.Bot(S.level) : null],
      panels: [$('#panel0'), $('#panel1')],
      sel: [-1, -1], typed: '',
      clock: { owner: -1, total: 1, left: 0, elapsed: 0, running: false, onEnd: null },
      plan: null, waits: [], paused: false, speed: 1, lastTs: performance.now(), raf: 0, lastTick: -1,
      ballAt: null, firstShot: [true, true], started: Date.now(), pointBusy: false,
    };
    m.players[0].name = playerName(0);
    m.players[1].name = playerName(1);
    const game = $('#game');
    game.classList.toggle('duo', mode === 'duo');
    game.classList.toggle('bot', mode === 'bot');
    $('#menu').classList.remove('on');
    game.classList.add('on');
    $('#endSheet').hidden = true;
    buildPanel(0); buildPanel(1);
    renderScore();
    layout();
    G.raf = requestAnimationFrame(frame);
    labNote(`Maç başladı: ${mode === 'bot' ? 'bota karşı (' + S.level + ')' : 'iki kişi'}, ${S.lang === 'tr' ? 'Türkçe' : 'İngilizce'}, ${S.len} harf, ${S.pace}, ${S.format === 1 ? 'tek oyun' : "3'te 2"}`);
    if (mode === 'duo') {
      banner(t('servesFirst', { name: playerName(fs) }));
      wait(1.6, () => { hideBanner(); enterServe(); });
    } else {
      enterServe();
    }
  }

  function stopGame() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    G = null;
  }

  // ---------- panels ----------
  function buildPanel(i) {
    const p = panelOf(i);
    p.className = 'panel ' + (i === 0 ? 'bottom' : 'top') + ' ' + (isBot(i) ? 'cbot' : 'c' + i);
    if (isBot(i)) {
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="bot-think" hidden><i></i><i></i><i></i></span><span class="games"></span><span class="pscore"></span></div>
        <div class="tiles small"></div><div class="clock idle"><i></i></div>`;
    } else {
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="games"></span><span class="pscore"></span></div>
        <div class="msg"></div><div class="tiles"></div><div class="clock idle"><i></i></div><div class="kbd off"></div>`;
      const kbd = $('.kbd', p);
      kbd.innerHTML = KT.KEYS[S.lang].map(row => '<div class="krow">' + [...row].map(c =>
        `<button type="button" class="key" data-k="${c}">${esc(U(c))}</button>`).join('') + '</div>').join('');
      $$('.key', kbd).forEach(k => k.addEventListener('pointerdown', e => { e.preventDefault(); onKey(i, k.dataset.k, k); }));
    }
    $('.pname', p).textContent = playerName(i) + (isBot(i) ? ' · ' + t(G.bots[i].level) : '');
  }

  function renderScore() {
    const m = G.m;
    for (const i of [0, 1]) {
      const p = panelOf(i);
      const sc = $('.pscore', p);
      sc.textContent = m.scoreText(i) + '–' + m.scoreText(1 - i);
      sc.classList.toggle('hot', !!m.pointFor(i));
      $('.games', p).innerHTML = Array.from({ length: m.gamesToWin }, (_, k) => `<i class="${k < m.games[i] ? 'won' : ''}"></i>`).join('');
    }
  }

  function setMsg(i, html, cls) {
    if (isBot(i)) return;
    const el = $('.msg', panelOf(i));
    el.className = 'msg' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }

  function renderTiles(i, word, opts) {
    const o = opts || {};
    const el = $('.tiles', panelOf(i));
    if (!word) { el.innerHTML = ''; el.className = 'tiles' + (isBot(i) ? ' small' : ''); return; }
    const letters = [...word];
    el.className = 'tiles' + (isBot(i) ? ' small' : '') + (o.wait ? ' wait' : '') + (o.land ? ' land' : '');
    el.innerHTML = letters.map((c, k) => {
      const cls = ['tile'];
      if (o.sel === k) cls.push('sel');
      if (o.mark === k) cls.push('new');
      if (o.typed !== undefined && k >= o.typed) cls.push('dim');
      return `<div class="${cls.join(' ')}" data-i="${k}">${esc(U(c))}</div>`;
    }).join('');
    if (!isBot(i) && o.active) {
      $$('.tile', el).forEach(tile => tile.addEventListener('pointerdown', e => { e.preventDefault(); onTile(i, +tile.dataset.i); }));
    }
  }

  function renderServeCards(i, words) {
    const el = $('.tiles', panelOf(i));
    el.className = 'tiles';
    el.innerHTML = '<div class="serve-cards">' + words.map(w => `<button type="button" class="serve-card" data-w="${esc(w)}">${esc(U(w))}</button>`).join('') + '</div>';
    $$('.serve-card', el).forEach(b => b.addEventListener('click', () => {
      if (G.m.phase !== 'serve' || G.m.server !== i || G.pointBusy) return;
      b.classList.add('pick');
      doServe(b.dataset.w);
    }));
  }

  function setKeyboard(i, on) {
    if (isBot(i)) return;
    $('.kbd', panelOf(i)).classList.toggle('off', !on);
  }

  function courtInfo() {
    const m = G.m, pt = m.point;
    let txt = '';
    if (m.phase === 'serve') {
      if (m.goldenPoint()) txt = t('golden');
      else {
        const gp = [0, 1].find(i => m.pointFor(i));
        if (gp !== undefined) txt = t(m.pointFor(gp) === 'match' ? 'matchPoint' : 'gamePoint', { name: playerName(gp) });
        else txt = t('serving', { name: playerName(m.server) });
      }
      txt = esc(txt);
    } else if (pt && pt.shots.length) {
      const words = pt.shots.slice(-3).map(s => s.word);
      txt = '<span class="chain">' + words.map((w, k) => `<span class="${k === words.length - 1 ? 'last' : ''}">${esc(U(w))}</span>`).join('') +
        `</span> · ${pt.shots.length}`;
    }
    $('#info0').innerHTML = txt;
    $('#info1').innerHTML = txt;
  }

  // ---------- clock & scheduler (paused together) ----------
  function wait(sec, fn) { G.waits.push({ left: sec, fn }); }
  function startClock(owner, seconds, onEnd, visible) {
    const c = G.clock;
    c.owner = owner; c.total = seconds; c.left = seconds; c.elapsed = 0; c.running = true; c.onEnd = onEnd; c.visible = visible !== false;
    G.lastTick = -1;
    for (const i of [0, 1]) $('.clock', panelOf(i)).classList.toggle('idle', !(c.visible && i === owner));
    drawClock();
  }
  function stopClock() {
    G.clock.running = false; G.plan = null;
    for (const i of [0, 1]) { const c = $('.clock', panelOf(i)); c.classList.add('idle'); c.classList.remove('low'); }
  }
  function drawClock() {
    const c = G.clock;
    if (c.owner < 0 || !c.visible) return;
    const bar = $('.clock', panelOf(c.owner));
    const f = Math.max(0, c.left / c.total);
    bar.firstElementChild.style.transform = `scaleX(${f})`;
    bar.classList.toggle('low', c.left < 2.2 || f < 0.25);
  }
  function frame(ts) {
    if (!G) return;
    const dt = Math.min(0.1, Math.max(0, (ts - G.lastTs) / 1000)) * G.speed;
    G.lastTs = ts;
    if (!G.paused) {
      if (G.waits.length) {
        const due = [];
        for (const w of G.waits) { w.left -= dt; if (w.left <= 0) due.push(w); }
        if (due.length) { G.waits = G.waits.filter(w => !due.includes(w)); due.forEach(w => w.fn()); }
      }
      const c = G && G.clock;
      if (c && c.running) {
        c.left -= dt; c.elapsed += dt;
        drawClock();
        if (c.visible && c.left <= 3 && c.left > 0) {
          const s = Math.ceil(c.left);
          if (s !== G.lastTick) { G.lastTick = s; Sfx.tick(c.left <= 1.5); }
        }
        if (G.plan && c.elapsed >= G.plan.at) { const p = G.plan; G.plan = null; p.fn(); }
        if (c.running && c.left <= 0) { c.running = false; c.left = 0; drawClock(); if (c.onEnd) c.onEnd(); }
      }
    }
    if (G) G.raf = requestAnimationFrame(frame);
  }

  // ---------- ball ----------
  function courtPoint(side) { // side 0 = bottom (player 0), 1 = top
    const r = $('#court').getBoundingClientRect();
    const x = r.width * (0.3 + Math.random() * 0.4);
    const y = side === 0 ? r.height - 22 : 22;
    return { x, y };
  }
  function flyBall(toSide, done, opts) {
    const o = opts || {};
    const ball = $('#ball');
    const from = G.ballAt || courtPoint(1 - toSide);
    const to = o.out ? { x: from.x + (Math.random() - 0.5) * 80, y: toSide === 0 ? $('#court').clientHeight + 40 : -40 } : courtPoint(toSide);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const dur = (o.fast ? 340 : 520) / G.speed;
    ball.style.opacity = 1;
    const anim = ball.animate([
      { transform: `translate(${from.x}px, ${from.y}px) scale(1) rotate(0deg)` },
      { transform: `translate(${mid.x}px, ${mid.y}px) scale(${o.fast ? 1.25 : 1.55}) rotate(180deg)` },
      { transform: `translate(${to.x}px, ${to.y}px) scale(1) rotate(360deg)` },
    ], { duration: dur, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'forwards' });
    G.ballAt = o.out ? null : to;
    anim.onfinish = () => {
      if (!G) return;
      if (o.out) ball.style.opacity = 0; else Sfx.bounce();
      if (done) done();
    };
  }
  function hideBall() { $('#ball').style.opacity = 0; G.ballAt = null; }

  function banner(text, cls) {
    const b = $('#banner');
    b.innerHTML = `<div class="b b1 ${cls || ''}">${esc(text)}</div><div class="b b0 ${cls || ''}">${esc(text)}</div>`;
    void b.offsetWidth;
    b.classList.add('on');
    $('#court').classList.add('banner-on');
  }
  function hideBanner() { $('#banner').classList.remove('on'); $('#court').classList.remove('banner-on'); }

  // ---------- serve ----------
  function enterServe() {
    const m = G.m, s = m.server, r = 1 - s;
    G.pointBusy = false;
    G.sel = [-1, -1]; G.typed = '';
    hideBanner(); hideBall();
    renderScore(); courtInfo();
    for (const i of [0, 1]) setKeyboard(i, false);
    renderTiles(r, null);
    setMsg(r, esc(t('serveWait', { name: playerName(s) })));
    if (isBot(s)) {
      renderTiles(s, null);
      $('.bot-think', panelOf(s)).hidden = false;
      const choice = G.bots[s].serve(m);
      startClock(s, KT.SERVE_TIME, () => doServe(choice.word), false);
      G.plan = { at: choice.delay, fn: () => doServe(choice.word) };
    } else {
      setMsg(s, esc(t('serveYou')), 'turn');
      renderServeCards(s, m.point.serveOptions);
      startClock(s, KT.SERVE_TIME, () => doServe(m.point.serveOptions[Math.floor(Math.random() * 3)]));
    }
  }

  function doServe(word) {
    const m = G.m;
    if (m.phase !== 'serve' || G.pointBusy) return;
    const s = m.server;
    if (!m.serve(word).ok) return;
    stopClock();
    G.pointBusy = true;
    if (isBot(s)) $('.bot-think', panelOf(s)).hidden = true;
    renderTiles(s, word, { wait: true });
    setMsg(s, esc(t('sentBy', { name: playerName(s) })) + ' <b>' + esc(U(word)) + '</b>');
    Sfx.serve();
    courtInfo();
    G.ballAt = courtPoint(s);
    flyBall(1 - s, () => { G.pointBusy = false; enterTurn(); });
  }

  // ---------- rally ----------
  function enterTurn() {
    const m = G.m;
    if (m.phase !== 'rally') return;
    const p = m.point.turn, o = 1 - p, word = m.point.word;
    const secs = m.shotTime(p);
    G.sel[p] = -1; G.typed = '';
    setKeyboard(o, false);
    if (isBot(p)) {
      renderTiles(p, word, { land: true });
      $('.bot-think', panelOf(p)).hidden = false;
      setMsg(o, esc(t('thinking', { name: playerName(p) })));
      const rep = G.bots[p].reply(m);
      startClock(p, secs, onTimeout);
      if (rep.word && rep.delay < secs) G.plan = { at: rep.delay, fn: () => playShot(p, rep.word) };
    } else {
      renderTiles(p, word, { land: true, active: true });
      setKeyboard(p, true);
      setMsg(p, esc(G.firstShot[p] ? t('firstTurn') : t('yourTurn')), 'turn');
      if (!isBot(o)) setMsg(o, esc(t('thinking', { name: playerName(p) })));
      startClock(p, secs, onTimeout);
    }
  }

  function onTile(i, k, viaKey) {
    const m = G && G.m;
    if (!m || G.paused || m.phase !== 'rally' || m.point.turn !== i || G.pointBusy) return;
    G.sel[i] = G.sel[i] === k ? -1 : k;
    G.kbdSel = !!viaKey && G.sel[i] >= 0;
    G.typed = '';
    renderTiles(i, m.point.word, { sel: G.sel[i], active: true });
    setMsg(i, esc(G.sel[i] >= 0 ? t('pickKey') : t('yourTurn')), 'turn');
    Sfx.tap();
  }

  function onKey(i, ch, keyEl) {
    const m = G && G.m;
    if (!m || G.paused || m.phase !== 'rally' || m.point.turn !== i || G.pointBusy) return;
    Sfx.key();
    if (keyEl) { keyEl.classList.add('down'); setTimeout(() => keyEl.classList.remove('down'), 120); }
    const k = G.sel[i];
    if (k < 0) {
      setMsg(i, esc(t('pickTile')), 'err');
      const tiles = $('.tiles', panelOf(i));
      tiles.classList.remove('land'); void tiles.offsetWidth; tiles.classList.add('land');
      return;
    }
    const cur = m.point.word;
    if (cur[k] === ch) return;
    attempt(i, cur.slice(0, k) + ch + cur.slice(k + 1), k);
  }

  // Try a word for player i (from the on-screen keys or the physical keyboard).
  function attempt(i, word, at) {
    const m = G.m;
    const c = m.check(word);
    if (!c.ok) {
      if (c.reason === 'used' || c.reason === 'unknown') {
        Sfx.err();
        setMsg(i, esc(t(c.reason === 'used' ? 'errUsed' : 'errUnknown', { w: U(word) })), 'err');
        const tiles = $('.tiles', panelOf(i));
        const tile = tiles.children[at];
        if (tile) {
          tile.textContent = U(word[at]);
          tile.classList.remove('bad'); void tile.offsetWidth; tile.classList.add('bad');
          setTimeout(() => { if (G && G.m.point.word === m.point.word && G.m.point.turn === i) { tile.textContent = U(m.point.word[at]); tile.classList.remove('bad'); } }, 520);
        }
      }
      return false;
    }
    playShot(i, word, c.at);
    return true;
  }

  function playShot(p, word) {
    const m = G.m;
    const before = m.point.word;
    const r = m.shot(word);
    if (!r.ok) return;
    G.firstShot[p] = false;
    stopClock();
    G.pointBusy = true;
    if (isBot(p)) $('.bot-think', panelOf(p)).hidden = true;
    const at = G.lex.diff(before, word);
    renderTiles(p, word, { mark: at, wait: true });
    setKeyboard(p, false);
    setMsg(p, esc(t('sentBy', { name: playerName(p) })) + ' <b>' + esc(U(word)) + '</b>');
    courtInfo();
    if (r.how === 'smash') {
      Sfx.smash();
      flyBall(1 - p, () => pointOver(r), { fast: true });
    } else {
      Sfx.hit(1);
      flyBall(1 - p, () => { G.pointBusy = false; enterTurn(); });
    }
  }

  function onTimeout() {
    const m = G.m;
    if (m.phase !== 'rally' || G.pointBusy) return;
    const loser = m.point.turn;
    const r = m.timeout();
    if (!r) return;
    G.pointBusy = true;
    setKeyboard(loser, false);
    Sfx.miss();
    flyBall(loser, () => pointOver(r), { out: true });
  }

  function altsHtml(left) {
    const c = left.common.slice(0, 5), rare = left.rare.slice(0, c.length >= 3 ? 0 : 3);
    if (!c.length && !rare.length) return esc(t('none'));
    let h = '';
    if (c.length) h += esc(t('could')) + ' ' + c.map(w => `<span class="alt">${esc(U(w))}</span>`).join('');
    if (rare.length) h += (c.length ? '<br>' : esc(t('couldRare')) + ' ') + rare.map(w => `<span class="alt rare">${esc(U(w))}</span>`).join('');
    return h;
  }

  function pointOver(r) {
    const m = G.m, w = r.winner, l = 1 - w;
    stopClock();
    renderScore();
    for (const i of [0, 1]) setKeyboard(i, false);
    if (r.how === 'smash') {
      banner(t('smash'), 'smash');
      setMsg(w, esc(t('smashYou', { w: U(r.word) })), 'turn');
      setMsg(l, esc(t('smashThem', { w: U(r.word) })));
    } else {
      banner(G.mode === 'bot' && w === 0 ? t('pointYou') : t('point', { name: playerName(w) }));
      setMsg(w, esc(t('pointYou')), 'turn');
      setMsg(l, esc(t('timeUp')) + ' ' + altsHtml(r.left));
      if (isBot(l)) setMsg(w, esc(t('pointYou')) + ' ' + esc(t('timeUp')), 'turn');
    }
    Sfx.point(G.mode === 'duo' || w === 0);
    if (r.matchOver) {
      wait(2.4, () => { banner(t('game', { name: playerName(w) })); Sfx.match(); });
      wait(4.2, () => endMatch(r));
      return;
    }
    if (r.gameOver) {
      wait(2.4, () => { banner(t('game', { name: playerName(w) })); Sfx.game(); renderScore(); });
      wait(4.4, () => { m.next(); enterServe(); });
      return;
    }
    const delay = r.how === 'time' && !isBot(l) ? 4.6 : 2.8;
    G.skipTo = () => { if (G.skipTo) { G.skipTo = null; G.waits = []; m.next(); enterServe(); } };
    wait(delay, () => { if (G.skipTo) G.skipTo(); });
  }
  $('#court').addEventListener('pointerdown', e => {
    if (e.target.closest('#pauseBtn')) return;
    if (G && G.skipTo && G.m.phase === 'pointOver' && !G.paused) G.skipTo();
  });

  // ---------- physical keyboard ----------
  document.addEventListener('keydown', e => {
    if (!G || G.paused || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { pause(); return; }
    const m = G.m;
    if (m.phase === 'serve' && !isBot(m.server) && /^[1-3]$/.test(e.key)) { doServe(m.point.serveOptions[+e.key - 1]); return; }
    if (m.phase !== 'rally' || G.pointBusy) return;
    const p = m.point.turn;
    if (isBot(p)) return;
    const word = m.point.word;
    if (e.key === 'Backspace') { G.typed = G.typed.slice(0, -1); showTyped(p); e.preventDefault(); return; }
    if (/^[1-9]$/.test(e.key) && +e.key <= word.length) { onTile(p, +e.key - 1, true); return; }
    const ch = KT.lower(e.key, S.lang);
    if (ch.length !== 1 || !G.lex.alpha.includes(ch)) return;
    e.preventDefault();
    // 1-4 then a letter: change that letter. Otherwise type the whole new word.
    if (G.sel[p] >= 0 && G.kbdSel && !G.typed) { G.kbdSel = false; onKey(p, ch); return; }
    G.sel[p] = -1; G.kbdSel = false;
    G.typed += ch;
    if (G.typed.length >= word.length) {
      const typed = G.typed; G.typed = '';
      const at = G.lex.diff(word, typed);
      if (at < 0) { Sfx.err(); setMsg(p, esc(t('yourTurn')), 'err'); renderTiles(p, word, { active: true, land: true }); return; }
      if (!attempt(p, typed, at)) renderTiles(p, word, { active: true });
      return;
    }
    showTyped(p);
  });
  function showTyped(p) {
    const word = G.m.point.word, ty = G.typed;
    renderTiles(p, ty + word.slice(ty.length), { active: true, typed: ty.length || undefined });
  }

  // ---------- pause ----------
  function pause() {
    if (!G || G.paused || G.m.phase === 'matchOver') return;
    G.paused = true;
    $('#pauseSheet').hidden = false;
  }
  function resume() {
    if (!G) return;
    G.paused = false;
    G.lastTs = performance.now();
    $('#pauseSheet').hidden = true;
  }
  $('#pauseBtn').addEventListener('click', e => { e.stopPropagation(); pause(); });
  $('#resumeBtn').addEventListener('click', resume);
  $('#quitBtn').addEventListener('click', () => { $('#pauseSheet').hidden = true; toMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  function toMenu() {
    stopGame();
    $('#game').classList.remove('on');
    $('#menu').classList.add('on');
    $('#endSheet').hidden = true;
    syncMenu();
  }

  // ---------- end ----------
  function endMatch(r) {
    const m = G.m, w = m.winner;
    stopClock();
    const save = loadSave();
    if (G.mode === 'bot') {
      if (w === 0) save.bot[S.level].w++; else save.bot[S.level].l++;
      save.smashes += m.stats.smashes[0];
    } else {
      save.duo++;
      save.smashes += m.stats.smashes[0] + m.stats.smashes[1];
    }
    if (m.stats.longest > save.longest) { save.longest = m.stats.longest; save.longestWords = m.stats.longestWords; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
    const scoreLine = S.format === 1 ? `${r.gamePoints[0]}–${r.gamePoints[1]}` : `${m.games[0]}–${m.games[1]}`;
    const mins = Math.max(1, Math.round((Date.now() - G.started) / 60000));
    labNote(G.mode === 'bot'
      ? `Bota karşı (${S.level}): ${w === 0 ? 'kazandı' : 'kaybetti'} ${scoreLine} · en uzun ralli ${m.stats.longest} · ${m.stats.smashes[0]} smaç · ${mins} dk`
      : `Maç bitti: ${playerName(0)} ${scoreLine} ${playerName(1)} · en uzun ralli ${m.stats.longest} · smaç ${m.stats.smashes[0]}–${m.stats.smashes[1]} · ${mins} dk`);

    const title = G.mode === 'bot' ? (w === 0 ? t('youWin') : t('botWins')) : t('winTitle', { name: playerName(w) });
    $('#endTitle').textContent = title;
    $('#endScore').textContent = `${playerName(0)} ${scoreLine} ${playerName(1)}`;
    const items = [];
    if (m.stats.longestWords.length) items.push(t('statLongest', { n: m.stats.longest }) + '<br>' + m.stats.longestWords.map(x => esc(U(x))).join(' → '));
    items.push(t('statSmash', { a: G.mode === 'bot' ? m.stats.smashes[0] + '–' + m.stats.smashes[1] : `${esc(playerName(0))} ${m.stats.smashes[0]} · ${esc(playerName(1))} ${m.stats.smashes[1]}` }));
    if (G.mode === 'duo') items.push(t('statWords', { a: `${esc(playerName(0))} ${m.stats.words[0]} · ${esc(playerName(1))} ${m.stats.words[1]}` }));
    $('#endStats').innerHTML = items.map(x => '<li>' + x + '</li>').join('');
    const sheet = $('#endSheet');
    sheet.classList.toggle('duo', G.mode === 'duo');
    $('#endMirror').innerHTML = `<h2>${esc(title)}</h2><p class="end-score">${esc(playerName(1))} ${scoreLine.split('–').reverse().join('–')} ${esc(playerName(0))}</p>`;
    sheet.hidden = false;
  }
  $('#againBtn').addEventListener('click', () => { const fs = G ? 1 - G.firstServer : 0; startMatch(S.mode === 'bot' ? 0 : fs); });
  $('#menuBtn').addEventListener('click', toMenu);

  // ---------- layout ----------
  function layout() {
    if (!G) return;
    const n = S.len;
    for (const i of [0, 1]) {
      const p = panelOf(i);
      if (isBot(i)) { p.style.removeProperty('--tw'); continue; }
      const W = Math.min(p.clientWidth - 20, 640), Hh = p.clientHeight - 20;
      const rowMax = Math.max(...KT.KEYS[S.lang].map(r => r.length));
      const kw = Math.max(22, Math.min(58, Math.floor(W / (rowMax + (rowMax - 1) * 0.16))));
      let tw = Math.min(104, Math.floor(W / (n + (n - 1) * 0.12)) - 4, Math.floor(Hh * 0.22));
      tw = Math.max(36, tw);
      const fixed = 30 + 46 + 9 + 8 * 4 + tw * 1.14 + 8;    // head, two-line message, clock, gaps, tiles
      const kh = Math.max(30, Math.min(Math.round(kw * 1.5), Math.floor((Hh - fixed - kw * 0.36) / 3)));
      p.style.setProperty('--tw', tw + 'px');
      p.style.setProperty('--kw', kw + 'px');
      p.style.setProperty('--kh', kh + 'px');
    }
  }
  window.addEventListener('resize', layout);

  // ---------- start ----------
  $('#rotateNote').classList.add('need');
  syncMenu();
  if (!S.seenHow && !readJSON(SAVE_KEY)) setTimeout(openHow, 400);

  if (DEBUG) {
    window.__kt = {
      KT, S, T, lexFor, startMatch, toMenu, pause, resume, attempt, playShot,
      get G() { return G; },
      set speed(v) { if (G) G.speed = v; },
      timeout() { if (G && G.clock.running) G.clock.left = 0.001; },
    };
  }
})();
