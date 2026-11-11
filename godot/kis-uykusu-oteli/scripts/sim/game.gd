class_name OtelGame
extends RefCounted
## The rules, without any drawing. A line-by-line port of
## lab/kis-uykusu-oteli/src/sim.js: with the same seed the bot test gives the
## same numbers as the JavaScript version (see tests/bot_test.gd).
## One year = autumn (guests arrive) -> winter (they sleep) -> spring (they
## pay) -> summer (you build).

const D = preload("res://scripts/sim/data.gd")

var save: Dictionary
var events: Array = []
var phase := "summer"
var run: Dictionary = {}
var _a := 0


func _init(save_data: Dictionary, seed: int = -1) -> void:
	save = save_data
	_a = (seed if seed >= 0 else int(Time.get_unix_time_from_system() * 1000.0)) & 0xFFFFFFFF


# ---- mulberry32, identical to the JavaScript version ---------------------------

static func _imul(a: int, b: int) -> int:
	var ah := (a >> 16) & 0xFFFF
	var al := a & 0xFFFF
	var bh := (b >> 16) & 0xFFFF
	var bl := b & 0xFFFF
	return ((al * bl) + ((((ah * bl) + (al * bh)) & 0xFFFF) << 16)) & 0xFFFFFFFF


func rand() -> float:
	_a = (_a + 0x6D2B79F5) & 0xFFFFFFFF
	var t := _a
	t = _imul(t ^ (t >> 15), t | 1)
	t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
	return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0


func pick(arr: Array):
	return arr[int(floor(rand() * arr.size()))]


# ---- saves ---------------------------------------------------------------------

static func new_save() -> Dictionary:
	var grid := []
	for i in D.COLS * D.ROWS:
		grid.append({"dug": false, "room": null, "lvl": 1})
	for c in [0, 1, 2]:
		grid[c].dug = true
		grid[c].room = "yuva"
	return {
		"v": 1, "year": 1, "money": 20, "fame": 0, "grid": grid,
		"upgrades": {}, "staff": {"sincap": 0, "baykus": 0, "geyik": 0},
		"seen": {}, "total": {"guests": 0, "hearts": 0, "nuts": 0, "woke": 0},
	}


## Repairs a save from storage (same format as the web version's otel.save).
static func clean_save(s) -> Dictionary:
	var d := new_save()
	if typeof(s) != TYPE_DICTIONARY or s.get("v") != 1 or typeof(s.get("grid")) != TYPE_ARRAY or s.grid.size() != D.COLS * D.ROWS:
		return d
	var num := func(v, def): return v if (typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT) and is_finite(float(v)) else def
	var out := {
		"v": 1,
		"year": maxi(1, int(floor(num.call(s.get("year"), 1)))),
		"money": maxi(0, int(floor(num.call(s.get("money"), 20)))),
		"fame": maxi(0, int(floor(num.call(s.get("fame"), 0)))),
		"grid": [], "upgrades": {}, "staff": {"sincap": 0, "baykus": 0, "geyik": 0},
		"seen": (s.seen.duplicate() if typeof(s.get("seen")) == TYPE_DICTIONARY else {}),
		"total": d.total.duplicate(),
	}
	for g in s.grid:
		var dug: bool = typeof(g) == TYPE_DICTIONARY and bool(g.get("dug", false))
		var room = g.get("room") if dug and D.ROOMS.has(g.get("room")) else null
		var lvl := clampi(int(floor(num.call(g.get("lvl"), 1))), 1, 3) if room != null else 1
		out.grid.append({"dug": dug, "room": room, "lvl": lvl})
	if typeof(s.get("total")) == TYPE_DICTIONARY:
		for k in s.total:
			out.total[k] = s.total[k]
	for k in D.UPGRADE_ORDER:
		if typeof(s.get("upgrades")) == TYPE_DICTIONARY and s.upgrades.get(k):
			out.upgrades[k] = true
	for k in D.STAFF_ORDER:
		var v = s.staff.get(k) if typeof(s.get("staff")) == TYPE_DICTIONARY else 0
		out.staff[k] = clampi(int(floor(num.call(v, 0))), 0, D.STAFF[k].max)
	return out


