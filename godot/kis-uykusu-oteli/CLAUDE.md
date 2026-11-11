# Kış Uykusu Oteli · Godot

Kış Uykusu Oteli'nin iPad sürümü için Godot projesi. Web sürümü `lab/kis-uykusu-oteli/` (HTML, `src/`'den derlenir); bu klasör onun yerine geçecek sürüm. Şimdilik bir görünüm denemesi: ışıklı sahne (kulübe, odalar, uyuyan hayvanlar, kar, kuzey ışıkları) ve oyunun kurallarının birebir kopyası. Oyun döngüsü (sonbahar/kış/bahar/yaz ekranları, menüler, ses) henüz yok.

- Godot 4.7.2, GL Compatibility (web ve iPad aynı çizici). Ekran 1600×1200, `canvas_items` + `expand`: geniş ekranda sahne ortada kalır, kenarlar uzar.
- Lab'daki adresi: `uzigames.com/lab/otel-yeni/` (listede yok, sadece linkle). `.vercelignore`'da `/godot/` var: bu klasör siteye çıkmaz, sadece dışa aktarılan `lab/otel-yeni/` çıkar.

## Dosyalar

```
project.godot, main.tscn   ana sahne: scripts/main.gd (görünüm denemesi)
scripts/sim/data.gd        OtelData: türler, odalar, yardımcılar, ayarlar (src/data.js'in kopyası)
scripts/sim/game.gd        OtelGame: kurallar (src/sim.js'in satır satır kopyası)
scripts/stars.gd           yıldızlar
shaders/                   gökyüzü, kuzey ışıkları, gren + vinyet
art_src/make_art.py        bütün SVG çizimleri üretir → art/ (elle düzenleme, betiği değiştir ve çalıştır)
fonts/                     Fredoka 600 (+ Türkçe harfler için Nunito 700 yedek)
tests/                     kuralların web sürümüyle aynı olduğunu gösteren bot testi
export_presets.cfg         "Web" ön ayarı → ../../lab/otel-yeni/index.html (hesap.js ve paylaşım etiketleri html/head_include'da)
```

## Kurallar web sürümüyle aynı kalmalı

`game.gd` ve `data.gd`, `lab/kis-uykusu-oteli/src/sim.js` ve `data.js`'in kopyası. Aynı tohumla aynı sayılar çıkar (mulberry32 rastgele sayı, JS `Math.round`, `Math.hypot`; konumlar Vector2 değil düz float, çünkü Vector2 32 bit). Birinde kural değişirse ötekini de değiştir ve testi çalıştır:

```
GODOT=/yol/godot tests/parity.sh            # 12 yıl, kid/avg/fast, tohum 1–6
GODOT=/yol/godot tests/parity.sh 14 kid 1,2 # yıl, profil, tohumlar
```

Bot (`tests/bot_test.gd`), `src/test/bot.js`'in kopyası; JS tarafını `tests/js_dump.js` çalıştırır.

## Çalıştırma ve dışa aktarma

- Ekran görüntüsü: `xvfb-run -a -s "-screen 0 1600x1200x24" godot --rendering-driver opengl3 --path . -- --shot=/tmp/x.png` (90. karede kaydeder ve kapanır). `--cover` gren ve yazıları gizler; `cover.png` böyle alınır: `--resolution 2286x1200`, kırp (150, 0, 2245, 1100), 1200×630'a küçült, `imagequant` ile küçült (~190 KB; WhatsApp büyük görseli göstermez).
- Çizimler: `python3 art_src/make_art.py`, sonra `godot --headless --path . --import`.
- Web: `godot --headless --path . --export-release "Web" ../../lab/otel-yeni/index.html`. Şablon `web_nothreads_release` (SharedArrayBuffer ve özel başlık gerekmez). `index.wasm` (~40 MB) motorun kendisi, Godot sürümü değişmedikçe aynı kalır; değişen `index.pck`.
- iPad: Mac'te Godot 4.7.2 + Xcode ile iOS ön ayarı eklenip dışa aktarılacak (henüz yok).

## Görünüm

Gece sahnesi: `CanvasModulate` geceyi koyulaştırır, odalar ve kulübe `PointLight2D` ile yanar. Gökyüzü ve uzak dağlar karartılmaz (ayrı `CanvasLayer`). Battaniyeler hayvan × renk ayrı dosya (`blanket_<hayvan>_<renk>.svg`; kırmızı, mavi, hardal, yeşil). Renk paleti `make_art.py` başında.
