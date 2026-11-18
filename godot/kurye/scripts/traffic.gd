class_name Traffic
extends Node3D
## Cars that follow the lanes, turn at intersections (one car at a time in
## each intersection), queue behind each other and the player, and get
## bumped. Cars far from the player are moved back near the player, out of
## sight, so the streets around the player stay busy.

const MODELS := 4  # sedan, hatch, taxi, truck
const MIX := [0, 0, 1, 0, 1, 2, 0, 1, 3, 0, 1, 0, 2, 1, 3, 0, 1, 0, 1, 2, 0, 3, 1, 0, 1, 0, 2, 1, 0, 3, 1, 0,
	1, 0, 0, 1, 2, 0, 1, 3, 0, 1, 0, 2, 1, 0, 1, 3]
const LEN := [4.4, 3.8, 4.4, 6.2]
const WID := [1.86, 1.76, 1.86, 2.3]
const PAINTS := ["c0392b", "2e6db4", "e8e6df", "3b3f45", "8fb8c9", "6a8f3c", "d9a23a", "7d4e9e",
	"b8b4aa", "1f4f6e", "a0522d", "4a7c74", "d96f8b", "e0d6b8"]
const TRUCK_PAINTS := ["2e6db4", "c0392b", "3a7d44", "e8e6df"]

class Car:
	var id := 0
	var model := 0
	var length := 4.4
	var width := 1.86
	var paint := Color.WHITE
	var pos := Vector2.ZERO
	var head := 0.0
	var speed := 0.0
	var cruise := 11.0
	var dir := 0
	var node := Vector2i.ZERO
	var curve := false
	var p0 := Vector2.ZERO
	var p1 := Vector2.ZERO
	var p2 := Vector2.ZERO
	var leg_len := 1.0
	var s := 0.0
	var next_dir := 0
	var stopped := 0.0
	var blocked_by_player := 0.0
	var off := Vector2.ZERO
	var off_v := Vector2.ZERO
	var wob := 0.0
	var wob_v := 0.0
	var honk_cd := 0.0
	var ghost := 0.0
	var slot := 0

var city: City
var player: Player
var peds: Node
var cars: Array = []
var locks := {}
var mms: Array = []
var shadows: MultiMeshInstance3D
var rng := RandomNumberGenerator.new()
var view := Rect2()        # what the camera sees, in world 2D
var honks: Array = []      # positions of honks this frame (for sound)
var respawn_t := 0.0


func setup(c: City, p: Player, car_shader: Shader, blob_mat: Material) -> void:
	city = c
	player = p
	rng.seed = 99
	var meshes := [Meshes.sedan(), Meshes.hatch(), Meshes.sedan(true), Meshes.truck()]
	var counts := [0, 0, 0, 0]
	for k in MIX.size():
		var m: int = MIX[k]
		var car := Car.new()
		car.id = k
		car.model = m
		car.length = LEN[m]
		car.width = WID[m]
		car.slot = counts[m]
		counts[m] += 1
		match m:
			2: car.paint = Color("f2c230")
			3: car.paint = Color(TRUCK_PAINTS[rng.randi() % TRUCK_PAINTS.size()])
			_: car.paint = Color(PAINTS[rng.randi() % PAINTS.size()])
		car.cruise = rng.randf_range(9.5, 12.5) * (0.85 if m == 3 else 1.0)
		cars.append(car)
	var mat := ShaderMaterial.new()
	mat.shader = car_shader
	mat.set_shader_parameter("use_custom", 1.0)
	for m in MODELS:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.use_colors = true  # Compatibility multiplies COLOR by the instance colour
		mm.mesh = meshes[m]
		mm.instance_count = counts[m]
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		mms.append(mm)
	for car: Car in cars:
		mms[car.model].set_instance_custom_data(car.slot, car.paint)
		mms[car.model].set_instance_color(car.slot, Color.WHITE)
	var smm := MultiMesh.new()
	smm.transform_format = MultiMesh.TRANSFORM_3D
	smm.mesh = Meshes.blob(4.6, 1.95)
	smm.instance_count = cars.size()
	shadows = MultiMeshInstance3D.new()
	shadows.multimesh = smm
	shadows.material_override = blob_mat
	add_child(shadows)
	for car: Car in cars:
		_spawn(car, true)


static func _key(n: Vector2i) -> int:
	return n.y * 100 + n.x


func _valid_out(n: Vector2i, d: int) -> bool:
	return City.valid_node(n + City.dir_step(d))


func _choose_turn(n: Vector2i, d: int) -> int:
	var opts := []
	var w := []
	for pair in [[d, 0.56], [(d + 1) % 4, 0.22], [(d + 3) % 4, 0.22]]:
		if _valid_out(n, pair[0]):
			opts.append(pair[0])
			w.append(pair[1])
	if opts.is_empty():
		return (d + 2) % 4
	var t := rng.randf() * (w.reduce(func(a, b): return a + b) as float)
	for k in opts.size():
		t -= w[k]
		if t <= 0.0:
			return opts[k]
	return opts[-1]


