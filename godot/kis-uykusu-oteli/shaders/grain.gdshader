shader_type canvas_item;
render_mode blend_mul;
// A little paper grain and a soft vignette over everything.
uniform float amount = 0.07;
uniform float vignette = 0.42;

float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void fragment() {
	float n = h(floor(FRAGCOORD.xy));
	float g = 1.0 - amount + amount * n;
	vec2 uv = SCREEN_UV - 0.5;
	float v = 1.0 - dot(uv, uv) * vignette;
	COLOR = vec4(vec3(g * v), 1.0);
}
