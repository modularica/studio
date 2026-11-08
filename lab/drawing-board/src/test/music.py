# Müziği ve sesleri çevrimdışı çalıp dinlenebilir dosya yapar, ses düzeylerini ölçer.
# Önce: node build.js --local /tmp/km-local.html
# Çıktı: /tmp/km-shots/music.wav ve music.mp3 (ffmpeg varsa); bölüm bölüm tepe ve RMS düzeyi.
import base64, subprocess, sys, wave
import numpy as np
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html'
OUT = '/tmp/km-shots'
SR = 32000
BAR = 60 / 84 * 4
# Akış: 8 ölçü kurarken, 5 ölçü makine çalışırken (parça sesleriyle), kova + kutlama, sonuç penceresi, yeni çizim.
RUN0 = 8 * BAR
SCRIPT = [{'t': 0, 'level': 'rampa'}, {'t': 0.0, 'mode': 'build'},
          {'t': 3.0, 'sfx': 'place'}, {'t': 6.2, 'sfx': 'tick'}, {'t': 9.4, 'sfx': 'place'}, {'t': 15.0, 'sfx': 'link'},
          {'t': RUN0 - 0.1, 'sfx': 'run'}, {'t': RUN0 - 0.1, 'mode': 'run'}]
hits = [(1.2, 0.9, 0.6), (1.9, 0.75, 0.5), (2.5, 0.6, 0.45), (3.0, 0.45, 0.4), (3.4, 0.3, 0.35), (6.1, 0.5, 0.8)]
for dt, h, v in hits:
    SCRIPT.append({'t': RUN0 + dt, 'sfx': 'hit', 'o': {'h': h, 'v': v, 'x': 0.2}})
SCRIPT += [{'t': RUN0 + 4.0, 'sfx': 'spring'}, {'t': RUN0 + 5.5, 'sfx': 'sensor'}, {'t': RUN0 + 5.52, 'sfx': 'piston'},
           {'t': RUN0 + 7.5, 'sfx': 'gate'}, {'t': RUN0 + 9.0, 'sfx': 'magnet'}, {'t': RUN0 + 11.0, 'sfx': 'goal', 'o': {'n': 0}}]
WIN = RUN0 + 13.0
SCRIPT += [{'t': WIN, 'sfx': 'win'}, {'t': WIN + 1.05, 'mode': 'menu'},
           {'t': WIN + 1.5, 'sfx': 'approved'}, {'t': WIN + 1.75, 'sfx': 'stamp', 'o': {'n': 0}}, {'t': WIN + 2.05, 'sfx': 'stamp', 'o': {'n': 1}},
           {'t': WIN + 2.5, 'sfx': 'unlock'},
           {'t': WIN + 9.0, 'mode': 'build'}, {'t': WIN + 9.0, 'level': 'yay'}]
SECS = WIN + 9.0 + 6 * BAR
SECTIONS = [('kurarken', 0, RUN0), ('çalışırken', RUN0, WIN), ('kutlama', WIN, WIN + 4), ('sonuç penceresi', WIN + 4, WIN + 9), ('yeni çizim', WIN + 10, SECS)]

JS = """async ([secs, script, sr]) => {
  const buf = await KM_AUDIO.render(secs, script, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const out = new Int16Array(n * 2);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i]; peak = Math.max(peak, Math.abs(l), Math.abs(r));
    out[2 * i] = Math.max(-1, Math.min(1, l)) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, r)) * 32767;
  }
  const bytes = new Uint8Array(out.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak, n };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = b.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(500)
    res = page.evaluate(JS, [SECS, SCRIPT, SR])
    b.close()

raw = base64.b64decode(res['b64'])
with wave.open(f'{OUT}/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(raw)
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32767
print(f'{SECS:.1f} sn, tepe {res["peak"]:.3f}', 'HATA: ' + '; '.join(errors) if errors else '')
for name, a, z in SECTIONS:
    seg = x[int(a * SR):int(z * SR)]
    if not len(seg):
        continue
    rms = np.sqrt((seg ** 2).mean())
    print(f'  {name:16s} tepe {np.abs(seg).max():.3f}  rms {rms:.4f} ({20 * np.log10(rms + 1e-9):.1f} dB)')
try:
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/music.wav', '-codec:a', 'libmp3lame', '-b:a', '160k', f'{OUT}/music.mp3'], check=True)
    print('mp3:', f'{OUT}/music.mp3')
except Exception as e:
    print('mp3 yok:', e)
sys.exit(1 if errors or res['peak'] > 0.98 else 0)
