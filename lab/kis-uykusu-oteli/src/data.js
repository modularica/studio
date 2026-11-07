// ---------------------------------------------------------------------------
// Game data: guests, rooms, helpers, upgrades and the economy.
// All player-facing text is Turkish; code and comments stay English.
// ---------------------------------------------------------------------------

const COLS = 4;
const ROWS = 5;

// Guests. price = hazelnuts paid for a perfect sleep in a level-1 room.
// toss: how often the blanket slips. cold/heat/noise: how strongly each
// problem drains sleep. snore: how often this guest starts snoring.
const SPECIES = {
  fare: {
    name: 'Fındık faresi', room: 'yuva', price: 12,
    toss: 0.5, cold: 0.8, heat: 1.0, noise: 0.5, snore: 0, blanket: true,
    note: 'Dünyanın en uykucu hayvanı. Kolay kolay uyanmaz.',
  },
  kirpi: {
    name: 'Kirpi', room: 'yuva', price: 15,
    toss: 1.3, cold: 1.3, heat: 0.8, noise: 1.0, snore: 0, blanket: true,
    note: 'Üşümeyi hiç sevmez. Battaniyesine göz kulak ol.',
  },
  kurbaga: {
    name: 'Kurbağa', room: 'havuz', price: 22,
    toss: 0.7, cold: 0.4, heat: 1.8, noise: 0.8, snore: 0, blanket: true,
    note: 'Serin çamuru sever. Soba fazla yanarsa bunalır.',
  },
  ayi: {
    name: 'Ayı', room: 'magara', price: 45,
    toss: 0.8, cold: 0.6, heat: 1.2, noise: 0.6, snore: 1.0, blanket: true,
    note: 'En iyi ödeyen misafir. Ama çok horlar, yanındakiler uyanır.',
  },
  porsuk: {
    name: 'Porsuk', room: 'oda', price: 32,
    toss: 1.0, cold: 1.0, heat: 1.0, noise: 1.5, snore: 0.45, blanket: true,
    note: 'Sese çok hassas. Arada bir kendisi de horlar.',
  },
  yarasa: {
    name: 'Yarasa', room: 'tunek', price: 38,
    toss: 0, cold: 0.9, heat: 1.6, noise: 1.6, snore: 0, blanket: false,
    note: 'Kanatlarına sarılıp baş aşağı uyur. Sesi ve sıcağı sevmez.',
  },
};
const SPECIES_ORDER = ['fare', 'kirpi', 'kurbaga', 'ayi', 'porsuk', 'yarasa'];

// Room types. fame = hearts needed before this room can be built.
const ROOMS = {
  yuva:   { name: 'Yaprak yuvası', cost: 20, fame: 0,  species: ['fare', 'kirpi'] },
  havuz:  { name: 'Çamur havuzu',  cost: 35, fame: 8,  species: ['kurbaga'] },
  magara: { name: 'Ayı mağarası',  cost: 70, fame: 25, species: ['ayi'] },
  oda:    { name: 'Saman odası',   cost: 55, fame: 55, species: ['porsuk'] },
  tunek:  { name: 'Yarasa tüneği', cost: 60, fame: 100, species: ['yarasa'] },
};
const ROOM_ORDER = ['yuva', 'havuz', 'magara', 'oda', 'tunek'];

// Room levels: better rooms pay more and drain sleep less.
const LEVELS = [
  null,
  { name: 'Sade',  pay: 1.0,  drain: 1.0 },
  { name: 'Rahat', pay: 1.35, drain: 0.85 },
  { name: 'Lüks',  pay: 1.75, drain: 0.7 },
];
function upgradeCost(type, lvl) {
  const base = ROOMS[type].cost;
  return lvl === 1 ? Math.round(base * 1.2) : Math.round(base * 2.5);
}
function digCost(dugCount) { return 10 + 5 * dugCount; }

// Hotel stars come from total hearts (fame).
const STAR_AT = [0, 8, 25, 55, 100];
function starsFor(fame) {
  let s = 0;
  for (const t of STAR_AT) if (fame >= t) s++;
  return s;
}

