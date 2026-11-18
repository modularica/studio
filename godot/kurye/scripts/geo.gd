class_name Geo
## Helpers for building merged meshes with SurfaceTool.
##
## Every vertex carries: normal, colour (alpha = surface kind for the
## shaders), UV (metres on the surface) and UV2 (surface size in metres).
## Quads and triangles are given in any order around their edge together
## with the outward normal; the winding is fixed here so that the front
## face (clockwise in Godot) points outwards.

# Surface kinds, stored in vertex colour alpha.
const K_ROOF := 1.0
const K_AWNING := 0.875
const K_TILES := 0.75
const K_WALL := 0.5
const K_PROP := 0.25
const K_FLAT := 0.0


static func begin() -> SurfaceTool:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	return st


static func _v(st: SurfaceTool, p: Vector3, n: Vector3, col: Color, uv: Vector2, uv2: Vector2) -> void:
	st.set_normal(n)
	st.set_color(col)
	st.set_uv(uv)
	st.set_uv2(uv2)
	st.add_vertex(p)


static func quad(st: SurfaceTool, p: Array, n: Vector3, col: Color, uv: Array = [], uv2 := Vector2.ZERO) -> void:
	if uv.is_empty():
		uv = [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO, Vector2.ZERO]
	var a: Vector3 = p[0]
	var b: Vector3 = p[1]
	var d: Vector3 = p[3]
	var order := [0, 1, 2, 3]
	if (d - a).cross(b - a).dot(n) < 0.0:
		order = [0, 3, 2, 1]
	for i in [0, 1, 2, 0, 2, 3]:
		var k: int = order[i]
		_v(st, p[k], n, col, uv[k], uv2)


static func tri(st: SurfaceTool, p: Array, n: Vector3, col: Color, uv: Array = [], uv2 := Vector2.ZERO) -> void:
	if uv.is_empty():
		uv = [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO]
	var a: Vector3 = p[0]
	var b: Vector3 = p[1]
	var c: Vector3 = p[2]
	var order := [0, 1, 2]
	if (c - a).cross(b - a).dot(n) < 0.0:
		order = [0, 2, 1]
	for k in order:
		_v(st, p[k], n, col, uv[k], uv2)


## Axis-aligned box without a bottom. Walls get metre UVs (along, height)
## so the building shader can draw windows; the top gets (x, z) UVs.
static func box(st: SurfaceTool, lo: Vector3, hi: Vector3, top_col: Color, wall_col: Color, top := true) -> void:
	var dx := hi.x - lo.x
	var dz := hi.z - lo.z
	var h := hi.y - lo.y
	if top:
		quad(st, [Vector3(lo.x, hi.y, lo.z), Vector3(hi.x, hi.y, lo.z), Vector3(hi.x, hi.y, hi.z), Vector3(lo.x, hi.y, hi.z)],
			Vector3.UP, top_col,
			[Vector2(0, 0), Vector2(dx, 0), Vector2(dx, dz), Vector2(0, dz)], Vector2(dx, dz))
	# north (-z), east (+x), south (+z), west (-x)
	wall(st, Vector3(hi.x, lo.y, lo.z), Vector3(lo.x, lo.y, lo.z), h, Vector3.FORWARD, wall_col)
	wall(st, Vector3(hi.x, lo.y, hi.z), Vector3(hi.x, lo.y, lo.z), h, Vector3.RIGHT, wall_col)
	wall(st, Vector3(lo.x, lo.y, hi.z), Vector3(hi.x, lo.y, hi.z), h, Vector3.BACK, wall_col)
	wall(st, Vector3(lo.x, lo.y, lo.z), Vector3(lo.x, lo.y, hi.z), h, Vector3.LEFT, wall_col)


## A wall from a to b (bottom corners) going up h metres.
static func wall(st: SurfaceTool, a: Vector3, b: Vector3, h: float, n: Vector3, col: Color) -> void:
	var l := a.distance_to(b)
	var up := Vector3(0, h, 0)
	quad(st, [a, b, b + up, a + up], n, col,
		[Vector2(0, 0), Vector2(l, 0), Vector2(l, h), Vector2(0, h)], Vector2(l, h))


## Flat-shaded faceted dome (trees, bushes): rings of 8 points.
static func dome(st: SurfaceTool, c: Vector3, r: float, h: float, col: Color, seg := 8) -> void:
	var rings := [[0.0, 1.0], [0.45, 0.82], [0.8, 0.45]]
	var pts := []
	for ring in rings:
		var row := []
		for i in seg:
			var a := TAU * (float(i) + 0.5 * float(rings.find(ring) % 2)) / float(seg)
			row.append(c + Vector3(cos(a) * r * ring[1], h * ring[0], sin(a) * r * ring[1]))
		pts.append(row)
	var apex := c + Vector3(0, h, 0)
	for k in 2:
		for i in seg:
			var a: Vector3 = pts[k][i]
			var b: Vector3 = pts[k][(i + 1) % seg]
			var d: Vector3 = pts[k + 1][i]
			var e: Vector3 = pts[k + 1][(i + 1) % seg]
			var n := (b - a).cross(d - a).normalized()
			var mid := (a + b + d + e) * 0.25 - c
			if n.dot(mid) < 0.0:
				n = -n
			quad(st, [a, b, e, d], n, col)
	for i in seg:
		var a: Vector3 = pts[2][i]
		var b: Vector3 = pts[2][(i + 1) % seg]
		var n := (b - a).cross(apex - a).normalized()
		if n.dot((a + b + apex) / 3.0 - c) < 0.0:
			n = -n
		tri(st, [a, b, apex], n, col)


## Vertical prism with a flat top (columns, tanks, heads). Points around
## an ellipse with radii rx (x) and rz (z).
static func prism(st: SurfaceTool, c: Vector3, rx: float, rz: float, y0: float, y1: float, top_col: Color, side_col: Color, seg := 8) -> void:
	var ring := []
	for i in seg:
		var a := TAU * (float(i) + 0.5) / float(seg)
		ring.append(Vector2(cos(a) * rx, sin(a) * rz))
	for i in seg:
		var p: Vector2 = ring[i]
		var q: Vector2 = ring[(i + 1) % seg]
		var a := c + Vector3(p.x, y0, p.y)
		var b := c + Vector3(q.x, y0, q.y)
		var mid := (p + q) * 0.5
		var n := Vector3(mid.x, 0, mid.y).normalized()
		quad(st, [a, b, b + Vector3(0, y1 - y0, 0), a + Vector3(0, y1 - y0, 0)], n, side_col)
	var top := c + Vector3(0, y1, 0)
	for i in seg:
		var p: Vector2 = ring[i]
		var q: Vector2 = ring[(i + 1) % seg]
		tri(st, [top, c + Vector3(p.x, y1, p.y), c + Vector3(q.x, y1, q.y)], Vector3.UP, top_col)


static func finish(st: SurfaceTool) -> ArrayMesh:
	return st.commit()
