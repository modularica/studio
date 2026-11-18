class_name Hud
extends Control
## Everything on screen: money, clock, the order card, toasts, the arrow
## around the van, touch controls, and the title / pause / end panels.

signal start_pressed
signal resume_pressed
signal restart_pressed
signal feedback_pressed(where: String)
signal pause_pressed

const INK := Color("2b2421")
const CREAM := Color("fff8ea")
const ORANGE := Color("f08a24")
const GREEN := Color("3fae5a")
const RED := Color("d9483b")

var font: FontFile
var font_body: FontFile
var tex := {}

# live state pushed by the game
var playing := false
var touch := false
var arrow_on := false
var arrow_from := Vector2.ZERO
var arrow_dir := Vector2.RIGHT
var arrow_col := GREEN
var arrow_dist := 0.0

# touch controls
var stick_idx := -1
var stick_origin := Vector2.ZERO
var stick_vec := Vector2.ZERO
var brake_idx := -1
var drift_idx := -1
var horn_idx := -1
var horn_tap := false

var money_lbl: Label
var count_lbl: Label
var clock_lbl: Label
var card: PanelContainer
var card_icon: TextureRect
var card_title: Label
var card_sub: Label
var card_time: Label
var cond_bar: Control
var cond := 1.0
var toast_lbl: Label
var toast_t := 0.0
var big_lbl: Label
var big_t := 0.0
var star_row: HBoxContainer
var star_t := 0.0
var pause_btn: Button
var title_panel: Control
var pause_panel: Control
var end_panel: Control
var end_body: VBoxContainer
var top: Control


func setup() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	font = _font("baloo2-800")
	font_body = _font("baloo2-600")
	for n in ["pizza", "pasta", "cicek", "kitap", "dondurma", "koli", "ev", "coin", "star", "star_off", "clock", "van", "pause"]:
		tex[n] = load("res://art/%s.svg" % n)
	var th := Theme.new()
	th.default_font = font_body
	th.default_font_size = 26
	theme = th
	_build_hud()
	_build_title()
	_build_pause()
	_build_end()
	touch = DisplayServer.is_touchscreen_available()


func _font(n: String) -> FontFile:
	var f: FontFile = load("res://fonts/%s.woff2" % n)
	var ext: FontFile = load("res://fonts/%s-ext.woff2" % n)
	f.fallbacks = [ext]
	return f


func _label(text: String, size: int, col := INK, f: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", f if f != null else font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _box(bg := CREAM, radius := 22, pad := 16) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.border_color = INK
	sb.set_border_width_all(4)
	sb.content_margin_left = pad + 4
	sb.content_margin_right = pad + 4
	sb.content_margin_top = pad
	sb.content_margin_bottom = pad
	sb.shadow_color = Color(0, 0, 0, 0.18)
	sb.shadow_size = 0
	sb.shadow_offset = Vector2(0, 5)
	return sb


func _button(text: String, bg := ORANGE, size := 34) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_override("font", font)
	b.add_theme_font_size_override("font_size", size)
	for st in ["normal", "hover", "pressed", "disabled"]:
		var sb := _box(bg, 20, 10)
		if st == "pressed":
			sb.bg_color = bg.darkened(0.15)
		if st == "hover":
			sb.bg_color = bg.lightened(0.08)
		b.add_theme_stylebox_override(st, sb)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, INK if bg.get_luminance() > 0.45 else CREAM)
	return b


func _icon(n: String, s: float) -> TextureRect:
	var t := TextureRect.new()
	t.texture = tex[n]
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(s, s)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


