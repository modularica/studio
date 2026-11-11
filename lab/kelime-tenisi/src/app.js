// Kelime Düellosu arayüzü: menü, iki kişi tek ekran (karşılıklı), bota karşı, kayıt ve Lab bağlantıları.
// Adres ve kayıt anahtarları ilk adla (kelime-tenisi) kalıyor: paylaşılan link ve kayıtlar bozulmasın.
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
      title: 'Kelime Düellosu', tagline: 'Tek harfini değiştir, geri gönder.',
      duo: 'İki kişi', duoSub: 'Tek ekran, karşılıklı otur', bot: 'Bota karşı', botSub: 'Tek başına antrenman',
      level: 'Bot', kolay: 'Kolay', orta: 'Orta', zor: 'Zor', bonus: 'Ek süre (handikap)',
      word: 'Kelime', len3: '3 harf', len4: '4 harf', pace: 'Süre', rahat: 'Rahat', normal: 'Normal', hizli: 'Hızlı',
      ekli: 'Ekli kelimeler', ekliOn: 'Geçer', ekliOff: 'Geçmez', ekliHint: 'EVDE, ALDI, BANA gibi',
      format: 'Maç', short: 'Kısa · {n} sayı', long: 'Uzun · {n} sayı', start: 'Başla', how: 'Nasıl oynanır?',
      soundOn: 'Ses açık', soundOff: 'Ses kapalı', paused: 'Mola', resume: 'Devam', quit: 'Ana menü',
      nasildi: 'Nasıldı?', again: 'Rövanş', menu: 'Ana menü', gotIt: 'Anladım',
      rotate: 'Oyun dik ekran için. Telefonu dik tut.',
      p1: 'Oyuncu 1', p2: 'Oyuncu 2', botName: 'Bot', you: 'Sen',
      startYou: 'Sen başlıyorsun: bir kelime seç', startWait: '{name} kelime seçiyor',
      firstTurn: 'Önce değiştireceğin harfe, sonra yeni harfe dokun', yourTurn: 'Bir harfini değiştir',
      pickKey: 'Şimdi yeni harfi seç', pickTile: 'Önce değiştireceğin harfe dokun',
      thinking: '{name} düşünüyor', sentBy: '{name} gönderdi', sentYou: 'Gönderdin',
      errUsed: '{w} bu sayıda oynandı', errUnknown: '{w} sözlükte yok',
      point: 'Sayı {name}!', pointYou: 'Sayı senin!', dead: 'ÇIKMAZ!', deadYou: 'Çıkmaz! {w} kelimesinden çıkış yok.',
      deadThem: '{w} kelimesinden çıkış yoktu.', timeUp: 'Süre bitti.',
      could: 'Şunları yazabilirdin:', couldRare: 'Sözlükte bir de:', none: 'Bu kelimeden çıkış yoktu.',
      matchPoint: 'Maç sayısı · {name}', firstPick: 'Yazı tura: {name} başlıyor', starting: 'Başlayan: {name}',
      winTitle: '{name} kazandı!', youWin: 'Kazandın!', botWins: 'Bot kazandı',
      statLongest: 'En uzun zincir: <b>{n} kelime</b>', statDead: 'Çıkmaz: <b>{a}</b>', statWords: 'Gönderilen kelime: <b>{a}</b>',
      record: 'Bota karşı: {w} galibiyet, {l} yenilgi', recordChain: 'En uzun zincir: {n} kelime',
      how1: '<b>Başla:</b> üç kelimeden birini seç, karşıya gönder.',
      how2: '<b>Cevap ver:</b> gelen kelimenin <b>tek harfini</b> değiştir. Önce harfe, sonra yeni harfe dokun.',
      how3: '<b>Süre</b> her kelimede biraz kısalır; süresinde cevap veremeyen sayıyı kaybeder. Bir kelime bir sayıda bir kez oynanır.',
      how4: '<b>Çıkmaz:</b> hiç çıkışı olmayan bir kelime gönderirsen sayı hemen senin.',
      howEkli: '<b>Ekli kelimeler de geçer:</b> EVDE, ALDI, BANA. Kökü belli olan kelimenin kökü yanında küçük yazar.',
      howWin: '<b>{n} sayıya</b> ilk ulaşan kazanır. Her sayıda başlayan değişir.',
      demo: ['kasa', 'kara', 'kare'], logo: ['kasa', 'kara'],
    },
    en: {
      title: 'Word Duel', tagline: 'Change one letter, send it back.',
      duo: 'Two players', duoSub: 'One screen, face to face', bot: 'Against the bot', botSub: 'Practice on your own',
      level: 'Bot', kolay: 'Easy', orta: 'Medium', zor: 'Hard', bonus: 'Extra time (handicap)',
      word: 'Words', len3: '3 letters', len4: '4 letters', pace: 'Time', rahat: 'Relaxed', normal: 'Normal', hizli: 'Fast',
      ekli: 'Inflected words', ekliOn: 'Allowed', ekliOff: 'Not allowed', ekliHint: '',
      format: 'Match', short: 'Short · {n} points', long: 'Long · {n} points', start: 'Play', how: 'How to play',
      soundOn: 'Sound on', soundOff: 'Sound off', paused: 'Paused', resume: 'Resume', quit: 'Main menu',
      nasildi: 'How was it?', again: 'Rematch', menu: 'Main menu', gotIt: 'Got it',
      rotate: 'This game is played upright. Turn your phone.',
      p1: 'Player 1', p2: 'Player 2', botName: 'Bot', you: 'You',
      startYou: 'You start: pick a word', startWait: '{name} is picking a word',
      firstTurn: 'Tap the letter to change, then the new letter', yourTurn: 'Change one letter',
      pickKey: 'Now pick the new letter', pickTile: 'First tap the letter you want to change',
      thinking: '{name} is thinking', sentBy: '{name} sent', sentYou: 'You sent',
      errUsed: '{w} was already played this point', errUnknown: '{w} is not in the dictionary',
      point: 'Point {name}!', pointYou: 'Your point!', dead: 'DEAD END!', deadYou: 'Dead end! There is no way out of {w}.',
      deadThem: 'There was no way out of {w}.', timeUp: 'Out of time.',
      could: 'You could have played:', couldRare: 'The dictionary also has:', none: 'There was no way out of that word.',
      matchPoint: 'Match point · {name}', firstPick: 'Coin toss: {name} starts', starting: 'Starting: {name}',
      winTitle: '{name} wins!', youWin: 'You win!', botWins: 'The bot wins',
      statLongest: 'Longest chain: <b>{n} words</b>', statDead: 'Dead ends: <b>{a}</b>', statWords: 'Words sent: <b>{a}</b>',
      record: 'Against the bot: {w} won, {l} lost', recordChain: 'Longest chain: {n} words',
      how1: '<b>Start:</b> pick one of three words and send it over.',
      how2: '<b>Answer:</b> change <b>one letter</b> of the word that comes to you. Tap the letter, then the new letter.',
      how3: '<b>Time</b> gets a little shorter with every word; miss it and you lose the point. A word can be played once per point.',
      how4: '<b>Dead end:</b> send a word with no way out and the point is yours at once.',
      howEkli: '',
      howWin: 'First to <b>{n} points</b> wins. The starting player changes every point.',
      demo: ['cold', 'cord', 'word'], logo: ['cold', 'cord'],
    },
  };
  const t = (k, vars) => {
    let s = (T[S.lang] && T[S.lang][k]) || T.tr[k] || k;
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const U = w => KT.upper(w, S.lang);

  // ---------- settings ----------
  // Turkish first, whatever the device language. English only once someone taps it
  // (langPicked); older saves picked 'en' from navigator.language, so they reset.
  const S = Object.assign({
    lang: 'tr', langPicked: false, ekli: true,
    mode: 'duo', level: 'orta', len: 4, pace: 'normal', format: 1,
    names: ['', ''], bonus: [0, 0], sound: true, seenHow: false,
  }, readJSON(DEVICE_KEY) || {});
  if (!S.langPicked || !T[S.lang]) S.lang = 'tr';
  if (![3, 4].includes(+S.len)) S.len = 4;
  S.len = +S.len; S.format = +S.format === 2 ? 2 : 1; S.ekli = S.ekli !== false;
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function saveDevice() { try { localStorage.setItem(DEVICE_KEY, JSON.stringify(S)); } catch (e) {} }
  function loadSave() {
    const d = readJSON(SAVE_KEY) || {};
    d.v = 1;
    d.bot = d.bot || {};
    for (const l of ['kolay', 'orta', 'zor']) d.bot[l] = Object.assign({ w: 0, l: 0 }, d.bot[l] || {});
    d.duo = d.duo || 0; d.longest = d.longest || 0; d.longestWords = d.longestWords || [];
    d.deadEnds = d.deadEnds || d.smashes || 0;   // "smashes" in the first version
    delete d.smashes;
    return d;
  }
  const ekliOn = () => S.lang === 'tr' && S.ekli;
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
  const lexFor = (lang, len, ekli) => {
    const k = lang + len + (ekli ? 'x' : '');
    return lexCache[k] || (lexCache[k] = new KT.Lexicon(WORDS, lang, len, { ekli }));
  };

  // ---------- menu ----------
  function renderLogo() {
    const [a, b] = t('logo'), at = [...a].findIndex((c, i) => c !== b[i]);
    $('#logo').innerHTML = [...a].map((c, i) => i === at
      ? `<span class="lt swap"><b>${esc(U(c))}</b><b>${esc(U(b[i]))}</b></span>`
      : `<span class="lt">${esc(U(c))}</span>`).join('');
  }
  function applyTexts() {
    document.documentElement.lang = S.lang;
    document.title = t('title');
    $$('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    $('[data-set=format] [data-v="1"]').textContent = t('short', { n: KT.TARGET[1] });
    $('[data-set=format] [data-v="2"]').textContent = t('long', { n: KT.TARGET[2] });
    $('#name1').placeholder = t('p1');
    $('#name2').placeholder = t('p2');
    $('#soundBtn').textContent = S.sound ? t('soundOn') : t('soundOff');
    renderLogo();
    const save = loadSave();
    const w = save.bot.kolay.w + save.bot.orta.w + save.bot.zor.w, l = save.bot.kolay.l + save.bot.orta.l + save.bot.zor.l;
    const parts = [];
    if (w + l) parts.push(t('record', { w, l }));
    if (save.longest) parts.push(t('recordChain', { n: save.longest }));
    $('#record').textContent = parts.join(' · ');
    const how = ['how1', 'how2', 'how3', 'how4'].map(k => t(k));
    if (ekliOn()) how.push(t('howEkli'));
    how.push(t('howWin', { n: KT.TARGET[S.format] }));
    $('#howList').innerHTML = how.map(h => '<li>' + h + '</li>').join('');
  }
  function syncMenu() {
    $$('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
    $$('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
    $('#setupBot').classList.toggle('on', S.mode === 'bot');
    $('#setupDuo').classList.toggle('on', S.mode === 'duo');
    $('#ekliOpt').hidden = S.lang !== 'tr';
    const val = { level: S.level, len: String(S.len), pace: S.pace, format: String(S.format), ekli: S.ekli ? '1' : '0', bonus0: String(S.bonus[0]), bonus1: String(S.bonus[1]) };
    $$('[data-set]').forEach(g => $$('.chip', g).forEach(c => c.classList.toggle('on', c.dataset.v === val[g.dataset.set])));
    $('#name1').value = S.names[0] || '';
    $('#name2').value = S.names[1] || '';
    applyTexts();
  }
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => { S.lang = b.dataset.lang; S.langPicked = true; saveDevice(); syncMenu(); Sfx.tap(); }));
  $$('.mode').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; saveDevice(); syncMenu(); Sfx.tap(); }));
  $$('[data-set]').forEach(g => $$('.chip', g).forEach(c => c.addEventListener('click', () => {
    const k = g.dataset.set, v = c.dataset.v;
    if (k === 'level') S.level = v;
    else if (k === 'len') S.len = +v;
    else if (k === 'pace') S.pace = v;
    else if (k === 'format') S.format = +v;
    else if (k === 'ekli') S.ekli = v === '1';
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

  function startMatch(firstStarter) {
    stopGame();
    const ekli = ekliOn();
    const lex = lexFor(S.lang, S.len, ekli);
    const mode = S.mode;
    const players = [0, 1].map(i => ({ name: '', bonus: mode === 'duo' ? S.bonus[i] : 0 }));
    const fs = firstStarter !== undefined ? firstStarter : (mode === 'bot' ? 0 : (Math.random() < 0.5 ? 0 : 1));
    const m = new KT.Match({ lex, players, target: KT.TARGET[S.format], pace: S.pace, firstStarter: fs });
    G = {
      m, lex, mode, firstStarter: fs,
      bots: [null, mode === 'bot' ? new KT.Bot(S.level) : null],
      panels: [$('#panel0'), $('#panel1')],
      sel: [-1, -1], typed: '',
      clock: { owner: -1, total: 1, left: 0, elapsed: 0, running: false, onEnd: null },
      plan: null, waits: [], paused: false, speed: 1, lastTs: performance.now(), raf: 0, lastTick: -1,
      firstShot: [true, true], started: Date.now(), pointBusy: false,
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
    labNote(`Maç başladı: ${mode === 'bot' ? 'bota karşı (' + S.level + ')' : 'iki kişi'}, ${S.lang === 'tr' ? 'Türkçe' : 'İngilizce'}${S.lang === 'tr' ? (ekli ? ', ekliler geçer' : ', yalnız sözlük') : ''}, ${S.len} harf, ${S.pace}, ${KT.TARGET[S.format]} sayı`);
    if (mode === 'duo') {
      banner(t('firstPick', { name: playerName(fs) }));
      wait(1.6, () => { hideBanner(); enterStart(); });
    } else {
      enterStart();
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
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="bot-think" hidden><i></i><i></i><i></i></span><span class="dots"></span><span class="pscore"></span></div>
        <div class="tiles small"></div><div class="clock idle"><i></i></div>`;
    } else {
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="dots"></span><span class="pscore"></span></div>
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
      sc.textContent = m.points[i] + '–' + m.points[1 - i];
      sc.classList.toggle('hot', !!m.pointFor(i));
      $('.dots', p).innerHTML = Array.from({ length: m.target }, (_, k) => `<i class="${k < m.points[i] ? 'won' : ''}"></i>`).join('');
    }
  }

  function setMsg(i, html, cls) {
    if (isBot(i)) return;
    const el = $('.msg', panelOf(i));
    el.className = 'msg' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }

  const sentText = i => (G.mode === 'bot' && i === 0 ? t('sentYou') : t('sentBy', { name: playerName(i) }));
  // "ALDI (almak)": the dictionary word an inflected form comes from, when it is clear.
  const rootTag = w => { const r = G.lex.root(w); return r ? ` <span class="root">(${esc(r)})</span>` : ''; };

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

  function renderStartCards(i, words) {
    const el = $('.tiles', panelOf(i));
    el.className = 'tiles';
    el.innerHTML = '<div class="start-cards">' + words.map(w => `<button type="button" class="start-card" data-w="${esc(w)}">${esc(U(w))}</button>`).join('') + '</div>';
    $$('.start-card', el).forEach(b => b.addEventListener('click', () => {
      if (G.m.phase !== 'start' || G.m.starter !== i || G.pointBusy) return;
      b.classList.add('pick');
      doStart(b.dataset.w);
    }));
  }

  function setKeyboard(i, on) {
    if (isBot(i)) return;
    $('.kbd', panelOf(i)).classList.toggle('off', !on);
  }

  // Middle strip: who starts / match point, or the last words of the chain.
  function boardInfo() {
    const m = G.m, pt = m.point;
    let txt = '';
    if (m.phase === 'start') {
      const mp = [0, 1].find(i => m.pointFor(i));
      txt = esc(mp !== undefined ? t('matchPoint', { name: playerName(mp) }) : t('starting', { name: playerName(m.starter) }));
    } else if (pt && pt.shots.length) {
      const words = pt.shots.slice(-3).map(s => s.word);
      txt = '<span class="chain">' + words.map((w, k) => `<span class="${k === words.length - 1 ? 'last' : ''}">${esc(U(w))}${k === words.length - 1 ? rootTag(w) : ''}</span>`).join('') +
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

  // ---------- the word crossing the board ----------
  function boardPoint(side) { // side 0 = bottom (player 0), 1 = top
    const r = $('#board').getBoundingClientRect();
    return { x: r.width / 2, y: side === 0 ? r.height - 24 : 24 };
  }
  // A player's facing: the top player sits across the table in duo mode.
  const facing = side => (G.mode === 'duo' && side === 1 ? 180 : 0);
  function flyWord(fromSide, word, done, opts) {
    const o = opts || {};
    const el = $('#flyer');
    el.innerHTML = [...word].map(c => `<span>${esc(U(c))}</span>`).join('');
    el.classList.toggle('dead', !!o.dead);
    const w = el.offsetWidth, h = el.offsetHeight;
    const at = (p, rot, s) => `translate(${p.x - w / 2}px, ${p.y - h / 2}px) rotate(${rot}deg) scale(${s})`;
    const from = boardPoint(fromSide);
    const dur = (o.fast ? 380 : 560) / G.speed;
    el.style.opacity = 1;
    let frames;
    if (o.out) {   // time ran out: the word stays with the player who could not answer, and fades
      const away = { x: from.x, y: from.y + (fromSide === 0 ? 30 : -30) };
      frames = [{ transform: at(from, facing(fromSide), 1), opacity: 1 }, { transform: at(away, facing(fromSide), 0.8), opacity: 0 }];
    } else {
      const to = boardPoint(1 - fromSide), mid = { x: from.x, y: (from.y + to.y) / 2 };
      const r0 = facing(fromSide), r1 = facing(1 - fromSide);
      frames = [
        { transform: at(from, r0, 0.85), opacity: 1 },
        { transform: at(mid, (r0 + r1) / 2, o.dead ? 1.35 : 1.15), opacity: 1 },
        { transform: at(to, r1, 0.95), opacity: 1 },
      ];
    }
    const anim = el.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
    anim.onfinish = () => {
      if (!G) return;
      el.style.opacity = 0;
      anim.cancel();
      if (!o.out) Sfx.land();
      if (done) done();
    };
  }
  function hideFlyer() { $('#flyer').style.opacity = 0; }

  function banner(text, cls) {
    const b = $('#banner');
    b.innerHTML = `<div class="b b1 ${cls || ''}">${esc(text)}</div><div class="b b0 ${cls || ''}">${esc(text)}</div>`;
    void b.offsetWidth;
    b.classList.add('on');
    $('#board').classList.add('banner-on');
  }
  function hideBanner() { $('#banner').classList.remove('on'); $('#board').classList.remove('banner-on'); }

  // ---------- starting word ----------
  function enterStart() {
    const m = G.m, s = m.starter, r = 1 - s;
    G.pointBusy = false;
    G.sel = [-1, -1]; G.typed = '';
    hideBanner(); hideFlyer();
    renderScore(); boardInfo();
    for (const i of [0, 1]) setKeyboard(i, false);
    renderTiles(r, null);
    setMsg(r, esc(t('startWait', { name: playerName(s) })));
    if (isBot(s)) {
      renderTiles(s, null);
      $('.bot-think', panelOf(s)).hidden = false;
      const choice = G.bots[s].open(m);
      startClock(s, KT.START_TIME, () => doStart(choice.word), false);
      G.plan = { at: choice.delay, fn: () => doStart(choice.word) };
    } else {
      setMsg(s, esc(t('startYou')), 'turn');
      renderStartCards(s, m.point.options);
      startClock(s, KT.START_TIME, () => doStart(m.point.options[Math.floor(Math.random() * 3)]));
    }
  }

  function doStart(word) {
    const m = G.m;
    if (m.phase !== 'start' || G.pointBusy) return;
    const s = m.starter;
    if (!m.start(word).ok) return;
    stopClock();
    G.pointBusy = true;
    if (isBot(s)) $('.bot-think', panelOf(s)).hidden = true;
    renderTiles(s, word, { wait: true });
    setMsg(s, esc(sentText(s)) + ' <b>' + esc(U(word)) + '</b>');
    Sfx.start();
    boardInfo();
    flyWord(s, word, () => { G.pointBusy = false; enterTurn(); });
  }

  // ---------- answers ----------
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
        const key = c.reason === 'used' ? 'errUsed' : 'errUnknown';
        setMsg(i, esc(t(key, { w: U(word) })), 'err');
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
    setMsg(p, esc(sentText(p)) + ' <b>' + esc(U(word)) + '</b>' + rootTag(word));
    boardInfo();
    if (r.how === 'dead') {
      Sfx.deadEnd();
      flyWord(p, word, () => pointOver(r), { fast: true, dead: true });
    } else {
      Sfx.send();
      flyWord(p, word, () => { G.pointBusy = false; enterTurn(); });
    }
  }

  function onTimeout() {
    const m = G.m;
    if (m.phase !== 'rally' || G.pointBusy) return;
    const loser = m.point.turn, word = m.point.word;
    const r = m.timeout();
    if (!r) return;
    G.pointBusy = true;
    setKeyboard(loser, false);
    Sfx.timeUp();
    flyWord(loser, word, () => pointOver(r), { out: true });
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
    if (r.how === 'dead') {
      banner(t('dead'), 'dead');
      setMsg(w, esc(t('deadYou', { w: U(r.word) })), 'turn');
      setMsg(l, esc(t('deadThem', { w: U(r.word) })));
    } else {
      banner(G.mode === 'bot' && w === 0 ? t('pointYou') : t('point', { name: playerName(w) }));
      setMsg(w, esc(t('pointYou')), 'turn');
      setMsg(l, esc(t('timeUp')) + ' ' + altsHtml(r.left));
      if (isBot(l)) setMsg(w, esc(t('pointYou')) + ' ' + esc(t('timeUp')), 'turn');
    }
    Sfx.point(G.mode === 'duo' || w === 0);
    if (r.matchOver) {
      wait(2.4, () => { banner(G.mode === 'bot' ? (w === 0 ? t('youWin') : t('botWins')) : t('winTitle', { name: playerName(w) })); Sfx.win(); });
      wait(4.2, () => endMatch(r));
      return;
    }
    const delay = r.how === 'time' && !isBot(l) ? 4.6 : 2.8;
    G.skipTo = () => { if (G.skipTo) { G.skipTo = null; G.waits = []; m.next(); enterStart(); } };
    wait(delay, () => { if (G.skipTo) G.skipTo(); });
  }
  $('#board').addEventListener('pointerdown', e => {
    if (e.target.closest('#pauseBtn')) return;
    if (G && G.skipTo && G.m.phase === 'pointOver' && !G.paused) G.skipTo();
  });

  // ---------- physical keyboard ----------
  document.addEventListener('keydown', e => {
    if (!G || G.paused || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { pause(); return; }
    const m = G.m;
    if (m.phase === 'start' && !isBot(m.starter) && /^[1-3]$/.test(e.key)) { doStart(m.point.options[+e.key - 1]); return; }
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
  function endMatch() {
    const m = G.m, w = m.winner;
    stopClock();
    const save = loadSave();
    if (G.mode === 'bot') {
      if (w === 0) save.bot[S.level].w++; else save.bot[S.level].l++;
      save.deadEnds += m.stats.deadEnds[0];
    } else {
      save.duo++;
      save.deadEnds += m.stats.deadEnds[0] + m.stats.deadEnds[1];
    }
    if (m.stats.longest > save.longest) { save.longest = m.stats.longest; save.longestWords = m.stats.longestWords; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
    const scoreLine = `${m.points[0]}–${m.points[1]}`;
    const mins = Math.max(1, Math.round((Date.now() - G.started) / 60000));
    labNote(G.mode === 'bot'
      ? `Bota karşı (${S.level}): ${w === 0 ? 'kazandı' : 'kaybetti'} ${scoreLine} · en uzun zincir ${m.stats.longest} · ${m.stats.deadEnds[0]} çıkmaz · ${mins} dk`
      : `Maç bitti: ${playerName(0)} ${scoreLine} ${playerName(1)} · en uzun zincir ${m.stats.longest} · çıkmaz ${m.stats.deadEnds[0]}–${m.stats.deadEnds[1]} · ${mins} dk`);

    const title = G.mode === 'bot' ? (w === 0 ? t('youWin') : t('botWins')) : t('winTitle', { name: playerName(w) });
    $('#trophy').innerHTML = `<div class="tile gold">${esc(U([...playerName(w)][0] || '★'))}</div>`;
    $('#endTitle').textContent = title;
    $('#endScore').textContent = `${playerName(0)} ${scoreLine} ${playerName(1)}`;
    const items = [];
    if (m.stats.longestWords.length) items.push(t('statLongest', { n: m.stats.longest }) + '<br>' + m.stats.longestWords.map(x => esc(U(x))).join(' → '));
    items.push(t('statDead', { a: G.mode === 'bot' ? m.stats.deadEnds[0] + '–' + m.stats.deadEnds[1] : `${esc(playerName(0))} ${m.stats.deadEnds[0]} · ${esc(playerName(1))} ${m.stats.deadEnds[1]}` }));
    if (G.mode === 'duo') items.push(t('statWords', { a: `${esc(playerName(0))} ${m.stats.words[0]} · ${esc(playerName(1))} ${m.stats.words[1]}` }));
    $('#endStats').innerHTML = items.map(x => '<li>' + x + '</li>').join('');
    const sheet = $('#endSheet');
    sheet.classList.toggle('duo', G.mode === 'duo');
    $('#endMirror').innerHTML = `<h2>${esc(title)}</h2><p class="end-score">${esc(playerName(1))} ${m.points[1]}–${m.points[0]} ${esc(playerName(0))}</p>`;
    sheet.hidden = false;
  }
  $('#againBtn').addEventListener('click', () => { const fs = G ? 1 - G.firstStarter : 0; startMatch(S.mode === 'bot' ? 0 : fs); });
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
