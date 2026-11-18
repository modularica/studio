class_name City
extends Node3D
## The island city: an N×N grid of blocks with roads between them, the sea
## all around. Everything is generated from one seed, so the city is the
## same every time (players learn the streets).
##
## 2D world coordinates: Vector2(x, y) is the 3D point (x, 0, y). North is
## -y (up on screen), east is +x.

const N := 8
const BS := 48.0          # block size, sidewalk included
const RW := 14.0          # road width
const P := BS + RW        # grid period
const SW := 3.5           # sidewalk width
const LO := 3.5           # lane centre offset from the road centre
const EXT := N * P + RW   # city size: 510 m
const PROM := 4.0         # promenade between the outer roads and the sea wall
const SHADOW_PX := 2.0    # shadow mask pixels per metre
const SUN := Vector2(0.5, 0.42)  # ground shadow offset per metre of height

enum { CITY, PARK, PLAZA }

const FACADES := ["e8dac0", "c9765c", "d9b98a", "9cb595", "8eaac0", "d8b04c", "d99a8f",
	"efebe2", "bdb8ad", "a55b45", "6f9c98", "a99bbf", "e3c49b", "7d95a9", "c7a27a", "b7c7a4"]
const FLAT_ROOFS := ["7a766f", "9d998f", "8a9086", "aba395", "6c7175", "8f8578"]
const TILE_ROOFS := ["b5583b", "5d6672", "8b4c34", "6e7a4b", "a9654a", "c06a45"]

const SHOP_DEFS := [
	{"id": "kargo", "name": "Uzi Kargo", "from": "Uzi Kargo'dan", "color": "f08a24", "cargo": "koli"},
	{"id": "pizza", "name": "Pizzacı", "from": "Pizzacıdan", "color": "e2553f", "cargo": "pizza"},
	{"id": "pasta", "name": "Pastane", "from": "Pastaneden", "color": "e98db0", "cargo": "pasta"},
	{"id": "cicek", "name": "Çiçekçi", "from": "Çiçekçiden", "color": "7fb84e", "cargo": "cicek"},
	{"id": "kitap", "name": "Kitapçı", "from": "Kitapçıdan", "color": "5b88c8", "cargo": "kitap"},
	{"id": "dondurma", "name": "Dondurmacı", "from": "Dondurmacıdan", "color": "5fc3d6", "cargo": "dondurma"},
]

var rng := RandomNumberGenerator.new()
var block_type: Array[int] = []
var buildings: Array = []      # {rect: Rect2, h: float, roof: int, color: Color, roof_color: Color, block: int}
var block_rects: Array = []    # per block: Array of Rect2 (solid)
var block_circles: Array = []  # per block: Array of Vector3 (x, y, r) (solid)
var trees: Array = []          # Vector3 (x, y, r)
var shops: Array = []          # {def, building, spot: Vector2, out: Vector2, door: Vector2}
var doors: Array = []          # {building, spot: Vector2, out: Vector2, door: Vector2}
var shadow_img: Image
var ground_mat: ShaderMaterial
var building_mat: ShaderMaterial


# --- grid helpers ---------------------------------------------------------

static func road_c(k: int) -> float:
	return float(k) * P + RW * 0.5


static func block_origin(i: int, j: int) -> Vector2:
	return Vector2(float(i) * P + RW, float(j) * P + RW)


static func node_pos(n: Vector2i) -> Vector2:
	return Vector2(road_c(n.x), road_c(n.y))


## 0 east, 1 south, 2 west, 3 north
static func dir_vec(d: int) -> Vector2:
	match d:
		0: return Vector2(1, 0)
		1: return Vector2(0, 1)
		2: return Vector2(-1, 0)
	return Vector2(0, -1)


static func dir_step(d: int) -> Vector2i:
	match d:
		0: return Vector2i(1, 0)
		1: return Vector2i(0, 1)
		2: return Vector2i(-1, 0)
	return Vector2i(0, -1)


## Right-hand side of a driver heading in direction d (we drive on the right).
static func right_of(d: int) -> Vector2:
	var v := dir_vec(d)
	return Vector2(-v.y, v.x)


