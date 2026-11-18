extends Node3D
## Kurye: a GTA 2-style top-down courier game. Pick up at a shop, drop off
## at a customer's door, before the clock runs out and without shaking the
## parcel to bits. A shift is four minutes.

const SHIFT := 240.0
const SEED := 7
const ARRIVE_R := 5.2
const ARRIVE_SPEED := 4.5

const CARGO := {
	"koli": {"name": "Koli", "fragile": 0.8, "time": 1.0, "hint": "Uzi Kargo paketi"},
	"pizza": {"name": "Pizza", "fragile": 1.0, "time": 0.82, "hint": "Sıcak sıcak yetiştir!"},
	"pasta": {"name": "Pasta", "fragile": 2.4, "time": 1.15, "hint": "Kolay ezilir, yavaş al virajları!"},
	"cicek": {"name": "Çiçek", "fragile": 1.5, "time": 1.0, "hint": "Yaprakları dökülmesin"},
	"kitap": {"name": "Kitap", "fragile": 0.45, "time": 0.95, "hint": "Sağlam paket"},
	"dondurma": {"name": "Dondurma", "fragile": 1.0, "time": 0.74, "hint": "Erimeden yetiştir!"},
}
const CUSTOMERS := ["Ayşe Teyze", "Mehmet Amca", "Zeynep", "Can", "Elif Hanım", "Ali Bey", "Deniz",
	"Ece", "Burak", "Selin", "Kemal Dede", "Nur Nine", "Emre", "Defne", "Kaan", "Leyla", "Mert",
	"Su", "Hakan Usta", "Pelin", "Ozan", "Melis", "Yusuf", "İpek", "Tuna", "Gül Teyze"]

enum { TITLE, PLAY, PAUSE, END }

var state := TITLE
var city: City
var traffic: Traffic
var peds: Peds
var player: Player
var cam: Camera3D
var hud: Hud
var car_shader: Shader
var blob_mat: ShaderMaterial
var rng := RandomNumberGenerator.new()

var cam_xy := Vector2.ZERO
var cam_h := 50.0

var time_left := SHIFT
var money := 0
var deliveries := 0
var stars := 0
var best_money := 0
var best_deliveries := 0

var order := {}
var done_t := 0.0
var last_shop := 0
var marker: MeshInstance3D
var marker_mat: ShaderMaterial
var float_icon: Sprite3D
var customer: MeshInstance3D
var customer_mat: ShaderMaterial
var cust_joy := 0.0
var icons := {}
var warn_cd := 0.0
var hey_cd := 0.0
var bump_cd := 0.0
var horn_cd := 0.0
var last_tick := -1

var bot := false
var bot_path: Array = []
var bot_target := Vector2.INF
var bot_stuck := 0.0
var bot_reverse := 0.0

var skid_mm: MultiMesh
var skid_i := 0
var skid_acc := 0.0
const SKIDS := 900

var snd := {}
var engine: AudioStreamPlayer
var skid: AudioStreamPlayer
var pool: Array = []

var shot_path := ""
var shot_frame := 150
var frame := 0
var test_bot := false
var test_seconds := 0.0
var sim_time := 0.0
var shot_title := false
var warmup := 0.0
var shift_len := SHIFT
var cover := false


func _ready() -> void:
	_parse_args()
	_setup_input()
	rng.seed = 2026
	car_shader = load("res://shaders/car.gdshader")
	blob_mat = ShaderMaterial.new()
	blob_mat.shader = load("res://shaders/blob.gdshader")
	city = City.new()
	add_child(city)
	city.generate(SEED)
	city.build()
	player = Player.new()
	add_child(player)
	player.setup(city, car_shader, blob_mat)
	_place_at_depot()
	peds = Peds.new()
	add_child(peds)
	peds.setup(city, player, car_shader, blob_mat)
	traffic = Traffic.new()
	add_child(traffic)
	traffic.peds = peds
	traffic.setup(city, player, car_shader, blob_mat)
	for n in ["pizza", "pasta", "cicek", "kitap", "dondurma", "koli", "ev"]:
		icons[n] = load("res://art/%s.svg" % n)
	_build_shop_signs()
	_build_marker()
	_build_customer()
	_build_skids()
	_setup_sound()
	cam = Camera3D.new()
	cam.fov = 52.0
	cam.near = 2.0
	cam.far = 220.0
	cam.rotation = Vector3(-PI * 0.5, 0.0, 0.0)
	add_child(cam)
	cam.current = true
	cam_xy = player.pos
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Hud.new()
	layer.add_child(hud)
	hud.setup()
	hud.start_pressed.connect(_start_shift)
	hud.restart_pressed.connect(_start_shift)
	hud.resume_pressed.connect(_resume)
	hud.pause_pressed.connect(_pause)
	hud.feedback_pressed.connect(_feedback)
	_load_best()
	_to_title()
	if test_bot or (shot_path != "" and not shot_title):
		_start_shift()


