// Kelime Düellosu çekirdek denemesi:  node lab/kelime-tenisi/src/test/core.test.js
// Sözlük verisi (fiil kökleri dahil, ekli haller yok), Türkçe büyük/küçük harf, kurallar (cevap, çıkmaz, süre, sayı yarışı), bot.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const KT = require('../core.js');

const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'words.js'), 'utf8') + ';this.WORDS = WORDS;', ctx);
const WORDS = ctx.WORDS;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e)); }
}

console.log('Sözlük');
for (const lang of ['tr', 'en']) {
  for (const len of [3, 4]) {
    test(`${lang}/${len}: harfler, uzunluk, tekrar yok, başlangıç kelimeleri bilinen ve komşulu`, () => {
      const d = WORDS[lang];
      const sets = [d.common[len], d.rare[len]];
      const all = [].concat(...sets.map(x => x ? x.split(' ') : []));
      assert.strictEqual(new Set(all).size, all.length, 'duplicate');
      for (const w of all) {
        assert.strictEqual(w.length, len, w);
        for (const c of w) assert.ok(d.alpha.includes(c), w);
      }
      const lex = new KT.Lexicon(WORDS, lang, len);
      for (const s of lex.serves) {
        assert.ok(lex.isCommon(s), s);
        assert.ok(lex.neighbours(s, null, true).length >= 4, s);
      }
      assert.ok(lex.serves.length > 100, 'start word count ' + lex.serves.length);
    });
  }
}
test('istenmeyen kelimeler yok', () => {
  const tr3 = new KT.Lexicon(WORDS, 'tr', 3), tr4 = new KT.Lexicon(WORDS, 'tr', 4);
  const en3 = new KT.Lexicon(WORDS, 'en', 3), en4 = new KT.Lexicon(WORDS, 'en', 4);
  for (const w of ['çük', 'piç', 'göt', 'sik', 'bok']) assert.ok(!tr3.has(w), w);
  for (const w of ['seks', 'homo', 'ibne', 'puşt', 'chat', 'food']) assert.ok(!tr4.has(w), w);
  for (const w of ['fag', 'cum', 'tit', 'sex', 'ass']) assert.ok(!en3.has(w), w);
  for (const w of ['fuck', 'shit', 'cunt', 'rape', 'slut', 'porn', 'jews']) assert.ok(!en4.has(w), w);
  // valid but never played by the bot
  assert.ok(tr4.has('kaka') && !tr4.isCommon('kaka'));
  assert.ok(en4.has('kill') && !en4.isCommon('kill'));
  assert.ok(en4.has('tony') && !en4.isCommon('tony'));
});
test('Türkçe: türetilmiş kelimeler geçer, çekimli biçimler geçmez', () => {
  const tr4 = new KT.Lexicon(WORDS, 'tr', 4);
  for (const w of ['ünlü', 'uçuş', 'iniş', 'atış', 'okçu', 'etli', 'üçlü', 'yeme']) assert.ok(tr4.has(w) && tr4.isCommon(w), w);
  for (const w of ['evci', 'öpüş', 'işli']) assert.ok(tr4.has(w), w);
  assert.ok(tr4.has('ölme') && !tr4.isCommon('ölme'));
  for (const w of ['bana', 'evde', 'oldu', 'gücü', 'aklı']) assert.ok(!tr4.has(w), w);
});
test('Türkçe: fiil kökleri geçer (GEL, ANLA), ekli haller geçmez (EVDE, ALDI, BANA)', () => {
  const tr3 = new KT.Lexicon(WORDS, 'tr', 3), tr4 = new KT.Lexicon(WORDS, 'tr', 4);
  for (const w of ['gel', 'git', 'yap', 'ver', 'oku', 'sus']) assert.ok(tr3.has(w) && tr3.isCommon(w), w);
  for (const w of ['anla', 'otur', 'oyna', 'unut', 'izle', 'kalk']) assert.ok(tr4.has(w) && tr4.isCommon(w), w);
  for (const w of ['eve', 'evi', 'işi', 'adı', 'onu', 'idi']) assert.ok(!tr3.has(w), w);
  for (const w of ['evde', 'yolu', 'suyu', 'aldı', 'oldu', 'bana', 'onun', 'gücü']) assert.ok(!tr4.has(w), w);
  for (const w of ['taşı', 'dile', 'akla']) assert.ok(!tr4.has(w), w);          // roots that read as inflected nouns
  for (const w of ['döv', 'boğ', 'kus', 'sok']) assert.ok(tr3.has(w) && !tr3.isCommon(w), w);   // never by the bot
  for (const w of ['sik', 'göt', 'amı']) assert.ok(!tr3.has(w), w);
  for (const w of ['masa', 'kale', 'ünlü', 'uçuş']) assert.ok(tr4.has(w) && tr4.isCommon(w), w);
  assert.ok(!WORDS.tr.x, 'inflected-form lists are gone');
});