static func valid_node(n: Vector2i) -> bool:
	return n.x >= 0 and n.y >= 0 and n.x <= N and n.y <= N


## Where a car heading d enters the intersection at node n (its stop line).
static func entry_point(n: Vector2i, d: int) -> Vector2:
	return node_pos(n) - dir_vec(d) * (RW * 0.5) + right_of(d) * LO


## Where a car leaves the intersection at node n heading d.
static func exit_point(n: Vector2i, d: int) -> Vector2:
	return node_pos(n) + dir_vec(d) * (RW * 0.5) + right_of(d) * LO


## Control point of the turn through node n from heading d to heading d2.
static func turn_control(n: Vector2i, d: int, d2: int) -> Vector2:
	if d == d2:
		return (entry_point(n, d) + exit_point(n, d2)) * 0.5
	return node_pos(n) + right_of(d) * LO + right_of(d2) * LO


static func nearest_node(p: Vector2) -> Vector2i:
	return Vector2i(clampi(roundi((p.x - RW * 0.5) / P), 0, N), clampi(roundi((p.y - RW * 0.5) / P), 0, N))


func block_index_at(p: Vector2) -> int:
	var i := floori((p.x - RW) / P)
	var j := floori((p.y - RW) / P)
	if i < 0 or j < 0 or i >= N or j >= N:
		return -1
	var o := block_origin(i, j)
	if p.x < o.x or p.y < o.y or p.x > o.x + BS or p.y > o.y + BS:
		return -1
	return j * N + i


## True when p is on asphalt (not inside a block or out at sea).
func on_road(p: Vector2) -> bool:
	if p.x < 0.0 or p.y < 0.0 or p.x > EXT or p.y > EXT:
		return false
	return block_index_at(p) == -1


# --- collision ------------------------------------------------------------

## Push a circle out of buildings, trees and the sea wall. Returns the push.
func push_out(p: Vector2, r: float) -> Vector2:
	var start := p
	var i0 := clampi(floori((p.x - r - RW) / P), 0, N - 1)
	var i1 := clampi(floori((p.x + r - RW) / P), 0, N - 1)
	var j0 := clampi(floori((p.y - r - RW) / P), 0, N - 1)
	var j1 := clampi(floori((p.y + r - RW) / P), 0, N - 1)
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var idx := j * N + i
			for rect: Rect2 in block_rects[idx]:
				if p.x < rect.position.x - r or p.x > rect.end.x + r or p.y < rect.position.y - r or p.y > rect.end.y + r:
					continue
				var q := Vector2(clampf(p.x, rect.position.x, rect.end.x), clampf(p.y, rect.position.y, rect.end.y))
				var d := p - q
				var dist := d.length()
				if dist >= r:
					continue
				if dist > 0.0001:
					p += d / dist * (r - dist)
				else:
					# centre inside: leave by the nearest side
					var l := p.x - rect.position.x
					var rr := rect.end.x - p.x
					var t := p.y - rect.position.y
					var b := rect.end.y - p.y
					var m := minf(minf(l, rr), minf(t, b))
					if m == l:
						p.x = rect.position.x - r
					elif m == rr:
						p.x = rect.end.x + r
					elif m == t:
						p.y = rect.position.y - r
					else:
						p.y = rect.end.y + r
			for c: Vector3 in block_circles[idx]:
				var d := p - Vector2(c.x, c.y)
				var dist := d.length()
				var rr := r + c.z
				if dist < rr and dist > 0.0001:
					p += d / dist * (rr - dist)
	var lo := -PROM + 0.4
	var hi := EXT + PROM - 0.4
	p.x = clampf(p.x, lo + r, hi - r)
	p.y = clampf(p.y, lo + r, hi - r)
	return p - start


# --- generation -----------------------------------------------------------

func generate(seed_value: int) -> void:
	rng.seed = seed_value
	block_type.clear()
	for k in N * N:
		block_type.append(CITY)
	_place_parks()
	buildings.clear()
	block_rects.clear()
	block_circles.clear()
	trees.clear()
	for j in N:
		for i in N:
			block_rects.append([])
			block_circles.append([])
	for j in N:
		for i in N:
			var idx := j * N + i
			match block_type[idx]:
				CITY: _gen_city_block(i, j)
				PARK: _gen_park(i, j)
				PLAZA: _gen_plaza(i, j)
	_find_doors()
	_pick_shops()
	_make_shadows()


