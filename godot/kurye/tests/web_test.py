#!/usr/bin/env python3
"""Plays the web export in headless Chrome and takes screenshots.

  python3 tests/web_test.py /tmp/kurye-web /tmp/kurye-shots

Serves the folder, opens it at iPad and phone sizes with touch, presses
"Başla", drives with the touch stick, and saves screenshots plus the
browser console (errors make the script exit with 1).
"""
import functools
import http.server
import os
import sys
import threading
import time

from playwright.sync_api import sync_playwright

root = sys.argv[1] if len(sys.argv) > 1 else "/tmp/kurye-web"
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/kurye-shots"
os.makedirs(out, exist_ok=True)

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8123), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

errors = []


def run(p, name, w, h, scale):
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=scale, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    t0 = time.time()
    page.goto("http://127.0.0.1:8123/index.html")
    while not any("Godot Engine" in l for l in logs):
        if time.time() - t0 > 180:
            raise SystemExit(f"{name}: the engine did not start")
        page.wait_for_timeout(int((0.5) * 1000))
    print(f"{name}: engine up in {time.time() - t0:.1f}s")
    page.wait_for_timeout(int((6) * 1000))
    page.screenshot(path=f"{out}/{name}-title.png")
    # "Başla" sits in the middle of the title panel, a little below centre
    page.touchscreen.tap(w * 0.5, h * 0.5 + h * 0.13)
    page.wait_for_timeout(int((2) * 1000))
    page.screenshot(path=f"{out}/{name}-start.png")
    # drive: hold the touch stick pointing up, then right
    cdp = ctx.new_cdp_session(page)
    sx, sy = w * 0.18, h * 0.7

    def touch(kind, pts):
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})

    touch("touchStart", [(sx, sy)])
    for k in range(1, 12):
        touch("touchMove", [(sx, sy - k * 6)])
        page.wait_for_timeout(int((0.03) * 1000))
    page.wait_for_timeout(int((2.5) * 1000))
    page.screenshot(path=f"{out}/{name}-drive.png")
    for k in range(1, 12):
        touch("touchMove", [(sx + k * 6, sy - 66 + k * 5)])
        page.wait_for_timeout(int((0.03) * 1000))
    page.wait_for_timeout(int((1.5) * 1000))
    page.screenshot(path=f"{out}/{name}-turn.png")
    touch("touchEnd", [])
    page.wait_for_timeout(int((0.5) * 1000))
    with open(f"{out}/{name}-console.txt", "w") as f:
        f.write("\n".join(logs))
    for l in logs:
        if l.startswith("error") or l.startswith("pageerror"):
            errors.append(f"{name}: {l}")
    browser.close()


with sync_playwright() as p:
    run(p, "ipad", 1180, 820, 2)
    run(p, "phone", 844, 390, 3)

srv.shutdown()
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("ok")
