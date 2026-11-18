#!/usr/bin/env python3
"""Draws the icons (SVG → art/) and synthesises the sounds (WAV → sfx/).

Run from the project folder:  python3 art_src/make_assets.py
then import:                  godot --headless --path . --import
"""
import math
import os
import random
import struct
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, "art")
SFX = os.path.join(ROOT, "sfx")
os.makedirs(ART, exist_ok=True)
os.makedirs(SFX, exist_ok=True)

INK = "#2b2421"
SW = 6  # outline width


def svg(name, body, size=128):
    with open(os.path.join(ART, name + ".svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 128 128">'
                f'<g stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


# --- icons --------------------------------------------------------------------

svg("pizza", """
<path d="M18 30 Q64 8 110 30 L64 118 Z" fill="#f4c34a"/>
<path d="M18 30 Q64 8 110 30 L104 42 Q64 22 24 42 Z" fill="#c9863d"/>
<circle cx="52" cy="54" r="9" fill="#d9483b"/>
<circle cx="78" cy="58" r="8" fill="#d9483b"/>
<circle cx="64" cy="84" r="8" fill="#d9483b"/>
<circle cx="70" cy="40" r="3" fill="#6b9a3c" stroke="none"/>
<circle cx="44" cy="40" r="3" fill="#6b9a3c" stroke="none"/>
""")

svg("pasta", """
<path d="M16 62 L112 50 L112 104 L16 112 Z" fill="#fbe6cf"/>
<path d="M16 62 L112 50 L112 68 L16 80 Z" fill="#f29bb8"/>
<path d="M16 92 L112 84 L112 92 L16 100 Z" fill="#f29bb8" stroke-width="4"/>
<path d="M16 62 L64 24 L112 50 Z" fill="#fff4ea"/>
<circle cx="66" cy="26" r="10" fill="#d9363e"/>
<path d="M68 16 Q74 6 84 8" fill="none" stroke-width="4"/>
""")

svg("cicek", """
<path d="M64 120 L34 62 L94 62 Z" fill="#d8b98a"/>
<path d="M50 64 L62 40 M64 64 L66 34 M78 64 L84 42" stroke="#4f7d34" stroke-width="5" fill="none"/>
<g fill="#ef6f8e"><circle cx="44" cy="40" r="11"/><circle cx="58" cy="28" r="11"/><circle cx="46" cy="22" r="10"/></g>
<circle cx="50" cy="30" r="6" fill="#ffd54a"/>
<g fill="#f6c23e"><circle cx="82" cy="30" r="11"/><circle cx="92" cy="42" r="10"/><circle cx="76" cy="44" r="9"/></g>
<circle cx="84" cy="38" r="5" fill="#fff4cf"/>
<path d="M40 70 L88 70" stroke-width="5"/>
""")

svg("kitap", """
<rect x="16" y="70" width="96" height="26" rx="5" fill="#5b88c8"/>
<rect x="24" y="44" width="84" height="26" rx="5" fill="#e2553f"/>
<rect x="20" y="96" width="92" height="22" rx="5" fill="#7fb84e"/>
<path d="M34 50 L34 64 M98 76 L98 90 M30 102 L30 112" stroke="#fff4e0" stroke-width="5"/>
<path d="M40 30 L88 30 L80 44 L48 44 Z" fill="#f6c23e"/>
""")

svg("dondurma", """
<path d="M38 62 L64 122 L90 62 Z" fill="#e2b26a"/>
<path d="M48 76 L80 100 M80 76 L52 104 M44 66 L84 66" stroke-width="4" fill="none"/>
<circle cx="64" cy="54" r="22" fill="#f29bb8"/>
<circle cx="64" cy="30" r="18" fill="#9fdcc8"/>
<circle cx="66" cy="12" r="6" fill="#d9363e"/>
""")

svg("koli", """
<path d="M16 44 L64 24 L112 44 L112 98 L64 118 L16 98 Z" fill="#d9a066"/>
<path d="M16 44 L64 64 L112 44 M64 64 L64 118" fill="none"/>
<path d="M40 34 L88 54 L88 70" fill="none" stroke="#f3e3c6" stroke-width="8"/>
""")

svg("ev", """
<path d="M18 62 L64 22 L110 62" fill="#e2553f"/>
<rect x="28" y="58" width="72" height="56" fill="#fbe6cf"/>
<rect x="54" y="80" width="20" height="34" fill="#8a5a3c"/>
<rect x="34" y="70" width="14" height="14" fill="#8fd3e0" stroke-width="4"/>
<rect x="80" y="70" width="14" height="14" fill="#8fd3e0" stroke-width="4"/>
""")

svg("coin", """
<circle cx="64" cy="64" r="50" fill="#f6c23e"/>
<circle cx="64" cy="64" r="34" fill="#ffd96a" stroke-width="5"/>
<path d="M58 44 L58 84 M58 56 L76 50 M58 68 L76 62" stroke-width="7" fill="none"/>
""")

svg("star", """
<path d="M64 10 L79 44 L116 48 L88 72 L96 110 L64 90 L32 110 L40 72 L12 48 L49 44 Z" fill="#f6c23e"/>
""")

svg("star_off", """
<path d="M64 10 L79 44 L116 48 L88 72 L96 110 L64 90 L32 110 L40 72 L12 48 L49 44 Z" fill="#cfc8bc" stroke="#8d847a"/>
""")

svg("clock", """
<circle cx="64" cy="66" r="48" fill="#fff8ea"/>
<path d="M64 38 L64 66 L84 78" fill="none" stroke-width="7"/>
<path d="M54 12 L74 12" stroke-width="8"/>
""")

svg("van", """
<rect x="14" y="34" width="100" height="60" rx="10" fill="#f08a24"/>
<rect x="14" y="34" width="64" height="60" rx="6" fill="#fbf6ec"/>
<rect x="84" y="40" width="20" height="48" rx="4" fill="#33414f"/>
<rect x="18" y="56" width="56" height="16" fill="#f08a24" stroke="none"/>
""")

svg("pause", """
<rect x="34" y="26" width="20" height="76" rx="5" fill="#fff8ea"/>
<rect x="74" y="26" width="20" height="76" rx="5" fill="#fff8ea"/>
""")

with open(os.path.join(ROOT, "icon.svg"), "w") as f:
    f.write(f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<rect width="128" height="128" rx="24" fill="#4f9bb3"/>
<g stroke="{INK}" stroke-width="5" stroke-linejoin="round">
<rect x="18" y="40" width="92" height="50" rx="9" fill="#f08a24"/>
<rect x="18" y="40" width="58" height="50" rx="6" fill="#fbf6ec"/>
<rect x="82" y="46" width="18" height="38" rx="4" fill="#33414f"/>
</g></svg>''')

# --- sounds -------------------------------------------------------------------

RATE = 22050
rnd = np.random.default_rng(7)


def write(name, x):
    x = np.clip(x, -1.0, 1.0)
    data = (x * 32000).astype(np.int16)
    with wave.open(os.path.join(SFX, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


def t_of(sec):
    return np.arange(int(RATE * sec)) / RATE


def periodic_noise(lo, hi, sec=1.0):
    """Noise made of integer-Hz sines: loops perfectly over `sec` seconds."""
    t = t_of(sec)
    x = np.zeros_like(t)
    step = 1.0 / sec
    f = lo
    while f <= hi:
        x += np.sin(2 * np.pi * f * t + rnd.uniform(0, 2 * np.pi)) * rnd.uniform(0.5, 1.0)
        f += step * rnd.integers(1, 4)
    return x / (np.abs(x).max() + 1e-9)


# engine: a low hum with a growl, loops over one second (48 Hz × 48 cycles)
t = t_of(1.0)
eng = np.zeros_like(t)
for h, a in [(1, 1.0), (2, 0.55), (3, 0.35), (4, 0.22), (6, 0.12), (8, 0.06)]:
    eng += a * np.sin(2 * np.pi * 48 * h * t + h * 0.7)
eng *= 0.75 + 0.25 * np.sin(2 * np.pi * 12 * t)
eng += periodic_noise(60, 400) * 0.18
write("engine", eng / np.abs(eng).max() * 0.6)

# tyres: a band of noise, loops
sk = periodic_noise(700, 2400) * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * t))
write("skid", sk * 0.5)

# horn: two notes, a bit buzzy
t = t_of(0.42)
hn = np.tanh(2.2 * (np.sin(2 * np.pi * 392 * t) + 0.8 * np.sin(2 * np.pi * 494 * t)))
env = np.minimum(1.0, t / 0.02) * np.minimum(1.0, (0.42 - t) / 0.06)
write("horn", hn * env * 0.45)

# bump: a thump
t = t_of(0.32)
bp = np.sin(2 * np.pi * (90 - 40 * t / 0.32) * t) * np.exp(-t * 14)
bp += rnd.normal(0, 1, t.size) * np.exp(-t * 40) * 0.5
write("bump", bp * 0.8)


def bell(freq, sec, decay=6.0):
    t = t_of(sec)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.01 * t) + 0.12 * np.sin(2 * np.pi * freq * 3.0 * t)
    return x * np.exp(-t * decay) * np.minimum(1.0, t / 0.004)


def seq(notes, gap, sec):
    out = np.zeros(int(RATE * (gap * len(notes) + sec)))
    for k, f in enumerate(notes):
        b = bell(f, sec)
        i = int(RATE * gap * k)
        out[i:i + b.size] += b
    return out / np.abs(out).max()


write("pickup", seq([784, 1175], 0.09, 0.45) * 0.55)
write("deliver", seq([1047, 1319, 1568, 2093], 0.075, 0.5) * 0.55)
write("star", seq([1568, 2349], 0.05, 0.3) * 0.4)
write("tick", bell(1800, 0.06, 60) * 0.4)
write("late", seq([523, 392], 0.15, 0.4) * 0.45)

# "hey!": a little voice-like blip with a pitch bend
t = t_of(0.24)
f0 = 330 + 180 * (t / 0.24)
ph = 2 * np.pi * np.cumsum(f0) / RATE
v = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)
v *= (0.6 + 0.4 * np.sin(2 * np.pi * 900 * t)) * np.minimum(1, t / 0.02) * np.exp(-t * 6)
write("hey", v / np.abs(v).max() * 0.45)

# start / end whistle
t = t_of(0.5)
wh = np.sin(2 * np.pi * (1500 + 120 * np.sin(2 * np.pi * 28 * t)) * t) * np.minimum(1, t / 0.02) * np.minimum(1, (0.5 - t) / 0.1)
write("whistle", wh * 0.35)

print("ok")