func _place_parks() -> void:
	var placed := 0
	var tries := 0
	while placed < 6 and tries < 400:
		tries += 1
		var i := rng.randi_range(0, N - 1)
		var j := rng.randi_range(0, N - 1)
		if block_type[j * N + i] != CITY:
			continue
		var ok := true
		for dj in range(-1, 2):
			for di in range(-1, 2):
				var a := i + di
				var b := j + dj
				if a >= 0 and b >= 0 and a < N and b < N and block_type[b * N + a] != CITY:
					ok = false
		if ok:
			block_type[j * N + i] = PARK
			placed += 1
	# a square in the middle of town
	for c in [Vector2i(3, 4), Vector2i(4, 3), Vector2i(3, 3), Vector2i(4, 4)]:
		if block_type[c.y * N + c.x] == CITY:
			block_type[c.y * N + c.x] = PLAZA
			break


func _centrality(p: Vector2) -> float:
	var d := p.distance_to(Vector2(EXT, EXT) * 0.5) / (EXT * 0.62)
	return clampf(1.0 - d, 0.0, 1.0)


func _gen_city_block(i: int, j: int) -> void:
	var o := block_origin(i, j)
	var inner := Rect2(o + Vector2(SW, SW), Vector2(BS - 2.0 * SW, BS - 2.0 * SW))
	var lots: Array = []
	_split(inner, 0, lots)
	var idx := j * N + i
	for lot: Rect2 in lots:
		var touches := lot.position.x <= inner.position.x + 0.01 or lot.position.y <= inner.position.y + 0.01 \
			or lot.end.x >= inner.end.x - 0.01 or lot.end.y >= inner.end.y - 0.01
		if not touches and rng.randf() < 0.5:
			continue  # courtyard
		if touches and rng.randf() < 0.05 and lot.get_area() < 260.0:
			continue  # small car park
		var r := lot
		# small gaps between neighbours, never on the street side
		var ins := [0.0, 0.0, 0.0, 0.0]
		for s in 4:
			if rng.randf() < 0.45:
				ins[s] = rng.randf_range(0.3, 0.9)
		if r.position.x > inner.position.x + 0.01:
			r.position.x += ins[0]
			r.size.x -= ins[0]
		if r.position.y > inner.position.y + 0.01:
			r.position.y += ins[1]
			r.size.y -= ins[1]
		if r.end.x < inner.end.x - 0.01:
			r.size.x -= ins[2]
		if r.end.y < inner.end.y - 0.01:
			r.size.y -= ins[3]
		if r.size.x < 5.0 or r.size.y < 5.0:
			continue
		var cen := _centrality(r.get_center())
		var floors := int(round(lerpf(1.2, 5.2, cen * cen) * rng.randf_range(0.7, 1.3)))
		if rng.randf() < 0.07 * cen:
			floors += 2
		floors = clampi(floors, 1, 7)
		var h := 4.2 + 3.2 * float(floors - 1) + 0.6
		var roof := 0
		if floors <= 2 and r.get_area() < 420.0 and rng.randf() < 0.45 + 0.4 * (1.0 - cen):
			roof = 1
		var b := {
			"rect": r, "h": h, "roof": roof, "block": idx,
			"color": Color(FACADES[rng.randi() % FACADES.size()]),
			"roof_color": Color((TILE_ROOFS if roof == 1 else FLAT_ROOFS)[rng.randi() % (TILE_ROOFS if roof == 1 else FLAT_ROOFS).size()]),
			"shop": -1,
		}
		buildings.append(b)
		block_rects[idx].append(r)


