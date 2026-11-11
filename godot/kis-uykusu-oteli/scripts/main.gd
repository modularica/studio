extends Node2D
## Kış Uykusu Oteli: look test. A night cross-section of the hotel with
## lit rooms, snow, chimney smoke and the northern lights. Tap a room to
## tuck a fallen blanket, tap the cabin to feed the stove, tap a falling nut.

const ART := "res://art/"
const S := 0.5                     # art is drawn at 2x
const GROUND_Y := 560.0
const CELL := Vector2(300, 200)
const GRID := Vector2(200, 600)
const NIGHT := Color(0.46, 0.52, 0.72)
const WARM := Color(1.0, 0.78, 0.5)
const LAMP := Color(1.0, 0.72, 0.42)

var world: Node2D
var overlay: CanvasLayer
var cam: Camera2D
var light_tex: Texture2D
var font: FontFile
var sky_rect: ColorRect
var aurora_rect: ColorRect
var stars: Node2D
var moon: Sprite2D
var counter_label: Label

var guests: Array = []
var nuts: Array = []
var lamps: Array = []
var nut_count := 0
var window_light: PointLight2D
var smoke: CPUParticles2D
var flare := 0.0
var t := 0.0
var next_nut := 2.0
var cabin_rect := Rect2()
var shot_path := ""
var shot_frames := 0
var cover_mode := false  # --cover: no grain and no UI, for the share image
var rng := RandomNumberGenerator.new()


func _ready() -> void:
	rng.seed = 7
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			shot_path = a.substr(7)
		if a == "--cover":
			cover_mode = true
	light_tex = tex("light")
	# Fredoka has no ş, ğ or İ; those letters come from Nunito (as on the web
	# page). There are no system fonts to fall back on in the browser.
	font = load("res://fonts/fredoka-600.woff2")
	font.fallbacks = [load("res://fonts/fredoka-600-ext.woff2"), load("res://fonts/nunito-700-ext.woff2"), load("res://fonts/nunito-700.woff2")]

	cam = Camera2D.new()
	cam.position = Vector2(800, 600)
	add_child(cam)
	cam.make_current()

	_build_sky()
	_build_far()
	world = Node2D.new()
	add_child(world)
	var cm := CanvasModulate.new()
	cm.color = NIGHT
	add_child(cm)
	overlay = CanvasLayer.new()
	overlay.layer = 5
	overlay.follow_viewport_enabled = true
	add_child(overlay)

	_build_ground()
	_build_trees()
	_build_cabin()
	_build_snow()
	_build_rooms()
	_build_fx_and_ui()
	get_viewport().size_changed.connect(_on_resize)
	_on_resize()


# ---- helpers ---------------------------------------------------------------

func tex(name: String) -> Texture2D:
	return load(ART + name + ".svg")


func sprite(name: String, pos: Vector2, parent: Node, z := 0, anchor := Vector2(0.5, 1.0), sc := S) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex(name)
	s.centered = false
	s.offset = -s.texture.get_size() * anchor
	s.scale = Vector2(sc, sc)
	s.position = pos
	s.z_index = z
	parent.add_child(s)
	return s


func light(pos: Vector2, color: Color, energy: float, size_px: float) -> PointLight2D:
	var l := PointLight2D.new()
	l.texture = light_tex
	l.texture_scale = size_px / light_tex.get_width()
	l.color = color
	l.energy = energy
	l.position = pos
	world.add_child(l)
	return l


func label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = size
	ls.font_color = color
	l.label_settings = ls
	return l


func cell_center(r: int, c: int) -> Vector2:
	return GRID + Vector2(c * CELL.x + CELL.x / 2, r * CELL.y + CELL.y / 2)


# ---- sky (screen space, not darkened by the night tint) ----------------------

func _build_sky() -> void:
	var layer := CanvasLayer.new()
	layer.layer = -10
	add_child(layer)
	sky_rect = ColorRect.new()
	sky_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/sky.gdshader")
	sky_rect.material = m
	layer.add_child(sky_rect)
	stars = Node2D.new()
	stars.set_script(load("res://scripts/stars.gd"))
	layer.add_child(stars)
	moon = Sprite2D.new()
	moon.texture = tex("moon")
	moon.scale = Vector2(0.6, 0.6)
	layer.add_child(moon)
	aurora_rect = ColorRect.new()
	aurora_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	var am := ShaderMaterial.new()
	am.shader = load("res://shaders/aurora.gdshader")
	aurora_rect.material = am
	aurora_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sky_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(aurora_rect)