console.log('Türkçe harfler');
test('İ/ı büyük-küçük harf', () => {
  assert.strictEqual(KT.upper('iyi', 'tr'), 'İYİ');
  assert.strictEqual(KT.upper('ılık', 'tr'), 'ILIK');
  assert.strictEqual(KT.lower('İYİ', 'tr'), 'iyi');
  assert.strictEqual(KT.lower('ILIK', 'tr'), 'ılık');
  assert.strictEqual(KT.upper('kite', 'en'), 'KITE');
  assert.strictEqual(KT.KEYS.tr.join('').length, 29);
  assert.strictEqual(new Set(KT.KEYS.tr.join('')).size, 29);
  for (const c of WORDS.tr.alpha) assert.ok(KT.KEYS.tr.join('').includes(c), c);
  for (const c of WORDS.en.alpha) assert.ok(KT.KEYS.en.join('').includes(c), c);
});

console.log('Sözlük araması');
test('komşular ve fark', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4);
  const n = lex.neighbours('kasa');
  for (const w of ['kara', 'kase', 'kaza', 'masa']) assert.ok(n.includes(w), w);
  assert.ok(!n.includes('kasa'));
  assert.strictEqual(lex.diff('kasa', 'kara'), 2);
  assert.strictEqual(lex.diff('kasa', 'kasa'), -1);
  assert.strictEqual(lex.diff('kasa', 'kare'), -1);
  assert.strictEqual(lex.diff('kasa', 'kas'), -1);
  const used = new Set(['kara']);
  assert.ok(!lex.neighbours('kasa', used).includes('kara'));
});