func _parse_args() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			shot_path = a.substr(7)
		elif a.begins_with("--frame="):
			shot_frame = int(a.substr(8))
		elif a == "--bot":
			test_bot = true
		elif a.begins_with("--seconds="):
			test_seconds = float(a.substr(10))
		elif a == "--title":
			shot_title = true
		elif a == "--cover":
			cover = true
		elif a.begins_with("--shift="):
			shift_len = float(a.substr(8))
		elif a.begins_with("--warmup="):
			warmup = float(a.substr(9))


func _setup_input() -> void:
	var keys := {
		"gas": [KEY_W, KEY_UP], "brake": [KEY_S, KEY_DOWN], "left": [KEY_A, KEY_LEFT],
		"right": [KEY_D, KEY_RIGHT], "handbrake": [KEY_SPACE], "horn": [KEY_H, KEY_E],
		"pause": [KEY_ESCAPE, KEY_P],
	}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a, 0.15)
		for k in keys[a]:
			var e := InputEventKey.new()
			e.physical_keycode = k
			InputMap.action_add_event(a, e)
	var axes := [["gas", JOY_AXIS_TRIGGER_RIGHT, 1.0], ["brake", JOY_AXIS_TRIGGER_LEFT, 1.0],
		["left", JOY_AXIS_LEFT_X, -1.0], ["right", JOY_AXIS_LEFT_X, 1.0]]
	for ax in axes:
		var e := InputEventJoypadMotion.new()
		e.axis = ax[1]
		e.axis_value = ax[2]
		InputMap.action_add_event(ax[0], e)
	for bt in [["handbrake", JOY_BUTTON_A], ["horn", JOY_BUTTON_B], ["pause", JOY_BUTTON_START], ["gas", JOY_BUTTON_RIGHT_SHOULDER], ["brake", JOY_BUTTON_LEFT_SHOULDER]]:
		var e := InputEventJoypadButton.new()
		e.button_index = bt[1]
		InputMap.action_add_event(bt[0], e)


# --- building the extras --------------------------------------------------------

func _build_shop_signs() -> void:
	var f: FontFile = load("res://fonts/baloo2-800.woff2")
	f.fallbacks = [load("res://fonts/baloo2-800-ext.woff2")]
	for s in city.shops:
		var b: Dictionary = city.buildings[s.building]
		var r: Rect2 = b.rect
		var c := r.get_center()
		var y: float = b.h + 0.12
		var spr := Sprite3D.new()
		spr.texture = icons[s.def.cargo]
		spr.pixel_size = minf(r.size.x, r.size.y) * 0.5 / 512.0
		spr.rotation = Vector3(-PI * 0.5, 0, 0)
		spr.position = Vector3(c.x, y, c.y - minf(r.size.y, 14.0) * 0.12)
		spr.shaded = false
		spr.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		add_child(spr)
		var lbl := Label3D.new()
		lbl.text = s.def.name
		lbl.font = f
		lbl.font_size = 96
		lbl.outline_size = 28
		lbl.modulate = Color(s.def.color).lightened(0.15)
		lbl.outline_modulate = Color("2b2421")
		lbl.pixel_size = minf(0.022, (r.size.x - 1.5) / (float(s.def.name.length()) * 56.0))
		lbl.rotation = Vector3(-PI * 0.5, 0, 0)
		lbl.position = Vector3(c.x, y + 0.05, c.y + minf(r.size.y, 14.0) * 0.28)
		lbl.shaded = false
		add_child(lbl)


