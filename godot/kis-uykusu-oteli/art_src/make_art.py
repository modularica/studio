"""Generates the game's SVG art. Run: python3 art_src/make_art.py

Everything is drawn at 2x the size it appears in the game (sprites are
scaled by 0.5), so it stays crisp on an iPad screen. Style: a Nordic
storybook at night, flat shapes with one shade and one highlight each,
no outlines. Lighting, grain and glow are added in Godot.
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'art'
OUT.mkdir(exist_ok=True)

# ---- palette ----------------------------------------------------------------
INK = '#2b2421'
SNOW, SNOW_SH, SNOW_DEEP = '#f3f6f8', '#d3dee7', '#b7c7d6'
FALU, FALU_D, FALU_L = '#a8392b', '#7e2a20', '#bc4a3a'
TRIM, TRIM_SH = '#f1eadf', '#d8cfc2'
WOOD, WOOD_D, WOOD_L = '#8b6443', '#6e4d33', '#a77d55'
PINE, PINE_D, PINE_L = '#34544a', '#28433b', '#42665a'
WARM, WARM2 = '#ffd88f', '#f4a95a'
STONE, STONE_D, STONE_L = '#8f8a85', '#76716c', '#a9a49e'
BLANKETS = {
    'red': ('#b4473a', '#8f3328', '#f4eadb'),
    'blue': ('#4a6d8c', '#385670', '#f1ece2'),
    'mustard': ('#c99a3f', '#a77b2c', '#fbf3e2'),
    'green': ('#5f7f5c', '#4a6748', '#f1ece2'),
}


# ---- helpers ------------------------------------------------------------------
def f(v):
    return f'{v:.1f}'


def svg(name, w, h, body, defs=''):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
    if defs:
        s += f'<defs>{defs}</defs>'
    s += body + '</svg>'
    (OUT / f'{name}.svg').write_text(s)


def path(d, fill, extra=''):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def line(d, col, w, extra=''):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{f(w)}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'


def ell(cx, cy, rx, ry, fill, extra='', rot=0):
    t = f' transform="rotate({f(rot)} {f(cx)} {f(cy)})"' if rot else ''
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{t} {extra}/>'


def circ(cx, cy, r, fill, extra=''):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}" {extra}/>'


def rect(x, y, w, h, fill, rx=0, extra=''):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(rx)}" fill="{fill}" {extra}/>'


def smooth(pts, closed=True, t=1.0):
    """Catmull-Rom spline through pts as an SVG path."""
    n = len(pts)
    if n < 3:
        return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts)
    d = f'M {f(pts[0][0])} {f(pts[0][1])}'
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[0]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed or i + 2 < n else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
        d += f' C {f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}'
    return d + (' Z' if closed else '')


def blob(cx, cy, rx, ry, n=10, jit=0.08, seed=0, rot=0):
    r = random.Random(seed)
    pts = []
    for i in range(n):
        a = i / n * math.tau + rot
        k = 1 + r.uniform(-jit, jit)
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    return smooth(pts)


def radial(id_, stops, cx='50%', cy='50%', r='60%'):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'


def linear(id_, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def snow_lumps(x0, x1, y, h, seed, n=None, col=SNOW, shadow=True):
    """A row of soft snow lumps sitting on a line (for ledges, branches, roofs)."""
    r = random.Random(seed)
    n = n or max(2, int((x1 - x0) / (h * 1.6)))
    pts = [(x0, y + h * 0.15)]
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        pts.append((x, y - h * r.uniform(0.55, 1.0)))
    pts.append((x1, y + h * 0.15))
    pts += [(x1 - (x1 - x0) * i / 6, y + h * (0.32 + 0.12 * math.sin(i * 1.7 + seed))) for i in range(1, 6)]
    out = ''
    if shadow:
        out += path(smooth([(x, yy + h * 0.22) for x, yy in pts]), SNOW_SH)
    return out + path(smooth(pts), col)


# ---- trees ----------------------------------------------------------------------
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1])


def pine(name, seed, w=300, h=560, tiers=5):
    r = random.Random(seed)
    cx = w / 2
    body = rect(cx - 13, h - 110, 26, 110, '#4b382b') + rect(cx + 1, h - 110, 12, 110, '#3d2d22')
    base = h - 64
    tier_h = (h - 90) / (tiers * 0.66 + 0.75)
    for i in range(tiers):
        yb = base - i * tier_h * 0.66
        yt = yb - tier_h * 1.3
        th = yb - yt
        hw = (w * 0.49) * (1 - i / (tiers + 0.5)) ** 0.85
        A = (cx, yt)
        R1, R2, R3 = (cx + hw * 0.2, yt + th * 0.42), (cx + hw * 0.7, yb - th * 0.14), (cx + hw, yb)
        L1, L2, L3 = (cx - hw * 0.2, yt + th * 0.42), (cx - hw * 0.7, yb - th * 0.14), (cx - hw, yb)
        n = 3 + int(hw / 38)
        hem = []
        for k in range(1, n + 1):
            x_tip = cx + hw - 2 * hw * k / n
            hem.append((x_tip + hw / n, yb - r.uniform(10, 16)))
            hem.append((x_tip, yb + (r.uniform(0, 6) if k < n else 0)))
        d = f'M {f(A[0])} {f(A[1])} C {f(R1[0])} {f(R1[1])} {f(R2[0])} {f(R2[1])} {f(R3[0])} {f(R3[1])} '
        d += ' '.join(f'L {f(x)} {f(y)}' for x, y in hem)
        d += f' C {f(L2[0])} {f(L2[1])} {f(L1[0])} {f(L1[1])} {f(A[0])} {f(A[1])} Z'
        body += path(d, PINE)
        half = [pt for pt in hem if pt[0] >= cx]
        d2 = f'M {f(A[0])} {f(A[1])} C {f(R1[0])} {f(R1[1])} {f(R2[0])} {f(R2[1])} {f(R3[0])} {f(R3[1])} '
        d2 += ' '.join(f'L {f(x)} {f(y)}' for x, y in half) + f' L {f(cx + r.uniform(-4, 4))} {f(yb - th * 0.2)} Z'
        body += path(d2, PINE_D)
        # a lighter rim along the moonlit left edge
        body += line(f'M {f(A[0])} {f(A[1] + 6)} C {f(L1[0])} {f(L1[1])} {f(L2[0])} {f(L2[1])} {f(L3[0] + 4)} {f(L3[1] - 2)}', PINE_L, 5, 'opacity="0.7"')
        # snow on the upper surface, thicker towards the tips
        for side, t0, thick, col_seed in ((-1, 0.1, 22, 1), (1, 0.28, 12, 2)):
            P1, P2, P3 = ((L1, L2, L3) if side < 0 else (R1, R2, R3))
            top, under = [], []
            for j in range(9):
                t = t0 + (1 - t0) * j / 8
                x, y = bez(A, P1, P2, P3, t)
                top.append((x, y - 3))
                under.append((x - side * 3, y + 3 + thick * (0.35 + 0.65 * t) * r.uniform(0.8, 1.15)))
            pts = top + under[::-1]
            sh = [(x, y + 6) for x, y in pts]
            body += path(smooth(sh, t=0.7), SNOW_SH) + path(smooth(pts, t=0.7), SNOW)
    ytop = base - (tiers - 1) * tier_h * 0.66 - tier_h * 1.3
    body += path(blob(cx, ytop + 6, 13, 10, 8, 0.1, seed), SNOW)
    body += snow_lumps(cx - 74, cx + 74, h - 4, 18, seed + 3)
    svg(name, w, h, body)


def birch(name, seed, w=240, h=620):
    r = random.Random(seed)
    cx = w / 2
    # branches first (behind the trunk)
    body = ''
    for k in range(7):
        y = h * (0.12 + k * 0.085)
        side = -1 if k % 2 else 1
        L = w * (0.42 - k * 0.025)
        x2, y2 = cx + side * L, y - L * 0.75
        body += line(f'M {f(cx)} {f(y + 30)} Q {f(cx + side * L * 0.4)} {f(y)} {f(x2)} {f(y2)}', '#3f3632', 5 - k * 0.35)
        for j in range(3):
            t = 0.45 + j * 0.2
            bx, by = cx + side * L * t, y + 30 - (y + 30 - y2) * t
            body += line(f'M {f(bx)} {f(by)} l {f(side * r.uniform(14, 30))} {f(-r.uniform(18, 34))}', '#4a403b', 2.2)
        body += line(f'M {f(cx + side * L * 0.35)} {f(y + 6)} Q {f(cx + side * L * 0.6)} {f(y - L * 0.32)} {f(x2 - side * 6)} {f(y2 + 4)}', SNOW, 3.4, 'opacity="0.95"')
    # trunk, slightly leaning, tapering
    lean = r.uniform(-10, 10)
    left = [(cx - 19, h), (cx - 16 + lean * 0.3, h * 0.6), (cx - 9 + lean * 0.8, h * 0.18), (cx - 4 + lean, h * 0.05)]
    right = [(cx + 4 + lean, h * 0.05), (cx + 9 + lean * 0.8, h * 0.18), (cx + 16 + lean * 0.3, h * 0.6), (cx + 19, h)]
    trunk = smooth(left + right, closed=True, t=0.6)
    body += path(trunk, '#efe9de')
    body += path(smooth([(cx + 6 + lean * 0.9, h * 0.08), (cx + 12 + lean * 0.6, h * 0.35), (cx + 18, h), (cx + 6, h), (cx + 4 + lean * 0.5, h * 0.4)]), '#d6cec1')
    # bark marks
    for k in range(16):
        y = h * (0.12 + k * 0.053) + r.uniform(-8, 8)
        t = y / h
        half = 4 + 15 * t
        x0 = cx + lean * (1 - t) - half + r.uniform(0, half)
        body += path(smooth([(x0, y), (x0 + r.uniform(8, 18), y - 2), (x0 + r.uniform(10, 22), y + 3), (x0 + 2, y + 4)]), '#2f2a27', 'opacity="0.9"')
    body += path(smooth([(cx - 19, h), (cx - 17, h - 50), (cx - 6, h - 70), (cx + 10, h - 40), (cx + 19, h)]), '#3a3330', 'opacity="0.85"')
    body += snow_lumps(cx - 60, cx + 60, h - 4, 16, seed + 1)
    svg(name, w, h, body)


# ---- sky things -------------------------------------------------------------
def mountains():
    W, H = 2048, 520
    r = random.Random(4)
    def periodic(x, amps):
        return sum(a * math.sin(x / W * math.tau * k + ph) for k, a, ph in amps)
    far = [(x, 250 + periodic(x, [(2, 70, 0.4), (5, 40, 1.3), (9, 18, 2.2)])) for x in range(0, W + 1, 16)]
    # sharp peaks on the far range
    pk = []
    for i in range(0, len(far)):
        x, y = far[i]
        pk.append((x, y - (34 if i % 9 == 4 else 0)))
    d = f'M 0 {H} ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in pk) + f' L {W} {H} Z'
    body = path(d, '#2c4262')
    # snow caps on the higher bits
    for i in range(1, len(pk) - 1):
        x, y = pk[i]
        if y < 215:
            body += path(f'M {f(x - 34)} {f(y + 30)} L {f(x)} {f(y)} L {f(x + 30)} {f(y + 26)} Q {f(x + 8)} {f(y + 18)} {f(x - 6)} {f(y + 30)} Z', '#8ea4c0', 'opacity="0.8"')
    near = [(x, 380 + periodic(x, [(3, 30, 2.0), (7, 14, 0.2)])) for x in range(0, W + 1, 16)]
    body += path(f'M 0 {H} ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in near) + f' L {W} {H} Z', '#30496b')
    # a fringe of little pines on the near hills
    for k in range(120):
        x = (k * 17.07 + r.uniform(0, 12)) % W
        y = 380 + periodic(x, [(3, 30, 2.0), (7, 14, 0.2)]) + 6
        hh = r.uniform(18, 40)
        body += path(f'M {f(x - hh * 0.28)} {f(y)} L {f(x)} {f(y - hh)} L {f(x + hh * 0.28)} {f(y)} Z', '#253c59')
    svg('mountains', W, H, body)


def moon():
    W = 220
    defs = radial('glow', [(0, '#f6efd6', 0.35), (0.5, '#f6efd6', 0.08), (1, '#f6efd6', 0)])
    body = circ(110, 110, 108, 'url(#glow)') + circ(110, 110, 46, '#f4ecd2')
    body += circ(94, 98, 8, '#e3d8b8') + circ(124, 126, 6, '#e3d8b8') + circ(124, 92, 4, '#e3d8b8')
    svg('moon', W, W, body, defs)


# ---- the ground and the soil --------------------------------------------------------
def soil():
    W, H = 2048, 1800
    r = random.Random(11)
    def wave(x, base, amps):
        return base + sum(a * math.sin(x / W * math.tau * k + ph) for k, a, ph in amps)
    bands = [('#9c7d60', 90), ('#8e7158', 470), ('#80654f', 870), ('#725a46', 1270), ('#654f3e', 1640)]
    body = rect(0, 0, W, H, '#5d4838')
    for i, (col, base) in enumerate(bands):
        amps = [(3 + i, 14, i * 0.9), (8 + i, 6, i * 1.7)]
        pts = [(x, wave(x, base, amps)) for x in range(0, W + 1, 16)]
        body += path(f'M 0 {H} ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in pts) + f' L {W} {H} Z', col) if i == 0 else ''
    # draw bands top to bottom so each lower band covers the one above
    body = rect(0, 0, W, H, bands[0][0])
    for i, (col, base) in enumerate(bands[1:], start=1):
        amps = [(3 + i, 16, i * 0.9), (8 + i, 7, i * 1.7)]
        pts = [(x, wave(x, base, amps)) for x in range(0, W + 1, 16)]
        body += path(f'M 0 {H} ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in pts) + f' L {W} {H} Z', col)
        # a thin darker line where the layers meet
        body += line('M ' + ' L '.join(f'{f(x)} {f(y + 3)}' for x, y in pts), '#000000', 3, 'opacity="0.06"')
    # hatching for a hand-drawn texture
    for k in range(900):
        x, y = r.uniform(20, W - 20), r.uniform(120, H - 10)
        l = r.uniform(6, 14)
        body += line(f'M {f(x)} {f(y)} l {f(l * 0.7)} {f(-l * 0.5)}', '#3b2a1e', 2, 'opacity="0.10"')
    # pebbles with a highlight
    for k in range(120):
        x, y = r.uniform(30, W - 30), r.uniform(130, H - 20)
        rx = r.uniform(6, 16) * (1 + y / H * 0.6)
        col = r.choice(['#9a866f', '#8a7662', '#6e5b4a', '#7d6957'])
        body += path(blob(x, y, rx, rx * 0.68, 8, 0.12, k), col, 'opacity="0.8"')
        body += ell(x - rx * 0.3, y - rx * 0.25, rx * 0.35, rx * 0.2, '#ffffff', 'opacity="0.1"')
    # roots from the top
    for k in range(14):
        x = 70 + k * 141 + r.uniform(-30, 30)
        pts = [(x, 60)]
        for j in range(5):
            x += r.uniform(-26, 26)
            pts.append((x, 60 + (j + 1) * r.uniform(28, 44)))
        body += line(smooth(pts, closed=False), '#5f4330', r.uniform(5, 8), 'opacity="0.55"')
        for j in range(2, 5):
            bx, by = pts[j]
            body += line(f'M {f(bx)} {f(by)} q {f(r.uniform(-30, 30))} {f(r.uniform(10, 26))} {f(r.uniform(-40, 40))} {f(r.uniform(30, 50))}', '#5f4330', 3, 'opacity="0.45"')
    # frozen top: a dark crust then the snow
    crust = [(x, 92 + 4 * math.sin(x / W * math.tau * 11)) for x in range(0, W + 1, 16)]
    body += path('M 0 0 ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in crust) + f' L {W} 0 Z', '#5a4636')
    snow = [(x, 62 + 10 * math.sin(x / W * math.tau * 13) + 6 * math.sin(x / W * math.tau * 29 + 1)) for x in range(0, W + 1, 8)]
    body += path('M 0 0 ' + ' '.join(f'L {f(x)} {f(y + 14)}' for x, y in snow) + f' L {W} 0 Z', SNOW_DEEP)
    body += path('M 0 0 ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in snow) + f' L {W} 0 Z', SNOW_SH)
    top = [(x, 34 + 9 * math.sin(x / W * math.tau * 13) + 5 * math.sin(x / W * math.tau * 29 + 1)) for x in range(0, W + 1, 8)]
    body += path('M 0 -10 ' + ' '.join(f'L {f(x)} {f(y)}' for x, y in top) + f' L {W} -10 Z', SNOW)
    svg('soil', W, H, body)


# ---- the cabin -------------------------------------------------------------------
def cabin():
    W, H = 780, 820
    defs = linear('glass', [(0, WARM, 1), (1, WARM2, 1)])
    defs += radial('inner', [(0, '#fff0c6', 1), (0.7, '#ffcf7e', 1), (1, '#f0a65a', 1)], cy='70%')
    body = ''
    wall_l, wall_r, wall_t, wall_b = 110, 670, 372, 712
    apex = (390, 168)
    # chimney behind the roof
    body += rect(548, 150, 70, 170, '#7d6f67') + rect(548, 150, 22, 170, '#8d7f76')
    for k in range(6):
        y = 160 + k * 26
        body += line(f'M 548 {y} L 618 {y}', '#5f534c', 3, 'opacity="0.6"')
        body += line(f'M {566 + (k % 2) * 26} {y} L {566 + (k % 2) * 26} {y + 26}', '#5f534c', 3, 'opacity="0.6"')
    body += snow_lumps(536, 630, 152, 22, 5)
    # gable wall
    gable = f'M {wall_l} {wall_t} L {apex[0]} {apex[1] + 30} L {wall_r} {wall_t} Z'
    body += path(gable, FALU)
    # walls
    body += rect(wall_l, wall_t - 2, wall_r - wall_l, wall_b - wall_t + 2, FALU)
    # board and batten
    for x in range(wall_l + 30, wall_r, 46):
        top = wall_t - (x - wall_l) * (apex[1] + 30 - wall_t) / (apex[0] - wall_l) if x <= apex[0] else wall_t - (wall_r - x) * (apex[1] + 30 - wall_t) / (wall_r - apex[0])
        body += rect(x, top, 10, wall_b - top, FALU_L) + rect(x + 10, top, 3, wall_b - top, FALU_D, extra='opacity="0.6"')
    # shade under the eaves
    body += path(f'M {wall_l} {wall_t} L {apex[0]} {apex[1] + 30} L {wall_r} {wall_t} L {wall_r} {wall_t + 26} L {apex[0]} {apex[1] + 58} L {wall_l} {wall_t + 26} Z', '#000000', 'opacity="0.16"')
    # corner boards
    body += rect(wall_l - 6, wall_t - 6, 26, wall_b - wall_t + 6, TRIM) + rect(wall_r - 20, wall_t - 6, 26, wall_b - wall_t + 6, TRIM)
    body += rect(wall_r - 8, wall_t - 6, 14, wall_b - wall_t + 6, TRIM_SH)
    # round gable window
    body += circ(apex[0], 290, 38, TRIM) + circ(apex[0], 290, 28, 'url(#inner)')
    body += line(f'M {apex[0] - 28} 290 L {apex[0] + 28} 290 M {apex[0]} 262 L {apex[0]} 318', TRIM, 6)
    # big window with the stove inside
    wx, wy, ww, wh = 168, 440, 196, 168
    body += rect(wx - 16, wy - 16, ww + 32, wh + 32, TRIM, 4)
    body += rect(wx, wy, ww, wh, 'url(#inner)')
    # stove
    body += rect(wx + 64, wy + 58, 70, 104, '#2c2826', 8) + rect(wx + 90, wy, 18, 60, '#2c2826')
    body += rect(wx + 76, wy + 90, 46, 40, '#4b2617', 6) + path(f'M {wx + 82} {wy + 128} Q {wx + 92} {wy + 96} {wx + 99} {wy + 128} Z', '#ffb347') + path(f'M {wx + 96} {wy + 128} Q {wx + 106} {wy + 92} {wx + 116} {wy + 128} Z', '#ff8a3d')
    body += rect(wx + 58, wy + 160, 82, 8, '#2c2826', 3)
    # a pot plant and the kettle silhouette
    body += rect(wx + 150, wy + 132, 30, 30, '#b06a45', 4) + ell(wx + 165, wy + 126, 20, 14, '#5d7a4f')
    body += path(f'M {wx + 74} {wy + 58} q 8 -18 22 -18 q 14 0 18 18 Z', '#3a3532')
    # curtains
    body += path(f'M {wx} {wy} L {wx + 34} {wy} Q {wx + 22} {wy + 70} {wx + 40} {wy + wh} L {wx} {wy + wh} Z', '#e9d9c6', 'opacity="0.92"')
    body += path(f'M {wx + ww} {wy} L {wx + ww - 34} {wy} Q {wx + ww - 22} {wy + 70} {wx + ww - 40} {wy + wh} L {wx + ww} {wy + wh} Z', '#e9d9c6', 'opacity="0.92"')
    # mullions
    body += rect(wx + ww / 2 - 4, wy, 8, wh, TRIM) + rect(wx, wy + 58, ww, 8, TRIM)
    # sill with snow
    body += rect(wx - 26, wy + wh + 14, ww + 52, 16, TRIM_SH, 3)
    body += snow_lumps(wx - 28, wx + ww + 28, wy + wh + 16, 16, 8)
    # door with a small window
    dx, dy, dw, dh = 440, 474, 126, 238
    body += rect(dx - 12, dy - 12, dw + 24, dh + 12, TRIM, 6)
    body += rect(dx, dy, dw, dh, FALU_D, 4)
    for k in range(1, 4):
        body += line(f'M {dx + k * dw / 4} {dy + 8} L {dx + k * dw / 4} {dy + dh}', '#5f1f17', 3, 'opacity="0.6"')
    body += rect(dx + 28, dy + 22, 70, 52, TRIM, 26) + rect(dx + 36, dy + 30, 54, 38, 'url(#glass)', 19)
    body += circ(dx + dw - 22, dy + 128, 7, '#d6a945')
    # heart cut-out (Nordic)
    body += path(f'M {dx + 63} {dy + 186} c -14 -10 -20 -18 -20 -26 c 0 -8 6 -12 12 -12 c 4 0 7 3 8 6 c 1 -3 4 -6 8 -6 c 6 0 12 4 12 12 c 0 8 -6 16 -20 26 Z', '#5f1f17')
    # lantern by the door
    lx, ly = 600, 470
    body += line(f'M {lx - 26} {ly - 40} L {lx + 6} {ly - 40} L {lx + 6} {ly - 26}', '#2f2a27', 6)
    body += path(f'M {lx - 10} {ly - 26} L {lx + 22} {ly - 26} L {lx + 16} {ly - 14} L {lx - 4} {ly - 14} Z', '#2f2a27')
    body += rect(lx - 4, ly - 14, 20, 34, 'url(#glass)', 3) + rect(lx - 7, ly + 20, 26, 7, '#2f2a27', 2)
    # stone foundation
    r = random.Random(3)
    x = wall_l - 20
    while x < wall_r + 10:
        w = r.uniform(40, 70)
        body += path(blob(x + w / 2, 728, w / 2, 20, 8, 0.1, int(x)), r.choice([STONE, STONE_D, STONE_L]))
        x += w * 0.92
    # step and snow drifts
    body += rect(dx - 22, 708, dw + 44, 24, STONE_L, 6)
    body += snow_lumps(dx - 30, dx + dw + 30, 712, 18, 14)
    body += snow_lumps(wall_l - 40, dx - 20, 738, 30, 21)
    body += snow_lumps(dx + dw + 20, wall_r + 50, 740, 28, 22)
    # roof: dark edge, white fascia, then thick snow with icicles
    ov = 70
    L, R = (wall_l - ov, wall_t + 34), (wall_r + ov, wall_t + 34)
    body += path(f'M {f(L[0])} {f(L[1])} L {apex[0]} {apex[1] - 6} L {f(R[0])} {f(R[1])} L {f(R[0])} {f(R[1] + 22)} L {apex[0]} {apex[1] + 20} L {f(L[0])} {f(L[1] + 22)} Z', '#3a312d')
    body += path(f'M {f(L[0])} {f(L[1] + 14)} L {apex[0]} {apex[1] + 12} L {f(R[0])} {f(R[1] + 14)} L {f(R[0])} {f(R[1] + 28)} L {apex[0]} {apex[1] + 28} L {f(L[0])} {f(L[1] + 28)} Z', TRIM)
    # snow blanket on the roof: soft, thick, drooping over the edge
    sp = [(L[0] - 16, L[1] + 18)]
    for k in range(1, 9):
        t = k / 9
        sp.append((L[0] + (apex[0] - L[0]) * t, L[1] + (apex[1] - L[1]) * t - 30 - 6 * math.sin(k * 1.9)))
    sp.append((apex[0], apex[1] - 44))
    for k in range(1, 9):
        t = k / 9
        sp.append((apex[0] + (R[0] - apex[0]) * t, apex[1] + (R[1] - apex[1]) * t - 30 - 6 * math.sin(k * 2.3)))
    sp.append((R[0] + 16, R[1] + 18))
    # underside bumps
    under = []
    for k in range(9, -1, -1):
        t = k / 9
        under.append((apex[0] + (R[0] - apex[0]) * t, apex[1] + (R[1] - apex[1]) * t + 6 + 10 * (k % 2)))
    for k in range(9, -1, -1):
        t = k / 9
        under.append((L[0] + (apex[0] - L[0]) * (1 - t), L[1] + (apex[1] - L[1]) * (1 - t) + 6 + 10 * (k % 2)))
    roof_snow = smooth(sp + under, t=0.8)
    body += path(roof_snow, SNOW_SH, 'transform="translate(0 8)"')
    body += path(roof_snow, SNOW)
    # icicles
    for k in range(18):
        t = (k + 0.5) / 18
        if t < 0.5:
            x = L[0] + (apex[0] - L[0]) * (t * 2)
            y = L[1] + (apex[1] - L[1]) * (t * 2) + 28
        else:
            x = apex[0] + (R[0] - apex[0]) * ((t - 0.5) * 2)
            y = apex[1] + (R[1] - apex[1]) * ((t - 0.5) * 2) + 28
        if k % 3 == 1:
            continue
        hh = 14 + (k * 7) % 20
        body += path(f'M {f(x - 5)} {f(y)} L {f(x)} {f(y + hh)} L {f(x + 5)} {f(y)} Z', '#dbe7f1')
    # a little sign with a moon and stars
    sx = 447
    body += rect(sx, 404, 112, 46, WOOD, 8) + rect(sx + 6, 410, 100, 34, WOOD_L, 6)
    body += circ(sx + 40, 427, 12, '#f2d27a') + circ(sx + 46, 423, 10, WOOD_L)
    body += path(f'M {sx + 70} 417 l 3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z', '#f2d27a')
    body += circ(sx + 92, 432, 3, '#f2d27a')
    svg('cabin', W, H, body, defs)


def woodpile():
    W, H = 260, 170
    body = rect(10, 30, 240, 128, '#5c4433', 6)
    r = random.Random(9)
    for row in range(3):
        for k in range(5 - (row % 2)):
            x = 38 + k * 46 + (row % 2) * 23
            y = 140 - row * 40
            rr = r.uniform(19, 22)
            body += circ(x, y, rr, '#8c6440') + circ(x, y, rr * 0.74, '#d6b385') + circ(x, y, rr * 0.45, '#c79f70') + circ(x, y, rr * 0.16, '#a87d52')
    body += snow_lumps(4, 256, 32, 22, 4)
    svg('woodpile', W, H, body)


def fence():
    """A Scandinavian roundpole fence (gärdsgård) with snow."""
    W, H = 520, 220
    body = ''
    for k in range(6):
        x = 30 + k * 90
        body += line(f'M {x} 200 L {x + 4} 60', '#5c4433', 9) + line(f'M {x + 18} 200 L {x + 20} 66', '#6b4f3a', 8)
        body += snow_lumps(x - 6, x + 28, 64, 10, k)
    for k in range(10):
        x = 6 + k * 52
        body += line(f'M {x} 196 L {x + 110} 92', '#8b6443', 9) + line(f'M {x + 4} 192 L {x + 112} 90', '#a77d55', 3, 'opacity="0.7"')
        body += line(f'M {x + 40} 156 L {x + 98} 106', SNOW, 5, 'opacity="0.9"')
    body += snow_lumps(0, W, 214, 26, 7)
    svg('fence', W, H, body)


# ---- rooms ------------------------------------------------------------------------
RW, RH = 560, 360
CAVITY = f'M 16 346 L 16 150 C 16 62 110 14 280 14 C 450 14 544 62 544 150 L 544 346 Z'


def room_base(kind, inside=''):
    defs = radial('wall', [(0, '#f0d6ac', 1), (0.65, '#ddb98b', 1), (1, '#c39c72', 1)], cy='45%', r='65%')
    defs += linear('top', [(0, '#000000', 0.32), (1, '#000000', 0)])
    defs += f'<clipPath id="cav"><path d="{CAVITY}"/></clipPath>'
    defs += linear('glass', [(0, WARM, 1), (1, WARM2, 1)])
    body = '<g clip-path="url(#cav)">'
    if kind == 'empty':
        body += rect(0, 0, RW, RH, '#a98a6c')
        body += rect(0, 300, RW, 60, '#94775b')
        for k in range(30):
            r = random.Random(k)
            body += ell(r.uniform(30, 530), r.uniform(60, 320), r.uniform(4, 10), r.uniform(3, 6), '#7a6048', 'opacity="0.5"')
    else:
        body += rect(0, 0, RW, RH, 'url(#wall)')
        # wooden wainscot
        body += rect(0, 224, RW, 100, '#c49a6b')
        for x in range(10, RW, 28):
            body += line(f'M {x} 226 L {x} 322', '#a97f54', 3, 'opacity="0.8"')
        body += rect(0, 218, RW, 12, '#dcb582')
        # floor planks
        body += rect(0, 318, RW, 50, '#a87b51')
        for k, x in enumerate(range(-20, RW, 96)):
            body += line(f'M {x + (k % 2) * 40} 320 L {x + (k % 2) * 40} 346', '#8b623d', 3)
        body += line('M 0 331 L 560 331', '#8b623d', 2, 'opacity="0.6"')
    body += inside
    # depth: darker towards the arch top
    body += rect(0, 0, RW, 120, 'url(#top)')
    body += '</g>'
    # soil rim around the hole
    body += path(CAVITY, 'none', 'stroke="#4e3a2b" stroke-width="18" opacity="0.9"')
    body += path(CAVITY, 'none', 'stroke="#2e2219" stroke-width="5" opacity="0.5" transform="translate(0 4)"')
    # a couple of roots poking in
    body += line('M 150 10 q 6 26 -4 46 q -6 12 2 24', '#5f4330', 6)
    body += line('M 408 12 q -4 20 6 34', '#5f4330', 5)
    return defs, body


def lantern(x, y):
    s = line(f'M {x} 14 L {x} {y - 26}', '#2f2a27', 3)
    s += path(f'M {x - 16} {y - 26} L {x + 16} {y - 26} L {x + 11} {y - 14} L {x - 11} {y - 14} Z', '#2f2a27')
    s += rect(x - 10, y - 14, 20, 30, 'url(#glass)', 3) + rect(x - 13, y + 16, 26, 6, '#2f2a27', 2)
    return s


def frame(x, y):
    s = rect(x - 4, y - 4, 86, 66, '#7d5e42', 3) + rect(x, y, 78, 58, '#bcd2dc')
    s += path(f'M {x} {y + 58} L {x + 26} {y + 22} L {x + 42} {y + 42} L {x + 56} {y + 28} L {x + 78} {y + 58} Z', '#6f8f7d')
    s += path(f'M {x + 22} {y + 28} L {x + 26} {y + 22} L {x + 31} {y + 29} Z', '#f3f6f8') + circ(x + 62, y + 14, 6, '#f2d27a')
    return s


def rooms():
    # leaf nest (fındık faresi, kirpi)
    defs, body = room_base('leaf')
    body += lantern(112, 104) + frame(392, 92)
    r = random.Random(5)
    cols = ['#c98a3c', '#b35a32', '#8f8d4a', '#a8743c', '#d4a24c']
    for k in range(70):
        a = r.uniform(math.pi * 1.05, math.pi * 1.95)
        rr = r.uniform(0.3, 1.0)
        x = 280 + math.cos(a) * 170 * rr
        y = 336 + math.sin(a) * 42 * rr
        body += ell(x, y, r.uniform(14, 22), r.uniform(6, 9), r.choice(cols), rot=r.uniform(-50, 50))
    body += ell(280, 338, 176, 16, '#8f6a3d')
    svg('room_leaf', RW, RH, body, defs)

    # cave (ayı): stones on the walls, a fur rug
    r = random.Random(8)
    stones = ''
    for side in (0, 1):
        for k in range(9):
            y = 110 + k * 26 + r.uniform(-6, 6)
            x = (40 + r.uniform(-10, 20) + (k % 2) * 16) if side == 0 else (520 - r.uniform(-10, 20) - (k % 2) * 16)
            rx = r.uniform(24, 36)
            stones += path(blob(x, y, rx, rx * 0.66, 8, 0.12, k + side * 20), r.choice([STONE, STONE_L, STONE_D]))
            stones += ell(x - rx * 0.25, y - rx * 0.2, rx * 0.35, rx * 0.15, '#ffffff', 'opacity="0.18"')
    defs, body = room_base('cave', stones)
    body += lantern(280, 92)
    rug = []
    for k in range(40):
        a = k / 40 * math.tau
        rr = 1 + (0.08 if k % 2 else -0.04)
        rug.append((280 + math.cos(a) * 200 * rr, 334 + math.sin(a) * 26 * rr))
    body += path('M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in rug) + ' Z', '#efe2c9')
    body += ell(280, 332, 170, 16, '#f7eedb')
    svg('room_cave', RW, RH, body, defs)

    # straw bed (porsuk) - used later
    defs, body = room_base('straw')
    body += lantern(448, 100) + frame(70, 96)
    body += ell(280, 334, 190, 26, '#d8b35a')
    r = random.Random(12)
    for k in range(60):
        x = 280 + r.uniform(-180, 180)
        y = 330 + r.uniform(-16, 10)
        body += line(f'M {f(x)} {f(y)} l {f(r.uniform(-16, 16))} {f(r.uniform(-14, -4))}', '#b8923f', 3)
    svg('room_straw', RW, RH, body, defs)

    defs, body = room_base('empty')
    svg('room_empty', RW, RH, body, defs)


def tunnels():
    # a short horizontal passage between rooms, and a shaft with a ladder
    W, H = 120, 130
    body = path(smooth([(0, 10), (60, 4), (120, 10), (120, 126), (0, 126)], t=0.4), '#8f704f') + rect(0, 104, W, 26, '#7c5f42')
    svg('tunnel_h', W, H, body)
    W, H = 100, 240
    body = rect(10, 0, 80, H, '#8f704f') + line('M 30 0 L 30 240 M 70 0 L 70 240', '#5c4433', 7)
    for y in range(20, H, 34):
        body += line(f'M 30 {y} L 70 {y}', '#7a5a40', 6)
    svg('shaft', W, H, body)


# ---- animals ---------------------------------------------------------------------
def closed_eye(x, y, s=1.0, w=5):
    return line(f'M {f(x - 11 * s)} {f(y - 2 * s)} Q {f(x)} {f(y + 8 * s)} {f(x + 11 * s)} {f(y - 2 * s)}', INK, w)


def cheek(x, y, s=1.0):
    return ell(x, y, 13 * s, 8 * s, '#e0897a', 'opacity="0.45"')


def bear():
    W, H = 440, 280
    fur, fur_d, fur_l = '#7d5236', '#5f3c27', '#94654a'
    body = ell(220, 266, 200, 12, '#000000', 'opacity="0.18"')
    # back leg and rump
    body += path(smooth([(70, 262), (66, 200), (100, 132), (170, 98), (250, 82), (330, 98), (392, 140), (414, 206), (410, 262)]), fur)
    body += path(smooth([(170, 104), (250, 88), (330, 104), (372, 130), (320, 118), (250, 106), (190, 118)]), fur_l, 'opacity="0.8"')
    body += path(smooth([(90, 262), (120, 236), (230, 230), (340, 236), (410, 248), (410, 262)]), fur_d, 'opacity="0.7"')
    body += ell(372, 248, 44, 20, fur_d) + ell(394, 252, 18, 12, '#b9946f')
    # head resting on the paws
    hx, hy = 128, 168
    body += circ(hx - 46, hy - 60, 24, fur_d) + circ(hx - 46, hy - 60, 12, '#b07f63')
    body += circ(hx + 26, hy - 70, 24, fur_d) + circ(hx + 26, hy - 70, 12, '#b07f63')
    body += path(blob(hx, hy, 74, 64, 12, 0.04, 2), fur)
    body += path(smooth([(hx - 30, hy - 50), (hx + 10, hy - 62), (hx + 50, hy - 40), (hx + 20, hy - 46), (hx - 10, hy - 44)]), fur_l, 'opacity="0.8"')
    body += ell(hx - 40, hy + 26, 44, 30, '#c9a07a') + ell(hx - 30, hy + 18, 30, 16, '#d8b38e')
    body += path(blob(hx - 74, hy + 12, 17, 12, 8, 0.05, 3), '#2b2220') + ell(hx - 78, hy + 7, 5, 3, '#ffffff', 'opacity="0.5"')
    body += line(f'M {hx - 66} {hy + 34} q 10 8 22 2', INK, 4)
    body += closed_eye(hx - 12, hy - 8, 1.0) + closed_eye(hx + 30, hy - 12, 1.0)
    body += cheek(hx + 12, hy + 18)
    # paws in front
    body += ell(hx - 52, hy + 84, 40, 17, fur_d) + ell(hx + 22, hy + 88, 38, 16, fur)
    for k in range(3):
        body += line(f'M {hx - 78 + k * 13} {hy + 82} l -2 10', '#3f281a', 3)
    svg('bear', W, H, body)


def hedgehog():
    W, H = 320, 220
    body = ell(170, 210, 130, 9, '#000000', 'opacity="0.18"')
    r = random.Random(2)
    cx, cy = 182, 140
    # spines: outer dark, inner lighter, tips
    pts = []
    n = 34
    for i in range(n + 1):
        a = math.pi + i / n * math.pi
        rr = 1.18 if i % 2 else 0.98
        pts.append((cx + math.cos(a) * 124 * rr, cy + math.sin(a) * 100 * rr))
    pts += [(cx + 130, 206), (cx - 90, 206)]
    body += path('M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z', '#5b4839')
    body += path(blob(cx + 6, cy + 14, 112, 84, 14, 0.03, 4), '#7a6350')
    for k in range(60):
        a = r.uniform(math.pi * 1.05, math.pi * 1.95)
        rr = r.uniform(0.35, 0.95)
        x, y = cx + math.cos(a) * 112 * rr, cy + 10 + math.sin(a) * 84 * rr
        l = r.uniform(16, 28)
        body += line(f'M {f(x)} {f(y)} l {f(math.cos(a + 0.5) * l)} {f(math.sin(a + 0.5) * l)}', '#4a3a2e', 4)
        if k % 3 == 0:
            body += circ(x + math.cos(a + 0.5) * l, y + math.sin(a + 0.5) * l, 2, '#cbb894', 'opacity="0.7"')
    # face
    body += path(smooth([(118, 96), (84, 120), (40, 156), (30, 172), (54, 190), (110, 200), (150, 168), (152, 120)]), '#ead7b9')
    body += path(smooth([(60, 186), (100, 198), (142, 180), (110, 192)]), '#d8c09d')
    body += circ(32, 166, 10, '#2b2220') + ell(29, 162, 3, 2, '#ffffff', 'opacity="0.6"')
    body += circ(126, 110, 14, '#cfb48f') + circ(126, 110, 7, '#e0a596')
    body += closed_eye(96, 140, 0.8, 4.5)
    body += cheek(100, 166, 0.8)
    body += ell(78, 204, 14, 7, '#c9ad88') + ell(150, 206, 14, 7, '#c9ad88')
    svg('hedgehog', W, H, body)


def dormouse():
    W, H = 260, 220
    gold, gold_d, gold_l, belly = '#d39a55', '#b97c3a', '#e3b06e', '#f2dfba'
    body = ell(134, 208, 100, 9, '#000000', 'opacity="0.18"')
    cx, cy, R = 140, 128, 76
    # tail behind, then body, then tail in front
    body += line(f'M {cx + 60} {cy + 40} C {cx + 110} {cy - 10} {cx + 70} {cy - 96} {cx} {cy - 86}', gold_d, 40)
    body += circ(cx, cy, R, gold)
    body += path(smooth([(cx - 30, cy - 66), (cx + 30, cy - 70), (cx + 66, cy - 30), (cx + 40, cy - 46), (cx, cy - 56)]), gold_l, 'opacity="0.9"')
    body += ell(cx - 26, cy + 34, 46, 34, belly)
    body += line(f'M {cx + 64} {cy + 46} C {cx + 30} {cy + 82} {cx - 40} {cy + 84} {cx - 70} {cy + 54}', '#c7843e', 38)
    body += line(f'M {cx + 56} {cy + 44} C {cx + 24} {cy + 74} {cx - 34} {cy + 76} {cx - 62} {cy + 52}', '#d9a05a', 12, 'opacity="0.7"')
    # head features on the left of the ball
    body += circ(cx - 46, cy - 62, 20, gold_d) + circ(cx - 46, cy - 62, 11, '#e9b0a4')
    body += circ(cx + 2, cy - 72, 17, gold_d) + circ(cx + 2, cy - 72, 9, '#e9b0a4')
    body += closed_eye(cx - 40, cy - 14, 0.85, 4.5)
    body += circ(cx - 84, cy + 2, 7, '#d77f79')
    for k in range(3):
        body += line(f'M {cx - 84} {cy + 4 + k * 5} l -26 {-6 + k * 7}', '#7a5a3a', 1.6, 'opacity="0.7"')
    body += cheek(cx - 50, cy + 8, 0.8)
    svg('dormouse', W, H, body)


def blanket(name, W, H, cx, base, rx, ry, colors, seed):
    c1, c2, c3 = colors
    r = random.Random(seed)
    # main dome, a soft hem at the floor
    pts = [(cx - rx, base)]
    for k in range(1, 12):
        a = math.pi + k / 12 * math.pi
        wob = 1 + 0.025 * math.sin(k * 2.1 + seed)
        pts.append((cx + math.cos(a) * rx * wob, base + math.sin(a) * ry * wob))
    pts.append((cx + rx, base))
    for k in range(1, 6):
        pts.append((cx + rx - 2 * rx * k / 6, base + 6 + 4 * (k % 2)))
    d = smooth(pts, t=0.9)
    body = path(d, c1)
    # shade on the right side, folds
    body += path(smooth([(cx + rx * 0.35, base - ry * 0.92), (cx + rx * 0.85, base - ry * 0.55), (cx + rx, base), (cx + rx * 0.6, base + 6), (cx + rx * 0.55, base - ry * 0.4)]), c2, 'opacity="0.8"')
    body += line(f'M {f(cx - rx * 0.2)} {f(base - ry * 0.75)} q {f(rx * 0.1)} {f(ry * 0.4)} {f(rx * 0.02)} {f(ry * 0.72)}', c2, 4, 'opacity="0.7"')
    body += line(f'M {f(cx + rx * 0.35)} {f(base - ry * 0.7)} q {f(rx * 0.08)} {f(ry * 0.35)} {f(-rx * 0.02)} {f(ry * 0.66)}', c2, 4, 'opacity="0.6"')
    # folded top edge
    edge = [(cx + math.cos(math.pi + k / 10 * math.pi) * rx * 0.86, base + math.sin(math.pi + k / 10 * math.pi) * ry * 0.84) for k in range(2, 9)]
    body += line(smooth(edge, closed=False), c3, max(5, ry * 0.07), 'opacity="0.95"')
    # a row of Nordic stars (eight-pointed rose simplified to diamonds) and a zigzag band
    for k in range(7):
        a = math.pi * (1.22 + 0.56 * k / 6)
        x, y = cx + math.cos(a) * rx * 0.6, base + math.sin(a) * ry * 0.52
        s = max(5, ry * 0.075)
        body += path(f'M {f(x)} {f(y - s)} L {f(x + s)} {f(y)} L {f(x)} {f(y + s)} L {f(x - s)} {f(y)} Z', c3)
        body += circ(x, y, s * 0.3, c1)
    zz = []
    n = int(rx / 9)
    for k in range(n + 1):
        x = cx - rx * 0.86 + 1.72 * rx * k / n
        zz.append((x, base - ry * 0.16 - (6 if k % 2 else 0)))
    body += line('M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in zz), c3, 3.5)
    svg(name, W, H, body)


def blankets():
    # one file per animal and colour: blanket_<animal>_<colour>
    shapes = {
        'bear': (440, 280, 300, 262, 132, 158, 1),
        'hedgehog': (320, 220, 206, 206, 98, 96, 2),
        'dormouse': (260, 220, 160, 206, 78, 104, 3),
    }
    for animal, (W, H, cx, base, rx, ry, seed) in shapes.items():
        for colour, cols in BLANKETS.items():
            blanket(f'blanket_{animal}_{colour}', W, H, cx, base, rx, ry, cols, seed)
    for name, cols in BLANKETS.items():
        c1, c2, c3 = cols
        body = path(smooth([(10, 52), (30, 26), (110, 20), (150, 30), (160, 52)]), c1) + path(smooth([(20, 34), (90, 28), (150, 34), (100, 40)]), c3, 'opacity="0.9"')
        body += line('M 30 46 L 140 46', c2, 4, 'opacity="0.7"')
        svg(f'blanket_folded_{name}', 170, 60, body)


# ---- small things -----------------------------------------------------------------
def nut_on_leaf():
    W, H = 110, 130
    body = path(smooth([(8, 34), (40, 14), (90, 18), (104, 30), (70, 42), (30, 44)]), '#a9bf86')
    body += line('M 14 34 Q 56 26 100 28', '#7d9561', 3)
    body += line('M 55 36 L 55 58', '#6e5038', 3)
    body += ell(55, 94, 30, 28, '#a86f3a') + path('M 24 82 A 31 20 0 0 1 86 82 Z', '#7c5030')
    body += ell(44, 98, 6, 10, '#ffffff', 'opacity="0.25"')
    svg('nut_leaf', W, H, body)


def snowflake():
    W = 32
    defs = radial('g', [(0, '#ffffff', 1), (0.55, '#ffffff', 0.85), (1, '#ffffff', 0)])
    svg('flake', W, W, circ(16, 16, 15, 'url(#g)'), defs)


def soft_light():
    W = 256
    defs = radial('g', [(0, '#ffffff', 1), (0.35, '#ffffff', 0.55), (0.7, '#ffffff', 0.15), (1, '#ffffff', 0)], r='50%')
    svg('light', W, W, rect(0, 0, W, W, 'url(#g)'), defs)


def smoke_puff():
    W = 96
    defs = radial('g', [(0, '#ffffff', 0.9), (0.6, '#ffffff', 0.5), (1, '#ffffff', 0)], r='50%')
    svg('puff', W, W, circ(48, 48, 48, 'url(#g)'), defs)


def soil_bits():
    # worm
    W, H = 140, 60
    body = line('M 12 34 C 30 10 46 54 66 30 C 82 12 100 44 124 26', '#d98c86', 14) + circ(124, 26, 4, INK)
    svg('bit_worm', W, H, body)
    # a little stash of nuts in a hollow
    W, H = 160, 90
    body = ell(80, 58, 70, 26, '#3f2f24', 'opacity="0.55"')
    for x, y in ((50, 56), (82, 62), (110, 54), (68, 40), (96, 40)):
        body += ell(x, y + 4, 15, 14, '#a86f3a') + path(f'M {x - 15} {y - 1} A 15 9 0 0 1 {x + 15} {y - 1} Z', '#7c5030')
    svg('bit_stash', W, H, body)
    # stones
    W, H = 200, 100
    r = random.Random(4)
    body = ''
    for k in range(4):
        x, y, rx = 30 + k * 44, 60 + r.uniform(-12, 12), r.uniform(20, 30)
        body += path(blob(x, y, rx, rx * 0.66, 8, 0.12, k), r.choice([STONE, STONE_D, '#857f78'])) + ell(x - rx * 0.3, y - rx * 0.2, rx * 0.35, rx * 0.14, '#ffffff', 'opacity="0.15"')
    svg('bit_stones', W, H, body)
    # a snail shell fossil
    W = 90
    pts = [(45 + math.cos(a) * 2.6 * a, 45 + math.sin(a) * 2.6 * a) for a in [k * 0.25 for k in range(64)]]
    body = circ(45, 45, 40, '#c9b79c', 'opacity="0.55"') + line('M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in pts), '#8d7a62', 4)
    svg('bit_fossil', W, W, body)


def bubble():
    W = 120
    body = circ(60, 56, 50, '#000000', 'opacity="0.18"') + circ(60, 52, 50, '#fbf8f2')
    body += path('M 46 96 L 60 116 L 72 96 Z', '#fbf8f2')
    c1, c2, c3 = BLANKETS['red']
    body += path(smooth([(24, 66), (34, 42), (78, 36), (96, 46), (98, 66)]), c1) + line('M 34 52 Q 62 42 90 50', c3, 4)
    body += line('M 40 62 L 86 62', c2, 3)
    for k in range(3):
        body += line(f'M {86 + k * 4} {22 + k * 9} l 10 -4', '#6f95b5', 4)
    svg('bubble_blanket', W, W + 10, body)


if __name__ == '__main__':
    pine('pine_a', 1)
    pine('pine_b', 2, w=260, h=480, tiers=4)
    pine('pine_c', 3, w=340, h=640, tiers=6)
    birch('birch_a', 4)
    birch('birch_b', 5, w=220, h=560)
    mountains()
    moon()
    soil()
    cabin()
    woodpile()
    fence()
    rooms()
    tunnels()
    bear()
    hedgehog()
    dormouse()
    blankets()
    nut_on_leaf()
    snowflake()
    soft_light()
    smoke_puff()
    bubble()
    soil_bits()
    print('wrote', len(list(OUT.glob('*.svg'))), 'svg files to', OUT)
