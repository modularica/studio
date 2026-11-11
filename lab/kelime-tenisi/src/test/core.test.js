// Kelime Tenisi çekirdek denemesi:  node lab/kelime-tenisi/src/test/core.test.js
// Sözlük verisi, Türkçe büyük/küçük harf, kurallar (vuruş, smaç, süre, tenis sayısı), bot.
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
    test(`${lang}/${len}: harfler, uzunluk, tekrar yok, servisler bilinen ve komşulu`, () => {
      const d = WORDS[lang];
      const common = d.common[len].split(' '), rare = d.rare[len].split(' '), serve = d.serve[len].split(' ');
      const all = common.concat(rare);
      assert.strictEqual(new Set(all).size, all.length, 'duplicate');
      for (const w of all) {
        assert.strictEqual(w.length, len, w);
        for (const c of w) assert.ok(d.alpha.includes(c), w);
      }
      const lex = new KT.Lexicon(WORDS, lang, len);
      for (const s of serve) {
        assert.ok(lex.isCommon(s), s);
        assert.ok(lex.neighbours(s, null, true).length >= 4, s);
      }
      assert.ok(serve.length > 100, 'serve count ' + serve.length);
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
test('servis, vuruş, hatalar', () => {
  const m = newMatch(1);
  assert.strictEqual(m.phase, 'serve');
  assert.strictEqual(m.point.serveOptions.length, 3);
  assert.strictEqual(m.serve('zzzz').ok, false);
  const s = m.point.serveOptions[0];
  assert.ok(m.serve(s).ok);
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
  m.serve(m.point.serveOptions[0]);
  assert.strictEqual(m.shotTime(), 7 + 2);         // B returns the serve with +2
  const w = m.lex.neighbours(m.point.word, m.point.used).find(x => m.lex.neighbours(x, new Set([m.point.word, x])).length > 0);
  m.shot(w);
  assert.ok(Math.abs(m.shotTime() - 6.6) < 1e-9);   // A, second shot
  assert.strictEqual(KT.PACES.hizli.min, 2.5);
});
test('süre biterse sayı vurana; dönebileceği kelimeler gösterilir', () => {
  const m = newMatch(3);
  const s = m.point.serveOptions[0];
  m.serve(s);
  const res = m.timeout();
  assert.strictEqual(res.winner, 0);
  assert.strictEqual(res.how, 'time');
  assert.ok(res.left.common.length >= 4);
  assert.strictEqual(m.points[0], 1);
  assert.strictEqual(m.scoreText(0), '15');
  assert.strictEqual(m.phase, 'pointOver');
  assert.strictEqual(m.stats.misses[1], 1);
});
test('smaç: dönüşü olmayan kelime sayıyı hemen alır', () => {
  const lex = new KT.Lexicon(WORDS, 'tr', 4);
  // find a serve s and a reply v of s that leaves no valid return
  let found = null;
  for (const s of lex.serves) {
    for (const v of lex.neighbours(s)) {
      if (lex.neighbours(v, new Set([s, v])).length === 0) { found = [s, v]; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'no smash pair in data');
  const m = newMatch(4);
  m.point.serveOptions = [found[0], 'x', 'y'];
  m.serve(found[0]);
  const r = m.shot(found[1]);
  assert.ok(r.ok);
  assert.strictEqual(r.how, 'smash');
  assert.strictEqual(r.winner, 1);
  assert.strictEqual(m.stats.smashes[1], 1);
});
test('tenis sayısı: 15-30-40, altın sayı, oyun, servis değişir, maç biter', () => {
  const m = newMatch(5, { gamesToWin: 2 });
  const win = (p) => { m.serve(m.point.serveOptions[0]); if (m.point.turn === p) { // p must answer: make p's opponent miss instead
      const w = m.lex.neighbours(m.point.word, m.point.used).find(x => m.lex.neighbours(x, new Set([...m.point.used, x])).length > 0);
      m.shot(w); }
    const r = m.timeout(); assert.strictEqual(r.winner, p); m.next(); return r; };
  win(0); win(0); win(0);
  assert.deepStrictEqual([m.scoreText(0), m.scoreText(1)], ['40', '0']);
  assert.strictEqual(m.pointFor(0), 'game');
  win(1); win(1); win(1);
  assert.ok(m.goldenPoint());
  const g = win(1);
  assert.ok(g.gameOver && !g.matchOver);
  assert.deepStrictEqual(m.games, [0, 1]);
  assert.strictEqual(m.server, 1);                  // A served game 1, B serves game 2
  win(1); win(1); win(1);
  assert.strictEqual(m.pointFor(1), 'match');
  const last = win(1);
  assert.ok(last.matchOver);
  assert.strictEqual(m.winner, 1);
  assert.strictEqual(m.phase, 'matchOver');
});

console.log('Bot');
function botMatch(lang, len, levels, seed, pace) {
  const lex = new KT.Lexicon(WORDS, lang, len);
  const r = KT.seeded(seed);
  const m = new KT.Match({ lex, players: [{ name: 'A' }, { name: 'B' }], random: r, pace: pace || 'normal', gamesToWin: 2 });
  const bots = levels.map(l => new KT.Bot(l, r));
  let seconds = 0, guard = 0;
  while (m.phase !== 'matchOver' && guard++ < 5000) {
    if (m.phase === 'pointOver') { m.next(); seconds += 3.5; continue; }
    if (m.phase === 'serve') { const s = bots[m.server].serve(m); seconds += s.delay + 0.7; m.serve(s.word); continue; }
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
for (const [lang, len] of [['tr', 4], ['tr', 3], ['en', 4], ['en', 3]]) {
  test(`${lang}/${len}: bot maçları biter, zor bot kolayı yener`, () => {
    let zorWins = 0, rally = 0, points = 0, secs = 0, smash = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const { m, seconds } = botMatch(lang, len, i % 2 ? ['zor', 'kolay'] : ['kolay', 'zor'], 1000 + i);
      if (m.winner === (i % 2 ? 0 : 1)) zorWins++;
      rally += m.history.reduce((a, h) => a + h.rally, 0);
      points += m.history.length;
      smash += m.stats.smashes[0] + m.stats.smashes[1];
      secs += seconds;
    }
    report[`${lang}/${len}`] = {
      'zor kazanır': Math.round(100 * zorWins / N) + '%',
      'ralli (kelime)': +(rally / points).toFixed(1),
      'smaç': Math.round(100 * smash / points) + '%',
      'sayı/maç': +(points / N).toFixed(1),
      'maç ~dk': +(secs / N / 60).toFixed(1),
    };
    assert.ok(zorWins / N > 0.7, 'zor won only ' + zorWins);
  });
}
test('orta botla orta bot: maç süresi makul', () => {
  let secs = 0, pts = 0;
  for (let i = 0; i < 60; i++) { const { m, seconds } = botMatch('tr', 4, ['orta', 'orta'], 5000 + i); secs += seconds; pts += m.history.length; }
  report['tr/4 orta-orta'] = { 'sayı/maç': +(pts / 60).toFixed(1), 'maç ~dk': +(secs / 60 / 60).toFixed(1) };
  assert.ok(secs / 60 / 60 < 10);
});

console.log('\nÖzet (bot maçları, 2 oyun alan kazanır, normal süre):');
console.table(report);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