func _build_marker() -> void:
	marker = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(ARRIVE_R * 2.0, ARRIVE_R * 2.0)
	marker.mesh = pm
	marker_mat = ShaderMaterial.new()
	marker_mat.shader = load("res://shaders/marker.gdshader")
	marker.material_override = marker_mat
	marker.position.y = 0.06
	add_child(marker)
	float_icon = Sprite3D.new()
	float_icon.pixel_size = 4.2 / 512.0
	float_icon.rotation = Vector3(-PI * 0.5, 0, 0)
	float_icon.shaded = false
	float_icon.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	add_child(float_icon)
	marker.visible = false
	float_icon.visible = false


func _build_customer() -> void:
	customer = MeshInstance3D.new()
	customer.mesh = Meshes.person()
	customer_mat = ShaderMaterial.new()
	customer_mat.shader = car_shader
	customer.material_override = customer_mat
	customer.scale = Vector3(1.15, 1.15, 1.15)
	add_child(customer)
	customer.visible = false


func _build_skids() -> void:
	skid_mm = MultiMesh.new()
	skid_mm.transform_format = MultiMesh.TRANSFORM_3D
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.62, 0.3)
	skid_mm.mesh = pm
	skid_mm.instance_count = SKIDS
	var far := Transform3D(Basis(), Vector3(0, -50, 0))
	for k in SKIDS:
		skid_mm.set_instance_transform(k, far)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(0.08, 0.08, 0.09, 0.32)
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = skid_mm
	mi.material_override = mat
	add_child(mi)


func _setup_sound() -> void:
	for n in ["engine", "skid", "horn", "bump", "pickup", "deliver", "star", "tick", "late", "hey", "whistle"]:
		snd[n] = load("res://sfx/%s.wav" % n)
	for n in ["engine", "skid"]:
		var s: AudioStreamWAV = snd[n]
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = int(s.get_length() * float(s.mix_rate))
	engine = AudioStreamPlayer.new()
	engine.stream = snd["engine"]
	engine.volume_db = -14.0
	add_child(engine)
	skid = AudioStreamPlayer.new()
	skid.stream = snd["skid"]
	skid.volume_db = -60.0
	add_child(skid)
	for k in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		pool.append(p)


func play(n: String, vol := 0.0, pitch := 1.0) -> void:
	for p: AudioStreamPlayer in pool:
		if not p.playing:
			p.stream = snd[n]
			p.volume_db = vol
			p.pitch_scale = pitch
			p.play()
			return


# --- game flow ------------------------------------------------------------------

func _place_at_depot() -> void:
	var s: Dictionary = city.shops[0]
	var out: Vector2 = s.out
	var v := Vector2(-out.y, out.x)
	player.place(s.spot + out * 1.9 - v * 6.0, v.angle())


func _to_title() -> void:
	state = TITLE
	bot = true
	hud.playing = false
	hud.top.visible = false
	hud.title_panel.visible = true
	hud.pause_panel.visible = false
	hud.end_panel.visible = false
	hud.set_best(best_money, best_deliveries)
	order = {}
	_new_order(true)


func _start_shift() -> void:
	state = PLAY
	bot = test_bot
	time_left = shift_len
	money = 0
	deliveries = 0
	stars = 0
	player.frozen = false
	_place_at_depot()
	cam_xy = player.pos
	hud.playing = true
	hud.release_touches()
	hud.top.visible = true
	hud.title_panel.visible = false
	hud.pause_panel.visible = false
	hud.end_panel.visible = false
	order = {}
	last_tick = -1
	_new_order(true)
	play("whistle", -6.0)
	hud.big("Haydi!", 1.2)
	if not engine.playing:
		engine.play()
		skid.play()
	_note("Vardiya başladı")
	_log("start")


func _pause() -> void:
	if state != PLAY:
		return
	state = PAUSE
	hud.playing = false
	hud.release_touches()
	hud.pause_panel.visible = true


func _resume() -> void:
	if state != PAUSE:
		return
	state = PLAY
	hud.playing = true
	hud.pause_panel.visible = false


func _end_shift() -> void:
	state = END
	player.frozen = true
	hud.playing = false
	hud.release_touches()
	var record := money > best_money
	if record:
		best_money = money
		best_deliveries = deliveries
		_save_best()
	play("whistle", -4.0, 0.85)
	hud.big("Zaman doldu!", 1.6)
	hud.show_end({"money": money, "deliveries": deliveries, "stars": stars, "record": record, "best": best_money})
	_note("Vardiya bitti · %d teslimat · %d jeton · %d yıldız" % [deliveries, money, stars])
	_log("end deliveries=%d money=%d stars=%d" % [deliveries, money, stars])


