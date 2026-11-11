// Kelime Düellosu çekirdek denemesi:  node lab/kelime-tenisi/src/test/core.test.js
// Sözlük verisi (ekli kelimeler dahil), Türkçe büyük/küçük harf, kurallar (cevap, çıkmaz, süre, sayı yarışı), bot.
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
      const sets = [d.common[len], d.rare[len]].concat(d.x ? [d.x.common[len], d.x.rare[len]] : []);
      const all = [].concat(...sets.map(x => x ? x.split(' ') : []));
      assert.strictEqual(new Set(all).size, all.length, 'duplicate');
      for (const w of all) {
        assert.strictEqual(w.length, len, w);
        for (const c of w) assert.ok(d.alpha.includes(c), w);
      }
      for (const ekli of d.x ? [false, true] : [false]) {
        const lex = new KT.Lexicon(WORDS, lang, len, { ekli });
        for (const s of lex.serves) {
          assert.ok(lex.isCommon(s), s);
          assert.ok(!lex.root(s) && d.common[len].split(' ').includes(s), 'starting word is not a dictionary word: ' + s);
          assert.ok(lex.neighbours(s, null, true).length >= 4, s);
        }
        assert.ok(lex.serves.length > 100, 'start word count ' + lex.serves.length);
      }
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
test('Türkçe ekli kelimeler: EVDE, ALDI, BANA geçer; kaba köklü ekli biçim geçmez; kök gösterilir', () => {
  const tr3 = new KT.Lexicon(WORDS, 'tr', 3, { ekli: true }), tr4 = new KT.Lexicon(WORDS, 'tr', 4, { ekli: true });
  assert.ok(tr4.ekli && !new KT.Lexicon(WORDS, 'tr', 4).ekli);
  for (const w of ['evde', 'aldı', 'bana', 'onun', 'oldu', 'gücü', 'yolu']) assert.ok(tr4.has(w) && tr4.isCommon(w), w);
  for (const w of ['gel', 'git', 'yap', 'eve', 'işi']) assert.ok(tr3.has(w) && tr3.isCommon(w), w);
  for (const w of ['masa', 'kale', 'ünlü']) assert.ok(tr4.has(w) && tr4.isCommon(w), w);   // dictionary words stay
  for (const w of ['göte', 'götü', 'siki', 'sike', 'boka', 'boku', 'piçi']) assert.ok(!tr4.has(w), w);
  for (const w of ['amı', 'göt', 'sik']) assert.ok(!tr3.has(w), w);
  for (const w of ['öldü', 'kanı']) assert.ok(!tr4.isCommon(w), w);       // soft roots: never by the bot
  for (const w of ['yada', 'şuan', 'emre']) assert.ok(!tr4.isCommon(w), w); // frequent for other reasons
  assert.strictEqual(tr4.root('aldı'), 'almak');
  assert.strictEqual(tr4.root('evde'), 'ev');
  assert.strictEqual(tr4.root('masa'), null);                              // dictionary words: no root shown
  assert.strictEqual(new KT.Lexicon(WORDS, 'tr', 4).root('aldı'), null);
  // more ways out in the inflected rule
  const d = new KT.Lexicon(WORDS, 'tr', 4);
  assert.ok(tr4.neighbours('oyun', null, true).length > d.neighbours('oyun', null, true).length);
  assert.ok(!new KT.Lexicon(WORDS, 'en', 4, { ekli: true }).ekli);          // English has no such rule
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

console.log('Bot');
function botMatch(lang, len, levels, seed, opts) {
  const o = opts || {};
  const lex = new KT.Lexicon(WORDS, lang, len, { ekli: !!o.ekli });
  const r = KT.seeded(seed);
  const m = new KT.Match({ lex, players: [{ name: 'A' }, { name: 'B' }], random: r, pace: o.pace || 'normal', target: o.target || KT.TARGET[1] });
  const bots = levels.map(l => new KT.Bot(l, r));
  let seconds = 0, guard = 0;
  while (m.phase !== 'matchOver' && guard++ < 5000) {
    if (m.phase === 'pointOver') { m.next(); seconds += 3.5; continue; }
    if (m.phase === 'start') { const s = bots[m.starter].open(m); seconds += s.delay + 0.7; m.start(s.word); continue; }
    const p = m.point.turn, t = m.shotTime();
    const rep = bots[p].reply(m);
    if (!rep.word || rep.delay >= t) { seconds += t; m.timeout(); continue; }
    assert.ok(lex.isCommon(rep.word), 'bot played a rare word ' + rep.word);
    assert.ok(!m.point.used.has(rep.word), 'bot replayed ' + rep.word);
    seconds += rep.delay + 0.6;
    const res = m.shot(rep.word);
    assert.ok(res.ok, JSON.stringify(res));
  }
  assert.strictEqual(m.phase, 'matchOver');
  return { m, seconds };
}
const report = {};
const cases = [['tr', 4, true], ['tr', 3, true], ['tr', 4, false], ['tr', 3, false], ['en', 4, false], ['en', 3, false]];
for (const [lang, len, ekli] of cases) {
  const name = `${lang}/${len}${lang === 'tr' ? (ekli ? ' ekli' : ' sözlük') : ''}`;
  test(`${name}: bot maçları biter, zor bot kolayı yener`, () => {
    let zorWins = 0, chain = 0, points = 0, secs = 0, dead = 0, mins = { 1: 0, 2: 0 };
    const N = 120;
    for (let i = 0; i < N; i++) {
      const { m, seconds } = botMatch(lang, len, i % 2 ? ['zor', 'kolay'] : ['kolay', 'zor'], 1000 + i, { ekli });
      if (m.winner === (i % 2 ? 0 : 1)) zorWins++;
      chain += m.history.reduce((a, h) => a + h.chain, 0);
      points += m.history.length;
      dead += m.stats.deadEnds[0] + m.stats.deadEnds[1];
      secs += seconds;
    }
    for (const f of [1, 2]) {
      for (let i = 0; i < 40; i++) mins[f] += botMatch(lang, len, ['orta', 'orta'], 7000 + i, { ekli, target: KT.TARGET[f] }).seconds / 60 / 40;
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

console.log(`\nÖzet (bot maçları, normal süre; dakikalar orta-orta, kısa ${KT.TARGET[1]}, uzun ${KT.TARGET[2]} sayı):`);
console.table(report);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