console.log('Kurallar');
function newMatch(seed, opts) {
  const lex = new KT.Lexicon(WORDS, 'tr', 4);
  return new KT.Match(Object.assign({ lex, players: [{ name: 'A' }, { name: 'B' }], random: KT.seeded(seed) }, opts || {}));
}
test('başlangıç kelimesi, cevap, hatalar', () => {
  const m = newMatch(1);
  assert.strictEqual(m.phase, 'start');
  assert.strictEqual(m.point.options.length, 3);
  assert.strictEqual(m.start('zzzz').ok, false);
  const s = m.point.options[0];
  assert.ok(m.start(s).ok);
  assert.strictEqual(m.point.turn, 1);
  assert.strictEqual(m.phase, 'rally');
  assert.strictEqual(m.check(s).reason, 'same');
  const two = s.slice(0, 2) + (s[2] === 'a' ? 'e' : 'a') + (s[3] === 'a' ? 'e' : 'a');
  assert.strictEqual(m.check(two).reason, 'one-letter');
  assert.strictEqual(m.check(s.slice(0, 3) + 'ğ').reason === 'unknown' || m.lex.has(s.slice(0, 3) + 'ğ'), true);
  const back = m.lex.neighbours(s, m.point.used).find(w => m.lex.neighbours(w, new Set([s, w])).length > 0);
  const r = m.shot(back);
  assert.ok(r.ok && !r.how, JSON.stringify(r));
  assert.strictEqual(m.point.turn, 0);
  assert.strictEqual(m.check(s).reason, 'used');
  assert.strictEqual(m.stats.words[1], 1);
});
test('süre kısalıyor, bonus ekleniyor', () => {
  const m = newMatch(2, { pace: 'normal', players: [{ name: 'A' }, { name: 'B', bonus: 2 }] });
  m.start(m.point.options[0]);
  assert.strictEqual(m.shotTime(), 7 + 2);         // B answers the first word with +2
  const w = m.lex.neighbours(m.point.word, m.point.used).find(x => m.lex.neighbours(x, new Set([m.point.word, x])).length > 0);
  m.shot(w);
  assert.ok(Math.abs(m.shotTime() - 6.6) < 1e-9);   // A, second answer
  assert.strictEqual(KT.PACES.hizli.min, 2.5);
});
test('süre biterse sayı rakibin; yazılabilecek kelimeler gösterilir', () => {
  const m = newMatch(3);
  const s = m.point.options[0];
  m.start(s);
  const res = m.timeout();
  assert.strictEqual(res.winner, 0);
  assert.strictEqual(res.how, 'time');
  assert.ok(res.left.common.length >= 4);
  assert.deepStrictEqual(m.points, [1, 0]);
  assert.strictEqual(m.phase, 'pointOver');
  assert.strictEqual(m.stats.misses[1], 1);
});
test('çıkmaz: çıkışı olmayan kelime sayıyı hemen alır', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4);
  // find a start word s and an answer v that leaves no way out
  let found = null;
  for (const s of lex.serves) {
    for (const v of lex.neighbours(s)) {
      if (lex.neighbours(v, new Set([s, v])).length === 0) { found = [s, v]; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'no dead-end pair in data');
  const m = newMatch(4);
  m.point.options = [found[0], 'x', 'y'];
  m.start(found[0]);
  const r = m.shot(found[1]);
  assert.ok(r.ok);
  assert.strictEqual(r.how, 'dead');
  assert.strictEqual(r.winner, 1);
  assert.strictEqual(m.stats.deadEnds[1], 1);
});
test('sayı yarışı: başlayan her sayıda değişir, maç sayısı, hedefe ulaşan kazanır', () => {
  const m = newMatch(5, { target: 5, firstStarter: 1 });
  const starters = [];
  const win = (p) => { starters.push(m.starter); m.start(m.point.options[0]); if (m.point.turn === p) { // p must answer: make p's opponent miss instead
      const w = m.lex.neighbours(m.point.word, m.point.used).find(x => m.lex.neighbours(x, new Set([...m.point.used, x])).length > 0);
      m.shot(w); }
    const r = m.timeout(); assert.strictEqual(r.winner, p); m.next(); return r; };
  win(0); win(1); win(0); win(0);
  assert.deepStrictEqual(m.points, [3, 1]);
  assert.deepStrictEqual(starters, [1, 0, 1, 0]);
  assert.strictEqual(m.pointFor(0), null);
  win(0);
  assert.strictEqual(m.pointFor(0), 'match');
  assert.strictEqual(m.pointFor(1), null);
  win(1); win(1); win(1);
  assert.deepStrictEqual(m.points, [4, 4]);
  assert.strictEqual(m.pointFor(1), 'match');
  const last = win(0);
  assert.ok(last.matchOver);
  assert.deepStrictEqual(last.points, [5, 4]);
  assert.strictEqual(m.winner, 0);
  assert.strictEqual(m.phase, 'matchOver');
  assert.strictEqual(KT.TARGET[1] < KT.TARGET[2], true);
});