func _feedback(where: String) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.Hesap && Hesap.nasildi && Hesap.nasildi({oyun: 'kurye', yer: '%s'})" % where, true)


func _note(text: String) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.Hesap && Hesap.not && Hesap.not(%s)" % JSON.stringify(text), true)


func _log(t: String) -> void:
	if test_bot or test_seconds > 0.0:
		print("[kurye %.1fs] %s" % [sim_time, t])


func _load_best() -> void:
	var cf := ConfigFile.new()
	if cf.load("user://kurye.cfg") == OK:
		best_money = int(cf.get_value("best", "money", 0))
		best_deliveries = int(cf.get_value("best", "deliveries", 0))


func _save_best() -> void:
	var cf := ConfigFile.new()
	cf.set_value("best", "money", best_money)
	cf.set_value("best", "deliveries", best_deliveries)
	cf.save("user://kurye.cfg")


# --- orders ---------------------------------------------------------------------

static func _manhattan(a: Vector2, b: Vector2) -> float:
	return absf(a.x - b.x) + absf(a.y - b.y)


func _new_order(first: bool) -> void:
	var shop_i := 0
	if not first:
		var cands := []
		for k in city.shops.size():
			if k == last_shop:
				continue
			var d := _manhattan(city.shops[k].spot, player.pos)
			if d > 70.0 and d < 420.0:
				cands.append(k)
		if cands.is_empty():
			shop_i = (last_shop + 1 + rng.randi() % (city.shops.size() - 1)) % city.shops.size()
		else:
			shop_i = cands[rng.randi() % cands.size()]
	var shop: Dictionary = city.shops[shop_i]
	var door := _pick_door(shop.spot)
	order = {"shop": shop_i, "door": door, "cargo": shop.def.cargo, "phase": 0, "cond": 1.0,
		"customer": CUSTOMERS[rng.randi() % CUSTOMERS.size()], "t_left": 0.0, "par": 1.0, "late": false}
	last_shop = shop_i
	bot_target = Vector2.INF
	if first:
		_load_cargo(true)
	else:
		if state == PLAY and hud.toast_t < 0.4:
			hud.toast("Yeni sipariş: %s" % shop.def.name)


func _pick_door(from: Vector2) -> int:
	var cands := []
	for k in city.doors.size():
		var d := _manhattan(city.doors[k].spot, from)
		if d > 150.0 and d < 360.0:
			cands.append(k)
	if cands.is_empty():
		return rng.randi() % city.doors.size()
	return cands[rng.randi() % cands.size()]


func _target() -> Vector2:
	if order.is_empty():
		return player.pos
	if order.phase == 0:
		return city.shops[order.shop].spot
	return city.doors[order.door].spot


func _load_cargo(first := false) -> void:
	var shop: Dictionary = city.shops[order.shop]
	var door: Dictionary = city.doors[order.door]
	var c: Dictionary = CARGO[order.cargo]
	var dist := _manhattan(shop.spot, door.spot)
	order.phase = 1
	order.par = (dist / 11.5 + 9.0) * c.time
	order.t_left = order.par
	order.cond = 1.0
	order.late = false
	bot_target = Vector2.INF
	customer.visible = true
	var out: Vector2 = door.out
	customer.position = Vector3(door.door.x, 0.0, door.door.y)
	customer.rotation = Vector3(0, -out.angle(), 0)
	var shirt := Color(Peds.SHIRTS[rng.randi() % Peds.SHIRTS.size()])
	customer_mat.set_shader_parameter("paint", Color(shirt.r, shirt.g, shirt.b, rng.randf()))
	cust_joy = 0.0
	if state == PLAY:
		play("pickup", -3.0)
		if first:
			hud.toast("İlk paket hazır! %s bekliyor" % order.customer, 2.6)
		else:
			hud.toast("%s yüklendi · %s" % [c.name, c.hint], 2.6)
	_log("loaded %s from %s, %d m, par %.0fs" % [order.cargo, shop.def.name, dist, order.par])