func _build_far() -> void:
	# mountains and a far forest follow the camera but stay out of the night tint
	var layer := CanvasLayer.new()
	layer.layer = -5
	layer.follow_viewport_enabled = true
	add_child(layer)
	for k in range(-2, 4):
		sprite("mountains", Vector2(k * 1024, GROUND_Y + 30), layer, 0, Vector2(0, 1))
	for k in range(-12, 34):
		var x := k * 70.0 + rng.randf_range(-20, 20)
		var name: String = ["pine_a", "pine_b", "pine_c"][k % 3]
		var s := sprite(name, Vector2(x, GROUND_Y + 10), layer, 1, Vector2(0.5, 1.0), rng.randf_range(0.17, 0.26))
		s.modulate = Color(0.36, 0.44, 0.6)


# ---- the world ---------------------------------------------------------------

func _build_ground() -> void:
	for k in range(-2, 4):
		sprite("soil", Vector2(k * 1024, GROUND_Y - 22), world, 0, Vector2(0, 0))
	var deep := ColorRect.new()
	deep.color = Color("5f4a3a")
	deep.position = Vector2(-2400, GROUND_Y - 22 + 890)
	deep.size = Vector2(6000, 3000)
	world.add_child(deep)


func _build_trees() -> void:
	var trees := [
		["pine_c", -330.0, 0.95], ["birch_a", -120.0, 1.0], ["pine_a", 110.0, 1.0], ["birch_b", 330.0, 1.0],
		["pine_b", 560.0, 1.05], ["birch_a", 800.0, 0.95], ["pine_c", 960.0, 0.92], ["pine_b", 1600.0, 1.1],
		["birch_b", 1780.0, 1.0], ["pine_a", 1960.0, 1.0],
	]
	for tr in trees:
		sprite(tr[0], Vector2(tr[1], GROUND_Y + 8), world, -10, Vector2(0.5, 1.0), S * tr[2])
	sprite("fence", Vector2(-40, GROUND_Y + 10), world, -9, Vector2(0, 1), S * 0.9)
	sprite("fence", Vector2(170, GROUND_Y + 12), world, -9, Vector2(0, 1), S * 0.9)


func _build_cabin() -> void:
	var base := Vector2(1250, GROUND_Y + 14)
	var cab := sprite("cabin", base, world, -8)
	var size := cab.texture.get_size() * S
	var tl := base - Vector2(size.x / 2, size.y)
	cabin_rect = Rect2(tl + Vector2(30, 40), size - Vector2(60, 40))
	sprite("woodpile", Vector2(1490, GROUND_Y + 12), world, -7, Vector2(0.5, 1.0), S * 0.8)
	window_light = light(tl + Vector2(133, 268), WARM, 0.85, 340)
	lamps.append([light(tl + Vector2(303, 236), LAMP, 0.95, 170), 0.95])
	lamps.append([light(tl + Vector2(195, 145), WARM, 0.6, 120), 0.6])
	smoke = CPUParticles2D.new()
	smoke.position = tl + Vector2(291, 70)
	smoke.texture = tex("puff")
	smoke.amount = 16
	smoke.lifetime = 5.0
	smoke.preprocess = 5.0
	smoke.direction = Vector2(0.15, -1)
	smoke.spread = 10.0
	smoke.gravity = Vector2(9, -14)
	smoke.initial_velocity_min = 16.0
	smoke.initial_velocity_max = 26.0
	smoke.scale_amount_min = 0.25
	smoke.scale_amount_max = 0.4
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.4))
	curve.add_point(Vector2(1, 1.6))
	smoke.scale_amount_curve = curve
	var ramp := Gradient.new()
	ramp.colors = PackedColorArray([Color(1.5, 1.55, 1.7, 0.0), Color(1.5, 1.55, 1.7, 0.45), Color(1.5, 1.55, 1.7, 0.0)])
	ramp.offsets = PackedFloat32Array([0.0, 0.15, 1.0])
	smoke.color_ramp = ramp
	smoke.z_index = -9
	world.add_child(smoke)