console.log('Saat (maç boyu süre)');
const answer = m => m.lex.neighbours(m.point.word, m.point.used).find(x => m.lex.neighbours(x, new Set([...m.point.used, x])).length > 0);
test('saat: süre maç boyu, yalnız sıradakinden gider, her kelime +2 (handikap da eklenir)', () => {
  const m = newMatch(11, { pace: 'saat', bank: 30, players: [{ name: 'A' }, { name: 'B', bonus: 2 }] });
  assert.ok(m.clockMode);
  assert.deepStrictEqual(m.banks, [30, 30]);
  m.start(m.point.options[0]);              // the starting word is not on the clock
  assert.strictEqual(m.shotTime(), 30);
  m.shot(answer(m), 4.5);                   // B: 30 - 4.5 + 2 + 2
  assert.deepStrictEqual(m.banks, [30, 29.5]);
  assert.strictEqual(m.shotTime(), 30);     // A's clock has not moved
  m.shot(answer(m), 7.25);                  // A: 30 - 7.25 + 2
  assert.deepStrictEqual(m.banks, [24.75, 29.5]);
  assert.strictEqual(m.shotTime(0), 24.75);
  assert.strictEqual(m.paceName, 'saat');
  assert.deepStrictEqual(KT.CLOCK.banks.includes(KT.CLOCK.bank), true);
  // the default bank, and the old paces still work
  assert.deepStrictEqual(newMatch(12, { pace: 'saat' }).banks, [KT.CLOCK.bank, KT.CLOCK.bank]);
  assert.strictEqual(newMatch(13, { pace: 'rahat' }).clockMode, false);
});
test('saat: süresi biten maçı kaybeder (sayısı önde olsa da)', () => {
  const m = newMatch(14, { pace: 'saat', bank: 20, target: 5, firstStarter: 0 });
  // B gives three points away
  for (let i = 0; i < 3; i++) {
    m.start(m.point.options[0]);
    if (m.point.turn === 0) m.shot(answer(m), 1);
    const r = m.pass(1);
    assert.strictEqual(r.how, 'pass');
    assert.ok(!r.matchOver);
    m.next();
  }
  assert.deepStrictEqual(m.points, [3, 0]);
  const lead = 0;
  m.start(m.point.options[0]);
  if (m.point.turn !== lead) m.shot(answer(m), 1);
  assert.strictEqual(m.point.turn, lead);
  const r = m.timeout();
  assert.ok(r.matchOver && r.flag);
  assert.strictEqual(r.how, 'time');
  assert.strictEqual(m.winner, 1 - lead);          // the one behind wins: the leader's clock ran out
  assert.strictEqual(m.banks[lead], 0);
  assert.strictEqual(m.phase, 'matchOver');
});
test('saat: sayıyı ver (pas) sayıyı rakibe verir, kalan süre kalır; çıkmaz yine sayı', () => {
  const m = newMatch(15, { pace: 'saat', bank: 30, firstStarter: 0 });
  m.start(m.point.options[0]);
  const r = m.pass(6);
  assert.strictEqual(r.winner, 0);
  assert.strictEqual(r.how, 'pass');
  assert.ok(r.left.common.length >= 1, 'shows what could have been played');
  assert.deepStrictEqual(m.banks, [30, 24]);
  assert.strictEqual(m.stats.passes[1], 1);
  assert.strictEqual(m.stats.misses[1], 0);
  m.next();
  // passing with no time left is running out of time
  m.start(m.point.options[0]);
  const late = m.pass(99);
  assert.ok(late.flag && late.matchOver);
  // no passing in the normal paces
  const n = newMatch(16, { pace: 'normal' });
  n.start(n.point.options[0]);
  assert.strictEqual(n.pass(1), null);
});
test('saat: çıkmaz sayıyı hemen alır ve maç sürer', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4);
  let found = null;
  for (const s of lex.serves) {
    for (const v of lex.neighbours(s)) if (lex.neighbours(v, new Set([s, v])).length === 0) { found = [s, v]; break; }
    if (found) break;
  }
  const m = newMatch(17, { pace: 'saat', bank: 30 });
  m.point.options = [found[0], 'x', 'y'];
  m.start(found[0]);
  const r = m.shot(found[1], 3);
  assert.strictEqual(r.how, 'dead');
  assert.ok(!r.matchOver && !r.flag);
  assert.deepStrictEqual(r.banks, [30, 29]);
});
test('saat: aynı hamleler iki telefonda aynı süreleri verir', () => {
  const a = newMatch(18, { pace: 'saat', bank: 45 }), b = newMatch(18, { pace: 'saat', bank: 45 });
  const times = [1.37, 2.01, 0.33, 4.99, 3.14, 2.72, 1.01];
  for (const m of [a, b]) {
    m.start(m.point.options[0]);
    for (const u of times) { const w = answer(m); if (!w) break; const r = m.shot(w, u); if (r.how) break; }
  }
  assert.deepStrictEqual(a.banks, b.banks);
  for (const x of a.banks) assert.strictEqual(x, Math.round(x * 100) / 100);
});