func _deliver() -> void:
	var shop: Dictionary = city.shops[order.shop]
	var door: Dictionary = city.doors[order.door]
	var dist := _manhattan(shop.spot, door.spot)
	var base := 12.0 + dist / 10.0
	var cond: float = order.cond
	var t_left: float = order.t_left
	var par: float = order.par
	var pay := base * (0.4 + 0.6 * cond)
	var st := 1
	if t_left >= 0.0:
		pay += ceilf(t_left * 0.6)
		if cond >= 0.85:
			st = 3
		elif cond >= 0.5:
			st = 2
	else:
		pay *= maxf(0.35, 1.0 + t_left / par)
		if cond >= 0.85 and t_left > -par * 0.25:
			st = 2
	var tip := 0
	if st == 3:
		tip = 5
	var p := int(round(pay)) + tip
	if state == PLAY:
		money += p
		deliveries += 1
		stars += st
		play("deliver", -2.0)
		for k in st:
			get_tree().create_timer(0.35 + 0.16 * k).timeout.connect(func(): play("star", -6.0, 1.0 + 0.08 * k))
		hud.big("+%d" % p, 1.6)
		hud.show_stars(st, 1.6)
		var msg: String = ["Geç oldu ama geldi.", "Teşekkürler!", "Harikasın, çok hızlı!"][st - 1]
		if tip > 0:
			msg += " Bahşiş +%d" % tip
		hud.toast(msg, 2.4)
	cust_joy = 1.6
	order.phase = 2
	done_t = 1.5
	_log("delivered %s to %s: pay %d, stars %d, cond %.2f, t_left %.1f" % [order.cargo, order.customer, p, st, cond, t_left])


func _update_order(dt: float) -> void:
	if order.is_empty():
		return
	if order.phase == 2:
		done_t -= dt
		if done_t <= 0.0:
			_new_order(false)
		return
	var tgt := _target()
	if player.pos.distance_to(tgt) < ARRIVE_R and absf(player.speed) < ARRIVE_SPEED:
		if order.phase == 0:
			_load_cargo()
		else:
			_deliver()
		return
	if order.phase == 1:
		order.t_left -= dt
		var tl: float = order.t_left
		if state == PLAY:
			if tl < 5.0 and tl > 0.0 and int(ceil(tl)) != last_tick:
				last_tick = int(ceil(tl))
				play("tick", -4.0)
			if tl <= 0.0 and not order.late:
				order.late = true
				play("late", -4.0)
				hud.toast("Geç kalıyorsun! Yine de götür.", 2.2)
		# bumps shake the parcel
		var c: Dictionary = CARGO[order.cargo]
		if player.hit > 2.5:
			var loss := (player.hit - 2.0) * 0.022 * float(c.fragile)
			order.cond = maxf(0.0, order.cond - loss)
			if state == PLAY and warn_cd <= 0.0 and loss > 0.04:
				hud.toast("Dikkat! %s sarsıldı" % c.name, 1.6)
				warn_cd = 2.0
		if peds.knocked > 0:
			order.cond = maxf(0.0, order.cond - 0.05 * float(c.fragile))


# --- main loop ------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if state == PLAY:
			_pause()
		elif state == PAUSE:
			_resume()
	if event.is_action_pressed("ui_accept") and state == TITLE and not test_bot:
		_start_shift()


func _process(delta: float) -> void:
	frame += 1
	if warmup > 0.0:
		var n := int(warmup * 60.0)
		warmup = 0.0
		for k in n:
			_step(1.0 / 60.0)
	_step(minf(delta, 1.0 / 30.0))
	if cover:
		hud.visible = false
	if shot_path != "" and frame == shot_frame:
		get_viewport().get_texture().get_image().save_png(shot_path)
		print("shot ", shot_path)
		get_tree().quit()
	if test_seconds > 0.0 and sim_time >= test_seconds:
		var vr := _view_rect()
		var np := 0
		for pd in peds.peds:
			if vr.has_point(pd.pos):
				np += 1
		var nc := 0
		for car in traffic.cars:
			if vr.has_point(car.pos):
				nc += 1
		print("[kurye] done: deliveries=%d money=%d stars=%d time_left=%.1f pos=%s peds_in_view=%d cars_in_view=%d view=%s" % [deliveries, money, stars, time_left, player.pos, np, nc, vr.size])
		get_tree().quit()