func _build_snow() -> void:
	for spec in [[-12, 120, 0.12, 0.22, 16.0, Color(1.3, 1.35, 1.5, 0.7)], [-5, 90, 0.22, 0.45, 28.0, Color(1.9, 1.95, 2.1, 0.9)]]:
		var p := CPUParticles2D.new()
		p.texture = tex("flake")
		p.amount = spec[1]
		p.lifetime = 26.0
		p.preprocess = 26.0
		p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		p.emission_rect_extents = Vector2(1700, 10)
		p.position = Vector2(800, -700)
		p.direction = Vector2(0.15, 1)
		p.spread = 18.0
		p.gravity = Vector2(4, 6)
		p.initial_velocity_min = spec[4] * 0.8
		p.initial_velocity_max = spec[4] * 1.3
		p.scale_amount_min = spec[2]
		p.scale_amount_max = spec[3]
		p.color = spec[5]
		p.z_index = spec[0]
		world.add_child(p)


func _build_rooms() -> void:
	# tunnels and the entrance shaft first, so the rooms sit on top
	var floor0 := cell_center(0, 0).y + 83
	for c in range(3):
		sprite("tunnel_h", Vector2(GRID.x + (c + 1) * CELL.x, floor0 + 4), world, 2, Vector2(0.5, 1.0))
	var shaft := sprite("shaft", Vector2(cell_center(0, 3).x - 70, GROUND_Y + 4), world, 1, Vector2(0.5, 0.0))
	shaft.scale.y = S * (cell_center(0, 3).y - 60 - GROUND_Y) / 120.0
	var shaft2 := sprite("shaft", Vector2(cell_center(0, 1).x + 104, floor0 - 8), world, 1, Vector2(0.5, 0.0))
	shaft2.scale.y = S * 0.55
	var floor1 := cell_center(1, 0).y + 83
	for c in range(2):
		sprite("tunnel_h", Vector2(GRID.x + (c + 1) * CELL.x, floor1 + 4), world, 2, Vector2(0.5, 1.0))
	# things buried in the soil
	for b in [["bit_stones", Vector2(1260, 860)], ["bit_worm", Vector2(300, 1010)], ["bit_stash", Vector2(1120, 1060)], ["bit_fossil", Vector2(700, 1080)], ["bit_stones", Vector2(150, 1200)], ["bit_worm", Vector2(1450, 1150)]]:
		sprite(b[0], b[1], world, 1, Vector2(0.5, 0.5))
	var rooms := [
		[0, 0, "room_leaf", "hedgehog", "blue", Vector2(0.53, 0.936), Vector2(56, 52)],
		[0, 1, "room_leaf", "dormouse", "mustard", Vector2(0.52, 0.936), Vector2(56, 52)],
		[0, 2, "room_cave", "bear", "red", Vector2(0.52, 0.936), Vector2(140, 46)],
		[0, 3, "room_straw", "", "", Vector2.ZERO, Vector2(224, 50)],
		[1, 0, "room_leaf", "dormouse", "green", Vector2(0.52, 0.936), Vector2(56, 52)],
		[1, 1, "room_empty", "", "", Vector2.ZERO, Vector2(-1, -1)],
		[1, 2, "room_leaf", "hedgehog", "red", Vector2(0.53, 0.936), Vector2(56, 52)],
	]
	for spec in rooms:
		var c := cell_center(spec[0], spec[1])
		sprite(spec[2], c, world, 3, Vector2(0.5, 0.5))
		var tl: Vector2 = c - Vector2(140, 90)
		if spec[6].x >= 0:
			lamps.append([light(tl + spec[6], LAMP, 1.0, 230), 1.0])
			light(c + Vector2(0, 10), Color(1.0, 0.84, 0.62), 0.75, 440)
		if spec[3] == "":
			continue
		var floor_y := c.y + 83
		var g := {}
		g.kind = spec[3]
		g.center = c
		g.rect = Rect2(c - Vector2(140, 90), Vector2(280, 180))
		g.animal = sprite(spec[3], Vector2(c.x, floor_y), world, 5, spec[5])
		g.blanket = sprite("blanket_%s_%s" % [spec[3], spec[4]], Vector2(c.x, floor_y), world, 6, spec[5])
		g.folded = sprite("blanket_folded_" + spec[4], Vector2(c.x - 96, floor_y + 4), world, 4, Vector2(0.5, 0.9), S * 0.8)
		g.folded.visible = false
		g.bubble = sprite("bubble_blanket", c + Vector2(98, -40), overlay, 10, Vector2(0.5, 1.0), S * 0.85)
		g.bubble.visible = false
		g.base = Vector2(c.x, floor_y)
		g.phase = rng.randf() * TAU
		g.off = false
		g.next_slip = rng.randf_range(5.0, 12.0) + guests.size() * 4.0
		g.next_z = rng.randf_range(0.2, 1.5)
		g.snore = 0.0
		g.next_snore = 6.0 if spec[3] == "bear" else 1e9
		guests.append(g)


