class_name OtelData
## Game data: guests, rooms, helpers, upgrades and the economy.
## A direct port of lab/kis-uykusu-oteli/src/data.js; keep the two in step.

const COLS := 4
const ROWS := 5

# price = hazelnuts for a perfect sleep in a level-1 room. toss: how often the
# blanket slips. cold/heat/noise: how strongly each problem drains sleep.
const SPECIES := {
	"fare": {"name": "Fındık faresi", "room": "yuva", "price": 12, "toss": 0.5, "cold": 0.8, "heat": 1.0, "noise": 0.5, "snore": 0.0, "blanket": true, "food": ["findik"], "note": "Dünyanın en uykucu hayvanı. Kolay kolay uyanmaz."},
	"kirpi": {"name": "Kirpi", "room": "yuva", "price": 15, "toss": 1.3, "cold": 1.3, "heat": 0.8, "noise": 1.0, "snore": 0.0, "blanket": true, "food": ["bocek"], "note": "Üşümeyi hiç sevmez. Battaniyesine göz kulak ol."},
	"kurbaga": {"name": "Kurbağa", "room": "havuz", "price": 22, "toss": 0.7, "cold": 0.4, "heat": 1.8, "noise": 0.8, "snore": 0.0, "blanket": true, "food": ["sinek"], "note": "Serin çamuru sever. Soba fazla yanarsa bunalır."},
	"ayi": {"name": "Ayı", "room": "magara", "price": 45, "toss": 0.8, "cold": 0.6, "heat": 1.2, "noise": 0.6, "snore": 1.0, "blanket": true, "food": ["bal", "balik"], "note": "En iyi ödeyen misafir. Ama çok horlar, yanındakiler uyanır."},
	"porsuk": {"name": "Porsuk", "room": "oda", "price": 32, "toss": 1.0, "cold": 1.0, "heat": 1.0, "noise": 1.5, "snore": 0.45, "blanket": true, "food": ["solucan"], "note": "Sese çok hassas. Arada bir kendisi de horlar."},
	"yarasa": {"name": "Yarasa", "room": "tunek", "price": 38, "toss": 0.0, "cold": 0.9, "heat": 1.6, "noise": 1.6, "snore": 0.0, "blanket": false, "food": ["guve"], "note": "Kanatlarına sarılıp baş aşağı uyur. Sesi ve sıcağı sevmez."},
}
const SPECIES_ORDER := ["fare", "kirpi", "kurbaga", "ayi", "porsuk", "yarasa"]

const FOODS := {"findik": "Fındık", "bocek": "Böcek", "sinek": "Sinek", "bal": "Bal", "balik": "Balık", "solucan": "Solucan", "guve": "Güve"}
const FOOD_ORDER := ["findik", "bocek", "sinek", "bal", "balik", "solucan", "guve"]

const ROOMS := {
	"yuva": {"name": "Yaprak yuvası", "cost": 20, "fame": 0, "species": ["fare", "kirpi"]},
	"havuz": {"name": "Çamur havuzu", "cost": 35, "fame": 8, "species": ["kurbaga"]},
	"magara": {"name": "Ayı mağarası", "cost": 70, "fame": 25, "species": ["ayi"]},
	"oda": {"name": "Saman odası", "cost": 55, "fame": 55, "species": ["porsuk"]},
	"tunek": {"name": "Yarasa tüneği", "cost": 60, "fame": 100, "species": ["yarasa"]},
}
const ROOM_ORDER := ["yuva", "havuz", "magara", "oda", "tunek"]

const LEVELS := [
	{},
	{"name": "Sade", "pay": 1.0, "drain": 1.0},
	{"name": "Rahat", "pay": 1.35, "drain": 0.85},
	{"name": "Lüks", "pay": 1.75, "drain": 0.7},
]

const STAR_AT := [0, 8, 25, 55, 100]

const STAFF := {
	"sincap": {"name": "Sincap kat görevlisi", "max": 3, "cost": [100, 170, 260], "note": "Düşen battaniyeleri kendisi örter. 3 tane alabilirsin."},
	"baykus": {"name": "Baykuş bekçi", "max": 1, "cost": [150], "note": "Ağaçkakanları kovar."},
	"geyik": {"name": "Ren geyiği", "max": 1, "cost": [200], "note": "Soba sönmeye yüz tutunca odun atar."},
}
const STAFF_ORDER := ["sincap", "baykus", "geyik"]

