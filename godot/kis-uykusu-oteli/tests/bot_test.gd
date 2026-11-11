extends SceneTree
## Parity test: the balance bot from lab/kis-uykusu-oteli/src/test/bot.js,
## ported line by line, plays the Godot rules. Every year's numbers must equal
## the JavaScript run with the same seed. Run with tests/parity.sh.
##   godot --headless --path . --script res://tests/bot_test.gd -- <years> <profile> <seeds> <reference.json>

const D = preload("res://scripts/sim/data.gd")
const DT := 0.05


class Bot:
	var g: OtelGame
	var o: Dictionary
	var cd := 0.0
	var cold_t := 0.0
	var actions := 0

	func _init(game: OtelGame, opt: Dictionary) -> void:
		g = game
		o = opt

	func tick(dt: float) -> void:
		var run := g.run
		cd -= dt
		if g.phase == "autumn":
			if cd > 0: return
			for q in run.queue:
				if q.wait < o.react * 1.5: continue
				var cell := g.free_room_for(q.sp)
				if cell >= 0:
					g.place_guest(q.id, cell)
					cd = o.gap * 1.5
					actions += 1
					return
		elif g.phase == "winter":
			if run.temp + g.pending_heat() < 40: cold_t += dt
			else: cold_t = 0.0
			if cd > 0: return
			if cold_t >= o.react and run.temp + g.pending_heat() < 52:
				if g.add_log():
					cd = o.gap
					actions += 1
					return
			for w in run.wps:
				if w.t >= o.react:
					g.shoo(w.id)
					cd = o.gap
					actions += 1
					return
			var best = null
			var bs := INF
			for x in run.guests:
				if x.gone: continue
				var need: bool = (not x.blanket and x.offT >= o.react) or (x.snore > 0 and (D.TUNE.snoreLen - x.snore) >= o.react)
				if need and x.sleep < bs:
					bs = x.sleep
					best = x
			if best != null and g.rand() < o.accuracy:
				g.tap_room(best.cell)
				cd = o.gap
				actions += 1
				return
			if best != null:
				cd = o.gap
				return
			if o.fun:
				var d = null
				for x in run.drops:
					if x.p > 0.25 and x.p < 0.95 and x.p / x.v >= o.react * 0.6:
						d = x
						break
				if d != null and g.rand() < o.fun:
					g.catch_drop(d.id)
					cd = o.gap * 0.8
					actions += 1
					return
				var dr = null
				for x in run.guests:
					if not x.gone and x.dream != null and x.dream.t >= o.react:
						dr = x
						break
				if dr != null and g.rand() < o.fun:
					g.feed(dr.cell, dr.dream.item)
					cd = o.gap * 2
					actions += 1
					return
		elif g.phase == "summary":
			g.to_summer()

	func _count(t: String) -> int:
		var n := 0
		for x in g.save.grid:
			if x.room == t: n += 1
		return n

	func summer() -> void:
		var s := g.save
		var guard := 0
		while guard < 40:
			guard += 1
			var rooms := 0
			var empties := []
			for i in s.grid.size():
				if s.grid[i].room != null: rooms += 1
				elif s.grid[i].dug: empties.append(i)
			var unl := D.ROOM_ORDER.filter(func(t): return s.fame >= D.ROOMS[t].fame)
			var want := D.guests_wanted(s)
			# 1. advertising is cheap and early
			if s.year >= 2 and not s.upgrades.get("ilan", false) and s.money >= D.UPGRADES.ilan.cost:
				g.buy("ilan")
				continue
			# 2. a room for every new kind of guest, more rooms while guests outnumber them
			var need_room := rooms < want
			var extra := 0 if empties.size() > 0 else D.dig_cost(OtelGame.dug_count(s))
			var cands := []
			var rev := unl.duplicate()
			rev.reverse()
			for t in rev:
				if _count(t) == 0:
					cands.append(t)
					break
			if need_room:
				for t in rev:
					if _count(t) < 3: cands.append(t)
				cands.append("yuva")
			var type = null
			for t in cands:
				if D.ROOMS[t].cost + extra <= s.money:
					type = t
					break
			if type != null:
				if empties.size() > 0:
					if g.build(empties[0], type) == "ok": continue
				else:
					var dig := -1
					for i in s.grid.size():
						if OtelGame.can_dig(s, i):
							dig = i
							break
					if dig >= 0 and g.dig(dig) == "ok": continue
			# 3. helpers once the hotel is busy
			if rooms >= 5 and o.buyStaff:
				var bought := false
				for id in ["sincap", "geyik", "baykus", "duvar", "sincap", "yosun", "ninni", "sincap"]:
					var c = g.item_cost(id)
					if c != null and s.money >= c:
						g.buy(id)
						bought = true
						break
					if c != null: break
				if bought: continue
			# 4. upgrade the best-paying room (first one among the highest price)
			if rooms >= 8:
				var up := -1
				var top := -1
				for i in s.grid.size():
					var x: Dictionary = s.grid[i]
					if x.room == null or x.lvl >= 3: continue
					var price: int = D.SPECIES[D.ROOMS[x.room].species[0]].price
					if price > top:
						top = price
						up = i
				if up >= 0 and g.upgrade_room(up) == "ok": continue
			break