# ---- grid helpers ----------------------------------------------------------------

static func cell_r(i: int) -> int:
	return i / D.COLS


static func cell_c(i: int) -> int:
	return i % D.COLS


static func neighbours(i: int) -> Array:
	var r := cell_r(i)
	var c := cell_c(i)
	var out := []
	if c > 0: out.append(i - 1)
	if c < D.COLS - 1: out.append(i + 1)
	if r > 0: out.append(i - D.COLS)
	if r < D.ROWS - 1: out.append(i + D.COLS)
	return out


## Where squirrel k waits: on the snow by the cabin door (grid units; y -1.02 is
## the ground line). Plain floats, not Vector2: Vector2 is 32-bit and would
## break the match with the JavaScript numbers.
static func sq_home(k: int) -> Dictionary:
	return {"x": 2.72 - k * 0.24, "y": -1.02}


static func dug_count(s: Dictionary) -> int:
	var n := 0
	for g in s.grid:
		if g.dug: n += 1
	return n


static func can_dig(s: Dictionary, i: int) -> bool:
	if s.grid[i].dug: return false
	if cell_r(i) == 0: return true
	for n in neighbours(i):
		if s.grid[n].dug: return true
	return false


static func room_unlocked(s: Dictionary, type: String) -> bool:
	return s.fame >= D.ROOMS[type].fame


func emit(type: String, data: Dictionary = {}) -> void:
	var e := data.duplicate()
	e.type = type
	events.append(e)


func take_events() -> Array:
	var e := events
	events = []
	return e


func unlocked_species() -> Array:
	return D.SPECIES_ORDER.filter(func(sp): return room_unlocked(save, D.SPECIES[sp].room))


# ---- autumn ------------------------------------------------------------------------

func start_autumn() -> void:
	var s := save
	var count := {}
	var rooms := 0
	for g in s.grid:
		if g.room != null:
			count[g.room] = count.get(g.room, 0) + 1
			rooms += 1
	var n := mini(D.guests_wanted(s), rooms + 1)
	var left := count.duplicate()
	var plan := []
	var missing := unlocked_species().filter(func(sp): return not count.has(D.SPECIES[sp].room))
	if s.year == 1:
		plan = ["fare", "kirpi", "fare"]
	else:
		for k in n:
			var types := left.keys().filter(func(t): return left[t] > 0)
			if missing.size() > 0 and k > 0 and (types.size() == 0 or rand() < 0.12):
				plan.append(pick(missing))
				continue
			if types.is_empty():
				break
			var total := 0
			for t in types: total += left[t]
			var roll := rand() * total
			var chosen: String = types[0]
			for x in types:
				roll -= left[x]
				if roll < 0:
					chosen = x
					break
			left[chosen] -= 1
			plan.append(pick(D.ROOMS[chosen].species))
	phase = "autumn"
	run = {"year": s.year, "t": 0.0, "plan": plan, "nextAt": 1.0, "queue": [], "guests": [], "nextId": 1, "left": 0, "endT": 0.0}
	emit("autumn", {"count": plan.size()})


func room_guest(i: int):
	if run.is_empty(): return null
	for g in run.guests:
		if g.cell == i and not g.gone:
			return g
	return null


func free_room_for(sp: String) -> int:
	var type: String = D.SPECIES[sp].room
	for i in save.grid.size():
		if save.grid[i].room == type and room_guest(i) == null:
			return i
	return -1


func _queue_find(id: int):
	for q in run.queue:
		if q.id == id: return q
	return null