func _split(r: Rect2, depth: int, out: Array) -> void:
	var w := r.size.x
	var h := r.size.y
	if (w > 15.0 or h > 15.0) and depth < 3 and (depth < 1 or rng.randf() < 0.8):
		var along_x := w > h
		if absf(w - h) < 4.0:
			along_x = rng.randf() < 0.5
		var gap := 0.0
		if depth == 0 and rng.randf() < 0.4:
			gap = 6.0  # an alley you can drive through
		var t := rng.randf_range(0.36, 0.64)
		if along_x:
			var cut := r.position.x + w * t
			_split(Rect2(r.position, Vector2(cut - gap * 0.5 - r.position.x, h)), depth + 1, out)
			_split(Rect2(Vector2(cut + gap * 0.5, r.position.y), Vector2(r.end.x - cut - gap * 0.5, h)), depth + 1, out)
		else:
			var cut := r.position.y + h * t
			_split(Rect2(r.position, Vector2(w, cut - gap * 0.5 - r.position.y)), depth + 1, out)
			_split(Rect2(Vector2(r.position.x, cut + gap * 0.5), Vector2(w, r.end.y - cut - gap * 0.5)), depth + 1, out)
	else:
		out.append(r)


func _gen_park(i: int, j: int) -> void:
	var o := block_origin(i, j)
	var idx := j * N + i
	var c := o + Vector2(BS, BS) * 0.5
	block_circles[idx].append(Vector3(c.x, c.y, 3.7))  # fountain
	var placed := 0
	var tries := 0
	while placed < 22 and tries < 300:
		tries += 1
		var p := o + Vector2(rng.randf_range(SW + 2.0, BS - SW - 2.0), rng.randf_range(SW + 2.0, BS - SW - 2.0))
		var l := p - o
		if absf(l.x - BS * 0.5) < 3.4 or absf(l.y - BS * 0.5) < 3.4:
			continue  # paths
		if p.distance_to(c) < 11.0:
			continue
		var r := rng.randf_range(1.8, 3.2)
		var ok := true
		for t: Vector3 in trees:
			if Vector2(t.x, t.y).distance_to(p) < t.z + r + 0.6:
				ok = false
				break
		if not ok:
			continue
		trees.append(Vector3(p.x, p.y, r))
		block_circles[idx].append(Vector3(p.x, p.y, r * 0.45))
		placed += 1


func _gen_plaza(i: int, j: int) -> void:
	var o := block_origin(i, j)
	var idx := j * N + i
	var c := o + Vector2(BS, BS) * 0.5
	block_circles[idx].append(Vector3(c.x, c.y, 4.6))
	for k in 4:
		var a := TAU * (float(k) + 0.5) / 4.0
		var p := c + Vector2(cos(a), sin(a)) * 15.5
		trees.append(Vector3(p.x, p.y, 2.6))
		block_circles[idx].append(Vector3(p.x, p.y, 1.1))


## Delivery spots: the kerb in front of every building that faces a street.
func _find_doors() -> void:
	doors.clear()
	for bi in buildings.size():
		var b: Dictionary = buildings[bi]
		var r: Rect2 = b.rect
		var idx: int = b.block
		var bo := block_origin(idx % N, idx / N)
		var inner := Rect2(bo + Vector2(SW, SW), Vector2(BS - 2.0 * SW, BS - 2.0 * SW))
		var sides := []
		if r.position.y <= inner.position.y + 0.01 and r.size.x >= 6.0:
			sides.append([Vector2(r.get_center().x, bo.y), Vector2(0, -1), r.size.x])
		if r.end.y >= inner.end.y - 0.01 and r.size.x >= 6.0:
			sides.append([Vector2(r.get_center().x, bo.y + BS), Vector2(0, 1), r.size.x])
		if r.position.x <= inner.position.x + 0.01 and r.size.y >= 6.0:
			sides.append([Vector2(bo.x, r.get_center().y), Vector2(-1, 0), r.size.y])
		if r.end.x >= inner.end.x - 0.01 and r.size.y >= 6.0:
			sides.append([Vector2(bo.x + BS, r.get_center().y), Vector2(1, 0), r.size.y])
		if sides.is_empty():
			continue
		# the longest frontage is the front door
		sides.sort_custom(func(a, c): return a[2] > c[2])
		var kerb: Vector2 = sides[0][0]
		var out: Vector2 = sides[0][1]
		doors.append({"building": bi, "spot": kerb + out * 1.6, "out": out, "door": kerb - out * (SW - 0.2)})


