shader_type spatial;
render_mode unshaded, cull_back;

// Buildings, roofs, trees and street props. Vertex colour alpha says what
// the surface is (see Geo.K_*); UV is metres on the surface, UV2 its size.

uniform vec3 sun = vec3(-0.5, 1.0, -0.42);

varying vec3 v_n;
varying vec3 v_w;

void vertex() {
	v_n = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
	v_w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float band(float x, float w, float fw) {
	fw = fw * 0.8 + 1e-4;
	return 1.0 - smoothstep(w - fw, w + fw, abs(x));
}

void fragment() {
	vec3 base = COLOR.rgb;
	float kind = COLOR.a;
	vec3 n = normalize(v_n);
	float ndl = dot(n, normalize(sun));
	vec3 col = base;
	vec2 uv = UV;
	vec2 sz = UV2;
	if (kind > 0.94) {
		// flat roof: parapet, a little shade inside it, panels
		float e = min(min(uv.x, sz.x - uv.x), min(uv.y, sz.y - uv.y));
		float fw = fwidth(uv.x) + fwidth(uv.y);
		float par = 1.0 - smoothstep(0.42 - fw, 0.42 + fw, e);
		vec2 pq = uv / 3.0;
		vec2 pf = abs(fract(pq) - 0.5);
		float seam = band(max(pf.x, pf.y) - 0.5, 0.012, fw / 3.0);
		vec3 roof = base * (0.94 + hash(floor(pq) + floor(v_w.xz * 0.05)) * 0.06) * (1.0 - seam * 0.08);
		float inner = (1.0 - smoothstep(0.42, 1.25, min(uv.x, uv.y * 1.1))) * (1.0 - par);
		roof *= 1.0 - inner * 0.18;
		vec3 parc = min(base * 1.28 + 0.06, vec3(1.0));
		col = mix(roof, parc, par);
		col *= 1.0 - band(e, 0.05, fw) * 0.25;
	} else if (kind > 0.81) {
		// shop awning: stripes
		float s = step(fract((uv.x + uv.y) / 0.9), 0.5);
		col = mix(base, vec3(0.97, 0.95, 0.9), s * 0.85);
		col *= 0.7 + 0.3 * clamp(ndl * 1.2, 0.0, 1.0);
	} else if (kind > 0.62) {
		// pitched roof: rows of tiles, ridge cap, eaves
		float rowp = uv.y / 0.42;
		float row = floor(rowp);
		float fr = fract(rowp);
		float tx = fract((uv.x + mod(row, 2.0) * 0.21) / 0.42);
		float shade = 1.0 - 0.22 * smoothstep(0.62, 1.0, fr) - 0.08 * step(0.92, tx);
		shade *= 0.96 + hash(vec2(floor((uv.x + mod(row, 2.0) * 0.21) / 0.42), row) + floor(v_w.xz)) * 0.08;
		col = base * shade * (0.58 + 0.5 * clamp(ndl, 0.0, 1.0));
		col = mix(col, base * 0.75, step(sz.y - 0.22, uv.y));
		col = mix(col, base * 0.55, 1.0 - step(0.12, uv.y));
	} else if (kind > 0.37) {
		// walls: windows on every floor, shop fronts on the ground floor
		float lit = 0.6 + 0.4 * clamp(ndl * 1.3, 0.0, 1.0);
		float y = uv.y;
		float fwx = fwidth(uv.x);
		float fwy = fwidth(uv.y);
		float nc = max(1.0, floor((sz.x - 0.6) / 2.8));
		float sp = sz.x / nc;
		float fx = (fract(uv.x / sp) - 0.5) * sp;
		float inx = band(fx, min(0.68, sp * 0.3), fwx);
		float fl = (y - 3.6) / 3.2;
		float fy = fract(fl);
		float iny = (y > 3.6 && y < sz.y - 0.9) ? band((fy - 0.5) * 3.2, 0.78, fwy) : 0.0;
		float win = inx * iny;
		float gf = (y > 0.35 && y < 2.75) ? band(fx, min(sp * 0.38, 1.25), fwx) : 0.0;
		float cell = hash(vec2(floor(uv.x / sp), floor(fl)) + floor(v_w.xz * 0.07));
		vec3 glass = mix(vec3(0.19, 0.24, 0.30), vec3(0.40, 0.48, 0.55), cell * 0.7);
		glass = mix(glass, vec3(0.92, 0.86, 0.66), step(0.93, cell) * 0.7);
		col = base * lit;
		float frame = max(band(fx, min(0.68, sp * 0.3) + 0.12, fwx) * iny, 0.0) - win;
		col = mix(col, min(base * 1.2, vec3(1.0)) * lit, clamp(frame, 0.0, 1.0) * 0.6);
		col = mix(col, glass * (0.9 + 0.1 * lit), max(win, gf));
		col = mix(col, min(base * 1.15, vec3(1.0)) * lit, step(sz.y - 0.42, y));
		col = mix(col, base * lit * 0.72, 1.0 - step(0.32, y));
		col *= 1.0 - band(y - 3.25, 0.05, fwy) * 0.15;
	} else if (kind > 0.12) {
		col = base * (0.62 + 0.4 * clamp(ndl * 1.15, 0.0, 1.0));
	} else {
		col = base * (0.9 + 0.1 * clamp(ndl, 0.0, 1.0));
	}
	ALBEDO = col;
}