func place_guest(id: int, cell: int) -> String:
	if phase != "autumn": return "phase"
	var q = _queue_find(id)
	if q == null: return "gone"
	var g = save.grid[cell] if cell >= 0 and cell < save.grid.size() else null
	if g == null or g.room == null: return "noRoomHere"
	if g.room != D.SPECIES[q.sp].room: return "wrongRoom"
	if room_guest(cell) != null: return "occupied"
	run.queue.erase(q)
	run.guests.append({"id": q.id, "sp": q.sp, "cell": cell, "sleep": 100.0, "blanket": true, "offT": 0.0,
		"snore": 0.0, "rest": 6.0 + rand() * 8.0, "woke": false, "gone": false, "drain": 0.0, "by": null, "dream": null})
	emit("placed", {"id": id, "cell": cell, "sp": q.sp})
	return "ok"


func _leave_queue(q: Dictionary, why: String) -> void:
	run.queue.erase(q)
	run.left += 1
	emit("left", {"id": q.id, "sp": q.sp, "why": why})


func _update_autumn(dt: float) -> void:
	var s := save
	var T := D.TUNE
	run.t += dt
	if run.plan.size() > 0 and run.t >= run.nextAt and run.queue.size() < T.queueMax:
		var sp: String = run.plan.pop_front()
		var patience: float = T.patience + (T.patienceIlan if s.upgrades.get("ilan", false) else 0.0) + (20.0 if s.year == 1 else 0.0)
		run.queue.append({"id": run.nextId, "sp": sp, "wait": 0.0, "patience": patience, "noRoomT": 0.0})
		run.nextId += 1
		run.nextAt = run.t + T.autumnGap
		emit("arrive", {"id": run.nextId - 1, "sp": sp})
	for q in run.queue.duplicate():
		q.wait += dt
		if free_room_for(q.sp) < 0:
			q.noRoomT += dt
			if q.noRoomT > T.noRoomWait:
				_leave_queue(q, "noRoom")
				continue
		else:
			q.noRoomT = 0.0
		if q.wait > q.patience:
			_leave_queue(q, "patience")
	if run.plan.is_empty() and run.queue.is_empty():
		run.endT += dt
		if run.endT > 1.0:
			_start_winter()


# ---- winter --------------------------------------------------------------------------

func _start_winter() -> void:
	var s := save
	var T := D.TUNE
	phase = "winter"
	run.t = 0.0
	run.len = D.winter_len(s.year)
	run.temp = T.tempStart
	run.heat = []
	run.logCd = 0.0
	run.wps = []
	run.wpId = 1
	run.nextWp = 6.0 + rand() * 6.0 if s.year >= T.wpFrom else INF
	run.ayazAt = 22.0 + rand() * 25.0 if s.year >= T.ayazFrom else INF
	run.ayaz = 0.0
	run.ayazDone = false
	run.ayazWarned = false
	run.coldFlag = false
	run.hotFlag = false
	run.squirrels = []
	for k in s.staff.sincap:
		var h := sq_home(k)
		run.squirrels.append({"x": h.x, "y": h.y, "state": "idle", "target": null, "t": 0.0, "k": k})
	run.owl = {"state": "perch", "target": null, "t": 0.0, "col": 3} if s.staff.baykus else null
	run.deer = {"cd": 0.0, "t": 0.0} if s.staff.geyik else null
	run.drops = []
	run.dropId = 1
	run.nextDrop = 2.5 + rand() * 2.0
	run.caught = 0
	run.peace = 0.0
	run.aurora = 0.0
	run.auroras = 0
	run.dreams = 0
	run.dreamTip = 0
	run.nextDream = D.dream_first(s.year) + rand() * 3.0
	run.foods = D.FOOD_ORDER.filter(func(f): return run.guests.any(func(g): return D.SPECIES[g.sp].food.has(f)))
	emit("winter", {"len": run.len})
	if run.guests.is_empty():
		run.t = run.len


func noise_mult() -> float:
	return D.TUNE.yosunNoise if save.upgrades.get("yosun", false) else 1.0


