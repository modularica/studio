shader_type canvas_item;
render_mode blend_add;
// Northern lights: three curtains with a bright lower edge and rays going up.
uniform float strength = 0.5;
uniform float horizon = 0.45;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) {
	float i = floor(x);
	float f = fract(x);
	return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, f));
}

void fragment() {
	vec2 uv = UV;
	float t = TIME * 0.05;
	vec3 acc = vec3(0.0);
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float base = horizon * (0.38 + 0.16 * fi);
		float y = base + 0.045 * sin(uv.x * 4.0 + t * 5.0 + fi * 2.1) + 0.025 * sin(uv.x * 10.0 - t * 7.0 + fi);
		float d = uv.y - y;
		float edge = exp(-pow(d * 30.0, 2.0));
		float rays = d < 0.0 ? exp(d * 8.0) * (0.35 + 0.65 * noise(uv.x * 80.0 + fi * 13.0 + t * 12.0)) : 0.0;
		float a = (edge * 0.8 + rays * 0.5) * (0.45 + 0.55 * sin(uv.x * 2.6 + t * 3.0 + fi * 1.3));
		vec3 col = mix(vec3(0.3, 0.95, 0.62), vec3(0.4, 0.78, 1.0), fi * 0.45);
		col = mix(col, vec3(0.72, 0.5, 1.0), clamp(-d * 5.0, 0.0, 1.0) * 0.55);
		acc += col * max(a, 0.0);
	}
	float fade = smoothstep(horizon * 1.0, horizon * 0.72, uv.y);
	COLOR = vec4(acc * strength * fade, 1.0);
}