func _step(dt: float) -> void:
	if state == PAUSE:
		engine.volume_db = -60.0
		skid.volume_db = -60.0
		hud.tick(dt)
		return
	sim_time += dt
	warn_cd -= dt
	hey_cd -= dt
	bump_cd -= dt
	horn_cd -= dt
	if state == PLAY:
		time_left -= dt
		if time_left <= 0.0:
			time_left = 0.0
			_end_shift()
	_controls(dt)
	player.step(dt)
	_collide_traffic()
	var vr := _view_rect()
	peds.view = vr
	peds.update(dt)
	traffic.view = vr
	traffic.update(dt)
	if state == PLAY or state == TITLE:
		_update_order(dt)
	_effects(dt)
	_update_camera(dt)
	_update_markers(dt)
	_update_hud(dt)
	_sound(dt)


func _controls(dt: float) -> void:
	if bot:
		_bot(dt)
		return
	if state != PLAY:
		player.throttle = 0.0
		player.steer = 0.0
		player.handbrake = state != PLAY
		return
	var steer := Input.get_axis("left", "right")
	var thr := Input.get_action_strength("gas") - Input.get_action_strength("brake")
	var hb := Input.is_action_pressed("handbrake")
	var horn := Input.is_action_just_pressed("horn")
	if hud.stick_idx >= 0:
		var d := hud.stick_vec
		var mag := d.length()
		if mag > 0.18:
			var want := d.angle()
			var delta := wrapf(want - player.head, -PI, PI)
			steer = clampf(delta * 1.7, -1.0, 1.0)
			thr = clampf(mag * 1.3, 0.0, 1.0) * lerpf(1.0, 0.5, clampf(absf(delta) / PI, 0.0, 1.0))
	if hud.brake_idx >= 0:
		thr = -1.0
	if hud.drift_idx >= 0:
		hb = true
	if hud.horn_tap:
		hud.horn_tap = false
		horn = true
	player.steer = steer
	player.throttle = thr
	player.handbrake = hb
	if horn and horn_cd <= 0.0:
		horn_cd = 0.35
		play("horn", -4.0)
		for pd in peds.peds:
			var d: Vector2 = (pd.pos + pd.off) - player.pos
			if d.length() < 9.0 and pd.state != 2 and pd.startle <= 0.0:
				pd.startle = 0.8


func _collide_traffic() -> void:
	var f := player.fwd()
	for car in traffic.cars:
		if car.pos.distance_squared_to(player.pos) > 100.0:
			continue
		var tr: float = car.width * 0.5
		for pass_k in 2:
			var tc: Array = traffic.circles(car)
			for off: float in Player.CIRCLES:
				var pc := player.pos + f * off
				for c: Vector2 in tc:
					var d := pc - c
					var dist := d.length()
					var rr := Player.R + tr
					if dist < rr and dist > 0.001:
						var n := d / dist
						var depth := rr - dist
						player.pos += n * depth * 0.8
						car.off -= n * depth * 0.2
						pc += n * depth * 0.8
						var vn := player._impulse(n, f * off, traffic.velocity(car), 0.8)
						if vn > 0.4:
							traffic.bump(car, n, vn)
	player._sync(0.0)


func _effects(dt: float) -> void:
	# skid marks from the rear wheels
	var marking := (player.slip > 3.4 and absf(player.speed) > 3.0) or (player.handbrake and absf(player.speed) > 4.0 and state == PLAY) or (player.accel_f < -20.0 and absf(player.speed) > 4.0)
	if marking:
		skid_acc += player.vel.length() * dt
		if skid_acc > 0.45:
			skid_acc = 0.0
			var f := player.fwd()
			var r := player.rgt()
			var ang := player.vel.angle() if player.vel.length() > 1.0 else player.head
			for s: float in [-0.92, 0.92]:
				var p := player.pos - f * 1.45 + r * s
				skid_mm.set_instance_transform(skid_i, Transform3D(Basis(Vector3.UP, -ang), Vector3(p.x, 0.035 + 0.0001 * float(skid_i % 50), p.y)))
				skid_i = (skid_i + 1) % SKIDS
	if state != PLAY:
		return
	if peds.startled > 0 and hey_cd <= 0.0:
		hey_cd = 0.9
		play("hey", -6.0, rng.randf_range(0.85, 1.25))
	if peds.knocked > 0:
		play("bump", -8.0, 1.5)
		play("hey", -3.0, rng.randf_range(0.7, 0.9))
		hud.toast("Aman dikkat! Yayalara yol ver.", 1.8)
	if player.hit > 2.0 and bump_cd <= 0.0:
		bump_cd = 0.18
		play("bump", linear_to_db(clampf(player.hit / 12.0, 0.15, 1.0)) - 2.0, rng.randf_range(0.9, 1.1))
	for hp: Vector2 in traffic.honks:
		var d := hp.distance_to(cam_xy)
		if d < 70.0:
			play("horn", -8.0 - d * 0.25, rng.randf_range(0.82, 1.18))