func add_log(by: String = "player") -> bool:
	if phase != "winter": return false
	var T := D.TUNE
	if by != "geyik":
		if run.logCd > 0: return false
		run.logCd = T.logCooldown
	if by != "geyik" and run.temp + pending_heat() < T.ZONE[0] + 5:
		peace_bonus(false, {"cabin": true})
	run.heat.append(T.logHeat)
	emit("log", {"by": by})
	return true


func pending_heat() -> float:
	var s := 0.0
	for h in run.heat: s += h
	return s


func peace_bonus(quick: bool, where: Dictionary) -> void:
	if run.aurora > 0: return
	run.peace = minf(100.0, run.peace + (D.TUNE.peaceQuick if quick else D.TUNE.peaceFix))
	if quick: emit("quick", where)


func issue_count() -> int:
	var T := D.TUNE
	var n: int = run.wps.size() + (1 if run.temp < T.ZONE[0] or run.temp > T.ZONE[1] else 0)
	for g in run.guests:
		if not g.gone and ((not g.blanket and D.SPECIES[g.sp].blanket) or g.snore > 0):
			n += 1
	return n


func catch_drop(id: int) -> int:
	if phase != "winter": return 0
	var d = null
	for x in run.drops:
		if x.id == id: d = x
	if d == null: return 0
	run.drops.erase(d)
	var v := D.drop_value(save.year, d.gold)
	run.caught += v
	emit("caught", {"id": id, "x": d.x, "p": d.p, "ph": d.ph, "v": v, "gold": d.gold})
	return v


func feed(cell: int, item: String) -> String:
	if phase != "winter": return "phase"
	var g = room_guest(cell)
	if g == null or g.woke or g.dream == null: return "none"
	if g.dream.item != item: return "wrong"
	g.dream = null
	g.sleep = minf(100.0, g.sleep + D.TUNE.dreamSleep)
	var tip := maxi(1, int(D._js_round(D.SPECIES[g.sp].price * D.LEVELS[save.grid[cell].lvl].pay * D.TUNE.dreamTip)))
	run.dreamTip += tip
	run.dreams += 1
	if run.aurora <= 0:
		run.peace = minf(100.0, run.peace + D.TUNE.peaceFeed)
	emit("fed", {"cell": cell, "item": item, "tip": tip, "sp": g.sp})
	return "ok"


func tap_room(cell: int) -> bool:
	if phase != "winter": return false
	var g = room_guest(cell)
	if g == null or g.woke: return false
	var T := D.TUNE
	var did := false
	var quick := false
	if not g.blanket:
		quick = g.offT <= T.quickT
		g.blanket = true
		g.offT = 0.0
		emit("tucked", {"cell": cell, "by": "player"})
		did = true
	if g.snore > 0:
		quick = quick or T.snoreLen - g.snore <= T.quickT
		g.snore = 0.0
		g.rest = T.snoreRest
		emit("rolled", {"cell": cell})
		did = true
	if did:
		peace_bonus(quick, {"cell": cell})
	return did


func shoo(id: int, by: String = "player") -> bool:
	if phase != "winter": return false
	var wp = null
	for w in run.wps:
		if w.id == id: wp = w
	if wp == null: return false
	run.wps.erase(wp)
	emit("shoo", {"id": id, "col": wp.col, "by": by})
	if by == "player":
		peace_bonus(wp.t <= D.TUNE.quickT, {"col": wp.col})
	return true