console.log('Uzat / kısalt');
function resizeMatch(seed, rights, opts) {
  const lex = new KT.Lexicon(WORDS, 'tr', 4, KT.RESIZE.lens);
  return new KT.Match(Object.assign({ lex, players: [{ name: 'A' }, { name: 'B' }], random: KT.seeded(seed), resize: rights }, opts || {}));
}
test('sözlükte 5 harfliler: ELMAS, KALEM, fiil kökleri (BAŞLA, KONUŞ); ekli haller ve kaba kelimeler yok', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4, KT.RESIZE.lens);
  for (const w of ['elmas', 'kalem', 'masal', 'kasap', 'başla', 'konuş', 'çalış', 'öğren']) assert.ok(lex.has(w) && lex.isCommon(w), w);
  for (const w of ['evden', 'aldım', 'seviş', 'porno', 'fuhuş']) assert.ok(!lex.has(w), w);
  for (const w of ['öldür', 'savaş', 'alkol', 'bitti', 'namaz', 'becer']) assert.ok(lex.has(w) && !lex.isCommon(w), w);
  assert.deepStrictEqual([lex.minLen, lex.maxLen], [3, 5]);
  assert.ok(new KT.Lexicon(WORDS, 'tr', 4).maxLen === 4, 'without resize only 4 letters');
  const en = new KT.Lexicon(WORDS, 'en', 4, KT.RESIZE.lens);
  for (const w of ['words', 'cards', 'heart']) assert.ok(en.isCommon(w), w);
  for (const w of ['texas', 'paris', 'fucks']) assert.ok(!en.isCommon(w), w);
});
test('uzat ve kısalt: KASA → KASAP → KASA olmaz (yandı), ELMA → ELMAS, KALEM → KALE; haklar düşer', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4, KT.RESIZE.lens);
  assert.deepStrictEqual(lex.step('elma', 'elmas'), { kind: 'add', at: 4 });
  assert.deepStrictEqual(lex.step('kalem', 'kale'), { kind: 'del', at: 4 });
  assert.deepStrictEqual(lex.step('kasa', 'akasa'), { kind: 'add', at: 0 });
  assert.strictEqual(lex.step('kasa', 'kasapp'), null);
  assert.deepStrictEqual(lex.step('masa', 'mas'), { kind: 'del', at: 3 });
  assert.strictEqual(lex.step('masa', 'kaya'), null);
  const m = resizeMatch(21, 2, { firstStarter: 0 });
  m.point.options = ['kasa', 'x', 'y'];
  m.start('kasa');
  const r = m.shot('kasap');                        // B adds a letter
  assert.ok(r.ok && r.kind === 'add', JSON.stringify(r));
  assert.deepStrictEqual(m.rights, [2, 1]);
  assert.strictEqual(m.check('kasa').reason, 'used'); // A takes it out: KASA was played this point
  assert.strictEqual(m.check('kasp').reason, 'unknown'); // KASAP without its second A: not a word
  assert.strictEqual(m.stats.resizes[1], 1);
});
test('hak bitince uzat/kısalt yok; kapalıyken hiç yok; en çok 5, en az 3 harf', () => {
  const m = resizeMatch(22, 1, { firstStarter: 0 });
  m.point.options = ['elma', 'x', 'y'];
  m.start('elma');
  assert.ok(m.shot('elmas').ok);                   // B's only right
  m.shot(m.lex.neighbours('elmas', m.point.used).find(w => w.length === 5) || 'elmas');
  if (m.phase === 'rally' && m.point.turn === 1) {
    const add = m.lex.resizes(m.point.word, m.point.used)[0];
    if (add) assert.strictEqual(m.check(add).reason, 'no-resize');
  }
  const off = new KT.Match({ lex: new KT.Lexicon(WORDS, 'tr', 4), players: [{ name: 'A' }, { name: 'B' }], random: KT.seeded(23), firstStarter: 0 });
  off.point.options = ['elma', 'x', 'y'];
  off.start('elma');
  assert.strictEqual(off.check('elmas').reason, 'no-resize');
  const all = resizeMatch(24, Infinity, { firstStarter: 0 });
  all.point.options = ['kale', 'x', 'y'];
  all.start('kale');
  assert.ok(all.shot('kalem').ok);
  assert.strictEqual(all.rights[1], Infinity);
  assert.ok(all.lex.resizes('kalem').every(w => w.length >= 3 && w.length <= 5));
});
test('çıkmaz: rakibin uzat/kısalt hakkı varsa onunla çıkış da sayılır', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4, KT.RESIZE.lens);
  // a 4-letter word with no same-length way out but a way out by adding or taking out a letter
  let found = null;
  for (const s of lex.serves) {
    for (const v of lex.neighbours(s)) {
      if (v.length !== 4) continue;
      const u = new Set([s, v]);
      if (lex.neighbours(v, u).length === 0 && lex.resizes(v, u).length > 0) { found = [s, v]; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'no such pair');
  const on = resizeMatch(25, 2, { firstStarter: 0 });
  on.point.options = [found[0], 'x', 'y'];
  on.start(found[0]);
  const r = on.shot(found[1]);
  assert.ok(r.ok && !r.how, 'not a dead end: A can still add or take out a letter');
  const off = resizeMatch(26, 0, { firstStarter: 0 });
  off.point.options = [found[0], 'x', 'y'];
  off.start(found[0]);
  assert.strictEqual(off.shot(found[1]).how, 'dead');
});

