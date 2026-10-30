// Game rules for the room server. They mirror the single-player game in lab/fish/index.html:
// keep TURLER in the same order and with the same sizes as SPECIES there (the client draws
// NPCs by their index in this list).

export const TURLER = [
  { ad: 'minnow', min: 3, max: 10, w: 0.11 },
  { ad: 'bleak', min: 10, max: 18, w: 0.095 },
  { ad: 'rudd', min: 18, max: 30, w: 0.13 },
  { ad: 'perch', min: 30, max: 45, w: 0.12 },
  { ad: 'carp', min: 45, max: 80, w: 0.15 },
  { ad: 'pike', min: 80, max: 130, w: 0.085 },
  { ad: 'wels catfish', min: 130, max: 1e9, w: 0.14 }
];
export const KOI_W = 0.125;

export const YE = 0.9;        // you can eat a fish shorter than 0.9 × your length
export const TEHLIKE = 1.1;   // a fish longer than 1.1 × your length can bite you
export const BASLANGIC = 10;  // every koi starts at 10 cm
export const CAN = 3;         // bites from wild fish before you are eaten
export const HIZ = 3.6;       // top speed: 3.6 body lengths per second at 10 cm (steerPlayer in index.html)

export const TUR_SURESI = 5 * 60 * 1000; // a round lasts five minutes
export const EN_COK = 8;                 // koi per room
export const DOGMA_BEKLE = 3;            // seconds before an eaten koi comes back
export const KORUMA = 3;                 // seconds a new koi can't be eaten
export const GERI_DONUS = 30 * 1000;     // a koi that lost its connection keeps its place this long

// Bigger fish are slower for their size: every speed in body lengths per second is multiplied by this.
// 10 cm → 1, 30 cm → 0.72, 1 m → 0.5, 3 m → 0.36 (same as hizCarpani in lab/fish/index.html).
export function hizCarpani(l) { return Math.min(1.5, Math.max(0.25, Math.pow(l / 10, -0.3))); }

export function buyu(L, l) { return Math.cbrt(L * L * L + 1.3 * l * l * l); }

export function turIcin(l) {
  for (let i = 0; i < TURLER.length; i++) if (l < TURLER[i].max) return i;
  return TURLER.length - 1;
}

// Half the side of the square pond (cm). Grows with the number of koi and with the biggest one.
export function golYaricap(n, enBuyuk) {
  return Math.max(900 + 250 * (Math.max(1, n) - 1), (enBuyuk || 0) * 5.5);
}

// Camera scale (px per cm), the same formula as targetScale() in index.html.
export function olcek(w, h, l) {
  const base = Math.min(w, h) / (w < h ? 6.2 : 8);
  return base * Math.pow(l / 10, 0.15) / l;
}
