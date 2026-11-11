// Kelime Tenisi: sözlük, kurallar ve bot. DOM'suz; tarayıcıda ve Node testlerinde aynı dosya.
// Oyun: kelime merdiveni rallisi. Her vuruşta gelen kelimenin tek harfini değiştirip geri gönderirsin.
// Kullanılan kelime yanar; süresinde dönemeyen sayıyı kaybeder; dönüşü hiç olmayan kelime = smaç.
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

  // Shot clock in seconds: first return, shrink per shot, floor.
  const PACES = {
    rahat: { start: 10, step: 0.5, min: 5 },
    normal: { start: 7, step: 0.4, min: 3.5 },
    hizli: { start: 5, step: 0.3, min: 2.5 },
  };
  const SERVE_TIME = 10;      // seconds to pick a serve word (then one is picked for you)
  const POINTS_TO_GAME = 4;   // 15, 30, 40, game; at 40-40 the next point wins ("altın sayı")
  const TENNIS = ['0', '15', '30', '40'];

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

  class Lexicon {
    constructor(words, lang, len) {
      const d = words[lang];
      if (!d || !d.common[len]) throw new Error('no words for ' + lang + '/' + len);
      this.lang = lang;
      this.len = len;
      this.alpha = d.alpha;
      const common = d.common[len].split(' ');
      const rare = d.rare[len] ? d.rare[len].split(' ') : [];
      this.commonSet = new Set(common);
      this.validSet = new Set(common.concat(rare));
      this.serves = d.serve[len].split(' ');
      this.buckets = new Map();
      for (const w of this.validSet) {
        for (let i = 0; i < len; i++) {
          const k = w.slice(0, i) + '_' + w.slice(i + 1);
          let b = this.buckets.get(k);
          if (!b) this.buckets.set(k, (b = []));
          b.push(w);
        }
      }
    }
    has(w) { return this.validSet.has(w); }
    isCommon(w) { return this.commonSet.has(w); }
    // Words one letter away from w, not in `used`. onlyCommon: the ones most people know.
    neighbours(w, used, onlyCommon) {
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
      return out;
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
    pickServes(n, r, avoid) {
      const pool = avoid ? this.serves.filter(w => !avoid.has(w)) : this.serves;
      return shuffle(pool.length >= n ? pool : this.serves, r).slice(0, n);
    }
    // Sort for showing: common words first, each group by fewest letters changed from `w`? keep A-Z.
    split(words) {
      const c = [], r = [];
      for (const w of words) (this.commonSet.has(w) ? c : r).push(w);
      c.sort((a, b) => a.localeCompare(b, LOCALE[this.lang]));
      r.sort((a, b) => a.localeCompare(b, LOCALE[this.lang]));
      return { common: c, rare: r };
    }
  }

  class Match {
    // opts: { lex, players: [{ name, bonus }], gamesToWin, pace, firstServer, random }
    constructor(opts) {
      this.lex = opts.lex;
      this.players = opts.players.map(p => Object.assign({ bonus: 0 }, p));
      this.gamesToWin = opts.gamesToWin || 2;
      this.paceName = PACES[opts.pace] ? opts.pace : 'normal';
      this.pace = PACES[this.paceName];
      this.r = opts.random || Math.random;
      this.games = [0, 0];
      this.points = [0, 0];
      this.server = opts.firstServer === 1 ? 1 : 0;
      this.phase = 'serve';         // serve | rally | pointOver | matchOver
      this.winner = -1;
      this.pointsPlayed = 0;
      this.history = [];
      this.served = new Set();      // serve words already used in this match
      this.stats = { smashes: [0, 0], misses: [0, 0], words: [0, 0], longest: 0, longestWords: [] };
      this.point = null;
      this.newPoint();
    }
    get receiver() { return 1 - this.server; }
    newPoint() {
      const opts = this.lex.pickServes(3, this.r, this.served);
      this.point = { word: null, used: new Set(), shots: [], turn: this.server, serveOptions: opts };
      this.phase = 'serve';
    }
    serve(word) {
      if (this.phase !== 'serve') return { ok: false, reason: 'phase' };
      if (!this.point.serveOptions.includes(word)) return { ok: false, reason: 'not-offered' };
      const pt = this.point;
      pt.word = word;
      pt.used.add(word);
      pt.shots.push({ by: this.server, word });
      this.served.add(word);
      pt.turn = this.receiver;
      this.phase = 'rally';
      return { ok: true };
    }
    // Seconds the player to move has for this shot.
    shotTime(player) {
      const p = player === undefined ? this.point.turn : player;
      const n = Math.max(0, this.point.shots.length - 1);
      return Math.max(this.pace.min, this.pace.start - this.pace.step * n) + (this.players[p].bonus || 0);
    }
    check(word) {
      if (this.phase !== 'rally') return { ok: false, reason: 'phase' };
      const cur = this.point.word;
      if (word === cur) return { ok: false, reason: 'same' };
      const at = this.lex.diff(cur, word);
      if (at < 0) return { ok: false, reason: 'one-letter' };
      if (this.point.used.has(word)) return { ok: false, reason: 'used', at };
      if (!this.lex.has(word)) return { ok: false, reason: 'unknown', at };
      return { ok: true, at };
    }
    // The player whose turn it is plays `word`.
    shot(word) {
      const c = this.check(word);
      if (!c.ok) return c;
      const pt = this.point, p = pt.turn;
      pt.word = word;
      pt.used.add(word);
      pt.shots.push({ by: p, word });
      this.stats.words[p]++;
      if (this.lex.neighbours(word, pt.used).length === 0) {
        return Object.assign({ ok: true, at: c.at }, this.endPoint(p, 'smash'));
      }
      pt.turn = 1 - p;
      return { ok: true, at: c.at };
    }
    // The player to move ran out of time.
    timeout() {
      if (this.phase !== 'rally') return null;
      return this.endPoint(1 - this.point.turn, 'time');
    }
    endPoint(winner, how) {
      const pt = this.point, loser = 1 - winner;
      const left = how === 'time' ? this.lex.split(this.lex.neighbours(pt.word, pt.used)) : { common: [], rare: [] };
      const rally = pt.shots.length;            // words played in the point, serve included
      if (rally > this.stats.longest) { this.stats.longest = rally; this.stats.longestWords = pt.shots.map(s => s.word); }
      if (how === 'smash') this.stats.smashes[winner]++;
      if (how === 'time') this.stats.misses[loser]++;
      this.points[winner]++;
      this.pointsPlayed++;
      const res = { winner, how, word: pt.word, rally, shots: pt.shots.slice(), left, gameOver: false, matchOver: false };
      if (this.points[winner] >= POINTS_TO_GAME) {
        this.games[winner]++;
        res.gameOver = true;
        res.gamePoints = this.points.slice();
        this.points = [0, 0];
        this.server = 1 - this.server;          // serve changes every game
        if (this.games[winner] >= this.gamesToWin) {
          res.matchOver = true;
          this.winner = winner;
        }
      }
      res.games = this.games.slice();
      this.phase = res.matchOver ? 'matchOver' : 'pointOver';
      this.history.push(res);
      return res;
    }
    next() { if (this.phase === 'pointOver') this.newPoint(); }
    // "15", "30", "40"; at 40-40 both are "40" and goldenPoint() is true.
    scoreText(i) { return TENNIS[Math.min(3, this.points[i])]; }
    goldenPoint() { return this.points[0] === 3 && this.points[1] === 3; }
    // Game point / match point for player i (one point from it).
    pointFor(i) {
      if (this.points[i] < POINTS_TO_GAME - 1) return null;
      return this.games[i] + 1 >= this.gamesToWin ? 'match' : 'game';
    }
  }

  // Bot. see: chance of spotting each word a person would know; think: seconds (min, max);
  // smart: chance of choosing the word that leaves the opponent the fewest returns.
  const LEVELS = {
    kolay: { see: 0.5, think: [2.4, 4.6], smart: 0.0, serve: [1.8, 3.0] },
    orta: { see: 0.72, think: [1.6, 3.6], smart: 0.5, serve: [1.4, 2.4] },
    zor: { see: 0.9, think: [1.0, 2.5], smart: 0.85, serve: [1.0, 1.8] },
  };
  class Bot {
    constructor(level, random) {
      this.level = LEVELS[level] ? level : 'orta';
      this.cfg = LEVELS[this.level];
      this.r = random || Math.random;
    }
    between([a, b]) { return a + (b - a) * this.r(); }
    // Opponent's returns (words people know) after we play w.
    pressure(lex, w, used) {
      const u = new Set(used); u.add(w);
      return lex.neighbours(w, u, true).length;
    }
    serve(match) {
      const opts = match.point.serveOptions;
      let word = pick(opts, this.r);
      if (this.r() < this.cfg.smart) {
        let best = Infinity;
        for (const w of opts) {
          const p = this.pressure(match.lex, w, new Set()) + this.r() * 0.5;
          if (p < best) { best = p; word = w; }
        }
      }
      return { word, delay: this.between(this.cfg.serve) };
    }
    // { word, delay } or { word: null } when it does not find anything (then it runs out of time).
    reply(match) {
      const lex = match.lex, pt = match.point;
      const opts = lex.neighbours(pt.word, pt.used, true);
      const seen = opts.filter(() => this.r() < this.cfg.see);
      if (!seen.length) return { word: null, delay: Infinity, options: opts.length };
      let word = pick(seen, this.r);
      if (this.r() < this.cfg.smart) {
        let best = Infinity;
        for (const w of seen) {
          const p = this.pressure(lex, w, pt.used) + this.r() * 0.5;
          if (p < best) { best = p; word = w; }
        }
      }
      let delay = this.between(this.cfg.think);
      if (opts.length <= 2) delay += 0.6 + this.r() * 0.8;   // harder to find when there are few
      return { word, delay, options: opts.length };
    }
  }

  return { KEYS, LOCALE, PACES, SERVE_TIME, POINTS_TO_GAME, LEVELS, upper, lower, seeded, shuffle, Lexicon, Match, Bot };
})();

if (typeof module !== 'undefined') module.exports = KT;