func _build_hud() -> void:
	top = Control.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(top)
	top.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# money + deliveries, top left
	var mp := PanelContainer.new()
	mp.add_theme_stylebox_override("panel", _box(CREAM, 20, 8))
	mp.position = Vector2(20, 18)
	mp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mrow := HBoxContainer.new()
	mrow.add_theme_constant_override("separation", 8)
	mrow.add_child(_icon("coin", 40))
	money_lbl = _label("0", 34)
	mrow.add_child(money_lbl)
	var sep := Control.new()
	sep.custom_minimum_size = Vector2(10, 0)
	mrow.add_child(sep)
	mrow.add_child(_icon("koli", 34))
	count_lbl = _label("0", 30)
	mrow.add_child(count_lbl)
	mp.add_child(mrow)
	top.add_child(mp)
	# clock + pause, top right
	var cp := HBoxContainer.new()
	cp.add_theme_constant_override("separation", 10)
	var cbox := PanelContainer.new()
	cbox.add_theme_stylebox_override("panel", _box(CREAM, 20, 8))
	cbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var crow := HBoxContainer.new()
	crow.add_theme_constant_override("separation", 6)
	crow.add_child(_icon("clock", 36))
	clock_lbl = _label("4:00", 32)
	crow.add_child(clock_lbl)
	cbox.add_child(crow)
	cp.add_child(cbox)
	pause_btn = _button("", INK, 26)
	pause_btn.icon = tex["pause"]
	pause_btn.expand_icon = true
	pause_btn.custom_minimum_size = Vector2(64, 64)
	pause_btn.pressed.connect(func(): pause_pressed.emit())
	cp.add_child(pause_btn)
	top.add_child(cp)
	cp.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	cp.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 18)
	# order card, top centre
	var card_row := HBoxContainer.new()
	card_row.alignment = BoxContainer.ALIGNMENT_CENTER
	card_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card = PanelContainer.new()
	card.add_theme_stylebox_override("panel", _box(CREAM, 22, 10))
	card.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card_icon = _icon("pizza", 62)
	row.add_child(card_icon)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", -6)
	card_title = _label("", 28)
	card_sub = _label("", 21, Color(INK, 0.75), font_body)
	col.add_child(card_title)
	col.add_child(card_sub)
	cond_bar = Control.new()
	cond_bar.custom_minimum_size = Vector2(150, 12)
	cond_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cond_bar.draw.connect(_draw_cond)
	col.add_child(cond_bar)
	row.add_child(col)
	card_time = _label("", 36)
	card_time.custom_minimum_size = Vector2(70, 0)
	card_time.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	row.add_child(card_time)
	card.add_child(row)
	card_row.add_child(card)
	top.add_child(card_row)
	card_row.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE, Control.PRESET_MODE_MINSIZE, 16)
	# toast under the card, big centre text
	toast_lbl = _label("", 30, CREAM)
	toast_lbl.add_theme_color_override("font_outline_color", INK)
	toast_lbl.add_theme_constant_override("outline_size", 10)
	toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(toast_lbl)
	toast_lbl.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	toast_lbl.offset_top = 128
	toast_lbl.offset_bottom = 180
	big_lbl = _label("", 84, CREAM)
	big_lbl.add_theme_color_override("font_outline_color", INK)
	big_lbl.add_theme_constant_override("outline_size", 18)
	big_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	big_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	top.add_child(big_lbl)
	big_lbl.set_anchors_and_offsets_preset(Control.PRESET_HCENTER_WIDE)
	big_lbl.offset_top = -200
	big_lbl.offset_bottom = -70
	star_row = HBoxContainer.new()
	star_row.alignment = BoxContainer.ALIGNMENT_CENTER
	star_row.add_theme_constant_override("separation", 6)
	star_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for k in 3:
		star_row.add_child(_icon("star", 72))
	top.add_child(star_row)
	star_row.set_anchors_and_offsets_preset(Control.PRESET_HCENTER_WIDE)
	star_row.offset_top = -72
	star_row.offset_bottom = 8
	star_row.modulate.a = 0.0
	top.visible = false


func _draw_cond() -> void:
	var s := cond_bar.size
	cond_bar.draw_rect(Rect2(Vector2.ZERO, s), Color(INK, 0.15))
	var c := GREEN if cond > 0.66 else (Color("e8a21f") if cond > 0.33 else RED)
	cond_bar.draw_rect(Rect2(Vector2.ZERO, Vector2(s.x * clampf(cond, 0.0, 1.0), s.y)), c)


func _centre_panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(CREAM, 30, 26))
	return p


func _build_title() -> void:
	title_panel = CenterContainer.new()
	title_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(title_panel)
	title_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var p := _centre_panel()
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 8)
	var trow := HBoxContainer.new()
	trow.alignment = BoxContainer.ALIGNMENT_CENTER
	trow.add_theme_constant_override("separation", 14)
	trow.add_child(_icon("van", 92))
	var t := _label("KURYE", 96, ORANGE)
	t.add_theme_color_override("font_outline_color", INK)
	t.add_theme_constant_override("outline_size", 16)
	trow.add_child(t)
	v.add_child(trow)
	var sub := _label("Paketleri şehrin dört bir yanına yetiştir!", 28, INK, font_body)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(sub)
	var hint := _label("", 22, Color(INK, 0.7), font_body)
	hint.name = "Hint"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.custom_minimum_size = Vector2(620, 0)
	v.add_child(hint)
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 8)
	v.add_child(gap)
	var b := _button("Başla", ORANGE, 44)
	b.custom_minimum_size = Vector2(300, 84)
	b.pressed.connect(func(): start_pressed.emit())
	var bc := CenterContainer.new()
	bc.add_child(b)
	v.add_child(bc)
	var best := _label("", 22, Color(INK, 0.7), font_body)
	best.name = "Best"
	best.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(best)
	p.add_child(v)
	title_panel.add_child(p)
	_title_hint()