func _build_fx_and_ui() -> void:
	var fx := CanvasLayer.new()
	fx.layer = 50
	add_child(fx)
	var grain := ColorRect.new()
	grain.set_anchors_preset(Control.PRESET_FULL_RECT)
	grain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gm := ShaderMaterial.new()
	gm.shader = load("res://shaders/grain.gdshader")
	grain.material = gm
	grain.visible = not cover_mode
	fx.add_child(grain)

	var ui := CanvasLayer.new()
	ui.layer = 60
	ui.visible = not cover_mode
	add_child(ui)
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.985, 0.97, 0.95, 0.94)
	sb.set_corner_radius_all(999)
	sb.content_margin_left = 16
	sb.content_margin_right = 20
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", sb)
	panel.position = Vector2(24, 24)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var icon := TextureRect.new()
	icon.texture = tex("nut_leaf")
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(34, 40)
	row.add_child(icon)
	counter_label = label("0", 30, Color("2b2421"))
	row.add_child(counter_label)
	panel.add_child(row)
	ui.add_child(panel)
	var hint := label("Görünüm denemesi · odaya dokun: battaniyeyi ört · kulübeye dokun: sobaya odun at · düşen fındığa dokun", 22, Color(0.98, 0.96, 0.92, 0.85))
	hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.position = Vector2(-560, -64)
	hint.size = Vector2(1120, 50)
	ui.add_child(hint)

	# "Nasıldı?" opens the Lab's feedback sheet (hesap/nasildi.js) on the web page.
	if OS.has_feature("web"):
		var fb := Button.new()
		fb.text = "Nasıldı?"
		fb.focus_mode = Control.FOCUS_NONE
		for st in ["normal", "hover", "pressed"]:
			var b := sb.duplicate() as StyleBoxFlat
			b.content_margin_left = 22
			b.content_margin_right = 22
			b.content_margin_top = 10
			b.content_margin_bottom = 10
			if st == "pressed":
				b.bg_color = Color(0.92, 0.88, 0.82, 0.96)
			fb.add_theme_stylebox_override(st, b)
		fb.add_theme_font_override("font", font)
		fb.add_theme_font_size_override("font_size", 26)
		for c in ["font_color", "font_hover_color", "font_pressed_color"]:
			fb.add_theme_color_override(c, Color("2b2421"))
		fb.pressed.connect(func():
			JavaScriptBridge.eval("window.Hesap && Hesap.nasildi && Hesap.nasildi({oyun: 'otel-yeni', yer: 'gorunum'})", true))
		ui.add_child(fb)
		fb.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		fb.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 24)


func _on_resize() -> void:
	var vp := get_viewport().get_visible_rect().size
	var ct := get_viewport().get_canvas_transform()
	var horizon := clampf((ct * Vector2(0, GROUND_Y)).y / vp.y, 0.1, 0.95)
	(sky_rect.material as ShaderMaterial).set_shader_parameter("horizon", horizon)
	(aurora_rect.material as ShaderMaterial).set_shader_parameter("horizon", horizon)
	stars.set("area", Vector2(vp.x, vp.y * horizon))
	moon.position = Vector2(vp.x * 0.13, vp.y * horizon * 0.3)


# ---- life ----------------------------------------------------------------------

func _process(delta: float) -> void:
	t += delta
	if t < 0.05:
		_on_resize()
	flare = maxf(0.0, flare - delta * 1.2)
	window_light.energy = 0.85 + 0.1 * sin(t * 9.1) + 0.07 * sin(t * 13.7) + flare * 1.4
	for l in lamps:
		l[0].energy = l[1] * (1.0 + 0.04 * sin(t * 7.3 + l[1] * 10.0))
	for g in guests:
		_update_guest(g, delta)
	_update_nuts(delta)
	if shot_path != "":
		shot_frames += 1
		if shot_frames == 90:
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(shot_path)
			get_tree().quit()


