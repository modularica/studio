class_name Peds
extends Node3D
## People walking around the blocks on the sidewalks, now and then crossing
## at a zebra crossing. They jump out of the van's way; if the van still
## touches one, they sit down for a moment (no harm done) and get up.

const COUNT := 170
const SHIRTS := ["d94f3d", "3f7cc0", "f2c230", "5da35a", "e5e1d8", "8e5aa8", "2f3640", "f08a6a",
	"4ab3b0", "c7486b", "a3b86c", "e39b2f", "6d8fbf", "b05a3c"]

class Ped:
	var block := Vector2i.ZERO
	var s := 0.0
	var dirsign := 1
	var speed := 1.3
	var pos := Vector2.ZERO
	var head := 0.0
	var off := Vector2.ZERO
	var off_v := Vector2.ZERO
	var state := 0          # 0 walking, 1 crossing, 2 sitting down
	var t := 0.0
	var startle := 0.0
	var cross_from := Vector2.ZERO
	var cross_to := Vector2.ZERO
	var cross_h := Vector2.ZERO
	var cross_corner := 0
	var next_block := Vector2i.ZERO
	var paint := Color.WHITE
	var phase := 0.0
	var fall := 0.0
	var idle := 0.0
	var prev := 0
	var cross_t := 0.0

var city: City
var player: Player
var peds: Array = []
var mm: MultiMesh
var shadow_mm: MultiMesh
var rng := RandomNumberGenerator.new()
var _road: Array = []
var startled := 0      # people who jumped aside this frame
var knocked := 0       # people the van touched this frame
var knocked_at := Vector2.ZERO
var view := Rect2()
var respawn_t := 0.0

const L := City.BS - City.SW


func setup(c: City, p: Player, car_shader: Shader, blob_mat: Material) -> void:
	city = c
	player = p
	rng.seed = 1234
	for k in COUNT:
		var pd := Ped.new()
		pd.block = Vector2i(rng.randi_range(0, City.N - 1), rng.randi_range(0, City.N - 1))
		pd.s = rng.randf_range(0.0, 4.0 * L)
		pd.dirsign = 1 if rng.randf() < 0.5 else -1
		pd.speed = rng.randf_range(1.0, 1.6)
		var col := Color(SHIRTS[rng.randi() % SHIRTS.size()])
		pd.paint = Color(col.r, col.g, col.b, rng.randf())
		pd.phase = rng.randf() * TAU
		_walk_pos(pd)
		peds.append(pd)
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true  # Compatibility multiplies COLOR by the instance colour
	mm.mesh = Meshes.person()
	mm.instance_count = COUNT
	var mat := ShaderMaterial.new()
	mat.shader = car_shader
	mat.set_shader_parameter("use_custom", 1.0)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	add_child(mi)
	for k in COUNT:
		mm.set_instance_custom_data(k, peds[k].paint)
		mm.set_instance_color(k, Color.WHITE)
	shadow_mm = MultiMesh.new()
	shadow_mm.transform_format = MultiMesh.TRANSFORM_3D
	shadow_mm.mesh = Meshes.blob(0.65, 0.8)
	shadow_mm.instance_count = COUNT
	var smi := MultiMeshInstance3D.new()
	smi.multimesh = shadow_mm
	smi.material_override = blob_mat
	add_child(smi)


func _corner(b: Vector2i, k: int) -> Vector2:
	var o := City.block_origin(b.x, b.y)
	var h := City.SW * 0.5
	match k % 4:
		0: return o + Vector2(h, h)
		1: return o + Vector2(City.BS - h, h)
		2: return o + Vector2(City.BS - h, City.BS - h)
	return o + Vector2(h, City.BS - h)


static func _edge_dir(e: int) -> Vector2:
	match posmod(e, 4):
		0: return Vector2(1, 0)
		1: return Vector2(0, 1)
		2: return Vector2(-1, 0)
	return Vector2(0, -1)


func _walk_pos(pd: Ped) -> void:
	var e := int(floor(pd.s / L)) % 4
	var f := pd.s - float(e) * L
	pd.pos = _corner(pd.block, e) + _edge_dir(e) * f
	var h := _edge_dir(e) * float(pd.dirsign)
	pd.head = h.angle()


## People currently on the road (traffic stops for them).
func road_points() -> Array:
	return _road


func update(dt: float) -> void:
	_road.clear()
	startled = 0
	knocked = 0
	var pv := player.vel
	var psp := pv.length()
	for pd: Ped in peds:
		pd.startle = maxf(0.0, pd.startle - dt)
		match pd.state:
			0: _walk(pd, dt)
			1: _cross(pd, dt)
			2:
				pd.t -= dt
				if pd.t <= 0.0:
					pd.state = pd.prev
					if pd.state == 1:
						pd.t = pd.cross_t
		pd.off += pd.off_v * dt
		pd.off_v *= exp(-6.0 * dt)
		pd.off = pd.off.lerp(Vector2.ZERO, 1.0 - exp(-0.7 * dt))
		var p := pd.pos + pd.off
		if pd.state == 1 or city.on_road(p):
			_road.append(p)
		# the van
		var d := p - player.pos
		if d.length_squared() > 144.0:
			continue
		if pd.state != 2 and psp > 3.0:
			var vh := pv / psp
			var along := d.dot(vh)
			var lat := d.dot(Vector2(-vh.y, vh.x))
			if along > -1.0 and along < 3.0 + psp * 0.5 and absf(lat) < 2.4 and pd.startle <= 0.0:
				var side := signf(lat) if absf(lat) > 0.1 else (1.0 if rng.randf() < 0.5 else -1.0)
				pd.off_v += Vector2(-vh.y, vh.x) * side * 7.5
				pd.startle = 1.2
				startled += 1
		if pd.state != 2:
			var f := player.fwd()
			for off: float in Player.CIRCLES:
				if (player.pos + f * off).distance_to(p) < Player.R + 0.3:
					pd.prev = pd.state
					if pd.state == 1:
						pd.cross_t = pd.t
					pd.state = 2
					pd.t = 1.8
					pd.fall = pv.angle() if psp > 0.5 else pd.head
					pd.off_v += pv * 0.45
					knocked += 1
					knocked_at = p
					break
	respawn_t -= dt
	if respawn_t <= 0.0:
		respawn_t = 0.1
		_respawn_far()
	_render()