func _start_straight(car: Car, from: Vector2i, d: int) -> void:
	car.dir = d
	car.node = from + City.dir_step(d)
	car.curve = false
	car.p0 = City.exit_point(from, d)
	car.p2 = City.entry_point(car.node, d)
	car.leg_len = car.p0.distance_to(car.p2)
	car.s = 0.0
	car.next_dir = _choose_turn(car.node, d)


func _start_curve(car: Car) -> void:
	var n := car.node
	car.curve = true
	car.p0 = City.entry_point(n, car.dir)
	car.p2 = City.exit_point(n, car.next_dir)
	car.p1 = City.turn_control(n, car.dir, car.next_dir)
	var l := 0.0
	var prev := car.p0
	for k in range(1, 9):
		var q := _bez(car.p0, car.p1, car.p2, float(k) / 8.0)
		l += prev.distance_to(q)
		prev = q
	car.leg_len = maxf(l, 0.5)
	car.s = 0.0


static func _bez(a: Vector2, b: Vector2, c: Vector2, t: float) -> Vector2:
	var u := 1.0 - t
	return a * (u * u) + b * (2.0 * u * t) + c * (t * t)


static func _bez_d(a: Vector2, b: Vector2, c: Vector2, t: float) -> Vector2:
	return (b - a) * (2.0 * (1.0 - t)) + (c - b) * (2.0 * t)


func _place(car: Car) -> void:
	var t := clampf(car.s / car.leg_len, 0.0, 1.0)
	if car.curve:
		car.pos = _bez(car.p0, car.p1, car.p2, t)
		var d := _bez_d(car.p0, car.p1, car.p2, t)
		if d.length_squared() > 1e-6:
			car.head = d.angle()
	else:
		car.pos = car.p0.lerp(car.p2, t)
		car.head = City.dir_vec(car.dir).angle()


## Put a car on a random lane, out of sight (or anywhere at the start).
func _spawn(car: Car, anywhere: bool) -> bool:
	for attempt in 40:
		var n := Vector2i(rng.randi_range(0, City.N), rng.randi_range(0, City.N))
		var d := rng.randi() % 4
		if not _valid_out(n, d):
			continue
		_start_straight(car, n, d)
		car.s = rng.randf_range(4.0, car.leg_len - 8.0)
		_place(car)
		if not anywhere:
			var dp := car.pos.distance_to(player.pos)
			if dp < 45.0 or dp > 120.0:
				continue
			if view.grow(14.0).has_point(car.pos):
				continue
		elif car.pos.distance_to(player.pos) < 25.0:
			continue
		var clash := false
		for o: Car in cars:
			if o != car and o.pos.distance_to(car.pos) < 10.0:
				clash = true
				break
		if clash:
			continue
		car.speed = car.cruise * 0.6
		car.off = Vector2.ZERO
		car.off_v = Vector2.ZERO
		car.stopped = 0.0
		car.ghost = 0.0
		_release(car)
		return true
	return false


func _release(car: Car) -> void:
	for k in locks.keys():
		if locks[k] == car.id:
			locks.erase(k)


func _exit_clear(car: Car) -> bool:
	var ep := City.exit_point(car.node, car.next_dir)
	for o: Car in cars:
		if o != car and o.pos.distance_to(ep) < 0.5 * (o.length + car.length) + 1.0:
			return false
	if player.pos.distance_to(ep) < 4.5:
		return false
	return true


## How fast we may go given what is in front of us.
func _ahead_limit(car: Car) -> float:
	var f := Vector2(cos(car.head), sin(car.head))
	var r := Vector2(-f.y, f.x)
	var best := 1e9
	for o: Car in cars:
		if o == car:
			continue
		var d := (o.pos + o.off) - (car.pos + car.off)
		var along := d.dot(f)
		if along <= 0.0 or along > 20.0:
			continue
		if absf(d.dot(r)) > 2.2:
			continue
		var gap := along - 0.5 * (car.length + o.length)
		if gap < best:
			best = gap
	var dp := player.pos - (car.pos + car.off)
	var al := dp.dot(f)
	if al > 0.0 and al < 22.0 and absf(dp.dot(r)) < 2.6:
		var gap := al - 0.5 * (car.length + Player.LEN)
		if gap < best:
			best = gap
	if peds != null:
		for pp: Vector2 in peds.road_points():
			var d := pp - car.pos
			var along := d.dot(f)
			if along > 0.0 and along < 14.0 and absf(d.dot(r)) < 1.9:
				best = minf(best, along - car.length * 0.5 - 0.8)
	if best > 1e8:
		car.blocked_by_player = 0.0
		return 99.0
	return maxf(0.0, (best - 2.2) * 1.5)