static func _js_round(v: float) -> int:
	return int(D._js_round(v))


func play(opt: Dictionary, years: int, seed: int) -> Array:
	var save := OtelGame.new_save()
	var g := OtelGame.new(save, seed)
	var bot := Bot.new(g, opt)
	var log := []
	for y in years:
		g.start_autumn()
		bot.actions = 0
		var winter_t := 0.0
		var cold_s := 0.0
		var hot_s := 0.0
		var guard := 0
		while g.phase != "summer" and guard < 100000:
			guard += 1
			g.update(DT)
			bot.tick(DT)
			if g.phase == "winter":
				winter_t += DT
				if g.run.temp < D.TUNE.ZONE[0]: cold_s += DT
				if g.run.temp > D.TUNE.ZONE[1]: hot_s += DT
			g.take_events()
		var r: Dictionary = g.run.results
		var sum := 0.0
		var woke := 0
		for x in r.rows:
			sum += x.sleep
			if x.woke: woke += 1
		var avg: float = sum / r.rows.size() if r.rows.size() > 0 else 0.0
		var rooms := 0
		for x in save.grid:
			if x.room != null: rooms += 1
		var row := {
			"year": r.year, "guests": r.rows.size(), "left": r.left, "woke": woke,
			"avgSleep": _js_round(avg), "hearts": r.hearts, "earned": r.pay + r.tip,
			"apm": _js_round(bot.actions / maxf(1.0, winter_t) * 60.0),
			"cold": _js_round(cold_s), "hot": _js_round(hot_s),
			"stars": D.stars_for(save.fame), "fame": save.fame, "rooms": rooms,
			"auroras": r.auroras, "caught": r.caught, "dreams": r.dreams, "extra": r.caught + r.dreamTip,
		}
		bot.summer()
		row.moneyAfter = save.money
		row.staff = "%d%d%d" % [save.staff.sincap, save.staff.baykus, save.staff.geyik]
		row.upg = ",".join(PackedStringArray(save.upgrades.keys()))
		log.append(row)
	return log


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var years := int(args[0]) if args.size() > 0 else 10
	var profile: String = args[1] if args.size() > 1 else "kid"
	var seeds: PackedStringArray = (args[2] if args.size() > 2 else "1,2,3").split(",")
	var ref_path: String = args[3] if args.size() > 3 else ""
	var players: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/players.json"))
	var ref = JSON.parse_string(FileAccess.get_file_as_string(ref_path)) if ref_path != "" else null
	var bad := 0
	var t0 := Time.get_ticks_msec()
	for sd in seeds:
		var log := play(players[profile], years, int(sd))
		if ref == null:
			print(JSON.stringify(log))
			continue
		var want: Array = ref[sd]
		for y in years:
			for k in want[y]:
				var a = log[y].get(k)
				var b = want[y][k]
				var same: bool = (str(a) == str(b)) if typeof(b) == TYPE_STRING else (a != null and float(a) == float(b))
				if not same:
					bad += 1
					if bad <= 12:
						print("DIFF %s seed %s year %d %s: godot=%s js=%s" % [profile, sd, y + 1, k, a, b])
	var ms := Time.get_ticks_msec() - t0
	if ref != null:
		print("%s %s: %s (%d years x %d seeds, %d ms)" % [profile, "OK" if bad == 0 else "FAIL", "all equal" if bad == 0 else "%d differences" % bad, years, seeds.size(), ms])
	quit(1 if bad else 0)
