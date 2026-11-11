shader_type canvas_item;
// Night sky gradient; horizon is where the ground meets the sky, in screen UV.
uniform vec4 top_color : source_color = vec4(0.055, 0.08, 0.16, 1.0);
uniform vec4 mid_color : source_color = vec4(0.11, 0.17, 0.31, 1.0);
uniform vec4 low_color : source_color = vec4(0.23, 0.33, 0.47, 1.0);
uniform float horizon = 0.45;

void fragment() {
	float y = UV.y / max(horizon, 0.01);
	vec3 c = mix(top_color.rgb, mid_color.rgb, smoothstep(0.0, 0.6, y));
	c = mix(c, low_color.rgb, smoothstep(0.55, 1.0, y));
	COLOR = vec4(c, 1.0);
}
