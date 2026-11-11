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
      online: 'İki telefondan', onlineSub: 'Oda kur ya da açık odaya katıl',
      roomLead: 'Bir oda kur. Rakibin oyunu açınca menüdeki “Açık odalar”da odanı görür ve “Katıl”a basar. İstersen “Arkadaşını çağır” ile link de gönderebilirsin. Herkes kendi telefonundan oynar; bir odada iki kişi olur.',
      roomAlone: 'Rakibin oyunu açınca menüdeki “Açık odalar”da odanı görüp “Katıl”a basacak. İstersen “Arkadaşını çağır” ile link de gönder.',
      rooms: 'Açık odalar', roomsNone: 'Şu an açık oda yok. Biri “İki telefondan” ile oda kurunca burada görünür.',
      roomName: '{name} odası', roomWait: 'rakip bekliyor', roomPlaying: 'maç sürüyor', join: 'Katıl', full: 'Dolu',
      roomLang: 'Dil', pts: '{n} sayı', netWait: '{name} bekleniyor…', netFull: 'Bu odada maç sürüyor.',
      level: 'Bot', kolay: 'Kolay', orta: 'Orta', zor: 'Zor', bonus: 'Ek süre (handikap)',
      word: 'Kelime', len3: '3 harf', len4: '4 harf', pace: 'Süre', rahat: 'Rahat', normal: 'Normal', hizli: 'Hızlı', saat: 'Saat',
      bankLabel: 'Herkesin süresi (bütün maç)', secs: '{n} sn', bonusClock: 'Her kelimede ek süre (handikap)',
      bankHint: 'Saat yalnız kendi sıranda akar. Her kelime +{inc} sn. Süresi biten maçı kaybeder.',
      give: 'Sayıyı ver', gaveYou: 'Sayıyı verdin.', gaveThem: '{name} sayıyı verdi.',
      flagYou: 'Süren bitti!', flagThem: '{name}: süre bitti!', flagWin: 'Rakibinin süresi bitti!', byFlag: 'süre bitti',
      statClock: 'Kalan süre: <b>{a}</b>',
      resize: 'Uzat / Kısalt', resizeOff: 'Kapalı', resize2: 'Maçta 2 hak', resizeAll: 'Her zaman',
      resizeHint: 'Bir harf ekleyip (KALE → KALEM) ya da çıkarıp (KALEM → KALE) gönder. Kelime 3–5 harf olur.',
      addBtn: 'Ekle +', delBtn: '− Çıkar', rights: '{n} hak', noRights: 'hak kalmadı',
      pickSlot: 'Yeni harfin gireceği yere dokun', pickDel: 'Çıkaracağın harfe dokun',
      errNoResize: 'Uzat/kısalt hakkın kalmadı', errLength: 'Kelime 3–5 harf olur',
      howResize: '<b>Uzat / Kısalt:</b> {when} kelimeye bir harf ekleyebilir (KALE → KALEM) ya da çıkarabilirsin (KALEM → KALE); kelime 3–5 harf olur. <b>Ekle +</b>, sonra harfin gireceği yer ve yeni harf; <b>− Çıkar</b>, sonra çıkacak harf.',
      when2: 'maçta 2 kez', whenAll: 'istediğin zaman', statResize: 'Uzat/kısalt: <b>{a}</b>',
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
      howClock: '<b>Saat:</b> herkesin bütün maç için {n} saniyesi var. Saat yalnız kendi sıranda akar, her kelime +{inc} sn getirir. Süresi biten maçı kaybeder. Takılırsan <b>Sayıyı ver</b>: sayı rakibe gider, kalan süren seninle kalır. Bir kelime bir sayıda bir kez oynanır.',
      how4: '<b>Çıkmaz:</b> hiç çıkışı olmayan bir kelime gönderirsen sayı hemen senin.',
      howWords: '<b>Kelimeler:</b> sözlükteki kelimeler geçer; fiiller -mek\'siz yazılır (GEL, ANLA). Ekli haller geçmez (EVDE, ALDI).',
      howWin: '<b>{n} sayıya</b> ilk ulaşan kazanır. Her sayıda başlayan değişir.',
      demo: ['kasa', 'kara', 'kare'], logo: ['kasa', 'kara'],
    },
    en: {
      title: 'Word Duel', tagline: 'Change one letter, send it back.',
      duo: 'Two players', duoSub: 'One screen, face to face', bot: 'Against the bot', botSub: 'Practice on your own',
      online: 'Two phones', onlineSub: 'Start a room or join an open one',
      roomLead: 'Start a room. When your opponent opens the game, they see it under “Open rooms” on the menu and tap “Join”. You can also send the link with “Invite a friend”. Each of you plays on your own phone; two players per room.',
      roomAlone: 'When your opponent opens the game, they will see your room under “Open rooms” on the menu and tap “Join”. You can also send the link with “Invite a friend”.',
      rooms: 'Open rooms', roomsNone: 'No open rooms right now. When someone starts one with “Two phones”, it shows up here.',
      roomName: '{name}', roomWait: 'waiting for a player', roomPlaying: 'match on', join: 'Join', full: 'Full',
      roomLang: 'Language', pts: '{n} points', netWait: 'Waiting for {name}…', netFull: 'A match is on in this room.',
      level: 'Bot', kolay: 'Easy', orta: 'Medium', zor: 'Hard', bonus: 'Extra time (handicap)',
      word: 'Words', len3: '3 letters', len4: '4 letters', pace: 'Time', rahat: 'Relaxed', normal: 'Normal', hizli: 'Fast', saat: 'Clock',
      bankLabel: 'Each player\'s time (whole match)', secs: '{n} s', bonusClock: 'Extra time per word (handicap)',
      bankHint: 'Your clock runs only on your turn. Every word adds {inc} s. Run out and you lose the match.',
      give: 'Give up point', gaveYou: 'You gave the point away.', gaveThem: '{name} gave the point away.',
      flagYou: 'Your time is up!', flagThem: '{name} is out of time!', flagWin: 'Your opponent is out of time!', byFlag: 'out of time',
      statClock: 'Time left: <b>{a}</b>',
      resize: 'Add / Take out', resizeOff: 'Off', resize2: '2 per match', resizeAll: 'Always',
      resizeHint: 'Add a letter (CARD → CARDS) or take one out (CARDS → CARD). Words stay 3–5 letters.',
      addBtn: 'Add +', delBtn: '− Take out', rights: '{n} left', noRights: 'none left',
      pickSlot: 'Tap where the new letter goes', pickDel: 'Tap the letter to take out',
      errNoResize: 'No adds or take-outs left', errLength: 'Words are 3–5 letters',
      howResize: '<b>Add / Take out:</b> {when} you can add a letter (CARD → CARDS) or take one out (CARDS → CARD); words stay 3–5 letters. <b>Add +</b>, then where it goes and the letter; <b>− Take out</b>, then the letter.',
      when2: 'twice a match', whenAll: 'any time', statResize: 'Add / take out: <b>{a}</b>',
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
      howClock: '<b>Clock:</b> each of you has {n} seconds for the whole match. Your clock runs only on your turn and every word adds {inc} s. Run out and you lose the match. Stuck? <b>Give up point</b>: your opponent gets the point and you keep the time you have. A word can be played once per point.',
      how4: '<b>Dead end:</b> send a word with no way out and the point is yours at once.',
      howWords: '<b>Words:</b> any dictionary word counts, plurals and verb forms included (CATS, RAN).',
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
    lang: 'tr', langPicked: false,
    mode: 'duo', level: 'orta', len: 4, pace: 'normal', bank: KT.CLOCK.bank, resize: 'off', format: 1,
    names: ['', ''], bonus: [0, 0], sound: true, seenHow: false,
  }, readJSON(DEVICE_KEY) || {});
  if (!S.langPicked || !T[S.lang]) S.lang = 'tr';
  if (![3, 4].includes(+S.len)) S.len = 4;
  S.len = +S.len; S.format = +S.format === 2 ? 2 : 1;
  if (!KT.PACES[S.pace] && S.pace !== 'saat') S.pace = 'normal';
  if (!KT.CLOCK.banks.includes(+S.bank)) S.bank = KT.CLOCK.bank;
  S.bank = +S.bank;
  if (!(S.resize in KT.RESIZE.rights)) S.resize = 'off';
  const resizeRights = () => KT.RESIZE.rights[S.resize] || 0;
  delete S.ekli;   // "inflected words count" setting, 11 Nov 2026 only
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
  Sfx.setEnabled(S.sound);

  // ---------- Lab ----------
  const H = () => window.Hesap || null;
  let oda = null;                              // the two-phone rooms (hesap/oda.js), set up below
  let roomsStop = null, roomsLast = [];        // open rooms on the menu
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
  // resize: uzat/kısalt is on, so 3-5 letter words are in play
  const lexFor = (lang, len, resize) => {
    const k = lang + len + (resize ? 'r' : '');
    return lexCache[k] || (lexCache[k] = new KT.Lexicon(WORDS, lang, len, resize ? KT.RESIZE.lens : null));
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
    $$('[data-set=bank] .chip').forEach(c => { c.textContent = t('secs', { n: c.dataset.v }); });
    $('#bankHint').textContent = t('bankHint', { inc: KT.CLOCK.inc });
    $('#bonusLabel').textContent = t(S.pace === 'saat' ? 'bonusClock' : 'bonus');
    $('#resizeHint').textContent = t('resizeHint');
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
    renderRooms();
    const how = ['how1', 'how2', ...(S.resize !== 'off' ? ['howResize'] : []), S.pace === 'saat' ? 'howClock' : 'how3', 'how4', 'howWords']
      .map(k => t(k, { n: S.bank, inc: KT.CLOCK.inc, when: t(S.resize === 'all' ? 'whenAll' : 'when2') }));
    how.push(t('howWin', { n: KT.TARGET[S.format] }));
    $('#howList').innerHTML = how.map(h => '<li>' + h + '</li>').join('');
  }
  function syncMenu() {
    $$('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
    $$('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
    $('#setupBot').classList.toggle('on', S.mode === 'bot');
    $('#setupDuo').classList.toggle('on', S.mode === 'duo');
    const val = { level: S.level, len: String(S.len), pace: S.pace, bank: String(S.bank), resize: S.resize, format: String(S.format), bonus0: String(S.bonus[0]), bonus1: String(S.bonus[1]) };
    $('#bankOpt').hidden = S.pace !== 'saat';
    $('#resizeHint').hidden = S.resize === 'off';
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
    else if (k === 'bank') S.bank = +v;
    else if (k === 'resize') S.resize = v;
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
    if (G && G.mode === 'online') return (i === 0 ? G.net.me.ad : G.net.opp.ad) || (i === 0 ? t('you') : t('p2'));
    return S.names[i] || (i === 0 ? t('p1') : t('p2'));
  }
  const isBot = i => !!(G && G.bots[i]);
  // online: player 0 is this phone, player 1 the other one
  const isRemote = i => !!(G && G.mode === 'online' && i === 1);
  // a player without keys on this screen (the bot, or the other phone): a small strip at the top
  const small = i => isBot(i) || isRemote(i);
  // one person on this screen: "you" in the texts
  const solo = () => G.mode === 'bot' || G.mode === 'online';
  const panelOf = i => G.panels[i];

  // online: { seat, me, opp, tohum, log } from the room (startOnline)
  function startMatch(firstStarter, online) {
    stopGame();
    watchRooms(false);
    const rz = resizeRights();
    const lex = lexFor(S.lang, S.len, rz > 0);
    const mode = online ? 'online' : S.mode;
    const players = [0, 1].map(i => ({ name: '', bonus: mode === 'duo' ? S.bonus[i] : 0 }));
    const fs = firstStarter !== undefined ? firstStarter : (mode === 'bot' ? 0 : (Math.random() < 0.5 ? 0 : 1));
    // online: both phones draw the same starting words from the room's seed
    const m = new KT.Match({ lex, players, target: KT.TARGET[S.format], pace: S.pace, bank: S.bank, resize: rz, firstStarter: fs, random: online ? KT.seeded(online.tohum) : undefined });
    G = {
      m, lex, mode, firstStarter: fs,
      bots: [null, mode === 'bot' ? new KT.Bot(S.level) : null],
      net: online ? { seat: online.seat, me: online.me, opp: online.opp, done: 0, queue: [], sent: [] } : null,
      panels: [$('#panel0'), $('#panel1')],
      sel: [-1, -1], typed: '', edit: [null, null],   // edit: uzat/kısalt mode of each player ('add' | 'del')
      clock: { owner: -1, total: 1, limit: 1, left: 0, elapsed: 0, running: false, onEnd: null, bank: false },
      shown: ['', ''],
      plan: null, waits: [], paused: false, speed: 1, lastTs: performance.now(), raf: 0, lastTick: -1,
      firstShot: [true, true], started: Date.now(), pointBusy: false, stage: null, over: false,
    };
    m.players[0].name = playerName(0);
    m.players[1].name = playerName(1);
    const game = $('#game');
    game.classList.toggle('duo', mode === 'duo');
    game.classList.toggle('bot', mode === 'bot' || mode === 'online');
    game.classList.toggle('clockmode', m.clockMode);
    game.classList.toggle('resize', m.resize > 0);
    $('#menu').classList.remove('on');
    game.classList.add('on');
    $('#endSheet').hidden = true;
    $('#pauseSheet').hidden = true;
    $('#howSheet').hidden = true;
    buildPanel(0); buildPanel(1);
    renderScore();
    layout();
    G.raf = requestAnimationFrame(frame);
    const who = mode === 'bot' ? 'bota karşı (' + S.level + ')' : mode === 'online' ? 'iki telefon, ' + playerName(1) + ' ile' : 'iki kişi';
    if (!(online && online.log.length)) labNote(`Maç başladı: ${who}, ${S.lang === 'tr' ? 'Türkçe' : 'İngilizce'}, ${S.len} harf, ${paceNote()}, ${KT.TARGET[S.format]} sayı`);
    if (online && online.log.length) {
      netReplay(online.log);   // back in a match that was already going
    } else if (mode === 'duo' || mode === 'online') {
      banner(t('firstPick', { name: playerName(fs) }));
      wait(1.6, () => { hideBanner(); enterStart(); });
    } else {
      enterStart();
    }
  }

  const paceNote = () => (S.pace === 'saat' ? `saat ${S.bank} sn +${KT.CLOCK.inc}` : S.pace) +
    (S.resize === 'off' ? '' : S.resize === 'all' ? ', uzat/kısalt her zaman' : ', uzat/kısalt maçta 2');

  function stopGame() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    G = null;
  }

  // ---------- panels ----------
  function buildPanel(i) {
    const p = panelOf(i);
    p.className = 'panel ' + (i === 0 ? 'bottom' : 'top') + ' ' + (small(i) ? 'cbot' : 'c' + i);
    p.style.removeProperty('--pc');
    if (isRemote(i) && /^#[0-9a-f]{6}$/i.test(G.net.opp.renk || '')) p.style.setProperty('--pc', G.net.opp.renk);
    if (small(i)) {
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="bot-think" hidden><i></i><i></i><i></i></span><span class="dots"></span><span class="prz"></span><span class="ptime"></span><span class="pscore"></span></div>
        <div class="tiles small"></div><div class="clock idle"><i></i></div>`;
    } else {
      p.innerHTML = `<div class="phead"><span class="pname"></span><span class="dots"></span><span class="pscore"></span></div>
        <div class="msg"></div><div class="tiles"></div>
        <div class="editrow"><button type="button" class="edit del" disabled></button><span class="rights"></span><button type="button" class="edit add" disabled></button></div>
        <div class="clockrow"><div class="clock idle"><i></i></div><span class="ptime"></span><button type="button" class="give" disabled></button></div>
        <div class="kbd off"></div>`;
      const give = $('.give', p);
      give.textContent = t('give');
      give.addEventListener('click', e => { e.preventDefault(); onPass(i); });
      const add = $('.edit.add', p), del = $('.edit.del', p);
      add.textContent = t('addBtn'); del.textContent = t('delBtn');
      add.addEventListener('click', e => { e.preventDefault(); setEdit(i, 'add'); });
      del.addEventListener('click', e => { e.preventDefault(); setEdit(i, 'del'); });
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
    drawBanks();
    drawRights();
  }
  // uzat/kısalt: what each player has left (the bot / other phone: in the head of its strip)
  function drawRights() {
    const m = G.m;
    if (!m.resize) return;
    for (const i of [0, 1]) {
      const p = panelOf(i), n = m.rights[i], txt = n === Infinity ? '' : n > 0 ? t('rights', { n }) : t('noRights');
      if (small(i)) { const el = $('.prz', p); el.textContent = n === Infinity ? '' : '±' + n; el.classList.toggle('none', n === 0); }
      else { const el = $('.rights', p); el.textContent = txt; el.classList.toggle('none', n === 0); }
    }
  }
  // pace 'saat': both clocks; the one of the player to move counts down
  function fmtTime(s) {
    s = Math.max(0, s);
    if (s >= 10) { const c = Math.ceil(s); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); }
    return (Math.floor(s * 10) / 10).toFixed(1);
  }
  function drawBanks() {
    if (!G || !G.m.clockMode) return;
    const c = G.clock;
    for (const i of [0, 1]) {
      const live = c.running && c.bank && c.owner === i;
      const secs = live ? c.left : G.m.banks[i];
      const txt = fmtTime(secs), key = txt + (live ? '*' : '');
      if (G.shown[i] === key) continue;
      G.shown[i] = key;
      const el = $('.ptime', panelOf(i));
      el.textContent = txt;
      el.classList.toggle('run', live);
      el.classList.toggle('low', secs < 10);
    }
  }
  function setGive(i, on) {
    if (small(i)) return;
    $('.give', panelOf(i)).disabled = !on;
  }

  function setMsg(i, html, cls) {
    if (small(i)) return;
    const el = $('.msg', panelOf(i));
    el.className = 'msg' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }

  const sentText = i => (solo() && i === 0 ? t('sentYou') : t('sentBy', { name: playerName(i) }));

  function renderTiles(i, word, opts) {
    const o = opts || {};
    const el = $('.tiles', panelOf(i));
    if (!word) { el.innerHTML = ''; el.className = 'tiles' + (small(i) ? ' small' : ''); return; }
    const letters = [...word];
    // o.slots: uzat, the places a new letter can go (o.slot: the one picked); o.del: kısalt, tap a letter to take it out
    el.className = 'tiles' + (small(i) ? ' small' : '') + (o.wait ? ' wait' : '') + (o.land ? ' land' : '') + (o.slots ? ' slots' : '') + (o.del ? ' deling' : '');
    const slot = k => `<div class="slot${o.slot === k ? ' sel' : ''}" data-s="${k}">+</div>`;
    el.innerHTML = letters.map((c, k) => {
      const cls = ['tile'];
      if (o.sel === k) cls.push('sel');
      if (o.mark === k) cls.push('new');
      if (o.typed !== undefined && k >= o.typed) cls.push('dim');
      return (o.slots ? slot(k) : '') + `<div class="${cls.join(' ')}" data-i="${k}">${esc(U(c))}</div>`;
    }).join('') + (o.slots ? slot(letters.length) : '');
    if (!small(i) && o.active) {
      $$('.tile', el).forEach(tile => tile.addEventListener('pointerdown', e => { e.preventDefault(); onTile(i, +tile.dataset.i); }));
      $$('.slot', el).forEach(s => s.addEventListener('pointerdown', e => { e.preventDefault(); onSlot(i, +s.dataset.s); }));
    }
  }
  // The word of the player to move, as their edit mode shows it.
  function renderActive(i, extra) {
    const e = G.edit[i];
    renderTiles(i, G.m.point.word, Object.assign({ active: true, sel: e ? -1 : G.sel[i], slots: e === 'add', slot: e === 'add' ? G.sel[i] : -1, del: e === 'del' }, extra || {}));
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
    if (small(i)) return;
    $('.kbd', panelOf(i)).classList.toggle('off', !on || G.edit[i] === 'del');   // kısalt: a letter is tapped, not typed
    const p = panelOf(i), m = G.m;
    if (!m.resize) return;
    const len = m.point && m.point.word ? m.point.word.length : 0, can = on && m.canResize(i);
    $('.edit.add', p).disabled = !(can && len < G.lex.maxLen);
    $('.edit.del', p).disabled = !(can && len > G.lex.minLen);
    if (!on) G.edit[i] = null;
    $('.edit.add', p).classList.toggle('on', G.edit[i] === 'add');
    $('.edit.del', p).classList.toggle('on', G.edit[i] === 'del');
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
      txt = '<span class="chain">' + words.map((w, k) => `<span class="${k === words.length - 1 ? 'last' : ''}">${esc(U(w))}</span>`).join('') +
        `</span> · ${pt.shots.length}`;
    }
    $('#info0').innerHTML = txt;
    $('#info1').innerHTML = txt;
  }

  // ---------- clock & scheduler (paused together) ----------
  function wait(sec, fn) { G.waits.push({ left: sec, fn }); }
  // o: { visible (false: the start clock of the bot), bank (pace 'saat': the player's clock for the match) }
  function startClock(owner, seconds, onEnd, o) {
    const c = G.clock, opt = o || {};
    c.owner = owner; c.limit = seconds; c.left = seconds; c.elapsed = 0; c.running = true; c.onEnd = onEnd;
    c.visible = opt.visible !== false; c.bank = !!opt.bank;
    c.total = c.bank ? Math.max(seconds, G.m.bank) : seconds;
    G.lastTick = -1;
    for (const i of [0, 1]) {
      const bar = $('.clock', panelOf(i));
      bar.classList.toggle('idle', !(c.visible && i === owner));
      bar.classList.toggle('pick', G.m.clockMode && !c.bank);   // pace 'saat': picking the starting word is not on the clock
    }
    drawClock();
  }
  function stopClock() {
    G.clock.running = false; G.plan = null;
    for (const i of [0, 1]) { const c = $('.clock', panelOf(i)); c.classList.add('idle'); c.classList.remove('low'); }
    drawBanks();
  }
  // pace 'saat': seconds the player to move has used (rounded, so both phones of a match count the same)
  function usedTime() {
    const c = G.clock;
    return c.bank ? Math.round(Math.min(c.elapsed, c.limit) * 100) / 100 : undefined;
  }
  function drawClock() {
    const c = G.clock;
    if (c.owner < 0 || !c.visible) return;
    const bar = $('.clock', panelOf(c.owner));
    const f = Math.max(0, c.left / c.total);
    bar.firstElementChild.style.transform = `scaleX(${f})`;
    bar.classList.toggle('low', c.bank ? c.left < 5 : c.left < 2.2 || f < 0.25);
    drawBanks();
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
        if (c.visible && c.left <= (c.bank ? 5 : 3) && c.left > 0) {
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
    for (const i of [0, 1]) { setKeyboard(i, false); setGive(i, false); }
    renderTiles(r, null);
    setMsg(r, esc(t('startWait', { name: playerName(s) })));
    if (isBot(s)) {
      renderTiles(s, null);
      $('.bot-think', panelOf(s)).hidden = false;
      const choice = G.bots[s].open(m);
      startClock(s, KT.START_TIME, () => doStart(choice.word), { visible: false });
      G.plan = { at: choice.delay, fn: () => doStart(choice.word) };
    } else if (isRemote(s)) {
      // the other phone picks (and keeps its own start clock)
      renderTiles(s, null);
      $('.bot-think', panelOf(s)).hidden = false;
      stopClock();
    } else {
      setMsg(s, esc(t('startYou')), 'turn');
      renderStartCards(s, m.point.options);
      startClock(s, KT.START_TIME, () => doStart(m.point.options[Math.floor(Math.random() * 3)]));
    }
    G.stage = 'start';
    pump();
  }

  // remote: the other phone's move (online)
  function doStart(word, remote) {
    const m = G.m;
    if (m.phase !== 'start' || G.pointBusy || G.over) return;
    const s = m.starter;
    if (isRemote(s) !== !!remote) return;
    if (remote && !m.point.options.includes(word)) m.point.options[0] = word;   // the same seed draws the same words; just in case
    if (!m.start(word).ok) return;
    netSent('s', word, s);
    G.stage = null;
    stopClock();
    G.pointBusy = true;
    if (small(s)) $('.bot-think', panelOf(s)).hidden = true;
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
    const secs = m.shotTime(p), co = { bank: m.clockMode };
    G.sel[p] = -1; G.typed = ''; G.edit[p] = null;
    setKeyboard(o, false); setGive(o, false);
    if (isBot(p)) {
      renderTiles(p, word, { land: true });
      $('.bot-think', panelOf(p)).hidden = false;
      setMsg(o, esc(t('thinking', { name: playerName(p) })));
      const rep = G.bots[p].reply(m);
      startClock(p, secs, onTimeout, co);
      if (rep.word && rep.delay < secs) G.plan = { at: rep.delay, fn: () => playShot(p, rep.word) };
      else if (rep.pass && rep.delay < secs) G.plan = { at: rep.delay, fn: () => onPass(p) };
    } else if (isRemote(p)) {
      renderTiles(p, word, { land: true });
      $('.bot-think', panelOf(p)).hidden = false;
      setMsg(o, esc(t('thinking', { name: playerName(p) })));
      // the other phone keeps the time and says when it ran out; this clock only shows it
      startClock(p, secs, () => setMsg(o, esc(t('netWait', { name: playerName(p) }))), co);
    } else {
      renderTiles(p, word, { land: true, active: true });
      setKeyboard(p, true);
      setGive(p, m.clockMode);
      setMsg(p, esc(G.firstShot[p] ? t('firstTurn') : t('yourTurn')), 'turn');
      if (!small(o)) setMsg(o, esc(t('thinking', { name: playerName(p) })));
      startClock(p, secs, onTimeout, co);
    }
    G.stage = 'turn';
    pump();
  }

  const myTurn = i => { const m = G && G.m; return !!m && !G.paused && m.phase === 'rally' && m.point.turn === i && !G.pointBusy; };
  function onTile(i, k, viaKey) {
    if (!myTurn(i)) return;
    const m = G.m, cur = m.point.word;
    if (G.edit[i] === 'del') { Sfx.tap(); attempt(i, cur.slice(0, k) + cur.slice(k + 1), k); return; }   // kısalt
    if (G.edit[i] === 'add') { onSlot(i, k, viaKey); return; }
    G.sel[i] = G.sel[i] === k ? -1 : k;
    G.kbdSel = !!viaKey && G.sel[i] >= 0;
    G.typed = '';
    renderActive(i);
    setMsg(i, esc(G.sel[i] >= 0 ? t('pickKey') : t('yourTurn')), 'turn');
    Sfx.tap();
  }
  // uzat: where the new letter goes (0 = before the first letter)
  function onSlot(i, k, viaKey) {
    if (!myTurn(i) || G.edit[i] !== 'add') return;
    G.sel[i] = G.sel[i] === k ? -1 : k;
    G.kbdSel = !!viaKey && G.sel[i] >= 0;
    G.typed = '';
    renderActive(i);
    setMsg(i, esc(G.sel[i] >= 0 ? t('pickKey') : t('pickSlot')), 'turn');
    Sfx.tap();
  }
  // uzat/kısalt buttons: 'add' or 'del'; the same again goes back to changing a letter
  function setEdit(i, mode) {
    if (!myTurn(i) || !G.m.canResize(i)) return;
    const len = G.m.point.word.length;
    if ((mode === 'add' && len >= G.lex.maxLen) || (mode === 'del' && len <= G.lex.minLen)) return;
    G.edit[i] = G.edit[i] === mode ? null : mode;
    G.sel[i] = -1; G.typed = '';
    renderActive(i);
    setKeyboard(i, true);
    setMsg(i, esc(G.edit[i] === 'add' ? t('pickSlot') : G.edit[i] === 'del' ? t('pickDel') : t('yourTurn')), 'turn');
    Sfx.tap();
  }

  function onKey(i, ch, keyEl) {
    const m = G && G.m;
    if (!m || G.paused || m.phase !== 'rally' || m.point.turn !== i || G.pointBusy) return;
    Sfx.key();
    if (keyEl) { keyEl.classList.add('down'); setTimeout(() => keyEl.classList.remove('down'), 120); }
    const k = G.sel[i], e = G.edit[i];
    if (e === 'del' || k < 0) {
      setMsg(i, esc(t(e === 'del' ? 'pickDel' : e === 'add' ? 'pickSlot' : 'pickTile')), 'err');
      const tiles = $('.tiles', panelOf(i));
      tiles.classList.remove('land'); void tiles.offsetWidth; tiles.classList.add('land');
      return;
    }
    const cur = m.point.word;
    if (e === 'add') { attempt(i, cur.slice(0, k) + ch + cur.slice(k), k); return; }   // uzat
    if (cur[k] === ch) return;
    attempt(i, cur.slice(0, k) + ch + cur.slice(k + 1), k);
  }

  // Try a word for player i (from the on-screen keys or the physical keyboard).
  function attempt(i, word, at) {
    const m = G.m;
    const c = m.check(word);
    if (!c.ok) {
      if (c.reason === 'no-resize' || c.reason === 'length') {
        Sfx.err();
        setMsg(i, esc(t(c.reason === 'length' ? 'errLength' : 'errNoResize')), 'err');
      } else if (c.reason === 'used' || c.reason === 'unknown') {
        Sfx.err();
        const key = c.reason === 'used' ? 'errUsed' : 'errUnknown';
        setMsg(i, esc(t(key, { w: U(word) })), 'err');
        const tiles = $('.tiles', panelOf(i));
        const tile = c.kind === 'swap' ? tiles.children[at] : null;
        if (!tile) { tiles.classList.remove('shake'); void tiles.offsetWidth; tiles.classList.add('shake'); }   // a letter added or taken out
        if (tile) {
          tile.textContent = U(word[at]);
          tile.classList.remove('bad'); void tile.offsetWidth; tile.classList.add('bad');
          setTimeout(() => { if (G && G.m.point.word === m.point.word && G.m.point.turn === i) { tile.textContent = U(m.point.word[at]); tile.classList.remove('bad'); } }, 520);
        }
      }
      return false;
    }
    playShot(i, word);
    return true;
  }

  // remote: the other phone's answer (online), used: the seconds it took there (pace 'saat')
  function playShot(p, word, remote, used) {
    const m = G.m;
    if (G.over || isRemote(p) !== !!remote) return;
    const before = m.point.word;
    // the other phone's word list said yes (the room only joins pages with the same lists; just in case)
    if (remote && m.check(word).reason === 'unknown') G.lex.validSet.add(word);
    const u = remote ? used : usedTime();
    const r = m.shot(word, u);
    if (!r.ok) return;
    netSent('h', word, p, u);
    G.stage = null;
    G.firstShot[p] = false;
    stopClock();
    G.pointBusy = true;
    if (small(p)) $('.bot-think', panelOf(p)).hidden = true;
    const st = G.lex.step(before, word);
    G.edit[p] = null;
    renderTiles(p, word, { mark: st && st.kind !== 'del' ? st.at : -1, wait: true });
    setKeyboard(p, false); setGive(p, false);
    if (st && st.kind !== 'swap') { drawRights(); layout(); }
    setMsg(p, esc(sentText(p)) + ' <b>' + esc(U(word)) + '</b>');
    boardInfo();
    if (r.how === 'dead') {
      Sfx.deadEnd();
      flyWord(p, word, () => pointOver(r), { fast: true, dead: true });
    } else {
      Sfx.send();
      flyWord(p, word, () => { G.pointBusy = false; enterTurn(); });
    }
  }

  // remote: the other phone ran out of time (online). Otherwise the clock of the player to move ran out.
  function onTimeout(remote) {
    const m = G.m;
    if (m.phase !== 'rally' || G.pointBusy || G.over) return;
    const loser = m.point.turn, word = m.point.word;
    if (isRemote(loser) !== (remote === true)) return;
    const r = m.timeout();
    if (!r) return;
    netSent('t', null, loser);
    G.stage = null;
    if (small(loser)) $('.bot-think', panelOf(loser)).hidden = true;
    G.pointBusy = true;
    stopClock();
    setKeyboard(loser, false); setGive(loser, false);
    Sfx.timeUp();
    flyWord(loser, word, () => pointOver(r), { out: true });
  }

  // pace 'saat': the player to move gives the point away (the "Sayıyı ver" button, the bot, or the other phone)
  function onPass(p, remote, used) {
    const m = G && G.m;
    if (!m || !m.clockMode || m.phase !== 'rally' || m.point.turn !== p || G.pointBusy || G.over || G.paused) return;
    if (isRemote(p) !== !!remote) return;
    const word = m.point.word, u = remote ? used : usedTime();
    const r = m.pass(u);
    if (!r) return;
    netSent(r.how === 'time' ? 't' : 'p', null, p, u);
    G.stage = null;
    if (small(p)) $('.bot-think', panelOf(p)).hidden = true;
    G.pointBusy = true;
    stopClock();
    setKeyboard(p, false); setGive(p, false);
    Sfx.timeUp();
    flyWord(p, word, () => pointOver(r), { out: true });
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
    for (const i of [0, 1]) { setKeyboard(i, false); setGive(i, false); }
    if (r.how === 'dead') {
      banner(t('dead'), 'dead');
      setMsg(w, esc(t('deadYou', { w: U(r.word) })), 'turn');
      setMsg(l, esc(t('deadThem', { w: U(r.word) })));
    } else if (r.flag) {   // pace 'saat': a clock ran out, the match is over
      banner(solo() && l === 0 ? t('flagYou') : t('flagThem', { name: playerName(l) }));
      setMsg(w, esc(t('flagWin')), 'turn');
      setMsg(l, esc(t('timeUp')) + ' ' + altsHtml(r.left));
    } else if (r.how === 'pass') {
      banner(solo() && w === 0 ? t('pointYou') : t('point', { name: playerName(w) }));
      setMsg(w, esc(t('pointYou')), 'turn');
      setMsg(l, esc(t('gaveYou')) + ' ' + altsHtml(r.left));
      if (small(l)) setMsg(w, esc(t('gaveThem', { name: playerName(l) })) + ' ' + esc(t('pointYou')), 'turn');
    } else {
      banner(solo() && w === 0 ? t('pointYou') : t('point', { name: playerName(w) }));
      setMsg(w, esc(t('pointYou')), 'turn');
      setMsg(l, esc(t('timeUp')) + ' ' + altsHtml(r.left));
      if (small(l)) setMsg(w, esc(t('pointYou')) + ' ' + esc(t('timeUp')), 'turn');
    }
    Sfx.point(G.mode === 'duo' || w === 0);
    if (G.mode === 'online' && oda) oda.gonder(m.points[0]);   // the score, in case the round is cut short
    if (r.matchOver) {
      wait(2.4, () => { banner(winText(w)); Sfx.win(); });
      wait(4.2, () => endMatch());
      return;
    }
    const delay = (r.how === 'time' || r.how === 'pass') && !small(l) ? 4.6 : 2.8;
    G.skipTo = () => { if (G.skipTo) { G.skipTo = null; G.waits = []; m.next(); enterStart(); } };
    wait(delay, () => { if (G.skipTo) G.skipTo(); });
    if (G.mode === 'online') pump();   // the other phone may have started the next point already
  }
  function winText(w) {
    if (G.mode === 'duo') return t('winTitle', { name: playerName(w) });
    if (w === 0) return t('youWin');
    return G.mode === 'bot' ? t('botWins') : t('winTitle', { name: playerName(w) });
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
    if (m.phase === 'start' && !small(m.starter) && /^[1-3]$/.test(e.key)) { doStart(m.point.options[+e.key - 1]); return; }
    if (m.phase !== 'rally' || G.pointBusy) return;
    const p = m.point.turn;
    if (small(p)) return;
    const word = m.point.word;
    if (e.key === 'Backspace') { G.typed = G.typed.slice(0, -1); showTyped(p); e.preventDefault(); return; }
    if (e.key === '+' || e.key === '=') { setEdit(p, 'add'); return; }   // uzat/kısalt
    if (e.key === '-') { setEdit(p, 'del'); return; }
    if (e.key === 'Enter' && G.typed) { submitTyped(p); e.preventDefault(); return; }   // a word one letter shorter
    if (/^[1-9]$/.test(e.key) && +e.key <= word.length + (G.edit[p] === 'add' ? 1 : 0)) { onTile(p, +e.key - 1, true); return; }
    const ch = KT.lower(e.key, S.lang);
    if (ch.length !== 1 || !G.lex.alpha.includes(ch)) return;
    e.preventDefault();
    // 1-4 then a letter: change that letter. Otherwise type the whole new word.
    if (G.sel[p] >= 0 && G.kbdSel && !G.typed) { G.kbdSel = false; onKey(p, ch); return; }
    G.sel[p] = -1; G.kbdSel = false; G.edit[p] = null;
    G.typed += ch;
    // the whole word: sent when it has the length of the word (or one more with uzat/kısalt);
    // with uzat/kısalt a word as long as the old one waits if it is not an answer (more may come), Enter sends a shorter one
    const L = word.length, canR = m.canResize(p);
    if (G.typed.length > L || (G.typed.length === L && (!canR || m.check(G.typed).ok))) { submitTyped(p); return; }
    showTyped(p);
  });
  function submitTyped(p) {
    const word = G.m.point.word, typed = G.typed;
    G.typed = '';
    const st = G.lex.step(word, typed);
    if (!st) { Sfx.err(); setMsg(p, esc(t('yourTurn')), 'err'); renderTiles(p, word, { active: true, land: true }); return; }
    if (!attempt(p, typed, st.at)) renderTiles(p, word, { active: true });
  }
  function showTyped(p) {
    const word = G.m.point.word, ty = G.typed;
    renderTiles(p, ty + word.slice(ty.length), { active: true, typed: ty.length || undefined });
  }

  // ---------- pause ----------
  function pause() {
    if (!G || G.paused || G.m.phase === 'matchOver') return;
    if (G.mode === 'online') { if (oda) oda.menu(); return; }   // two phones: no pause, the room's menu
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode !== 'online') pause(); });

  function toMenu() {
    if (G && G.mode === 'online' && oda && oda.odada) { oda.cik(); return; }   // leaving the room brings the menu back
    showMenu();
  }
  function showMenu() {
    stopGame();
    $('#game').classList.remove('on');
    $('#menu').classList.add('on');
    $('#endSheet').hidden = true;
    syncMenu();
    watchRooms(true);
  }

  // ---------- open rooms on the menu (two phones): the other one sees the room and joins, no link needed ----------
  function watchRooms(on) {
    if (!on || !oda) { if (roomsStop) { roomsStop(); roomsStop = null; } return; }
    if (!roomsStop) roomsStop = oda.odalariIzle(list => { roomsLast = list; renderRooms(); });
  }
  function renderRooms() {
    const box = $('#rooms'), ul = $('#roomList');
    if (!box || !roomsStop) return;
    box.hidden = false;
    const list = roomsLast.slice().sort((a, b) => (a.durum === 'bekliyor' ? 0 : 1) - (b.durum === 'bekliyor' ? 0 : 1));
    if (!list.length) { ul.innerHTML = `<li class="none">${esc(t('roomsNone'))}</li>`; return; }
    ul.innerHTML = list.map(r => {
      const wait = r.durum === 'bekliyor', fullRoom = r.n >= (r.en || 2);
      const name = S.lang === 'tr' ? t('roomName', { name: Oda.ninki(r.kurucu) }) : t('roomName', { name: (r.kurucu || '?') + '’s room' });
      const sub = [wait ? t('roomWait') : t('roomPlaying'), r.not].filter(Boolean).join(' · ');
      const c = /^#[0-9a-f]{6}$/i.test(r.renk || '') ? r.renk : '#4b5563';
      return `<li class="${wait ? 'wait' : ''}"><span class="rz" style="background:${c}">${esc(U([...(r.kurucu || '?')][0]))}</span>` +
        `<span class="rt"><b>${esc(name)}</b><small>${esc(sub)}</small></span>` +
        `<button type="button" data-room="${esc(r.id)}"${fullRoom ? ' disabled' : ''}>${esc(fullRoom ? t('full') : t('join'))}</button></li>`;
    }).join('');
    $$('[data-room]', ul).forEach(b => b.addEventListener('click', () => { Sfx.tap(); oda.katil(b.dataset.room); }));
  }

  // ---------- end ----------
  // replayed: a phone coming back to a match that had already ended (nothing to save again)
  function endMatch(replayed) {
    const m = G.m, w = m.winner;
    stopClock();
    if (G.mode === 'online') {
      G.over = true;
      if (!replayed) {
        const save = loadSave();
        save.online = (save.online || 0) + 1;
        save.deadEnds += m.stats.deadEnds[0];
        if (m.stats.longest > save.longest) { save.longest = m.stats.longest; save.longestWords = m.stats.longestWords; }
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
        const mins = Math.max(1, Math.round((Date.now() - G.started) / 60000));
        labNote(`İki telefon: ${playerName(0)} ${m.points[0]}–${m.points[1]} ${playerName(1)} · en uzun zincir ${m.stats.longest} · çıkmaz ${m.stats.deadEnds[0]}–${m.stats.deadEnds[1]}${clockNote(m)} · ${mins} dk`);
      }
      // the room shows who won: ranked by the match (a clock that ran out loses, whatever the score)
      if (oda) oda.bitir(m.points[0], undefined, undefined, winText(w), w === 0 ? 1 : 0);
      return;
    }
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
      ? `Bota karşı (${S.level}): ${w === 0 ? 'kazandı' : 'kaybetti'} ${scoreLine} · en uzun zincir ${m.stats.longest} · ${m.stats.deadEnds[0]} çıkmaz${clockNote(m)} · ${mins} dk`
      : `Maç bitti: ${playerName(0)} ${scoreLine} ${playerName(1)} · en uzun zincir ${m.stats.longest} · çıkmaz ${m.stats.deadEnds[0]}–${m.stats.deadEnds[1]}${clockNote(m)} · ${mins} dk`);

    const title = winText(w);
    $('#trophy').innerHTML = `<div class="tile gold">${esc(U([...playerName(w)][0] || '★'))}</div>`;
    $('#endTitle').textContent = title;
    const flagged = !!(m.history.length && m.history[m.history.length - 1].flag);
    $('#endScore').textContent = `${playerName(0)} ${scoreLine} ${playerName(1)}` + (flagged ? ' · ' + t('byFlag') : '');
    const items = [];
    if (m.stats.longestWords.length) items.push(t('statLongest', { n: m.stats.longest }) + '<br>' + m.stats.longestWords.map(x => esc(U(x))).join(' → '));
    items.push(t('statDead', { a: G.mode === 'bot' ? m.stats.deadEnds[0] + '–' + m.stats.deadEnds[1] : `${esc(playerName(0))} ${m.stats.deadEnds[0]} · ${esc(playerName(1))} ${m.stats.deadEnds[1]}` }));
    if (G.mode === 'duo') items.push(t('statWords', { a: `${esc(playerName(0))} ${m.stats.words[0]} · ${esc(playerName(1))} ${m.stats.words[1]}` }));
    if (m.resize) items.push(t('statResize', { a: `${esc(playerName(0))} ${m.stats.resizes[0]} · ${esc(playerName(1))} ${m.stats.resizes[1]}` }));
    if (m.clockMode) items.push(t('statClock', { a: `${esc(playerName(0))} ${fmtTime(m.banks[0])} · ${esc(playerName(1))} ${fmtTime(m.banks[1])}` }));
    $('#endStats').innerHTML = items.map(x => '<li>' + x + '</li>').join('');
    const sheet = $('#endSheet');
    sheet.classList.toggle('duo', G.mode === 'duo');
    $('#endMirror').innerHTML = `<h2>${esc(title)}</h2><p class="end-score">${esc(playerName(1))} ${m.points[1]}–${m.points[0]} ${esc(playerName(0))}${flagged ? ' · ' + esc(t('byFlag')) : ''}</p>`;
    sheet.hidden = false;
  }
  // pace 'saat': the clocks at the end, for the Lab note
  function clockNote(m) {
    const rz = m.resize ? ` · uzat/kısalt ${m.stats.resizes[0]}–${m.stats.resizes[1]}` : '';
    if (!m.clockMode) return rz;
    const last = m.history[m.history.length - 1];
    return ` · saat ${m.bank} sn, kalan ${fmtTime(m.banks[0])}–${fmtTime(m.banks[1])}` +
      (m.stats.passes[0] + m.stats.passes[1] ? `, verilen sayı ${m.stats.passes[0]}–${m.stats.passes[1]}` : '') +
      (last && last.flag ? `, ${playerName(1 - last.winner)} süresini bitirdi` : '') + rz;
  }
  $('#againBtn').addEventListener('click', () => { const fs = G ? 1 - G.firstStarter : 0; startMatch(S.mode === 'bot' ? 0 : fs); });
  $('#menuBtn').addEventListener('click', toMenu);

  // ---------- layout ----------
  function layout() {
    if (!G) return;
    const n = G.lex.maxLen + (G.m.resize ? 1.2 : 0);   // uzat/kısalt: up to 5 letters, and the places between them
    for (const i of [0, 1]) {
      const p = panelOf(i);
      if (small(i)) { p.style.removeProperty('--tw'); continue; }
      const W = Math.min(p.clientWidth - 20, 640), Hh = p.clientHeight - 20;
      const rowMax = Math.max(...KT.KEYS[S.lang].map(r => r.length));
      const kw = Math.max(22, Math.min(58, Math.floor(W / (rowMax + (rowMax - 1) * 0.16))));
      let tw = Math.min(104, Math.floor(W / (n + (n - 1) * 0.12)) - 4, Math.floor(Hh * 0.22));
      tw = Math.max(36, tw);
      const fixed = 30 + 46 + (G.m.clockMode ? 30 : 9) + (G.m.resize ? 42 : 0) + 8 * 4 + tw * 1.14 + 8;    // head, two-line message, uzat/kısalt, clock, gaps, tiles
      const kh = Math.max(30, Math.min(Math.round(kw * 1.5), Math.floor((Hh - fixed - kw * 0.36) / 3)));
      p.style.setProperty('--tw', tw + 'px');
      p.style.setProperty('--kw', kw + 'px');
      p.style.setProperty('--kh', kh + 'px');
    }
  }
  window.addEventListener('resize', layout);

  // ---------- two phones (hesap/oda.js rooms; server fish/sunucu/src/genel-oda.js, game "kelime") ----------
  // Both phones run the same match from the room's seed; on each, player 0 is this phone and player 1 the other.
  // Only the player whose turn it is moves, and tells the other phone: s (starting word), h (answer),
  // t (out of time), p (gave the point away, pace 'saat'), each with n = how many moves came before it, and
  // with pace 'saat' u = the seconds the move took (both phones work out the same clocks from it).
  // The room keeps the moves, so a phone that lost the connection catches up (oda geri) and a reopened page
  // replays the match (basla with log).
  const NET_VERSION = 3;   // 2: pace 'saat', 3: uzat/kısalt
  const MOVE = /^[shtp]$/;
  let netPrev = null;   // this phone's own settings; the room's are used while in it
  function netSurum() {  // phones play together only with the same word lists
    let h = 2166136261;
    for (const l of Object.keys(WORDS)) for (const k of ['common', 'rare', 'serve']) for (const n of Object.keys(WORDS[l][k] || {})) {
      const s = WORDS[l][k][n];
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    }
    return NET_VERSION + '.' + (h >>> 0).toString(36);
  }
  // A move was made (p: who). This phone's own moves go to the other phone.
  function netSent(k, w, p, u) {
    if (!G || !G.net) return;
    if (p === 0) {
      const e = { k, n: G.net.done };
      if (w) e.w = w;
      if (typeof u === 'number') e.u = u;
      G.net.sent.push(e);
      if (oda) oda.olay(e);   // if the connection is down, the catch-up sends it again
    }
    G.net.done++;
  }
  // [[no, e], ...] from the room: the moves in order, each once
  function netMoves(log) {
    const seen = new Set(), out = [];
    for (const x of log || []) {
      const e = x && x[1];
      if (!e || typeof e.n !== 'number' || !MOVE.test(e.k) || seen.has(e.n)) continue;
      seen.add(e.n);
      out.push({ no: x[0], e });
    }
    return out.sort((a, b) => a.e.n - b.e.n);
  }
  function netReceive(no, e) {
    if (!G || G.mode !== 'online' || G.over || !e || typeof e.n !== 'number' || !MOVE.test(e.k)) return;
    if (oda && no === oda.ben) return;
    G.net.queue.push(e);
    pump();
  }
  // The other phone's next move, as soon as this one is ready for it.
  function pump() {
    if (!G || G.mode !== 'online' || G.over) return;
    const q = G.net.queue, m = G.m;
    q.sort((a, b) => a.n - b.n);
    while (q.length && q[0].n < G.net.done) q.shift();
    if (!q.length || q[0].n > G.net.done || G.pointBusy) return;   // a move missing: the catch-up brings it
    const e = q[0];
    if (e.k === 's') {
      if (m.phase === 'pointOver' && G.skipTo) { G.skipTo(); return; }   // the other phone went on already
      if (G.stage !== 'start' || m.phase !== 'start' || m.starter !== 1) return;
      q.shift();
      doStart(e.w, true);
    } else {
      if (G.stage !== 'turn' || m.phase !== 'rally' || m.point.turn !== 1) return;
      q.shift();
      if (e.k === 'h') playShot(1, e.w, true, e.u);
      else if (e.k === 'p') onPass(1, true, e.u);
      else onTimeout(true);
    }
  }
  // Back after a dropped connection: moves the other phone made meanwhile, and ours the room never got.
  function netCatchUp(log) {
    if (!G || G.mode !== 'online' || G.over || !oda) return;
    const moves = netMoves(log), have = new Set(moves.map(x => x.e.n));
    for (const e of G.net.sent) if (!have.has(e.n)) oda.olay(e);
    for (const x of moves) if (x.no !== oda.ben && x.e.n >= G.net.done) G.net.queue.push(x.e);
    pump();
  }
  // A page opened in the middle of a match: play the moves so far without the show, then carry on.
  function netReplay(log) {
    const m = G.m, ben = oda ? oda.ben : 0;
    for (const { no, e } of netMoves(log)) {
      if (e.n !== G.net.done) break;
      const p = no === ben ? 0 : 1;
      let ok = false;
      if (e.k === 's') {
        if (m.phase === 'pointOver') m.next();
        if (m.phase === 'start' && m.starter === p) {
          if (!m.point.options.includes(e.w)) m.point.options[0] = e.w;
          ok = m.start(e.w).ok;
        }
      } else if (m.phase === 'rally' && m.point.turn === p) {
        if (e.k === 'h') { if (!m.lex.has(e.w)) m.lex.validSet.add(e.w); ok = m.shot(e.w, e.u).ok; G.firstShot[p] = false; }
        else if (e.k === 'p') ok = !!m.pass(e.u);
        else ok = !!m.timeout();
      }
      if (!ok) break;
      if (p === 0) G.net.sent.push(e);
      G.net.done++;
    }
    renderScore();
    if (m.phase === 'matchOver') { banner(winText(m.winner)); endMatch(true); return; }
    if (m.phase === 'pointOver') m.next();
    if (m.phase === 'start') { enterStart(); return; }
    const last = m.point.shots[m.point.shots.length - 1];
    if (last) renderTiles(last.by, last.word, { wait: true });
    boardInfo();
    enterTurn();
  }
  // The room started a match (or a reopened page came back to one).
  function startOnline(m) {
    const kadro = (m.kadro || []).slice(0, 2), seat = kadro.findIndex(k => k.no === oda.ben);
    if (seat < 0 || kadro.length < 2) {   // not one of the two players (came in late)
      oda.cik();
      $('#record').textContent = t('netFull');
      return;
    }
    if (!netPrev) netPrev = { lang: S.lang, len: S.len, pace: S.pace, bank: S.bank, resize: S.resize, format: S.format };
    const a = m.ayar || {};
    if (T[a.dil]) S.lang = a.dil;
    if ([3, 4].includes(+a.len)) S.len = +a.len;
    if (KT.PACES[a.pace] || a.pace === 'saat') S.pace = a.pace;
    S.bank = KT.CLOCK.banks.includes(+a.bank) ? +a.bank : KT.CLOCK.bank;
    S.resize = a.resize in KT.RESIZE.rights ? a.resize : 'off';
    S.format = +a.format === 2 ? 2 : 1;
    applyTexts();
    const first = ((m.tohum >>> 0) % 2) === seat ? 0 : 1;   // the seed tosses the coin, the same on both phones
    startMatch(first, { seat, me: kadro[seat], opp: kadro[1 - seat], tohum: m.tohum >>> 0, log: m.log || [] });
  }
  function leaveOnline() {
    if (netPrev) { Object.assign(S, netPrev); netPrev = null; }
    showMenu();
  }
  if (window.Oda && H()) {
    oda = Oda.kur({
      oyun: 'kelime', ad: t('title'), surum: netSurum(), skor: 'kelime-tenisi-oda', sira: 'puan', dil: S.lang,
      canli: false, izle: false, enAz: 2,
      tema: { zemin: '#f6f0e4', yazi: '#1f2633', ana: '#c4633a', anaYazi: '#fff', baslik: "'Nunito',system-ui,sans-serif", govde: "'Nunito',system-ui,sans-serif" },
      aciklama: t('roomLead'),
      yazi: { notTek: t('roomAlone'), gecGelen: '' },
      ayarlar: [
        { k: 'dil', ad: t('roomLang'), secenek: [{ d: 'tr', ad: 'Türkçe' }, { d: 'en', ad: 'English' }], v: S.lang },
        { k: 'len', ad: t('word'), secenek: [{ d: 4, ad: t('len4') }, { d: 3, ad: t('len3') }], v: S.len },
        { k: 'pace', ad: t('pace'), secenek: ['rahat', 'normal', 'hizli', 'saat'].map(d => ({ d, ad: t(d) })), v: S.pace },
        { k: 'bank', ad: t('bankLabel'), secenek: KT.CLOCK.banks.map(d => ({ d, ad: t('secs', { n: d }) })), v: S.bank, goster: a => a.pace === 'saat' },
        { k: 'resize', ad: t('resize'), secenek: ['off', '2', 'all'].map(d => ({ d, ad: t({ off: 'resizeOff', '2': 'resize2', all: 'resizeAll' }[d]) })), v: S.resize },
        { k: 'format', ad: t('format'), secenek: [1, 2].map(d => ({ d, ad: t(d === 1 ? 'short' : 'long', { n: KT.TARGET[d] }) })), v: S.format },
      ],
      puanYazi: p => t('pts', { n: Math.round(p) }),
      skorAyrinti: () => (G && G.mode === 'online' ? Object.assign({ zincir: G.m.stats.longest, hedef: G.m.target }, G.m.clockMode ? { saat: G.m.bank, kalan: G.m.banks[0] } : {}) : {}),
      girdi: () => watchRooms(false),
      basla: m => startOnline(m),
      geri: m => netCatchUp(m.log),
      olay: (no, e) => netReceive(no, e),
      bitti() { if (G && G.mode === 'online') { G.over = true; G.skipTo = null; G.waits = []; stopClock(); } },
      cikti() { if (netPrev || (G && G.mode === 'online')) leaveOnline(); else if ($('#menu').classList.contains('on')) watchRooms(true); },
    });
    oda.dugme($('#onlineBtn'));
    watchRooms(true);
  }

  // ---------- start ----------
  $('#rotateNote').classList.add('need');
  syncMenu();
  if (!S.seenHow && !readJSON(SAVE_KEY)) setTimeout(openHow, 400);

  if (DEBUG) {
    window.__kt = {
      KT, S, T, lexFor, startMatch, toMenu, pause, resume, attempt, playShot, onPass, setEdit, netReceive,
      get G() { return G; },
      get oda() { return oda; },
      set speed(v) { if (G) G.speed = v; },
      timeout() { if (G && G.clock.running) G.clock.left = 0.001; },
    };
  }
})();