func _update_camera(dt: float) -> void:
	var look := player.vel * 0.55
	if look.length() > 15.0:
		look = look.normalized() * 15.0
	var want := player.pos + look
	cam_xy = cam_xy.lerp(want, 1.0 - exp(-4.0 * dt))
	var want_h := 46.0 + clampf(absf(player.speed) - 4.0, 0.0, 23.0) * 0.85
	if state == TITLE:
		want_h = 62.0
	cam_h = lerpf(cam_h, want_h, 1.0 - exp(-1.3 * dt))
	cam.position = Vector3(cam_xy.x, cam_h, cam_xy.y)


func _view_rect() -> Rect2:
	var vs := get_viewport().get_visible_rect().size
	var hh := cam_h * tan(deg_to_rad(cam.fov * 0.5))
	var hw := hh * vs.x / maxf(vs.y, 1.0)
	return Rect2(cam_xy - Vector2(hw, hh), Vector2(hw, hh) * 2.0)


func _update_markers(dt: float) -> void:
	var t := sim_time
	if order.is_empty() or order.phase == 2:
		marker.visible = false
		float_icon.visible = false
	else:
		var tgt := _target()
		marker.visible = true
		float_icon.visible = true
		marker.position = Vector3(tgt.x, 0.06, tgt.y)
		var col := Color("3fae5a") if order.phase == 0 else Color("f08a24")
		marker_mat.set_shader_parameter("tint", col)
		var near := clampf(1.0 - (player.pos.distance_to(tgt) - ARRIVE_R) / 10.0, 0.0, 1.0)
		marker_mat.set_shader_parameter("glow", near)
		float_icon.texture = icons[order.cargo] if order.phase == 0 else icons["ev"]
		float_icon.position = Vector3(tgt.x, 6.5 + sin(t * 3.0) * 0.5, tgt.y)
	if customer.visible:
		if cust_joy > 0.0:
			cust_joy -= dt
			customer.position.y = absf(sin(cust_joy * 9.0)) * 0.6
			if cust_joy <= 0.0:
				customer.visible = false
				customer.position.y = 0.0
		else:
			customer.rotation.z = sin(t * 6.0) * 0.12


func _update_hud(dt: float) -> void:
	hud.tick(dt)
	if state == TITLE:
		return
	hud.money_lbl.text = str(money)
	hud.count_lbl.text = str(deliveries)
	var tl := int(ceil(time_left))
	hud.clock_lbl.text = "%d:%02d" % [tl / 60, tl % 60]
	hud.clock_lbl.add_theme_color_override("font_color", Hud.RED if time_left < 30.0 else Hud.INK)
	if order.is_empty() or order.phase == 2:
		hud.set_order("", "", "", "", Hud.INK, 1.0, false)
		hud.arrow_on = false
		return
	var c: Dictionary = CARGO[order.cargo]
	if order.phase == 0:
		var shop: Dictionary = city.shops[order.shop]
		hud.set_order(order.cargo, "%s %s al" % [shop.def.from, c.name.to_lower()],
			"Dükkânın önünde yavaşla", "", Hud.INK, 1.0, false)
	else:
		var tl2: float = order.t_left
		var txt := "%d" % int(ceil(tl2)) if tl2 > 0.0 else "+%d" % int(ceil(-tl2))
		var tc := Hud.INK if tl2 > 8.0 else (Color("d9822b") if tl2 > 0.0 else Hud.RED)
		hud.set_order(order.cargo, "%s · %s" % [c.name, order.customer], c.hint, txt, tc, order.cond, true)
	var tgt := _target()
	var d := tgt - player.pos
	hud.arrow_on = d.length() > ARRIVE_R + 2.0
	hud.arrow_dir = d.normalized() if d.length() > 0.01 else Vector2.RIGHT
	hud.arrow_dist = d.length()
	hud.arrow_col = Hud.GREEN if order.phase == 0 else Hud.ORANGE
	hud.arrow_from = cam.unproject_position(player.position + Vector3(0, 1.0, 0))