func _pick_shops() -> void:
	shops.clear()
	var cands := []
	for d in doors:
		var b: Dictionary = buildings[d.building]
		if b.roof == 0 and b.rect.get_area() >= 140.0 and b.h <= 15.0:
			cands.append(d)
	var used_blocks := {}
	var chosen := []
	# start near the middle with the depot, then spread out
	var mid := Vector2(EXT, EXT) * 0.5
	cands.sort_custom(func(a, c): return a.spot.distance_to(mid) < c.spot.distance_to(mid))
	chosen.append(cands[0])
	used_blocks[buildings[cands[0].building].block] = true
	while chosen.size() < SHOP_DEFS.size():
		var best = null
		var best_d := -1.0
		for d in cands:
			if used_blocks.has(buildings[d.building].block):
				continue
			var md := 1e9
			for c in chosen:
				md = minf(md, d.spot.distance_to(c.spot))
			md = minf(md, (d.spot - Vector2(EXT, EXT) * 0.5).length() * 3.0 + 120.0)
			if md > best_d:
				best_d = md
				best = d
		if best == null:
			break
		chosen.append(best)
		used_blocks[buildings[best.building].block] = true
	for k in chosen.size():
		var d: Dictionary = chosen[k]
		var def: Dictionary = SHOP_DEFS[k]
		buildings[d.building].shop = k
		shops.append({"def": def, "building": d.building, "spot": d.spot, "out": d.out, "door": d.door})
	# shops are not delivery addresses
	var keep := []
	for d in doors:
		if buildings[d.building].shop < 0:
			keep.append(d)
	doors = keep


func _make_shadows() -> void:
	var size := int(ceil(EXT * SHADOW_PX))
	shadow_img = Image.create(size, size, false, Image.FORMAT_L8)
	shadow_img.fill(Color(0, 0, 0))
	# soft contact darkening around every footprint
	for b in buildings:
		var r: Rect2 = b.rect
		_fill(r.grow(0.9), 0.22)
	for t: Vector3 in trees:
		_fill(Rect2(t.x - t.z * 0.7, t.y - t.z * 0.7, t.z * 1.4, t.z * 1.4), 0.18)
	# cast shadows to the south-east
	for b in buildings:
		var r: Rect2 = b.rect
		var h: float = b.h + (2.0 if b.roof == 1 else 0.0)
		var off := SUN * h
		var steps := int(ceil(off.length() / 0.4))
		for s in steps + 1:
			var t := float(s) / float(maxi(steps, 1))
			_fill(Rect2(r.position + off * t, r.size), 0.78)
	for t: Vector3 in trees:
		var off := SUN * (t.z * 1.6)
		for s in 6:
			var c := Vector2(t.x, t.y) + off * (0.35 + 0.13 * float(s))
			var rr: float = t.z * (0.85 - 0.06 * float(s))
			_fill(Rect2(c.x - rr * 0.7, c.y - rr * 0.7, rr * 1.4, rr * 1.4), 0.7)
			_fill(Rect2(c.x - rr, c.y - rr * 0.4, rr * 2.0, rr * 0.8), 0.7)
			_fill(Rect2(c.x - rr * 0.4, c.y - rr, rr * 0.8, rr * 2.0), 0.7)


func _fill(r: Rect2, v: float) -> void:
	var x0 := clampi(int(floor(r.position.x * SHADOW_PX)), 0, shadow_img.get_width())
	var y0 := clampi(int(floor(r.position.y * SHADOW_PX)), 0, shadow_img.get_height())
	var x1 := clampi(int(ceil(r.end.x * SHADOW_PX)), 0, shadow_img.get_width())
	var y1 := clampi(int(ceil(r.end.y * SHADOW_PX)), 0, shadow_img.get_height())
	if x1 > x0 and y1 > y0:
		shadow_img.fill_rect(Rect2i(x0, y0, x1 - x0, y1 - y0), Color(v, v, v))


# --- meshes -----------------------------------------------------------------

func build() -> void:
	_build_ground()
	_build_buildings()
	_build_trees()


