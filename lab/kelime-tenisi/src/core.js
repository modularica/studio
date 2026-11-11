// Kelime Düellosu: sözlük, kurallar ve bot. DOM'suz; tarayıcıda ve Node testlerinde aynı dosya.
// Oyun: kelime merdiveni karşılıklı oynanır. Gelen kelimenin tek harfini değiştirip geri gönderirsin.
// Kullanılan kelime o sayıda yanar; süresinde cevap veremeyen sayıyı kaybeder; hiç çıkışı olmayan kelime = çıkmaz.
// Uzat/kısalt (seçilirse): maçta birkaç kez (ya da her zaman) bir harf ekleyip ya da çıkarıp gönderebilirsin, 3–5 harf.
'use strict';

const KT = (function () {
  // On-screen keyboard rows (Turkish Q layout without q, w, x).
  const KEYS = {
    tr: ['ertyuıopğü', 'asdfghjklşi', 'zcvbnmöç'],
    en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  };
  const LOCALE = { tr: 'tr-TR', en: 'en-US' };
  const upper = (w, lang) => String(w).toLocaleUpperCase(LOCALE[lang] || 'en-US');
  const lower = (w, lang) => String(w).toLocaleLowerCase(LOCALE[lang] || 'en-US');

  // Clock in seconds for each answer: first answer, shrink per word, floor.
  const PACES = {
    rahat: { start: 10, step: 0.5, min: 5 },
    normal: { start: 7, step: 0.4, min: 3.5 },
    hizli: { start: 5, step: 0.3, min: 2.5 },
  };
  // pace 'saat': a chess clock. Each player has `bank` seconds for the whole match, running only on their
  // own turn; every word played adds `inc` (+ the player's handicap). Out of time = the match is lost.
  // A player who is stuck can give the point away (pass) and keep the time that is left.
  const CLOCK = { banks: [20, 30, 45, 60], bank: 30, inc: 2 };
  // Uzat/kısalt: add or remove one letter instead of changing one, within these lengths.
  const RESIZE = { lens: [3, 4, 5], rights: { off: 0, '2': 2, all: Infinity } };
  const START_TIME = 10;              // seconds to pick the starting word (then one is picked for you); not on the clock
  const TARGET = { 1: 5, 2: 9 };      // points to win: short match, long match
  const round2 = x => Math.round(x * 100) / 100;

  function seeded(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Turkish: dictionary words and the roots of well-known verbs (gel, anla); inflected forms (evde, aldı) do not count.
  // len: the length a game starts with (serves). lens: every length in play (uzat/kısalt: 3, 4 and 5).
  class Lexicon {
    constructor(words, lang, len, lens) {
      const d = words[lang];
      if (!d || !d.common[len]) throw new Error('no words for ' + lang + '/' + len);
      this.lang = lang;
      this.len = len;
      this.lens = (lens && lens.length ? lens : [len]).filter(n => d.common[n] !== undefined);
      if (!this.lens.includes(len)) this.lens.push(len);
      this.minLen = Math.min(...this.lens);
      this.maxLen = Math.max(...this.lens);
      this.alpha = d.alpha;
      const split = s => (s ? s.split(' ') : []);
      let common = [], rare = [];
      for (const n of this.lens) { common = common.concat(split(d.common[n])); rare = rare.concat(split(d.rare[n])); }
      this.commonSet = new Set(common);
      this.validSet = new Set(common.concat(rare));
      this.serves = split(d.serve[len]);
      this.buckets = new Map();
      this.longer = new Map();   // uzat: a word with one letter left out -> the longer words (kale -> kalem, ...)
      for (const w of this.validSet) {
        for (let i = 0; i < w.length; i++) {
          const k = w.slice(0, i) + '_' + w.slice(i + 1);
          let b = this.buckets.get(k);
          if (!b) this.buckets.set(k, (b = []));
          b.push(w);
          if (w.length > this.minLen) {
            const s = w.slice(0, i) + w.slice(i + 1);
            let l = this.longer.get(s);
            if (!l) this.longer.set(s, (l = []));
            if (!l.includes(w)) l.push(w);
          }
        }
      }
    }
    has(w) { return this.validSet.has(w); }
    isCommon(w) { return this.commonSet.has(w); }
    // Words one letter away from w, not in `used`. onlyCommon: the ones most people know.
    // resize: also the words with one letter more or less (uzat/kısalt).
    neighbours(w, used, onlyCommon, resize) {
      const out = [];
      for (let i = 0; i < w.length; i++) {
        const b = this.buckets.get(w.slice(0, i) + '_' + w.slice(i + 1));
        if (!b) continue;
        for (const x of b) {
          if (x === w || (used && used.has(x))) continue;
          if (onlyCommon && !this.commonSet.has(x)) continue;
          out.push(x);
        }
      }
      return resize ? out.concat(this.resizes(w, used, onlyCommon)) : out;
    }
    // Uzat/kısalt: the words with one letter added or taken out (3–5 letters), not in `used`.
    resizes(w, used, onlyCommon) {
      const out = new Set();
      const ok = x => !(used && used.has(x)) && (!onlyCommon || this.commonSet.has(x));
      for (const x of this.longer.get(w) || []) if (x.length <= this.maxLen && ok(x)) out.add(x);
      if (w.length > this.minLen) {
        for (let i = 0; i < w.length; i++) {
          const x = w.slice(0, i) + w.slice(i + 1);
          if (this.validSet.has(x) && ok(x)) out.add(x);
        }
      }
      return [...out];
    }
    // Index of the single differing letter, or -1.
    diff(a, b) {
      if (a.length !== b.length) return -1;
      let at = -1;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) { if (at >= 0) return -1; at = i; }
      }
      return at;
    }
    // How b comes from a: { kind: 'swap' | 'add' | 'del', at } (the letter changed, added or taken out), or null.
    step(a, b) {
      if (a.length === b.length) { const at = this.diff(a, b); return at < 0 ? null : { kind: 'swap', at }; }
      const [s, l, kind] = b.length === a.length + 1 ? [a, b, 'add'] : a.length === b.length + 1 ? [b, a, 'del'] : [];
      if (!kind) return null;
      let i = 0;
      while (i < s.length && s[i] === l[i]) i++;
      return l.slice(0, i) + l.slice(i + 1) === s ? { kind, at: i } : null;
    }
    pickStarts(n, r, avoid) {
      const pool = avoid ? this.serves.filter(w => !avoid.has(w)) : this.serves;
      return shuffle(pool.length >= n ? pool : this.serves, r).slice(0, n);
    }
    // For showing: common words first, each group A-Z.
    split(words) {
      const c = [], r = [];
      for (const w of words) (this.commonSet.has(w) ? c : r).push(w);
      c.sort((a, b) => a.localeCompare(b, LOCALE[this.lang]));
      r.sort((a, b) => a.localeCompare(b, LOCALE[this.lang]));
      return { common: c, rare: r };
    }
  }

  class Match {
    // opts: { lex, players: [{ name, bonus }], target, pace, bank, inc, resize, firstStarter, random }
    // resize: uzat/kısalt a player may use in the match (0: off, Infinity: always); lex needs lens 3–5 for it
    // bonus: seconds added to every answer (pace 'saat': to every word's increment)
    constructor(opts) {
      this.lex = opts.lex;
      this.players = opts.players.map(p => Object.assign({ bonus: 0 }, p));
      this.target = opts.target || TARGET[1];
      this.clockMode = opts.pace === 'saat';
      this.paceName = this.clockMode ? 'saat' : PACES[opts.pace] ? opts.pace : 'normal';
      this.pace = PACES[this.paceName] || PACES.normal;
      this.bank = this.clockMode ? (+opts.bank > 0 ? +opts.bank : CLOCK.bank) : 0;
      this.inc = opts.inc !== undefined ? +opts.inc : CLOCK.inc;
      this.banks = [this.bank, this.bank];   // seconds left on each clock (pace 'saat')
      this.resize = Math.max(0, +opts.resize || 0);
      this.rights = [this.resize, this.resize];   // uzat/kısalt left
      this.r = opts.random || Math.random;
      this.points = [0, 0];
      this.starter = opts.firstStarter === 1 ? 1 : 0;   // picks the first word of the point; alternates every point
      this.phase = 'start';         // start | rally | pointOver | matchOver
      this.winner = -1;
      this.pointsPlayed = 0;
      this.history = [];
      this.openers = new Set();     // starting words already used in this match
      this.stats = { deadEnds: [0, 0], misses: [0, 0], passes: [0, 0], resizes: [0, 0], words: [0, 0], longest: 0, longestWords: [] };
      this.point = null;
      this.newPoint();
    }
    newPoint() {
      const opts = this.lex.pickStarts(3, this.r, this.openers);
      this.point = { word: null, used: new Set(), shots: [], turn: this.starter, options: opts };
      this.phase = 'start';
    }
    start(word) {
      if (this.phase !== 'start') return { ok: false, reason: 'phase' };
      if (!this.point.options.includes(word)) return { ok: false, reason: 'not-offered' };
      const pt = this.point;
      pt.word = word;
      pt.used.add(word);
      pt.shots.push({ by: this.starter, word });
      this.openers.add(word);
      pt.turn = 1 - this.starter;
      this.phase = 'rally';
      return { ok: true };
    }
    // Seconds the player to move has for this answer (pace 'saat': what is left on their clock).
    shotTime(player) {
      const p = player === undefined ? this.point.turn : player;
      if (this.clockMode) return this.banks[p];
      const n = Math.max(0, this.point.shots.length - 1);
      return Math.max(this.pace.min, this.pace.start - this.pace.step * n) + (this.players[p].bonus || 0);
    }
    // Seconds a word adds to the clock (pace 'saat').
    gain(p) { return this.inc + (this.players[p].bonus || 0); }
    // pace 'saat': player p used `used` seconds of their turn (both phones of a match get the same number).
    spend(p, used, word) {
      if (!this.clockMode) return;
      this.banks[p] = round2(Math.max(0, this.banks[p] - Math.max(0, +used || 0)) + (word ? this.gain(p) : 0));
    }
    // Can player p add or take out a letter (uzat/kısalt)?
    canResize(p) { return this.rights[p] > 0; }
    check(word) {
      if (this.phase !== 'rally') return { ok: false, reason: 'phase' };
      const cur = this.point.word;
      if (word === cur) return { ok: false, reason: 'same' };
      const st = this.lex.step(cur, word);
      if (!st) return { ok: false, reason: 'one-letter' };
      const { kind, at } = st;
      if (kind !== 'swap') {
        if (!this.canResize(this.point.turn)) return { ok: false, reason: 'no-resize', kind, at };
        if (word.length < this.lex.minLen || word.length > this.lex.maxLen) return { ok: false, reason: 'length', kind, at };
      }
      if (this.point.used.has(word)) return { ok: false, reason: 'used', kind, at };
      if (!this.lex.has(word)) return { ok: false, reason: 'unknown', kind, at };
      return { ok: true, kind, at };
    }
    // The player whose turn it is plays `word`; used: seconds it took (pace 'saat').
    shot(word, used) {
      const c = this.check(word);
      if (!c.ok) return c;
      const pt = this.point, p = pt.turn;
      pt.word = word;
      pt.used.add(word);
      pt.shots.push({ by: p, word });
      this.stats.words[p]++;
      if (c.kind !== 'swap') { this.rights[p]--; this.stats.resizes[p]++; }
      this.spend(p, used, true);
      // a dead end: nothing the other player could send back (uzat/kısalt counts while they have it)
      if (this.lex.neighbours(word, pt.used, false, this.canResize(1 - p)).length === 0) {
        return Object.assign({ ok: true, at: c.at, kind: c.kind }, this.endPoint(p, 'dead'));
      }
      pt.turn = 1 - p;
      return { ok: true, at: c.at, kind: c.kind };
    }
    // The player to move ran out of time (pace 'saat': out of time for the match, which is lost).
    timeout() {
      if (this.phase !== 'rally') return null;
      if (this.clockMode) this.banks[this.point.turn] = 0;
      return this.endPoint(1 - this.point.turn, 'time');
    }
    // pace 'saat': the player to move gives the point away and keeps the time that is left.
    pass(used) {
      if (this.phase !== 'rally' || !this.clockMode) return null;
      const p = this.point.turn;
      this.spend(p, used, false);
      if (this.banks[p] <= 0) return this.timeout();
      return this.endPoint(1 - p, 'pass');
    }
    endPoint(winner, how) {
      const pt = this.point, loser = 1 - winner;
      const left = how === 'time' || how === 'pass' ? this.lex.split(this.lex.neighbours(pt.word, pt.used, false, this.canResize(loser))) : { common: [], rare: [] };
      const chain = pt.shots.length;            // words played in the point, the starting word included
      if (chain > this.stats.longest) { this.stats.longest = chain; this.stats.longestWords = pt.shots.map(s => s.word); }
      if (how === 'dead') this.stats.deadEnds[winner]++;
      if (how === 'time') this.stats.misses[loser]++;
      if (how === 'pass') this.stats.passes[loser]++;
      this.points[winner]++;
      this.pointsPlayed++;
      const flag = this.clockMode && how === 'time';   // a clock ran out: the match is over
      const res = { winner, how, word: pt.word, chain, shots: pt.shots.slice(), left, points: this.points.slice(), banks: this.banks.slice(), flag, matchOver: false };
      if (this.points[winner] >= this.target || flag) { res.matchOver = true; this.winner = winner; }
      this.starter = 1 - this.starter;
      this.phase = res.matchOver ? 'matchOver' : 'pointOver';
      this.history.push(res);
      return res;
    }
    next() { if (this.phase === 'pointOver') this.newPoint(); }
    // 'match' when player i is one point from winning.
    pointFor(i) { return this.points[i] === this.target - 1 ? 'match' : null; }
  }

  // Bot. see: chance of spotting each word a person would know; think: seconds (min, max);
  // smart: chance of choosing the word that leaves the opponent the fewest answers.
  // giveUp: pace 'saat', seconds it looks for a word before it gives the point away.
  const LEVELS = {
    kolay: { see: 0.5, think: [2.4, 4.6], smart: 0.0, open: [1.8, 3.0], giveUp: [5, 8] },
    orta: { see: 0.72, think: [1.6, 3.6], smart: 0.5, open: [1.4, 2.4], giveUp: [4, 6.5] },
    zor: { see: 0.9, think: [1.0, 2.5], smart: 0.85, open: [1.0, 1.8], giveUp: [3, 5] },
  };
  class Bot {
    constructor(level, random) {
      this.level = LEVELS[level] ? level : 'orta';
      this.cfg = LEVELS[this.level];
      this.r = random || Math.random;
    }
    between([a, b]) { return a + (b - a) * this.r(); }
    // Opponent's answers (words people know) after we play w. oppResize: they can add or take out a letter.
    pressure(lex, w, used, oppResize) {
      const u = new Set(used); u.add(w);
      return lex.neighbours(w, u, true, oppResize).length;
    }
    open(match) {
      const opts = match.point.options;
      let word = pick(opts, this.r);
      if (this.r() < this.cfg.smart) {
        let best = Infinity;
        for (const w of opts) {
          const p = this.pressure(match.lex, w, new Set(), match.canResize(1 - match.starter)) + this.r() * 0.5;
          if (p < best) { best = p; word = w; }
        }
      }
      return { word, delay: this.between(this.cfg.open) };
    }
    // { word, delay } or { word: null } when it does not find anything (then it runs out of time;
    // pace 'saat': { word: null, pass: true, delay }, it gives the point away after a while).
    // Uzat/kısalt: harder to see (0.6 of the usual chance) and slower to think of; with only a few rights left the
    // bot keeps them for when it finds nothing else, or for a trap that leaves the other player no answer.
    reply(match) {
      const lex = match.lex, pt = match.point, me = pt.turn;
      const same = lex.neighbours(pt.word, pt.used, true);
      const canR = match.canResize(me), oppR = match.canResize(1 - me);
      const resizes = canR ? lex.resizes(pt.word, pt.used, true) : [];
      const opts = same.concat(resizes);
      const seenSame = same.filter(() => this.r() < this.cfg.see);
      const seenR = resizes.filter(() => this.r() < this.cfg.see * 0.6);
      let seen = seenSame;
      if (seenR.length) {
        if (match.rights[me] === Infinity || !seenSame.length) seen = seenSame.concat(seenR);
        else if (this.r() < this.cfg.smart) {
          const trap = seenR.find(w => this.pressure(lex, w, pt.used, oppR) === 0);
          if (trap) seen = [trap];
        }
      }
      const bank = match.clockMode ? match.banks[me] : Infinity;
      if (!seen.length) {
        if (!match.clockMode) return { word: null, delay: Infinity, options: opts.length };
        // looks for a while, gives up sooner when its clock is low
        return { word: null, pass: true, delay: Math.min(this.between(this.cfg.giveUp), Math.max(0.5, bank * 0.4)), options: opts.length };
      }
      let word = pick(seen, this.r);
      if (this.r() < this.cfg.smart) {
        let best = Infinity;
        for (const w of seen) {
          const p = this.pressure(lex, w, pt.used, oppR) + this.r() * 0.5;
          if (p < best) { best = p; word = w; }
        }
      }
      let delay = this.between(this.cfg.think);
      if (opts.length <= 2) delay += 0.6 + this.r() * 0.8;   // harder to find when there are few
      if (word.length !== pt.word.length) delay += 0.5 + this.r() * 0.6;   // uzat/kısalt takes a moment more
      if (delay > bank * 0.75) {   // pace 'saat': hurries when its clock is low, and misses more
        const f = bank * 0.75 / delay;
        if (this.r() > f) return { word: null, pass: true, delay: Math.max(0.5, bank * 0.4), options: opts.length };
        delay = bank * 0.75;
      }
      return { word, delay, options: opts.length };
    }
  }

  return { KEYS, LOCALE, PACES, CLOCK, RESIZE, START_TIME, TARGET, LEVELS, upper, lower, seeded, shuffle, Lexicon, Match, Bot };
})();

if (typeof module !== 'undefined') module.exports = KT;