## Keep the sidewalks around the player busy: move far-away people to
## blocks near the player, where the camera is not looking.
func _respawn_far() -> void:
	var moved := 0
	var vg := view.grow(6.0)
	for pd: Ped in peds:
		if moved >= 5:
			return
		if pd.state != 0 or pd.pos.distance_to(player.pos) < 115.0 or vg.has_point(pd.pos):
			continue
		for attempt in 8:
			var b := Vector2i(clampi(int(floor((player.pos.x - City.RW) / City.P)) + rng.randi_range(-1, 1), 0, City.N - 1),
				clampi(int(floor((player.pos.y - City.RW) / City.P)) + rng.randi_range(-1, 1), 0, City.N - 1))
			pd.block = b
			pd.s = rng.randf_range(0.0, 4.0 * L)
			pd.off = Vector2.ZERO
			pd.off_v = Vector2.ZERO
			_walk_pos(pd)
			if not vg.has_point(pd.pos):
				break
		moved += 1


func _walk(pd: Ped, dt: float) -> void:
	if pd.idle > 0.0:
		pd.idle -= dt
		return
	if rng.randf() < dt * 0.02:
		pd.idle = rng.randf_range(1.0, 4.0)
	var e_old := int(floor(pd.s / L)) % 4
	var h_old := _edge_dir(e_old) * float(pd.dirsign)
	pd.s += float(pd.dirsign) * pd.speed * dt
	if pd.s >= 4.0 * L:
		pd.s -= 4.0 * L
	elif pd.s < 0.0:
		pd.s += 4.0 * L
	var e_new := int(floor(pd.s / L)) % 4
	pd.phase += dt * pd.speed * 6.0
	if e_new != e_old:
		var k := e_new if pd.dirsign > 0 else e_old
		if rng.randf() < 0.32:
			var step := Vector2i(roundi(h_old.x), roundi(h_old.y))
			var nb := pd.block + step
			if nb.x >= 0 and nb.y >= 0 and nb.x < City.N and nb.y < City.N:
				pd.state = 1
				pd.cross_from = _corner(pd.block, k)
				pd.cross_to = pd.cross_from + h_old * (City.SW + City.RW)
				pd.cross_h = h_old
				pd.t = 0.0
				pd.next_block = nb
				# corner on the other side
				if absf(h_old.x) > 0.5:
					pd.cross_corner = [1, 0, 3, 2][k]
				else:
					pd.cross_corner = [3, 2, 1, 0][k]
				pd.pos = pd.cross_from
				pd.head = h_old.angle()
				return
	_walk_pos(pd)


func _cross(pd: Ped, dt: float) -> void:
	var l := City.SW + City.RW
	pd.t += pd.speed * 1.15 * dt / l
	pd.phase += dt * pd.speed * 6.0
	pd.pos = pd.cross_from.lerp(pd.cross_to, minf(pd.t, 1.0))
	pd.head = pd.cross_h.angle()
	if pd.t >= 1.0:
		pd.block = pd.next_block
		var k := pd.cross_corner
		pd.s = float(k) * L
		if _edge_dir(k).is_equal_approx(pd.cross_h):
			pd.dirsign = 1
		else:
			pd.dirsign = -1
		pd.state = 0
		_walk_pos(pd)


func _render() -> void:
	for k in peds.size():
		var pd: Ped = peds[k]
		var p := pd.pos + pd.off
		var b := Basis(Vector3.UP, -pd.head).scaled(Vector3(1.3, 1.3, 1.3))
		var y := 0.0
		if pd.state == 2:
			b = (Basis(Vector3.UP, -pd.fall) * Basis(Vector3(0, 0, 1), -PI * 0.5)).scaled(Vector3(1.3, 1.3, 1.3))
			y = 0.2
		elif pd.idle <= 0.0:
			y = absf(sin(pd.phase)) * 0.05
			b = b * Basis(Vector3(1, 0, 0), sin(pd.phase) * 0.06)
		if pd.startle > 0.0 and pd.state != 2:
			b = b * Basis(Vector3(1, 0, 0), sin(pd.startle * 25.0) * 0.25 * pd.startle)
		mm.set_instance_transform(k, Transform3D(b, Vector3(p.x, y, p.y)))
		shadow_mm.set_instance_transform(k, Transform3D(Basis(), Vector3(p.x + 0.25, 0.0, p.y + 0.2)))