func _sound(dt: float) -> void:
	if state == END or state == TITLE:
		engine.volume_db = lerpf(engine.volume_db, -60.0 if state == END else -40.0, 1.0 - exp(-3.0 * dt))
		skid.volume_db = -60.0
		return
	var sp := absf(player.speed)
	engine.pitch_scale = 0.55 + sp / Player.MAX_SPEED * 1.25 + absf(player.throttle) * 0.08
	engine.volume_db = linear_to_db(0.22 + 0.22 * absf(player.throttle) + sp / Player.MAX_SPEED * 0.12) - 6.0
	var sk := clampf((player.slip - 2.5) / 6.0, 0.0, 1.0)
	if player.handbrake and sp > 4.0:
		sk = maxf(sk, 0.6)
	skid.volume_db = linear_to_db(maxf(sk * 0.5, 0.0001))
	skid.pitch_scale = 0.9 + sp / 60.0


# --- the bot (title screen and tests) ----------------------------------------------

func _route(from: Vector2, to: Vector2) -> Array:
	var f := player.fwd()
	var best := Vector2i.ZERO
	var best_s := 1e9
	var base := City.nearest_node(from)
	for dj in range(-1, 2):
		for di in range(-1, 2):
			var n := base + Vector2i(di, dj)
			if not City.valid_node(n):
				continue
			var p := City.node_pos(n)
			var s := p.distance_to(from)
			if (p - from).dot(f) < 0.0:
				s += 70.0
			if s < best_s:
				best_s = s
				best = n
	var goal := City.nearest_node(to)
	var pts: Array = []
	var n := best
	var prev_d := -1
	var nodes: Array = [n]
	while n != goal:
		var d := 0
		if n.x != goal.x and (n.y == goal.y or absf(n.x - goal.x) >= absf(n.y - goal.y)):
			d = 0 if goal.x > n.x else 2
		else:
			d = 1 if goal.y > n.y else 3
		n += City.dir_step(d)
		nodes.append(n)
	for k in nodes.size():
		var nd: Vector2i = nodes[k]
		var d_in := -1
		var d_out := -1
		if k > 0:
			d_in = _dir_between(nodes[k - 1], nd)
		if k < nodes.size() - 1:
			d_out = _dir_between(nd, nodes[k + 1])
		var p := City.node_pos(nd)
		if d_in >= 0:
			p += City.right_of(d_in) * City.LO
		if d_out >= 0:
			p += City.right_of(d_out) * City.LO
		pts.append(p)
	pts.append(to)
	return pts


static func _dir_between(a: Vector2i, b: Vector2i) -> int:
	var d := b - a
	if d.x > 0:
		return 0
	if d.y > 0:
		return 1
	if d.x < 0:
		return 2
	return 3


func _bot(dt: float) -> void:
	if state == END:
		player.throttle = 0.0
		return
	var tgt := _target()
	if tgt != bot_target or bot_path.is_empty():
		bot_target = tgt
		bot_path = _route(player.pos, tgt)
	while bot_path.size() > 1 and player.pos.distance_to(bot_path[0]) < 8.0:
		bot_path.pop_front()
	var wp: Vector2 = bot_path[0]
	var to := wp - player.pos
	var delta := wrapf(to.angle() - player.head, -PI, PI)
	var vmax := 20.0
	if bot_path.size() > 1:
		var nxt: Vector2 = bot_path[1]
		var turn := absf(wrapf((nxt - wp).angle() - to.angle(), -PI, PI))
		if turn > 0.5:
			vmax = lerpf(20.0, 7.0, clampf((26.0 - to.length()) / 20.0, 0.0, 1.0))
	else:
		vmax = minf(vmax, 2.5 + to.length() * 0.45)
	if absf(delta) > 0.7:
		vmax = minf(vmax, 7.0)
	var steer := clampf(delta * 2.2, -1.0, 1.0)
	var thr := 1.0 if player.speed < vmax else (-0.6 if player.speed > vmax + 2.5 else 0.15)
	# unstick: reverse for a moment
	if absf(player.speed) < 1.0 and thr > 0.0:
		bot_stuck += dt
	else:
		bot_stuck = maxf(0.0, bot_stuck - dt)
	if bot_stuck > 1.2:
		bot_reverse = 1.1
		bot_stuck = 0.0
		bot_path = []
	if bot_reverse > 0.0:
		bot_reverse -= dt
		thr = -0.8
		steer = -steer
	player.steer = steer
	player.throttle = thr
	player.handbrake = false