func _update_guest(g: Dictionary, delta: float) -> void:
	var breathe := 1.0 + sin(t * 1.6 + g.phase) * 0.018
	if g.snore > 0:
		breathe = 1.0 + sin(t * 5.0) * 0.04
		g.snore -= delta
	g.animal.scale = Vector2(S, S * breathe)
	g.blanket.scale = Vector2(S, S * breathe)
	g.animal.position.x = g.base.x + (sin(t * 55.0) * 1.6 if g.off else 0.0)
	if g.off:
		g.bubble.scale = Vector2.ONE * S * 0.85 * (1.0 + sin(t * 6.0) * 0.06)
	else:
		g.next_slip -= delta
		if g.next_slip <= 0 and not guests.any(func(o): return o.off):
			_set_blanket(g, false)
	g.next_snore -= delta
	if g.next_snore <= 0:
		g.snore = 6.0
		g.next_snore = rng.randf_range(14.0, 20.0)
	g.next_z -= delta
	if g.next_z <= 0 and not g.off:
		g.next_z = 0.45 if g.snore > 0 else rng.randf_range(1.2, 2.2)
		_float_text("Z" if g.snore > 0 else "z", g.center + Vector2(30, -20), 40 if g.snore > 0 else 26, Color(0.17, 0.14, 0.13, 0.6))


func _set_blanket(g: Dictionary, on: bool) -> void:
	g.off = not on
	g.blanket.visible = on
	g.folded.visible = not on
	g.bubble.visible = not on
	if on:
		g.next_slip = rng.randf_range(8.0, 14.0)
		_puff(g.center + Vector2(0, 40))
		_float_text("mmm", g.center + Vector2(0, -30), 26, Color("8a6fb8"))


func _float_text(text: String, pos: Vector2, size: int, color: Color) -> void:
	var l := label(text, size, color)
	l.position = pos + Vector2(rng.randf_range(-8, 8), 0)
	l.z_index = 20
	overlay.add_child(l)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(l, "position:y", l.position.y - 60, 1.6)
	tw.tween_property(l, "position:x", l.position.x + 14, 1.6)
	tw.tween_property(l, "modulate:a", 0.0, 1.6).set_ease(Tween.EASE_IN)
	tw.chain().tween_callback(l.queue_free)


func _puff(pos: Vector2) -> void:
	var p := CPUParticles2D.new()
	p.texture = tex("puff")
	p.one_shot = true
	p.explosiveness = 0.9
	p.amount = 10
	p.lifetime = 0.7
	p.spread = 180.0
	p.initial_velocity_min = 40.0
	p.initial_velocity_max = 90.0
	p.gravity = Vector2(0, -30)
	p.scale_amount_min = 0.12
	p.scale_amount_max = 0.22
	p.color = Color(1, 1, 1, 0.8)
	p.position = pos
	p.z_index = 15
	overlay.add_child(p)
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)


func _update_nuts(delta: float) -> void:
	next_nut -= delta
	if next_nut <= 0:
		next_nut = rng.randf_range(3.5, 6.0)
		var vp := get_viewport().get_visible_rect()
		var top := (get_viewport().get_canvas_transform().affine_inverse() * Vector2(0, 0)).y
		var n := sprite("nut_leaf", Vector2(rng.randf_range(80, 1520), top - 40), overlay, 8, Vector2(0.5, 0.5))
		nuts.append({"node": n, "x": n.position.x, "ph": rng.randf() * TAU, "v": rng.randf_range(42, 58)})
	for n in nuts.duplicate():
		var s: Sprite2D = n.node
		s.position.y += n.v * delta
		s.position.x = n.x + sin(t * 1.4 + n.ph) * 22.0
		s.rotation = sin(t * 1.4 + n.ph) * 0.25
		if s.position.y > GROUND_Y - 10:
			s.modulate.a -= delta * 2.0
			if s.modulate.a <= 0:
				nuts.erase(n)
				s.queue_free()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return
	var p := get_global_mouse_position()
	for n in nuts:
		if n.node.position.distance_to(p) < 52:
			nuts.erase(n)
			nut_count += 1
			counter_label.text = str(nut_count)
			_float_text("+1", n.node.position, 30, Color("f2d27a"))
			_puff(n.node.position)
			n.node.queue_free()
			return
	if cabin_rect.has_point(p):
		flare = 1.0
		smoke.emitting = true
		_float_text("çıtır", cabin_rect.position + Vector2(130, 180), 26, Color("ffcf8a"))
		return
	for g in guests:
		if g.rect.has_point(p) and g.off:
			_set_blanket(g, true)
			return