console.log('Bot');
function botMatch(lang, len, levels, seed, opts) {
  const o = opts || {};
  const lex = new KT.Lexicon(WORDS, lang, len, o.resize ? KT.RESIZE.lens : undefined);
  const r = KT.seeded(seed);
  const m = new KT.Match({ lex, players: [{ name: 'A' }, { name: 'B' }], random: r, pace: o.pace || 'normal', bank: o.bank, resize: o.resize, target: o.target || KT.TARGET[1] });
  const bots = levels.map(l => new KT.Bot(l, r));
  let seconds = 0, guard = 0;
  while (m.phase !== 'matchOver' && guard++ < 5000) {
    if (m.phase === 'pointOver') { m.next(); seconds += 3.5; continue; }
    if (m.phase === 'start') { const s = bots[m.starter].open(m); seconds += s.delay + 0.7; m.start(s.word); continue; }
    const p = m.point.turn, t = m.shotTime();
    const rep = bots[p].reply(m);
    if (rep.pass && rep.delay < t) { seconds += rep.delay; m.pass(rep.delay); continue; }
    if (!rep.word || rep.delay >= t) { seconds += t; m.timeout(); continue; }
    assert.ok(lex.isCommon(rep.word), 'bot played a rare word ' + rep.word);
    assert.ok(!m.point.used.has(rep.word), 'bot replayed ' + rep.word);
    seconds += rep.delay + 0.6;
    const res = m.shot(rep.word, rep.delay);
    assert.ok(res.ok, JSON.stringify(res) + ' ' + rep.word);
  }
  assert.strictEqual(m.phase, 'matchOver');
  return { m, seconds };
}
const report = {};
const cases = [['tr', 4], ['tr', 3], ['en', 4], ['en', 3]];
for (const [lang, len] of cases) {
  const name = `${lang}/${len}`;
  test(`${name}: bot maçları biter, zor bot kolayı yener`, () => {
    let zorWins = 0, chain = 0, points = 0, secs = 0, dead = 0, mins = { 1: 0, 2: 0 };
    const N = 120;
    for (let i = 0; i < N; i++) {
      const { m, seconds } = botMatch(lang, len, i % 2 ? ['zor', 'kolay'] : ['kolay', 'zor'], 1000 + i);
      if (m.winner === (i % 2 ? 0 : 1)) zorWins++;
      chain += m.history.reduce((a, h) => a + h.chain, 0);
      points += m.history.length;
      dead += m.stats.deadEnds[0] + m.stats.deadEnds[1];
      secs += seconds;
    }
    for (const f of [1, 2]) {
      for (let i = 0; i < 40; i++) mins[f] += botMatch(lang, len, ['orta', 'orta'], 7000 + i, { target: KT.TARGET[f] }).seconds / 60 / 40;
    }
    report[name] = {
      'zor kazanır': Math.round(100 * zorWins / N) + '%',
      'zincir (kelime)': +(chain / points).toFixed(1),
      'çıkmaz': Math.round(100 * dead / points) + '%',
      [`kısa (${KT.TARGET[1]}) ~dk`]: +mins[1].toFixed(1),
      [`uzun (${KT.TARGET[2]}) ~dk`]: +mins[2].toFixed(1),
    };
    assert.ok(zorWins / N > 0.7, 'zor won only ' + zorWins);
  });
}