func _build_ground() -> void:
	var margin := 700.0
	var plane := PlaneMesh.new()
	plane.size = Vector2(EXT + margin * 2.0, EXT + margin * 2.0)
	var mi := MeshInstance3D.new()
	mi.mesh = plane
	mi.position = Vector3(EXT * 0.5, 0.0, EXT * 0.5)
	ground_mat = ShaderMaterial.new()
	ground_mat.shader = load("res://shaders/ground.gdshader")
	var bt := Image.create(N, N, false, Image.FORMAT_L8)
	for j in N:
		for i in N:
			var v := 0.0
			match block_type[j * N + i]:
				PARK: v = 0.5
				PLAZA: v = 1.0
			bt.set_pixel(i, j, Color(v, v, v))
	ground_mat.set_shader_parameter("block_tex", ImageTexture.create_from_image(bt))
	var sh := shadow_img.duplicate() as Image
	sh.generate_mipmaps()
	ground_mat.set_shader_parameter("shadow_tex", ImageTexture.create_from_image(sh))
	ground_mat.set_shader_parameter("grid_n", float(N))
	ground_mat.set_shader_parameter("bs", BS)
	ground_mat.set_shader_parameter("rw", RW)
	ground_mat.set_shader_parameter("sw", SW)
	ground_mat.set_shader_parameter("ext", EXT)
	ground_mat.set_shader_parameter("prom", PROM)
	mi.material_override = ground_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _build_buildings() -> void:
	var st := Geo.begin()
	for b in buildings:
		var r: Rect2 = b.rect
		var h: float = b.h
		var col: Color = b.color
		var rc: Color = b.roof_color
		var lo := Vector3(r.position.x, 0.0, r.position.y)
		var hi := Vector3(r.end.x, h, r.end.y)
		if b.roof == 0:
			Geo.box(st, lo, hi, Color(rc, Geo.K_ROOF), Color(col, Geo.K_WALL))
			if b.shop < 0:
				_roof_props(st, b)
		else:
			Geo.box(st, lo, hi, Color(rc, Geo.K_ROOF), Color(col, Geo.K_WALL), false)
			_gable(st, r, h, Color(rc, Geo.K_TILES), Color(col, Geo.K_WALL))
		if b.shop >= 0:
			_awning(st, b)
	# sea wall
	var wc := Color(Color("d9d0bd"), Geo.K_PROP)
	var a := -PROM - 0.7
	var z := EXT + PROM + 0.7
	Geo.box(st, Vector3(a, 0, a), Vector3(z, 0.9, -PROM), wc, wc)
	Geo.box(st, Vector3(a, 0, EXT + PROM), Vector3(z, 0.9, z), wc, wc)
	Geo.box(st, Vector3(a, 0, -PROM), Vector3(-PROM, 0.9, EXT + PROM), wc, wc)
	Geo.box(st, Vector3(EXT + PROM, 0, -PROM), Vector3(z, 0.9, EXT + PROM), wc, wc)
	# fountains
	for idx in N * N:
		if block_type[idx] == CITY:
			continue
		var o := block_origin(idx % N, idx / N)
		var c := o + Vector2(BS, BS) * 0.5
		var rad := 3.7 if block_type[idx] == PARK else 4.6
		var stone := Color(Color("cfc6b4"), Geo.K_PROP)
		Geo.prism(st, Vector3(c.x, 0, c.y), rad, rad, 0.0, 0.7, stone, stone, 16)
		var water := Color(Color("5aa7c4"), Geo.K_FLAT)
		Geo.prism(st, Vector3(c.x, 0, c.y), rad - 0.45, rad - 0.45, 0.0, 0.62, water, water, 16)
		Geo.prism(st, Vector3(c.x, 0, c.y), 0.7, 0.7, 0.0, 1.6, stone, stone, 8)
	var mesh := Geo.finish(st)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	building_mat = ShaderMaterial.new()
	building_mat.shader = load("res://shaders/building.gdshader")
	mi.material_override = building_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _gable(st: SurfaceTool, r: Rect2, h: float, tile: Color, wallc: Color) -> void:
	var along_x := r.size.x >= r.size.y
	var short := r.size.y if along_x else r.size.x
	var rise := minf(short * 0.38, 4.2)
	var e := 0.35  # eaves overhang
	var x0 := r.position.x - e
	var x1 := r.end.x + e
	var z0 := r.position.y - e
	var z1 := r.end.y + e
	if along_x:
		var zm := r.get_center().y
		var ridge_len := x1 - x0
		var slope := Vector2(zm - z0, rise).length()
		var nn := Vector3(0, zm - z0, -rise).normalized()
		Geo.quad(st, [Vector3(x0, h, z0), Vector3(x1, h, z0), Vector3(x1, h + rise, zm), Vector3(x0, h + rise, zm)], nn, tile,
			[Vector2(0, 0), Vector2(ridge_len, 0), Vector2(ridge_len, slope), Vector2(0, slope)], Vector2(ridge_len, slope))
		var ns := Vector3(0, z1 - zm, rise).normalized()
		Geo.quad(st, [Vector3(x0, h, z1), Vector3(x1, h, z1), Vector3(x1, h + rise, zm), Vector3(x0, h + rise, zm)], ns, tile,
			[Vector2(0, 0), Vector2(ridge_len, 0), Vector2(ridge_len, slope), Vector2(0, slope)], Vector2(ridge_len, slope))
		# gable ends (walls)
		var rz0 := r.position.y
		var rz1 := r.end.y
		Geo.tri(st, [Vector3(r.position.x, h, rz0), Vector3(r.position.x, h, rz1), Vector3(r.position.x, h + rise, zm)], Vector3.LEFT, Color(wallc, Geo.K_PROP))
		Geo.tri(st, [Vector3(r.end.x, h, rz0), Vector3(r.end.x, h, rz1), Vector3(r.end.x, h + rise, zm)], Vector3.RIGHT, Color(wallc, Geo.K_PROP))
	else:
		var xm := r.get_center().x
		var ridge_len := z1 - z0
		var slope := Vector2(xm - x0, rise).length()
		var nw := Vector3(-rise, xm - x0, 0).normalized()
		Geo.quad(st, [Vector3(x0, h, z0), Vector3(x0, h, z1), Vector3(xm, h + rise, z1), Vector3(xm, h + rise, z0)], nw, tile,
			[Vector2(0, 0), Vector2(ridge_len, 0), Vector2(ridge_len, slope), Vector2(0, slope)], Vector2(ridge_len, slope))
		var ne := Vector3(rise, x1 - xm, 0).normalized()
		Geo.quad(st, [Vector3(x1, h, z0), Vector3(x1, h, z1), Vector3(xm, h + rise, z1), Vector3(xm, h + rise, z0)], ne, tile,
			[Vector2(0, 0), Vector2(ridge_len, 0), Vector2(ridge_len, slope), Vector2(0, slope)], Vector2(ridge_len, slope))
		var rx0 := r.position.x
		var rx1 := r.end.x
		Geo.tri(st, [Vector3(rx0, h, r.position.y), Vector3(rx1, h, r.position.y), Vector3(xm, h + rise, r.position.y)], Vector3.FORWARD, Color(wallc, Geo.K_PROP))
		Geo.tri(st, [Vector3(rx0, h, r.end.y), Vector3(rx1, h, r.end.y), Vector3(xm, h + rise, r.end.y)], Vector3.BACK, Color(wallc, Geo.K_PROP))
	# chimney
	if rng.randf() < 0.6:
		var cx := r.position.x + r.size.x * rng.randf_range(0.25, 0.75)
		var cz := r.position.y + r.size.y * rng.randf_range(0.25, 0.75)
		var brick := Color(Color("8e5442"), Geo.K_PROP)
		Geo.box(st, Vector3(cx - 0.45, h, cz - 0.45), Vector3(cx + 0.45, h + rise + 0.9, cz + 0.45), Color(Color("4a3a33"), Geo.K_PROP), brick)