func _update_winter(dt: float) -> void:
	var s := save
	var T := D.TUNE
	run.t += dt
	run.logCd = maxf(0.0, run.logCd - dt)

	# stove
	if run.t >= run.ayazAt and not run.ayazDone:
		run.ayaz = T.ayazLen
		run.ayazDone = true
		emit("ayaz")
	elif not run.ayazDone and run.ayazAt - run.t < 3 and not run.ayazWarned:
		run.ayazWarned = true
		emit("ayazWarn")
	if run.ayaz > 0:
		run.ayaz -= dt
		if run.ayaz <= 0: emit("ayazEnd")
	var decay: float = T.decay * (0.75 if s.year == 1 else 1.0) * (T.decayDuvar if s.upgrades.get("duvar", false) else 1.0) * (T.ayazDecay if run.ayaz > 0 else 1.0) * (0.5 if run.aurora > 0 else 1.0)
	run.temp -= decay * dt
	for k in range(run.heat.size() - 1, -1, -1):
		var add := minf(run.heat[k], T.logHeat * dt / T.logTime)
		run.temp += add
		run.heat[k] -= add
		if run.heat[k] <= 0.001:
			run.heat.remove_at(k)
	run.temp = maxf(0.0, minf(100.0, run.temp))
	if run.temp < T.ZONE[0] and not run.coldFlag:
		run.coldFlag = true
		emit("cold")
	if run.temp > T.ZONE[0] + 3: run.coldFlag = false
	if run.temp > T.ZONE[1] and not run.hotFlag:
		run.hotFlag = true
		emit("hot")
	if run.temp < T.ZONE[1] - 3: run.hotFlag = false

	# woodpeckers
	var awake: Array = run.guests.filter(func(g): return not g.gone)
	var calm: bool = run.aurora > 0
	if s.year >= T.wpFrom and awake.size() > 0 and not calm:
		run.nextWp -= dt
		var max_wp := 1 + int(floor(s.year / 5.0))
		if run.nextWp <= 0 and run.t < run.len - 4:
			run.nextWp = D.wp_gap(s.year) * (0.7 + 0.6 * rand())
			if run.wps.size() < max_wp:
				var used := {}
				for w in run.wps: used[w.col] = true
				var cols := []
				for g in awake:
					var c := cell_c(g.cell)
					if not cols.has(c) and not used.has(c): cols.append(c)
				if cols.is_empty():
					cols = [0, 1, 2, 3].filter(func(c): return not used.has(c))
				if cols.size() > 0:
					var wp := {"id": run.wpId, "col": pick(cols), "t": 0.0}
					run.wpId += 1
					run.wps.append(wp)
					emit("wp", {"id": wp.id, "col": wp.col})
	for wp in run.wps.duplicate():
		wp.t += dt
		if wp.t > T.wpLen:
			run.wps.erase(wp)
			emit("wpGone", {"id": wp.id, "col": wp.col})

	# guests: blankets slip, some start snoring
	var b_rate: float = T.blanketRateY1 if s.year == 1 else T.blanketRate
	for g in awake:
		var sp: Dictionary = D.SPECIES[g.sp]
		g.rest -= dt
		if not calm and sp.blanket and g.blanket and rand() < b_rate * sp.toss * dt:
			g.blanket = false
			g.offT = 0.0
			emit("blanket", {"cell": g.cell, "sp": g.sp})
		if not g.blanket: g.offT += dt
		if not calm and sp.snore > 0 and g.snore <= 0 and g.rest <= 0 and rand() < T.snoreRate * sp.snore * dt:
			g.snore = T.snoreLen
			emit("snore", {"cell": g.cell, "sp": g.sp})
		if g.snore > 0:
			g.snore -= dt
			if g.snore <= 0:
				g.snore = 0.0
				g.rest = T.snoreRest * 0.5

	# sleep
	var nm := noise_mult()
	var ninni: bool = s.upgrades.get("ninni", false)
	for g in awake:
		var sp: Dictionary = D.SPECIES[g.sp]
		var r := cell_r(g.cell)
		var c := cell_c(g.cell)
		var d := 0.0
		if run.temp < T.ZONE[0]: d += T.coldDrain * (T.ZONE[0] - run.temp) / T.ZONE[0] * sp.cold
		if run.temp > T.ZONE[1]: d += T.heatDrain * (run.temp - T.ZONE[1]) / (100.0 - T.ZONE[1]) * sp.heat
		if not g.blanket and sp.blanket: d += T.blanketDrain * (0.5 + 0.5 * sp.cold)
		for wp in run.wps:
			if wp.col == c: d += T.woodDrain * T.wpFalloff[r] * sp.noise * nm
		for n in neighbours(g.cell):
			var o = room_guest(n)
			if o != null and o.snore > 0 and not o.woke: d += T.snoreDrain * sp.noise * nm
		d *= D.LEVELS[s.grid[g.cell].lvl].drain * (T.ninniDrain if ninni else 1.0)
		g.drain = d
		if d > 0.05:
			g.sleep -= d * dt
		else:
			g.sleep += (T.regen + (T.regenNinni if ninni else 0.0) + (T.auroraRegen if calm else 0.0)) * dt
		g.sleep = maxf(0.0, minf(100.0, g.sleep))
		if g.sleep <= 0:
			g.woke = true
			g.gone = true
			g.snore = 0.0
			g.dream = null
			emit("woke", {"cell": g.cell, "sp": g.sp, "id": g.id})

	_update_staff(dt)
	_update_fun(dt, awake)
	if run.t >= run.len:
		_start_spring()