func _title_hint() -> void:
	var h: Label = title_panel.find_child("Hint", true, false)
	if touch:
		h.text = "Solda parmağını gitmek istediğin yöne kaydır. Sağda fren ve drift."
	else:
		h.text = "Ok tuşları ya da WASD ile sür · Boşluk: el freni · H: korna"


func set_best(money: int, deliveries: int) -> void:
	var l: Label = title_panel.find_child("Best", true, false)
	l.text = "" if money <= 0 else "En iyi vardiya: %d jeton · %d teslimat" % [money, deliveries]


func _build_pause() -> void:
	pause_panel = _modal()
	var v: VBoxContainer = pause_panel.get_meta("box")
	var t := _label("Mola", 64, INK)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var b1 := _button("Devam", ORANGE, 38)
	b1.pressed.connect(func(): resume_pressed.emit())
	v.add_child(b1)
	var b2 := _button("Baştan başla", CREAM, 30)
	b2.pressed.connect(func(): restart_pressed.emit())
	v.add_child(b2)
	if OS.has_feature("web"):
		var b3 := _button("Nasıldı?", CREAM, 30)
		b3.pressed.connect(func(): feedback_pressed.emit("mola"))
		v.add_child(b3)


func _build_end() -> void:
	end_panel = _modal()
	end_body = end_panel.get_meta("box")


func _modal() -> Control:
	var root := ColorRect.new()
	root.color = Color(0.1, 0.12, 0.16, 0.45)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(root)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var cc := CenterContainer.new()
	root.add_child(cc)
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var p := _centre_panel()
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	v.custom_minimum_size = Vector2(440, 0)
	p.add_child(v)
	cc.add_child(p)
	root.set_meta("box", v)
	root.visible = false
	return root


func show_end(stats: Dictionary) -> void:
	for c in end_body.get_children():
		c.queue_free()
	var t := _label("Vardiya bitti!", 60, INK)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_body.add_child(t)
	if stats.record:
		var r := _label("Yeni rekor!", 36, ORANGE)
		r.add_theme_color_override("font_outline_color", INK)
		r.add_theme_constant_override("outline_size", 8)
		r.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		end_body.add_child(r)
	for line in [["koli", "%d teslimat" % stats.deliveries], ["coin", "%d jeton" % stats.money], ["star", "%d yıldız" % stats.stars]]:
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 12)
		row.add_child(_icon(line[0], 44))
		row.add_child(_label(line[1], 36, INK))
		end_body.add_child(row)
	if not stats.record and stats.best > 0:
		var bl := _label("En iyi: %d jeton" % stats.best, 24, Color(INK, 0.7), font_body)
		bl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		end_body.add_child(bl)
	var b := _button("Bir vardiya daha", ORANGE, 36)
	b.pressed.connect(func(): restart_pressed.emit())
	end_body.add_child(b)
	if OS.has_feature("web"):
		var fb := _button("Nasıldı?", CREAM, 30)
		fb.pressed.connect(func(): feedback_pressed.emit("oyun-sonu"))
		end_body.add_child(fb)
	end_panel.visible = true


# --- per frame ---------------------------------------------------------------

func set_order(icon: String, title: String, sub: String, time_text: String, time_col: Color, c: float, show_cond: bool) -> void:
	card.visible = title != ""
	card_icon.texture = tex.get(icon, tex["koli"])
	card_title.text = title
	card_sub.text = sub
	card_time.text = time_text
	card_time.add_theme_color_override("font_color", time_col)
	cond = c
	cond_bar.visible = show_cond
	cond_bar.queue_redraw()


func toast(text: String, t := 2.2) -> void:
	toast_lbl.text = text
	toast_t = t


func big(text: String, t := 1.4) -> void:
	big_lbl.text = text
	big_t = t
	big_lbl.pivot_offset = big_lbl.size * 0.5
	big_lbl.scale = Vector2(1.3, 1.3)


