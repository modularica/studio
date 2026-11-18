class_name Player
extends Node3D
## The courier van: arcade top-down handling (grip, drift on the handbrake),
## bumps against buildings and traffic.

const LEN := 4.8
const WID := 2.04
const R := 1.02
const CIRCLES := [-1.55, 0.0, 1.55]

const MAX_SPEED := 27.0
const MAX_REV := 7.5
const ACCEL := 15.0
const REV_ACCEL := 9.0
const BRAKE := 30.0
const ROLL := 1.6
const AIR := 0.0016
const GRIP := 10.0
const MAX_YAW := 2.7
const RESTITUTION := 0.25

var city: City
var pos := Vector2.ZERO
var vel := Vector2.ZERO
var head := 0.0
var yaw_rate := 0.0
var spin := 0.0
var steer := 0.0
var throttle := 0.0
var handbrake := false
var speed := 0.0
var slip := 0.0
var hit := 0.0          # strongest bump this frame (m/s)
var hit_kind := 0       # 0 wall, 1 car
var accel_f := 0.0
var accel_l := 0.0
var frozen := false

var body: MeshInstance3D
var shadow: MeshInstance3D
var mat: ShaderMaterial


func setup(c: City, car_shader: Shader, blob_mat: Material) -> void:
	city = c
	body = MeshInstance3D.new()
	body.mesh = Meshes.van()
	mat = ShaderMaterial.new()
	mat.shader = car_shader
	mat.set_shader_parameter("paint", Color("f08a24"))
	body.material_override = mat
	add_child(body)
	shadow = MeshInstance3D.new()
	shadow.mesh = Meshes.blob(LEN, WID)
	shadow.material_override = blob_mat
	add_child(shadow)


func fwd() -> Vector2:
	return Vector2(cos(head), sin(head))


func rgt() -> Vector2:
	return Vector2(-sin(head), cos(head))


func place(p: Vector2, h: float) -> void:
	pos = p
	head = h
	vel = Vector2.ZERO
	yaw_rate = 0.0
	spin = 0.0
	_sync(0.0)


func step(dt: float) -> void:
	hit = 0.0
	if frozen:
		vel = vel.move_toward(Vector2.ZERO, 40.0 * dt)
	var f := fwd()
	var r := rgt()
	var vf := vel.dot(f)
	var vl := vel.dot(r)
	var vf0 := vf
	var vl0 := vl
	var thr := 0.0 if frozen else throttle
	if thr > 0.0:
		if vf < -0.5:
			vf = move_toward(vf, 0.0, BRAKE * thr * dt)
		else:
			vf += ACCEL * thr * (1.0 - clampf(vf / MAX_SPEED, 0.0, 1.0) * 0.92) * dt
			vf = minf(vf, MAX_SPEED)
	elif thr < 0.0:
		if vf > 0.5:
			vf = move_toward(vf, 0.0, BRAKE * -thr * dt)
		else:
			vf -= REV_ACCEL * -thr * (1.0 - clampf(-vf / MAX_REV, 0.0, 1.0)) * dt
	else:
		vf = move_toward(vf, 0.0, ROLL * dt)
	vf -= vf * absf(vf) * AIR * dt
	if handbrake:
		vf = move_toward(vf, 0.0, 7.0 * dt)
	var grip := GRIP
	if handbrake:
		grip = 1.5
	elif absf(steer) > 0.7 and absf(vf) > 18.0:
		grip = 5.5
	vl *= exp(-grip * dt)
	slip = absf(vl)
	var sf := clampf(absf(vf) / 5.0, 0.0, 1.0) * (1.0 - 0.42 * clampf((absf(vf) - 10.0) / 17.0, 0.0, 1.0))
	var dirn := 1.0 if vf >= -0.2 else -1.0
	var target_yaw := steer * MAX_YAW * sf * dirn
	if handbrake:
		target_yaw *= 1.55
	yaw_rate = lerpf(yaw_rate, target_yaw, 1.0 - exp(-12.0 * dt))
	vel = f * vf + r * vl
	head = wrapf(head + (yaw_rate + spin) * dt, -PI, PI)
	spin *= exp(-5.0 * dt)
	pos += vel * dt
	_collide_world()
	speed = vel.dot(fwd())
	accel_f = lerpf(accel_f, (vf - vf0) / maxf(dt, 0.001), 1.0 - exp(-8.0 * dt))
	accel_l = lerpf(accel_l, (vl - vl0) / maxf(dt, 0.001) + yaw_rate * vf, 1.0 - exp(-8.0 * dt))
	_sync(dt)


func _collide_world() -> void:
	var f := fwd()
	for it in 2:
		for off: float in CIRCLES:
			var c := pos + f * off
			var push := city.push_out(c, R)
			if push.length_squared() < 1e-8:
				continue
			pos += push
			var n := push.normalized()
			_impulse(n, f * off, Vector2.ZERO, 1.0)


## Bounce off something along normal n (pointing at us), hit at lever arm.
func _impulse(n: Vector2, lever: Vector2, other_vel: Vector2, share: float) -> float:
	var rel := vel - other_vel
	var vn := rel.dot(n)
	if vn >= 0.0:
		return 0.0
	var j := -vn * (1.0 + RESTITUTION) * share
	vel += n * j
	var t := Vector2(-n.y, n.x)
	vel -= t * rel.dot(t) * 0.1
	spin += lever.cross(n * j) * 0.055
	if -vn > hit:
		hit = -vn
		hit_kind = 0 if other_vel == Vector2.ZERO else 1
	return -vn


func _sync(dt: float) -> void:
	position = Vector3(pos.x, 0.0, pos.y)
	var roll := clampf(-accel_l * 0.004, -0.06, 0.06)
	var pitch := clampf(accel_f * 0.0035, -0.05, 0.05)
	body.rotation = Vector3(roll, -head, pitch)
	shadow.rotation = Vector3(0, -head, 0)
	shadow.position = Vector3(0.45, 0.0, 0.38)