func _update_fun(dt: float, awake: Array) -> void:
	var T := D.TUNE
	run.nextDrop -= dt
	if run.nextDrop <= 0 and run.t < run.len - 1.5:
		var a: bool = run.aurora > 0
		run.nextDrop = T.auroraGap if a else T.dropGap[0] + rand() * (T.dropGap[1] - T.dropGap[0])
		var fall: float = T.auroraFall if a else T.dropFall[0] + rand() * (T.dropFall[1] - T.dropFall[0])
		var drop := {"id": run.dropId, "x": 0.05 + rand() * 0.9, "p": 0.0, "v": 1.0 / fall}
		drop.gold = rand() < (T.auroraGold if a else T.goldChance)
		drop.ph = rand() * 6.0
		run.dropId += 1
		run.drops.append(drop)
	for d in run.drops.duplicate():
		d.p += d.v * dt
		if d.p >= 1: run.drops.erase(d)
	if run.aurora <= 0: run.nextDream -= dt
	if run.nextDream <= 0:
		run.nextDream = D.dream_gap(awake.size()) * (0.8 + 0.4 * rand())
		var cand := awake.filter(func(g): return g.dream == null and g.sleep > 25 and (g.blanket or not D.SPECIES[g.sp].blanket) and g.snore <= 0)
		if cand.size() > 0 and run.t < run.len - 6:
			var g = pick(cand)
			g.dream = {"item": pick(D.SPECIES[g.sp].food), "t": 0.0}
			emit("dream", {"cell": g.cell, "item": g.dream.item, "sp": g.sp})
	for g in awake:
		if g.dream == null: continue
		g.dream.t += dt
		if g.dream.t > T.dreamLen:
			g.dream = null
			emit("dreamGone", {"cell": g.cell})
	if run.aurora > 0:
		run.aurora -= dt
		if run.aurora <= 0:
			run.aurora = 0.0
			emit("auroraEnd")
	elif awake.size() > 0:
		run.peace += (-T.peaceDrain if issue_count() > 0 else T.peaceFill) * dt
		run.peace = maxf(0.0, minf(100.0, run.peace))
		if run.peace >= 100 and run.t < run.len - 3:
			run.peace = 0.0
			run.aurora = T.auroraLen
			run.auroras += 1
			run.nextDrop = 0.2
			emit("aurora")


func _find_guest(id):
	for g in run.guests:
		if g.id == id: return g
	return null