func update(dt: float) -> void:
	honks.clear()
	for car: Car in cars:
		_update_car(car, dt)
	respawn_t -= dt
	if respawn_t <= 0.0:
		respawn_t = 0.15
		for car: Car in cars:
			if car.pos.distance_to(player.pos) > 140.0 and not view.grow(20.0).has_point(car.pos):
				_spawn(car, false)
				break
	_render()


func _update_car(car: Car, dt: float) -> void:
	var tgt := car.cruise
	if car.curve:
		tgt = 5.0 if car.next_dir == (car.dir + 1) % 4 else (7.0 if car.next_dir != car.dir else car.cruise)
	else:
		var remain := car.leg_len - car.s
		if car.next_dir != car.dir:
			tgt = minf(tgt, 5.5 + remain * 0.45)
		if remain < 10.0:
			var key := _key(car.node)
			var holder: int = locks.get(key, -1)
			if holder == -1 and remain < 4.0 and _exit_clear(car):
				locks[key] = car.id
				holder = car.id
			if holder != car.id:
				tgt = minf(tgt, maxf(0.0, (remain - 0.4) * 1.6))
	var lim := _ahead_limit(car)
	if car.ghost > 0.0:
		car.ghost -= dt
		lim = maxf(lim, 6.0)
	tgt = minf(tgt, lim)
	if car.off.length() > 0.8:
		tgt = minf(tgt, 2.0)
	var acc := 5.5 if tgt > car.speed else 14.0
	car.speed = move_toward(car.speed, tgt, acc * dt)
	# blocked by the player: honk now and then
	var dp := player.pos - car.pos
	if car.speed < 0.6 and lim < 1.0 and dp.length() < 12.0:
		car.blocked_by_player += dt
		if car.blocked_by_player > 2.2 and car.honk_cd <= 0.0:
			honks.append(car.pos)
			car.honk_cd = rng.randf_range(2.5, 4.5)
	else:
		car.blocked_by_player = 0.0
	car.honk_cd -= dt
	if car.speed < 0.2:
		car.stopped += dt
		if car.stopped > 7.0:
			# probably gridlocked: let it squeeze through
			car.ghost = 2.5
			car.stopped = 0.0
	else:
		car.stopped = 0.0
	car.s += car.speed * dt
	if car.s >= car.leg_len:
		if not car.curve:
			var key := _key(car.node)
			var holder: int = locks.get(key, -1)
			if holder == car.id or (holder == -1 and _exit_clear(car)) or car.ghost > 0.0:
				var extra := car.s - car.leg_len
				locks[key] = car.id
				_start_curve(car)
				car.s = extra
			else:
				car.s = car.leg_len
				car.speed = 0.0
		else:
			var key := _key(car.node)
			if locks.get(key, -1) == car.id:
				locks.erase(key)
			var extra := car.s - car.leg_len
			_start_straight(car, car.node, car.next_dir)
			car.s = extra
	_place(car)
	# bumps: spring back into the lane
	car.off += car.off_v * dt
	car.off_v *= exp(-5.0 * dt)
	car.off = car.off.lerp(Vector2.ZERO, 1.0 - exp(-1.2 * dt))
	car.wob += car.wob_v * dt
	car.wob_v *= exp(-4.0 * dt)
	car.wob = lerpf(car.wob, 0.0, 1.0 - exp(-2.0 * dt))


## Circles along a car for collisions (world 2D).
func circles(car: Car) -> Array:
	var f := Vector2(cos(car.head + car.wob), sin(car.head + car.wob))
	var r := car.width * 0.5
	var half := car.length * 0.5 - r
	var c := car.pos + car.off
	return [c + f * half, c - f * half, c]


func velocity(car: Car) -> Vector2:
	return Vector2(cos(car.head), sin(car.head)) * car.speed + car.off_v


## Called by the game when the player hits this car.
func bump(car: Car, n: Vector2, strength: float) -> void:
	# n points from the car to the player
	car.off_v -= n * clampf(strength * 0.35, 0.0, 6.0)
	car.wob_v += clampf(strength * 0.12, 0.0, 1.5) * (1.0 if rng.randf() < 0.5 else -1.0)
	car.speed *= 0.3
	if strength > 2.0 and car.honk_cd <= 0.0:
		honks.append(car.pos)
		car.honk_cd = 2.0


func _render() -> void:
	var smm := shadows.multimesh
	for k in cars.size():
		var car: Car = cars[k]
		var c := car.pos + car.off
		var b := Basis(Vector3.UP, -(car.head + car.wob))
		mms[car.model].set_instance_transform(car.slot, Transform3D(b, Vector3(c.x, 0.0, c.y)))
		smm.set_instance_transform(k, Transform3D(b * Basis.from_scale(Vector3(car.length / 4.6, 1, car.width / 1.95)), Vector3(c.x + 0.45, 0.0, c.y + 0.38)))
