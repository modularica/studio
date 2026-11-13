#!/usr/bin/env python3
"""Builds Harf Kutusu into one HTML file.

    python3 lab/harf-kutusu/src/build.py --lab          -> lab/harf-kutusu/index.html (Lab head: share tags, account)
    python3 lab/harf-kutusu/src/build.py /tmp/hk.html   -> stand-alone copy without the Lab account (e.g. a Claude artifact)

Fonts, the dice, the word list (words.txt, from tools/words.py) and the tiny keep-awake video are inlined,
so the page has no outside requests.
"""
import base64
import json
import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parent
OUT_LAB = SRC.parent / "index.html"

LAB_HEAD = """<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="Harf Kutusu">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://uzigames.com/lab/harf-kutusu/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Harf Kutusu">
<link rel="icon" type="image/png" href="/lab/harf-kutusu/icon.png">
<link rel="apple-touch-icon" href="/lab/harf-kutusu/icon.png">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="harf-kutusu"></script>""".format(
    desc="Masada telefonla oynanan Türkçe harf kutusu: zarları salla, telefonu ortaya koy, süre bitmeden bulduğun kelimeleri kâğıda yaz.")


def b64(path):
    return base64.b64encode((SRC / path).read_bytes()).decode()


def build(lab):
    dice = json.loads((SRC / "dice.json").read_text(encoding="utf-8"))
    for n, ds in dice.items():
        assert len(ds) == int(n) ** 2, n
        assert all(len(d) == 6 and len(set(d)) == 6 for d in ds), n
    rep = {
        "<!--LAB_HEAD-->": LAB_HEAD if lab else "",
        "__BRICO_L__": b64("fonts/brico-800-l.woff2"), "__BRICO_X__": b64("fonts/brico-800-x.woff2"),
        "__AHN400L__": b64("fonts/ahn-400-l.woff2"), "__AHN400X__": b64("fonts/ahn-400-x.woff2"),
        "__AHN700L__": b64("fonts/ahn-700-l.woff2"), "__AHN700X__": b64("fonts/ahn-700-x.woff2"),
        "__WAKE__": b64("wake.mp4"),
        "__DICE__": json.dumps(dice, ensure_ascii=False),
        "__WORDS__": json.dumps((SRC / "words.txt").read_text(encoding="utf-8"), ensure_ascii=False),
    }
    html = (SRC / "page.html").read_text(encoding="utf-8")
    for k, v in rep.items():
        assert k in html, k
        html = html.replace(k, v)
    return html


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    lab = sys.argv[1] == "--lab"
    out = OUT_LAB if lab else pathlib.Path(sys.argv[1])
    out.write_text(build(lab), encoding="utf-8")
    print(f"{out} ({out.stat().st_size // 1024} KB)")