// Helpers work on their own during winter.
const STAFF = {
  sincap: {
    name: 'Sincap kat görevlisi', max: 3, cost: [100, 170, 260],
    note: 'Düşen battaniyeleri kendisi örter. 3 tane alabilirsin.',
  },
  baykus: {
    name: 'Baykuş bekçi', max: 1, cost: [150],
    note: 'Ağaçkakanları kovar.',
  },
  geyik: {
    name: 'Ren geyiği', max: 1, cost: [200],
    note: 'Soba sönmeye yüz tutunca odun atar.',
  },
};
const STAFF_ORDER = ['sincap', 'baykus', 'geyik'];

// One-time upgrades.
const UPGRADES = {
  ilan:  { name: 'Orman ilanı',     cost: 50,  note: 'Her sonbahar 3 misafir daha gelir, daha uzun bekler.' },
  duvar: { name: 'Kalın duvarlar',  cost: 90,  note: 'Soba daha yavaş soğur.' },
  yosun: { name: 'Yosun yalıtımı',  cost: 120, note: 'Ağaçkakan ve horlama sesi daha az duyulur.' },
  ninni: { name: 'Ninni kutusu',    cost: 140, note: 'Kışın ninni çalar. Herkes daha derin uyur.' },
};
const UPGRADE_ORDER = ['ilan', 'duvar', 'yosun', 'ninni'];

// Tuning for one winter.
const TUNE = {
  autumnGap: 2.6,        // seconds between arrivals
  patience: 22,          // seconds a guest waits in the queue
  patienceIlan: 6,
  noRoomWait: 5,         // a guest without a matching room leaves after this
  queueMax: 6,
  winterLen: (year) => (year === 1 ? 60 : year < 5 ? 80 : 90),
  springLen: 3.6,

  // Stove: temperature 0..100, comfortable between ZONE[0] and ZONE[1].
  ZONE: [35, 72],
  tempStart: 58,
  decay: 1.45,           // degrees per second
  decayDuvar: 0.65,
  logHeat: 18,           // degrees added by one log, over logTime seconds
  logTime: 1.2,
  logCooldown: 0.3,

  // Sleep drains (points per second at strength 1).
  coldDrain: 4.0,
  heatDrain: 4.0,
  blanketDrain: 3.0,
  woodDrain: 6.0,
  snoreDrain: 3.0,
  regen: 1.2,
  regenNinni: 1.0,
  ninniDrain: 0.9,
  yosunNoise: 0.6,

  blanketRate: 1 / 22,   // per guest per second, times species.toss
  blanketRateY1: 1 / 28,
  snoreRate: 1 / 22,
  snoreLen: 18,
  snoreRest: 10,         // after being rolled over, no snoring for this long
  wpFrom: 2,             // woodpeckers appear from this year
  wpGap: (year) => Math.max(9, 18 - year),
  wpLen: 14,
  wpFalloff: [1, 0.65, 0.4, 0.22, 0.1],
  ayazFrom: 4,
  ayazLen: 12,
  ayazDecay: 2.2,

  // Helpers.
  sincapDelay: 1.0,
  sincapSpeed: 1.7,      // cells per second
  sincapTuck: 0.6,
  baykusDelay: 2.5,
  baykusFly: 1.0,
  geyikBelow: 48,
  geyikCooldown: 3.2,
};

function guestsWanted(save) {
  return 2 + starsFor(save.fame) + Math.floor(save.year / 2) + (save.upgrades.ilan ? 3 : 0);
}

function heartsFor(sleep, woke) {
  if (woke) return 0;
  return sleep >= 85 ? 3 : sleep >= 55 ? 2 : 1;
}
function payFor(sp, lvl, sleep, woke) {
  if (woke) return { pay: 0, tip: 0 };
  const base = SPECIES[sp].price * LEVELS[lvl].pay;
  const pay = Math.round(base * (0.4 + 0.6 * sleep / 100));
  const tip = heartsFor(sleep, woke) === 3 ? Math.round(base * 0.25) : 0;
  return { pay, tip };
}
