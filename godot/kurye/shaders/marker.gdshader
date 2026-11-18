shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

// Pickup / drop-off circle on the ground.

uniform vec4 tint = vec4(0.3, 0.85, 0.45, 1.0);
uniform float glow = 0.0;

void fragment() {
	vec2 q = UV * 2.0 - 1.0;
	float r = length(q);
	float ring = smoothstep(0.80, 0.85, r) * (1.0 - smoothstep(0.95, 1.0, r));
	float fill = (1.0 - smoothstep(0.82, 0.88, r)) * 0.2;
	float a = atan(q.y, q.x);
	float dash = step(0.5, fract(a / 6.28318 * 14.0 + TIME * 0.35));
	float inner = smoothstep(0.62, 0.65, r) * (1.0 - smoothstep(0.71, 0.74, r)) * dash;
	float w = 0.5 + 0.5 * sin(TIME * 4.0);
	ALBEDO = mix(tint.rgb, vec3(1.0), glow * 0.5);
	ALPHA = clamp(ring * 0.95 + fill * (0.7 + 0.3 * w + glow) + inner * 0.75, 0.0, 1.0);
}