func show_stars(n: int, t := 1.6) -> void:
	for k in 3:
		var tr: TextureRect = star_row.get_child(k)
		tr.texture = tex["star"] if k < n else tex["star_off"]
		tr.pivot_offset = Vector2(36, 36)
		tr.scale = Vector2(0.2, 0.2)
		var tw := create_tween()
		tw.tween_interval(0.35 + 0.16 * k)
		tw.tween_property(tr, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	star_t = t


func tick(dt: float) -> void:
	star_t -= dt
	star_row.modulate.a = clampf(star_t / 0.3, 0.0, 1.0)
	toast_t -= dt
	toast_lbl.modulate.a = clampf(toast_t / 0.3, 0.0, 1.0)
	big_t -= dt
	big_lbl.modulate.a = clampf(big_t / 0.3, 0.0, 1.0)
	big_lbl.scale = big_lbl.scale.lerp(Vector2.ONE, 1.0 - exp(-10.0 * dt))
	queue_redraw()


func _btn_centres() -> Dictionary:
	var s := size
	return {
		"brake": [Vector2(s.x - 130.0, s.y - 130.0), 82.0],
		"drift": [Vector2(s.x - 285.0, s.y - 95.0), 58.0],
		"horn": [Vector2(s.x - 110.0, s.y - 300.0), 48.0],
	}


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		if not touch:
			touch = true
			_title_hint()
	if not playing:
		return
	if event is InputEventScreenTouch:
		var e := event as InputEventScreenTouch
		if e.pressed:
			var hitb := ""
			var bc := _btn_centres()
			for k in bc:
				if e.position.distance_to(bc[k][0]) < bc[k][1] + 16.0:
					hitb = k
			if hitb == "brake":
				brake_idx = e.index
			elif hitb == "drift":
				drift_idx = e.index
			elif hitb == "horn":
				horn_idx = e.index
				horn_tap = true
			elif e.position.x < size.x * 0.55 and e.position.y > 110.0 and stick_idx == -1:
				stick_idx = e.index
				stick_origin = e.position
				stick_vec = Vector2.ZERO
		else:
			if e.index == stick_idx:
				stick_idx = -1
				stick_vec = Vector2.ZERO
			if e.index == brake_idx:
				brake_idx = -1
			if e.index == drift_idx:
				drift_idx = -1
			if e.index == horn_idx:
				horn_idx = -1
	elif event is InputEventScreenDrag:
		var e := event as InputEventScreenDrag
		if e.index == stick_idx:
			var rad := 90.0
			var d := e.position - stick_origin
			if d.length() > rad:
				stick_origin = e.position - d.normalized() * rad
				d = e.position - stick_origin
			stick_vec = d / rad


func release_touches() -> void:
	stick_idx = -1
	stick_vec = Vector2.ZERO
	brake_idx = -1
	drift_idx = -1
	horn_idx = -1


func _draw() -> void:
	if not playing:
		return
	if arrow_on:
		_draw_arrow()
	if touch:
		_draw_touch()


func _draw_arrow() -> void:
	var c := arrow_from + arrow_dir * 92.0
	var d := arrow_dir
	var n := Vector2(-d.y, d.x)
	var pts := PackedVector2Array([c + d * 30.0, c - d * 14.0 + n * 26.0, c - d * 4.0, c - d * 14.0 - n * 26.0])
	var outline := PackedVector2Array()
	for p in pts:
		outline.append(c + (p - c) * 1.22)
	draw_colored_polygon(outline, INK)
	draw_colored_polygon(pts, arrow_col)
	var txt := "%d m" % int(arrow_dist)
	var fs := 24
	var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var tp := arrow_from + arrow_dir * 142.0 + Vector2(-w * 0.5, 9)
	draw_string_outline(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, INK)
	draw_string(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, CREAM)


func _draw_touch() -> void:
	var bc := _btn_centres()
	# stick
	if stick_idx >= 0:
		draw_circle(stick_origin, 90.0, Color(1, 1, 1, 0.16))
		draw_arc(stick_origin, 90.0, 0, TAU, 48, Color(1, 1, 1, 0.5), 4.0)
		draw_circle(stick_origin + stick_vec * 90.0, 40.0, Color(1, 1, 1, 0.55))
	else:
		var p := Vector2(190, size.y - 170)
		draw_arc(p, 90.0, 0, TAU, 48, Color(1, 1, 1, 0.28), 4.0)
		draw_circle(p, 40.0, Color(1, 1, 1, 0.2))
	for k in bc:
		var c: Vector2 = bc[k][0]
		var r: float = bc[k][1]
		var down: bool = (k == "brake" and brake_idx >= 0) or (k == "drift" and drift_idx >= 0) or (k == "horn" and horn_idx >= 0)
		draw_circle(c, r, Color(INK, 0.55 if down else 0.35))
		draw_arc(c, r, 0, TAU, 48, Color(1, 1, 1, 0.7), 4.0)
		var txt: String = {"brake": "FREN", "drift": "DRİFT", "horn": "KORNA"}[k]
		var fs := 26 if k == "brake" else 20
		var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(font, c + Vector2(-w * 0.5, fs * 0.36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.92))