const UPGRADES := {
	"ilan": {"name": "Orman ilanı", "cost": 50, "note": "Her sonbahar 3 misafir daha gelir, daha uzun bekler."},
	"duvar": {"name": "Kalın duvarlar", "cost": 90, "note": "Soba daha yavaş soğur."},
	"yosun": {"name": "Yosun yalıtımı", "cost": 120, "note": "Ağaçkakan ve horlama sesi daha az duyulur."},
	"ninni": {"name": "Ninni kutusu", "cost": 140, "note": "Kışın ninni çalar. Herkes daha derin uyur."},
}
const UPGRADE_ORDER := ["ilan", "duvar", "yosun", "ninni"]

const TUNE := {
	"autumnGap": 2.6, "patience": 22.0, "patienceIlan": 6.0, "noRoomWait": 5.0, "queueMax": 6, "springLen": 3.6,
	"ZONE": [35.0, 72.0], "tempStart": 58.0, "decay": 1.45, "decayDuvar": 0.65,
	"logHeat": 18.0, "logTime": 1.2, "logCooldown": 0.3,
	"coldDrain": 4.0, "heatDrain": 4.0, "blanketDrain": 3.0, "woodDrain": 6.0, "snoreDrain": 3.0,
	"regen": 1.2, "regenNinni": 1.0, "ninniDrain": 0.9, "yosunNoise": 0.6,
	"blanketRate": 1.0 / 22.0, "blanketRateY1": 1.0 / 28.0, "snoreRate": 1.0 / 22.0, "snoreLen": 18.0, "snoreRest": 10.0,
	"wpFrom": 2, "wpLen": 14.0, "wpFalloff": [1.0, 0.65, 0.4, 0.22, 0.1],
	"ayazFrom": 4, "ayazLen": 12.0, "ayazDecay": 2.2,
	"sincapDelay": 1.0, "sincapSpeed": 1.7, "sincapTuck": 0.6, "baykusDelay": 2.5, "baykusFly": 1.0,
	"geyikBelow": 48.0, "geyikCooldown": 3.2,
	"dropGap": [4.0, 7.0], "dropFall": [5.5, 7.0], "goldChance": 0.08,
	"peaceFill": 5.0, "peaceDrain": 2.0, "peaceFix": 5.0, "peaceQuick": 10.0, "peaceFeed": 8.0, "quickT": 2.0,
	"auroraLen": 7.0, "auroraGap": 0.45, "auroraFall": 3.2, "auroraGold": 0.15, "auroraRegen": 3.0,
	"dreamLen": 10.0, "dreamSleep": 25.0, "dreamTip": 0.2,
}


static func winter_len(year: int) -> float:
	return 60.0 if year == 1 else (80.0 if year < 5 else 90.0)


static func wp_gap(year: int) -> float:
	return maxf(9.0, 18.0 - year)


static func dream_first(year: int) -> float:
	return 13.0 if year == 1 else 6.0


static func dream_gap(n: int) -> float:
	return maxf(5.0, 12.0 - n * 0.5)


static func drop_value(year: int, gold: bool) -> int:
	return (3 if gold else 1) * (1 + int(floor((year - 1) / 4.0)))


static func upgrade_cost(type: String, lvl: int) -> int:
	var base: int = ROOMS[type].cost
	return int(round(base * 1.2)) if lvl == 1 else int(round(base * 2.5))


static func dig_cost(dug: int) -> int:
	return 10 + 5 * dug


static func stars_for(fame: int) -> int:
	var s := 0
	for t in STAR_AT:
		if fame >= t:
			s += 1
	return s


static func guests_wanted(save: Dictionary) -> int:
	return 2 + stars_for(save.fame) + int(floor(save.year / 2.0)) + (3 if save.upgrades.get("ilan", false) else 0)


static func hearts_for(sleep: float, woke: bool) -> int:
	if woke:
		return 0
	return 3 if sleep >= 85 else (2 if sleep >= 55 else 1)


static func pay_for(sp: String, lvl: int, sleep: float, woke: bool) -> Dictionary:
	if woke:
		return {"pay": 0, "tip": 0}
	var base: float = SPECIES[sp].price * LEVELS[lvl].pay
	var pay := int(_js_round(base * (0.4 + 0.6 * sleep / 100.0)))
	var tip := int(_js_round(base * 0.25)) if hearts_for(sleep, woke) == 3 else 0
	return {"pay": pay, "tip": tip}


# Math.round in JavaScript: halves go up. floor(v + 0.5) is not the same: for
# 0.49999999999999994 the addition rounds up to 1. v - floor(v) is exact.
static func _js_round(v: float) -> float:
	var f := floorf(v)
	return f + 1.0 if v - f >= 0.5 else f