func _roof_props(st: SurfaceTool, b: Dictionary) -> void:
	var r: Rect2 = b.rect
	var h: float = b.h
	var inner := r.grow(-1.4)
	if inner.size.x < 2.5 or inner.size.y < 2.5:
		return
	var grey := Color(Color("c9c7c0"), Geo.K_PROP)
	var dark := Color(Color("8d8a84"), Geo.K_PROP)
	var n := rng.randi_range(1, 3) if inner.get_area() > 40.0 else 1
	var taken: Array = []
	for k in n + 1:
		var kind := rng.randi() % 4
		var sz := Vector2(1.3, 1.0)
		match kind:
			1: sz = Vector2(2.6, 2.6)   # stair house
			2: sz = Vector2(2.2, 1.1)   # skylight
			3: sz = Vector2(2.0, 2.0)   # water tank
		if sz.x > inner.size.x or sz.y > inner.size.y:
			continue
		var p := Vector2(rng.randf_range(inner.position.x, inner.end.x - sz.x), rng.randf_range(inner.position.y, inner.end.y - sz.y))
		var rr := Rect2(p, sz)
		var clash := false
		for t: Rect2 in taken:
			if t.grow(0.4).intersects(rr):
				clash = true
		if clash:
			continue
		taken.append(rr)
		match kind:
			0:
				Geo.box(st, Vector3(p.x, h, p.y), Vector3(p.x + sz.x, h + 0.75, p.y + sz.y), grey, dark)
				Geo.prism(st, Vector3(p.x + sz.x * 0.5, 0, p.y + sz.y * 0.5), 0.34, 0.34, h + 0.75, h + 0.8, Color(Color("5e5c58"), Geo.K_PROP), dark, 8)
			1:
				var wc: Color = b.color
				Geo.box(st, Vector3(p.x, h, p.y), Vector3(p.x + sz.x, h + 2.3, p.y + sz.y), Color(b.roof_color.lightened(0.12), Geo.K_PROP), Color(wc.darkened(0.05), Geo.K_PROP))
			2:
				Geo.box(st, Vector3(p.x, h, p.y), Vector3(p.x + sz.x, h + 0.35, p.y + sz.y), Color(Color("5f7f96"), Geo.K_FLAT), grey)
			3:
				var c := Vector3(p.x + sz.x * 0.5, 0, p.y + sz.y * 0.5)
				Geo.prism(st, c, sz.x * 0.5, sz.y * 0.5, h, h + 1.8, Color(Color("b9b4a8"), Geo.K_PROP), Color(Color("9e998d"), Geo.K_PROP), 10)


