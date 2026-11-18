class_name Meshes
## Vehicle and people meshes, built from boxes. All face +X (forward).
## Vertex alpha 1 = paint (tinted in the shader), 0 = fixed colour.

const GLASS := Color(0.18, 0.23, 0.29, 0.0)
const TYRE := Color(0.1, 0.1, 0.11, 0.0)
const LAMP := Color(1.0, 0.95, 0.75, 0.0)
const TAIL := Color(0.85, 0.15, 0.12, 0.0)
const CHROME := Color(0.75, 0.76, 0.78, 0.0)


static func _b(st: SurfaceTool, cx: float, cy: float, cz: float, sx: float, sy: float, sz: float, col: Color) -> void:
	Geo.box(st, Vector3(cx - sx * 0.5, cy, cz - sz * 0.5), Vector3(cx + sx * 0.5, cy + sy, cz + sz * 0.5), col, col)


static func _wheels(st: SurfaceTool, l: float, w: float, front: float, rear: float) -> void:
	for x in [front, rear]:
		for s in [-1.0, 1.0]:
			_b(st, x, 0.0, s * (w * 0.5 - 0.06), 0.72, 0.62, 0.26, TYRE)


static func _lamps(st: SurfaceTool, l: float, w: float, y: float) -> void:
	for s in [-1.0, 1.0]:
		_b(st, l * 0.5 - 0.1, y, s * (w * 0.5 - 0.32), 0.22, 0.06, 0.36, LAMP)
		_b(st, -l * 0.5 + 0.08, y, s * (w * 0.5 - 0.28), 0.18, 0.06, 0.3, TAIL)


static func sedan(taxi := false) -> ArrayMesh:
	var st := Geo.begin()
	var l := 4.4
	var w := 1.86
	var paint := Color(1, 1, 1, 1)
	_wheels(st, l, w, 1.35, -1.35)
	_b(st, 0, 0.18, 0, l, 0.62, w, paint)              # body
	_b(st, -0.15, 0.8, 0, 2.35, 0.5, w - 0.22, GLASS)  # cabin glass
	_b(st, -0.25, 1.3, 0, 1.75, 0.1, w - 0.26, paint)  # roof
	_lamps(st, l, w, 0.8)
	# mirrors
	for s in [-1.0, 1.0]:
		_b(st, 0.85, 0.85, s * (w * 0.5 + 0.1), 0.18, 0.14, 0.2, paint)
	if taxi:
		_b(st, -0.25, 1.4, 0, 0.4, 0.22, 0.9, Color(0.15, 0.15, 0.15, 0.0))
		_b(st, -0.25, 1.62, 0, 0.42, 0.04, 0.92, Color(1.0, 0.85, 0.2, 0.0))
	return Geo.finish(st)


static func hatch() -> ArrayMesh:
	var st := Geo.begin()
	var l := 3.8
	var w := 1.76
	var paint := Color(1, 1, 1, 1)
	_wheels(st, l, w, 1.2, -1.15)
	_b(st, 0, 0.18, 0, l, 0.62, w, paint)
	_b(st, -0.35, 0.8, 0, 2.3, 0.52, w - 0.2, GLASS)
	_b(st, -0.5, 1.32, 0, 1.75, 0.1, w - 0.24, paint)
	_lamps(st, l, w, 0.8)
	return Geo.finish(st)


static func truck() -> ArrayMesh:
	var st := Geo.begin()
	var l := 6.2
	var w := 2.3
	var paint := Color(1, 1, 1, 1)
	_wheels(st, l, w, 2.2, -1.9)
	_b(st, 2.25, 0.25, 0, 1.7, 1.1, w - 0.1, paint)             # cab
	_b(st, 2.45, 1.35, 0, 1.0, 0.5, w - 0.2, GLASS)
	_b(st, 2.15, 1.85, 0, 0.9, 0.08, w - 0.24, paint)
	_b(st, -0.75, 0.3, 0, 4.5, 2.35, w, Color(0.93, 0.92, 0.88, 0.0))  # box
	_b(st, -0.75, 2.65, 0, 4.3, 0.06, w - 0.25, Color(0.86, 0.85, 0.81, 0.0))
	for s in [-1.0, 1.0]:
		_b(st, 3.1, 0.6, s * (w * 0.5 - 0.35), 0.06, 0.2, 0.36, LAMP)
	return Geo.finish(st)


## The player's courier van: orange cab, white load box with an orange band.
static func van() -> ArrayMesh:
	var st := Geo.begin()
	var l := 4.8
	var w := 2.04
	var paint := Color(1, 1, 1, 1)
	_wheels(st, l, w, 1.55, -1.45)
	_b(st, 0, 0.2, 0, l, 0.75, w, paint)                         # chassis
	_b(st, 1.55, 0.95, 0, 1.2, 0.6, w - 0.12, GLASS)             # windscreen
	_b(st, 1.45, 1.55, 0, 0.95, 0.1, w - 0.2, paint)             # cab roof
	var white := Color(0.96, 0.95, 0.92, 0.0)
	_b(st, -0.7, 0.95, 0, 3.0, 1.35, w - 0.04, white)            # load box
	_b(st, -0.7, 2.3, 0, 3.0, 0.07, 0.55, paint)                 # band on the roof
	_b(st, -2.05, 2.3, 0, 0.3, 0.07, w - 0.3, Color(0.85, 0.84, 0.8, 0.0))
	_lamps(st, l, w, 0.95)
	for s in [-1.0, 1.0]:
		_b(st, 1.35, 1.0, s * (w * 0.5 + 0.12), 0.18, 0.16, 0.22, paint)
	return Geo.finish(st)


## A person seen from above: shoulders (shirt = paint), arms, head (hair).
static func person() -> ArrayMesh:
	var st := Geo.begin()
	var paint := Color(1, 1, 1, 1)
	Geo.prism(st, Vector3(0, 0, 0), 0.2, 0.3, 0.75, 1.42, paint, Color(0.85, 0.85, 0.85, 1.0), 8)
	Geo.prism(st, Vector3(0.02, 0, 0), 0.1, 0.1, 1.42, 1.52, Color(0.86, 0.68, 0.55, 0.0), Color(0.86, 0.68, 0.55, 0.0), 6)
	Geo.prism(st, Vector3(-0.02, 0, 0), 0.15, 0.14, 1.52, 1.78, Color(1, 1, 1, 0.5), Color(1, 1, 1, 0.5), 8)
	Geo.prism(st, Vector3(0.11, 0, 0), 0.06, 0.1, 1.52, 1.68, Color(0.86, 0.68, 0.55, 0.0), Color(0.86, 0.68, 0.55, 0.0), 6)
	for s in [-1.0, 1.0]:
		Geo.prism(st, Vector3(0.0, 0, s * 0.33), 0.08, 0.07, 0.8, 1.32, Color(0.92, 0.92, 0.92, 1.0), Color(0.8, 0.8, 0.8, 1.0), 6)
	return Geo.finish(st)


## A flat dark disc for the shadow under a car (transparent material).
static func blob(l: float, w: float) -> ArrayMesh:
	var st := Geo.begin()
	var c := Color(0, 0, 0, 0)
	var hl := l * 0.5 + 0.25
	var hw := w * 0.5 + 0.2
	var off := Vector3(0, 0.03, 0)
	Geo.quad(st, [Vector3(-hl, 0, -hw) + off, Vector3(hl, 0, -hw) + off, Vector3(hl, 0, hw) + off, Vector3(-hl, 0, hw) + off], Vector3.UP, c,
		[Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)])
	return Geo.finish(st)