func _update_staff(dt: float) -> void:
	var T := D.TUNE
	for sq in run.squirrels:
		if sq.state == "idle" or sq.state == "home":
			var best = null
			var bd := INF
			for g in run.guests:
				if g.gone or g.blanket or g.offT < T.sincapDelay or g.by != null: continue
				var dd: float = absf(cell_c(g.cell) - sq.x) + absf(cell_r(g.cell) - sq.y)
				if dd < bd:
					bd = dd
					best = g
			if best != null:
				best.by = sq.k
				sq.target = best.id
				sq.state = "go"
			elif sq.state == "idle":
				sq.state = "home"
		if sq.state == "go":
			var g = _find_guest(sq.target)
			if g == null or g.gone:
				sq.state = "idle"
				sq.target = null
				continue
			if _move_to(sq, cell_c(g.cell), cell_r(g.cell), T.sincapSpeed * dt):
				if not g.blanket:
					sq.state = "tuck"
					sq.t = 0.0
				else:
					g.by = null
					sq.state = "idle"
					sq.target = null
		elif sq.state == "tuck":
			sq.t += dt
			if sq.t >= T.sincapTuck:
				var g = _find_guest(sq.target)
				if g != null and not g.gone and not g.blanket:
					g.blanket = true
					g.offT = 0.0
					emit("tucked", {"cell": g.cell, "by": "sincap"})
				if g != null: g.by = null
				sq.state = "idle"
				sq.target = null
		elif sq.state == "home":
			var h := sq_home(sq.k)
			if _move_to(sq, h.x, h.y, T.sincapSpeed * dt):
				sq.state = "rest"
		if sq.state == "rest":
			if run.guests.any(func(g): return not g.gone and not g.blanket and g.offT >= T.sincapDelay and g.by == null):
				sq.state = "idle"
	var owl = run.owl
	if owl != null:
		owl.t += dt
		if owl.state == "perch":
			for w in run.wps:
				if w.t >= T.baykusDelay:
					owl.state = "fly"
					owl.target = w.id
					owl.col = w.col
					owl.t = 0.0
					break
		elif owl.state == "fly" and owl.t >= T.baykusFly:
			shoo(owl.target, "baykus")
			owl.state = "back"
			owl.t = 0.0
		elif owl.state == "back" and owl.t >= T.baykusFly:
			owl.state = "perch"
			owl.t = 0.0
		if owl.state == "fly" and not run.wps.any(func(w): return w.id == owl.target):
			owl.state = "back"
			owl.t = 0.0
	var deer = run.deer
	if deer != null:
		deer.cd -= dt
		deer.t += dt
		if deer.cd <= 0 and run.temp + pending_heat() < T.geyikBelow:
			add_log("geyik")
			deer.cd = T.geyikCooldown
			deer.t = 0.0


func _move_to(o: Dictionary, x: float, y: float, step: float) -> bool:
	var dx: float = x - o.x
	var dy: float = y - o.y
	var d := _hypot(dx, dy)
	if d <= step:
		o.x = x
		o.y = y
		return true
	o.x += dx / d * step
	o.y += dy / d * step
	return false


## Math.hypot as V8 computes it (scaled Kahan sum), so positions match exactly.
static func _hypot(a: float, b: float) -> float:
	var x := absf(a)
	var y := absf(b)
	var m := maxf(x, y)
	if m == 0.0:
		return 0.0
	var sum := 0.0
	var comp := 0.0
	for v in [x, y]:
		var n: float = v / m
		var summand := n * n - comp
		var pre := sum + summand
		comp = (pre - sum) - summand
		sum = pre
	return sqrt(sum) * m


# ---- spring --------------------------------------------------------------------------

