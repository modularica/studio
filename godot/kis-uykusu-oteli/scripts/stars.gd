extends Node2D
## Twinkling stars above the horizon (screen space).

var area := Vector2(1600, 600):
	set(v):
		area = v
		queue_redraw()
var stars: Array = []
var t := 0.0


func _ready() -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 3
	for i in 170:
		stars.append([r.randf(), r.randf() * r.randf() * 0.95 + r.randf() * 0.05, r.randf_range(0.7, 1.9), r.randf() * TAU, r.randf_range(0.5, 2.0)])


func _process(delta: float) -> void:
	t += delta
	queue_redraw()


func _draw() -> void:
	for s in stars:
		var a: float = 0.45 + 0.45 * sin(t * s[4] + s[3])
		draw_circle(Vector2(s[0] * area.x, s[1] * area.y * 0.92), s[2], Color(1.0, 0.98, 0.9, a))