func _awning(st: SurfaceTool, b: Dictionary) -> void:
	var shop: Dictionary = {}
	for s in shops:
		if s.building == buildings.find(b):
			shop = s
	if shop.is_empty():
		return
	var r: Rect2 = b.rect
	var out: Vector2 = shop.out
	var col := Color(Color(SHOP_DEFS[b.shop].color), Geo.K_AWNING)
	var depth := 1.8
	var y := 3.3
	var lo: Vector3
	var hi: Vector3
	var w := minf((r.size.x if absf(out.y) > 0.5 else r.size.y) - 1.0, 12.0)
	var c := r.get_center()
	if out.y < -0.5:
		lo = Vector3(c.x - w * 0.5, y - 0.3, r.position.y - depth)
		hi = Vector3(c.x + w * 0.5, y, r.position.y)
	elif out.y > 0.5:
		lo = Vector3(c.x - w * 0.5, y - 0.3, r.end.y)
		hi = Vector3(c.x + w * 0.5, y, r.end.y + depth)
	elif out.x < -0.5:
		lo = Vector3(r.position.x - depth, y - 0.3, c.y - w * 0.5)
		hi = Vector3(r.position.x, y, c.y + w * 0.5)
	else:
		lo = Vector3(r.end.x, y - 0.3, c.y - w * 0.5)
		hi = Vector3(r.end.x + depth, y, c.y + w * 0.5)
	Geo.box(st, lo, hi, col, col)


func _build_trees() -> void:
	var st := Geo.begin()
	var greens := ["6f9a4a", "5d8c45", "7fa653", "5a8550", "8aac57"]
	for t: Vector3 in trees:
		var g := Color(greens[rng.randi() % greens.size()])
		var c := Vector3(t.x, 0.0, t.y)
		var r: float = t.z
		Geo.dome(st, c + Vector3(0, r * 0.9, 0), r, r * 1.25, Color(g, Geo.K_PROP))
		Geo.dome(st, c + Vector3(r * 0.18, r * 1.6, -r * 0.2), r * 0.62, r * 0.75, Color(g.lightened(0.1), Geo.K_PROP))
	# street trees and lamp posts along some sidewalks
	var mesh := Geo.finish(st)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = building_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
