#!/usr/bin/env python3
"""Draws lab/harf-kutusu/cover.png (1200x630 share image) and icon.png (180x180 home-screen icon).

    pip install playwright pillow && playwright install chromium
    python3 lab/harf-kutusu/src/tools/cover.py
"""
import asyncio
import base64
import io
import pathlib

from PIL import Image
from playwright.async_api import async_playwright

SRC = pathlib.Path(__file__).resolve().parents[1]
OUT = SRC.parent


def font(name):
    return base64.b64encode((SRC / "fonts" / name).read_bytes()).decode()


FACES = f"""
@font-face{{font-family:B;font-weight:800;src:url(data:font/woff2;base64,{font('brico-800-l.woff2')}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+2000-206F}}
@font-face{{font-family:B;font-weight:800;src:url(data:font/woff2;base64,{font('brico-800-x.woff2')}) format("woff2");unicode-range:U+0100-0130,U+0132-02FF}}
@font-face{{font-family:A;font-weight:400;src:url(data:font/woff2;base64,{font('ahn-400-l.woff2')}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+2000-206F}}
@font-face{{font-family:A;font-weight:400;src:url(data:font/woff2;base64,{font('ahn-400-x.woff2')}) format("woff2");unicode-range:U+0100-0130,U+0132-02FF}}
"""
BASE = FACES + """
*{box-sizing:border-box}html,body{margin:0}
body{background:radial-gradient(90% 120% at 70% 40%,#163a30 0%,#0b1c18 70%);color:#f4eee1;font-family:A,sans-serif}
.tray{padding:var(--pad);border-radius:calc(var(--s)*.075);display:grid;grid-template-columns:repeat(var(--n),1fr);gap:var(--gap);
  width:var(--s);height:var(--s);background:radial-gradient(120% 110% at 30% 18%,#22513f 0%,#16392f 48%,#0e2a22 100%);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.05),inset 0 12px 34px rgba(0,0,0,.5),0 24px 50px rgba(0,0,0,.55)}
.die{display:flex;align-items:center;justify-content:center;border-radius:calc(var(--cell)*.2);
  background:linear-gradient(165deg,#fffbf3 0%,#f4eee1 40%,#e4d9c2 100%);
  box-shadow:inset 0 calc(var(--cell)*-.07) 0 #d3c6aa,inset 0 1px 0 #fff,0 calc(var(--cell)*.06) calc(var(--cell)*.1) rgba(0,0,0,.5);
  font:800 calc(var(--cell)*.5)/1 B,sans-serif;color:#201b14}
.die span{transform:translateY(.04em)}
.die.on{background:linear-gradient(165deg,#ffd780 0%,#e8b24a 55%,#cf9431 100%);box-shadow:inset 0 calc(var(--cell)*-.07) 0 #a8761f,inset 0 1px 0 #ffe9b8,0 calc(var(--cell)*.06) calc(var(--cell)*.1) rgba(0,0,0,.5)}
"""


def tray(letters, n, size, on=()):
    pad, gap = round(size * .045), round(size * .03)
    cell = (size - 2 * pad - (n - 1) * gap) / n
    dice = "".join(f'<div class="die{" on" if i in on else ""}"><span>{c}</span></div>' for i, c in enumerate(letters))
    return f'<div class="tray" style="--s:{size}px;--n:{n};--pad:{pad}px;--gap:{gap}px;--cell:{cell}px">{dice}</div>'


# KALEM runs K-A-L-E-M through touching dice; MERT, TER and KAL are on the board too.
BOARD = "ŞAKS" "İLET" "MERÜ" "ÇZAN"
KALEM = {2, 1, 5, 9, 8}

COVER = f"""<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>{BASE}
body{{width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 64px 0 76px}}
.left{{flex:1}}
h1{{margin:0 0 26px;font:800 112px/.95 B,sans-serif;letter-spacing:-.01em}}
.sub{{margin:0 0 22px;font-size:34px;line-height:1.3;color:#f4eee1}}
.note{{margin:0;font-size:24px;color:rgba(244,238,225,.68)}}
.note b{{color:#e8b24a;font:800 26px/1 B,sans-serif}}
</style></head><body>
<div class="left"><h1>Harf<br>Kutusu</h1>
<p class="sub">Zarları salla, telefonu ortaya koy, kelimeleri kâğıda yaz.</p>
<p class="note"><b>3:00</b> · Türkçe harf zarları · kurallar içinde</p></div>
{tray(BOARD, 4, 500, KALEM)}
</body></html>"""

ICON = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE}
body{{width:180px;height:180px;display:grid;place-items:center;background:radial-gradient(120% 110% at 30% 18%,#22513f 0%,#16392f 55%,#0e2a22 100%)}}
.tray{{background:none;box-shadow:none}}
</style></head><body>{tray("HARF", 2, 168)}</body></html>"""


async def shot(page, html, w, h, scale, out):
    await page.set_viewport_size({"width": w, "height": h})
    await page.set_content(html)
    await page.evaluate("document.fonts.ready")
    await page.wait_for_timeout(150)
    png = await page.screenshot()
    Image.open(io.BytesIO(png)).convert("RGB").resize((w, h), Image.LANCZOS).save(out, optimize=True)
    print(out)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(device_scale_factor=2)
        await shot(page, COVER, 1200, 630, 2, OUT / "cover.png")
        await shot(page, ICON, 180, 180, 2, OUT / "icon.png")
        await b.close()


asyncio.run(main())