// pace 'saat': how long the clock lasts, for bots (people are slower: think of the kolay bot)
const clockReport = {};
for (const bank of KT.CLOCK.banks) {
  test(`saat ${bank} sn (tr/4): bot maçları biter`, () => {
    for (const lv of ['kolay', 'orta', 'zor']) {
      let flags = 0, secs = 0, passes = 0, left = 0;
      const N = 60;
      for (let i = 0; i < N; i++) {
        const { m, seconds } = botMatch('tr', 4, [lv, lv], 9000 + i, { pace: 'saat', bank });
        if (m.history[m.history.length - 1].flag) flags++;
        passes += m.stats.passes[0] + m.stats.passes[1];
        left += (m.banks[0] + m.banks[1]) / 2;
        secs += seconds;
        assert.ok(m.banks.every(x => x >= 0));
      }
      clockReport[`${bank} sn · ${lv}`] = {
        'süresi biten maç': Math.round(100 * flags / N) + '%',
        'maçta pas': +(passes / N).toFixed(1),
        'kalan süre (ort.)': Math.round(left / N) + ' sn',
        'maç ~dk': +(secs / 60 / N).toFixed(1),
      };
    }
  });
}

// uzat/kısalt: how the rallies change (bots of the same level, normal time, tr/4)
const resizeReport = {};
for (const [name, rights] of [['kapalı', 0], ['maçta 2', 2], ['her zaman', Infinity]]) {
  test(`uzat/kısalt ${name} (tr/4): bot maçları biter`, () => {
    for (const lv of ['orta', 'zor']) {
      let chain = 0, points = 0, dead = 0, secs = 0, resizes = 0, five = 0, three = 0, played = 0;
      const words = new Map();
      const N = 60;
      for (let i = 0; i < N; i++) {
        const { m, seconds } = botMatch('tr', 4, [lv, lv], 11000 + i, { resize: rights });
        for (const h of m.history) {
          chain += h.chain; points++;
          for (const s of h.shots) { words.set(s.word, (words.get(s.word) || 0) + 1); played++; if (s.word.length === 5) five++; if (s.word.length === 3) three++; }
        }
        dead += m.stats.deadEnds[0] + m.stats.deadEnds[1];
        resizes += m.stats.resizes[0] + m.stats.resizes[1];
        secs += seconds;
      }
      const top = [...words.values()].sort((a, b) => b - a).slice(0, 100).reduce((a, b) => a + b, 0);
      resizeReport[`${name} · ${lv}`] = {
        'zincir (kelime)': +(chain / points).toFixed(1),
        'çıkmaz': Math.round(100 * dead / points) + '%',
        'maçta uzat/kısalt': +(resizes / N).toFixed(1),
        '5 / 3 harf': Math.round(100 * five / played) + '% / ' + Math.round(100 * three / played) + '%',
        'farklı kelime': words.size,
        'sık 100': Math.round(100 * top / played) + '%',
        'maç ~dk': +(secs / 60 / N).toFixed(1),
      };
    }
  });
}

console.log(`\nÖzet (bot maçları, normal süre; dakikalar orta-orta, kısa ${KT.TARGET[1]}, uzun ${KT.TARGET[2]} sayı):`);
console.table(report);
console.log(`\nSaat modu (tr/4, kısa maç, iki bot aynı seviyede, her kelime +${KT.CLOCK.inc} sn):`);
console.table(clockReport);
console.log('\nUzat/kısalt (tr/4, kısa maç, normal süre, iki bot aynı seviyede, 60 maç):');
console.table(resizeReport);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
