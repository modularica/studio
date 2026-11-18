shader_type spatial;
render_mode unshaded, cull_back;

// Cars, the courier van and people. Vertex colour alpha: 1 = paint
// (tinted by the paint colour), 0.5 = hair, 0 = fixed colour.
// Traffic and people are MultiMeshes: their paint comes from
// INSTANCE_CUSTOM (rgb paint, a = hair tone).

uniform vec3 sun = vec3(-0.5, 1.0, -0.42);
uniform vec4 paint = vec4(0.95, 0.55, 0.15, 0.0);
uniform float use_custom = 0.0;

varying vec3 v_n;
varying vec4 v_paint;

void vertex() {
	v_n = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
	v_paint = mix(paint, INSTANCE_CUSTOM, use_custom);
}

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

void fragment() {
	vec3 n = normalize(v_n);
	float ndl = clamp(dot(n, normalize(sun)), 0.0, 1.0);
	vec3 c = COLOR.rgb;
	float k = COLOR.a;
	vec3 hair = mix(vec3(0.16, 0.11, 0.08), vec3(0.80, 0.64, 0.38), clamp(v_paint.a * 1.6, 0.0, 1.0));
	hair = mix(hair, vec3(0.75, 0.74, 0.72), step(0.8, v_paint.a));
	vec3 base = c;
	if (k > 0.75) {
		base = c * v_paint.rgb;
	} else if (k > 0.25) {
		base = hair;
	}
	vec3 col = base * (0.58 + 0.45 * ndl);
	// a soft highlight on the roofs
	col += vec3(0.06) * smoothstep(0.85, 1.0, n.y) * step(0.75, k);
	ALBEDO = col;
}
