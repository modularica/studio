shader_type spatial;
render_mode unshaded, cull_disabled;

// The whole ground is one plane: roads, sidewalks, parks, the square and
// the sea are worked out from the world position and the grid constants.
// block_tex: one texel per block (0 city, 0.5 park, 1 square).
// shadow_tex: building and tree shadows, 2 px per metre over the city.

uniform sampler2D block_tex : filter_nearest;
uniform sampler2D shadow_tex : filter_linear_mipmap;
uniform float grid_n = 8.0;
uniform float bs = 48.0;
uniform float rw = 14.0;
uniform float sw = 3.5;
uniform float ext = 510.0;
uniform float prom = 4.0;

varying vec2 wp;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 1 where |x| < w, antialiased with the given pixel footprint
float band(float x, float w, float fw) {
	fw = fw * 0.8 + 1e-4;
	return 1.0 - smoothstep(w - fw, w + fw, abs(x));
}

vec3 asphalt(vec2 p) {
	float n = vnoise(p * 0.35) * 0.06 + vnoise(p * 2.3) * 0.03;
	return vec3(0.33, 0.34, 0.36) * (0.95 + n);
}

// markings on a road stretch: across 0..rw, along = world distance,
// d = distance to the nearest intersection edge
vec3 road_marks(vec3 col, float across, float along, float d, float fwa, float fwl) {
	vec3 paint = vec3(0.90, 0.88, 0.82);
	float c = across - rw * 0.5;
	if (d > 4.6) {
		float dash = step(fract(along / 6.0), 0.55);
		col = mix(col, paint, band(c, 0.13, fwa) * dash * 0.9);
	}
	float edge = band(across - 0.75, 0.08, fwa) + band(across - (rw - 0.75), 0.08, fwa);
	col = mix(col, paint, clamp(edge, 0.0, 1.0) * 0.55 * step(4.0, d));
	// zebra crossing next to every intersection
	if (d > 0.7 && d < 3.7 && across > 0.7 && across < rw - 0.7) {
		float s = fract((across - 0.7) / 1.25);
		col = mix(col, paint, band(s - 0.3, 0.3, fwa / 1.25) * 0.95);
	}
	// stop line on the right-hand lane
	return col;
}

void fragment() {
	vec2 p = wp;
	float per = bs + rw;
	float fw = fwidth(p.x) + fwidth(p.y);
	vec3 col;
	float lo = -prom;
	float hi = ext + prom;
	if (p.x < lo - 0.6 || p.y < lo - 0.6 || p.x > hi + 0.6 || p.y > hi + 0.6) {
		// the sea
		float dw = min(min(lo - p.x, lo - p.y), min(p.x - hi, p.y - hi));
		dw = max(max(lo - p.x, lo - p.y), max(p.x - hi, p.y - hi));
		vec3 deep = vec3(0.17, 0.44, 0.56);
		vec3 shallow = vec3(0.26, 0.58, 0.67);
		col = mix(shallow, deep, smoothstep(2.0, 60.0, dw));
		float w1 = vnoise(p * 0.09 + vec2(TIME * 0.05, TIME * 0.03));
		float w2 = vnoise(p * 0.23 - vec2(TIME * 0.08, -TIME * 0.06));
		float crest = smoothstep(0.62, 0.7, w1 * 0.6 + w2 * 0.4);
		col = mix(col, vec3(0.55, 0.78, 0.84), crest * 0.35);
		// foam along the wall
		float foam = 1.0 - smoothstep(0.6, 2.6 + sin(TIME * 1.3 + (p.x + p.y) * 0.15) * 0.6, dw);
		col = mix(col, vec3(0.86, 0.94, 0.95), foam * 0.7);
	} else if (p.x < 0.0 || p.y < 0.0 || p.x > ext || p.y > ext) {
		// promenade: stone slabs
		vec2 q = p / 2.0;
		float n = hash(floor(q)) * 0.06;
		col = vec3(0.80, 0.76, 0.68) * (0.95 + n);
		vec2 f = abs(fract(q) - 0.5);
		col *= 1.0 - 0.08 * (1.0 - smoothstep(0.45, 0.48, max(f.x, f.y)) < 0.5 ? 1.0 : 0.0);
	} else {
		vec2 m = mod(p, per);
		bool rx = m.x < rw;
		bool ry = m.y < rw;
		if (rx || ry) {
			col = asphalt(p);
			if (rx && ry) {
				col *= 0.97;
			} else if (rx) {
				float ly = m.y - rw;
				col = road_marks(col, m.x, p.y, min(ly, bs - ly), fwidth(p.x), fwidth(p.y));
			} else {
				float lx = m.x - rw;
				col = road_marks(col, m.y, p.x, min(lx, bs - lx), fwidth(p.y), fwidth(p.x));
			}
		} else {
			vec2 loc = m - rw;
			ivec2 bi = ivec2(floor(p / per));
			float t = texelFetch(block_tex, bi, 0).r;
			float e = min(min(loc.x, bs - loc.x), min(loc.y, bs - loc.y));
			if (e < sw) {
				// sidewalk with paving and a bright kerb
				vec2 q = p / 1.6;
				vec2 f = abs(fract(q) - 0.5);
				float joint = 1.0 - smoothstep(0.42, 0.47, max(f.x, f.y));
				col = vec3(0.78, 0.76, 0.71) * (0.93 + 0.07 * joint) * (0.97 + hash(floor(q)) * 0.04);
				col = mix(col, vec3(0.88, 0.86, 0.81), 1.0 - smoothstep(0.32, 0.42, e));
				col = mix(col, vec3(0.45, 0.45, 0.44), band(e - 0.42, 0.05, fw));
			} else if (t < 0.25) {
				// courtyards and car parks
				vec2 q = p / 0.9;
				col = vec3(0.62, 0.61, 0.58) * (0.95 + hash(floor(q)) * 0.06);
			} else if (t < 0.75) {
				// park: grass, gravel paths and a ring around the fountain
				vec2 c = loc - vec2(bs * 0.5);
				float r = length(c);
				float g = vnoise(p * 0.25) * 0.5 + vnoise(p * 1.1) * 0.5;
				col = mix(vec3(0.49, 0.64, 0.33), vec3(0.58, 0.71, 0.37), g);
				col = mix(col, col * 0.86, 1.0 - smoothstep(sw, sw + 1.5, e));
				float path = max(band(c.x, 1.7, fw), band(c.y, 1.7, fw));
				path = max(path, band(r - 8.5, 1.2, fw));
				path = max(path, 1.0 - smoothstep(5.8, 6.0, r));
				vec3 grav = vec3(0.84, 0.78, 0.63) * (0.95 + hash(floor(p * 3.0)) * 0.08);
				col = mix(col, grav, path);
			} else {
				// the square: big stone tiles
				vec2 c = loc - vec2(bs * 0.5);
				float r = length(c);
				vec2 q = p / 2.4;
				vec2 f = abs(fract(q) - 0.5);
				float joint = 1.0 - smoothstep(0.44, 0.48, max(f.x, f.y));
				col = vec3(0.86, 0.82, 0.74) * (0.9 + 0.1 * joint) * (0.96 + hash(floor(q)) * 0.06);
				col = mix(col, vec3(0.73, 0.55, 0.45), band(r - 10.0, 0.6, fw));
				col = mix(col, vec3(0.73, 0.55, 0.45), band(r - 20.0, 0.6, fw) * step(abs(c.x), 19.0) * step(abs(c.y), 19.0));
			}
		}
		float sh = texture(shadow_tex, p / ext).r;
		col *= 1.0 - sh * 0.5;
	}
	ALBEDO = col;
}
