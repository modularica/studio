shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

// Soft shadow under cars and people.

uniform float strength = 0.38;

void fragment() {
	vec2 q = abs(UV * 2.0 - 1.0);
	float d = length(max(q - vec2(0.55), 0.0)) / 0.45;
	ALBEDO = vec3(0.0);
	ALPHA = strength * (1.0 - smoothstep(0.3, 1.0, d));
}