func _start_spring() -> void:
	var s := save
	phase = "spring"
	run.t = 0.0
	run.wps = []
	run.drops = []
	var rows := []
	var pay := 0
	var tip := 0
	var hearts := 0
	for g in run.guests:
		var lvl: int = s.grid[g.cell].lvl
		var h := D.hearts_for(g.sleep, g.woke)
		var p := D.pay_for(g.sp, lvl, g.sleep, g.woke)
		rows.append({"id": g.id, "sp": g.sp, "cell": g.cell, "sleep": int(D._js_round(0.0 if g.woke else g.sleep)), "hearts": h, "pay": p.pay, "tip": p.tip, "woke": g.woke})
		pay += p.pay
		tip += p.tip
		hearts += h
	var caught: int = run.get("caught", 0)
	var dream_tip: int = run.get("dreamTip", 0)
	var stars_before := D.stars_for(s.fame)
	var unlocked_before := D.ROOM_ORDER.filter(func(t): return room_unlocked(s, t))
	s.money += pay + tip + caught + dream_tip
	s.fame += hearts
	s.total.guests += rows.size()
	s.total.hearts += hearts
	s.total.nuts += pay + tip + caught + dream_tip
	s.total.woke += rows.filter(func(x): return x.woke).size()
	s.year += 1
	var unlocked := D.ROOM_ORDER.filter(func(t): return room_unlocked(s, t) and not unlocked_before.has(t))
	run.results = {"year": run.year, "rows": rows, "pay": pay, "tip": tip, "hearts": hearts, "left": run.left,
		"caught": caught, "dreamTip": dream_tip, "dreams": run.get("dreams", 0), "auroras": run.get("auroras", 0),
		"starsBefore": stars_before, "starsAfter": D.stars_for(s.fame), "unlocked": unlocked}
	emit("spring", {"results": run.results})


func _update_spring(dt: float) -> void:
	run.t += dt
	if run.t >= D.TUNE.springLen:
		phase = "summary"
		emit("summary", {"results": run.results})


func to_summer() -> void:
	if phase != "summary" and phase != "spring": return
	phase = "summer"
	emit("summer")


# ---- summer: building -------------------------------------------------------------------

func dig(i: int) -> String:
	var s := save
	var cost := D.dig_cost(dug_count(s))
	if phase != "summer" or not can_dig(s, i): return "no"
	if s.money < cost: return "money"
	s.money -= cost
	s.grid[i].dug = true
	emit("dug", {"cell": i, "cost": cost})
	return "ok"


func build(i: int, type: String) -> String:
	var s := save
	var g: Dictionary = s.grid[i]
	if phase != "summer" or not g.dug or g.room != null or not D.ROOMS.has(type): return "no"
	if not room_unlocked(s, type): return "locked"
	var cost: int = D.ROOMS[type].cost
	if s.money < cost: return "money"
	s.money -= cost
	g.room = type
	g.lvl = 1
	emit("built", {"cell": i, "type": type, "cost": cost})
	return "ok"


func upgrade_room(i: int) -> String:
	var s := save
	var g: Dictionary = s.grid[i]
	if phase != "summer" or g.room == null or g.lvl >= 3: return "no"
	var cost := D.upgrade_cost(g.room, g.lvl)
	if s.money < cost: return "money"
	s.money -= cost
	g.lvl += 1
	emit("upgraded", {"cell": i, "lvl": g.lvl, "cost": cost})
	return "ok"


func demolish(i: int) -> String:
	var s := save
	var g: Dictionary = s.grid[i]
	if phase != "summer" or g.room == null: return "no"
	var back := int(D._js_round(D.ROOMS[g.room].cost / 2.0))
	s.money += back
	g.room = null
	g.lvl = 1
	emit("demolished", {"cell": i, "back": back})
	return "ok"


func item_cost(id: String):
	if D.STAFF.has(id):
		var n: int = save.staff[id]
		return null if n >= D.STAFF[id].max else D.STAFF[id].cost[n]
	if D.UPGRADES.has(id):
		return null if save.upgrades.get(id, false) else D.UPGRADES[id].cost
	return null


func buy(id: String) -> String:
	var s := save
	var cost = item_cost(id)
	if phase != "summer" or cost == null: return "no"
	if s.money < cost: return "money"
	s.money -= cost
	if D.STAFF.has(id):
		s.staff[id] += 1
	else:
		s.upgrades[id] = true
	emit("bought", {"id": id, "cost": cost})
	return "ok"


func update(dt: float) -> void:
	if phase == "autumn": _update_autumn(dt)
	elif phase == "winter": _update_winter(dt)
	elif phase == "spring": _update_spring(dt)
