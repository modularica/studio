# Kurye · Godot

GTA 2 gibi yukarıdan bakışlı kurye oyunu (18 Kasım 2026, ilk sürüm). Turuncu kurye minibüsüyle adada bir şehir: dükkândan al (yeşil halka), müşterinin kapısına götür (turuncu halka), süre bitmeden ve paketi sarsmadan. Vardiya 4 dakika; jeton, teslimat ve yıldız sayılır. Oyunun içi Türkçe. Lab'da `uzigames.com/lab/kurye/` (listede yok, sadece linkle).

- Godot 4.7.2, GL Compatibility (web ve iPad aynı çizici). Ekran 1280×800 tabanı, `canvas_items` + `expand`, yatay.
- Kamera dümdüz aşağı bakan perspektif `Camera3D` (fov 52): binaların yana yatması GTA 2 gibi kendiliğinden gelir. Kuzey hep yukarıda, kamera dönmez; hızlandıkça yükselir (46 → 66 m), gidilen yöne biraz önden bakar.
- Bütün çizimler kodla: binalar, arabalar, insanlar kutulardan (`scripts/geo.gd`, `scripts/meshes.gd`), yol/kaldırım/park/deniz tek bir zemin shader'ında (`shaders/ground.gdshader`). Simgeler (`art/*.svg`) ve sesler (`sfx/*.wav`) `art_src/make_assets.py`'den üretilir; elle düzenleme, betiği değiştir ve çalıştır.

## Dosyalar

```
scripts/main.gd     oyun akışı: başlık (bot sürer), vardiya, siparişler, kontroller, kamera, ses, test bayrakları
scripts/city.gd     şehir: 8×8 blok (48 m blok, 14 m yol, 3,5 m kaldırım), parklar, meydan, binalar, dükkânlar, kapılar, gölge haritası, çarpışma (push_out)
scripts/player.gd   minibüs: tutunma, el freniyle drift, binalara ve arabalara çarpıp sekme
scripts/traffic.gd  48 araba: şeritte gider, kavşaklarda döner (her kavşakta aynı anda tek araba), öndekini/oyuncuyu/yayayı bekler, uzaktakiler oyuncunun yakınına (görünmeyen yere) taşınır
scripts/peds.gd     170 yaya: blokların etrafında yürür, zebradan karşıya geçer, minibüsten kaçar; değerse oturur, kalkar (zarar yok)
scripts/hud.gd      jeton/teslimat, saat, sipariş kartı, ok, dokunmatik kontroller, başlık / mola / vardiya sonu
scripts/geo.gd      SurfaceTool yardımcıları (yüz yönü normalden düzeltilir)
scripts/meshes.gd   sedan, hatchback, taksi, kamyonet, kurye minibüsü, insan, gölge
shaders/            zemin, binalar (pencereler, çatı, kiremit), arabalar/insanlar, halka, yumuşak gölge
tests/web_test.py   web çıktısını başsız Chrome'da iPad ve telefon boyunda oynar, ekran görüntüsü alır
export_presets.cfg  "Web" → ../../lab/kurye/index.html (hesap.js ve paylaşım etiketleri html/head_include'da); "WebTest" → /tmp/kurye-web (hesapsız, yerel test için)
```

Şehir `SEED = 7` ile her seferinde aynı çıkar (oyuncu sokakları öğrenir). Tohumu değiştirirsen dükkânların ve kapıların yeri de değişir.

## Kurallar

- Sipariş: dükkânın önündeki halkada (yarıçap 5,2 m) 4,5 m/sn'nin altına yavaşla → yüklenir; süre başlar (mesafe / 11,5 + 9 sn, kargoya göre çarpan). Kapıdaki halkada yavaşla → teslim. İlk paket Uzi Kargo'da hazır.
- Kargo: koli, pizza (az süre), pasta (çok kırılgan), çiçek, kitap (sağlam), dondurma (en az süre). Çarpma paketi sarsar (çarpma hızı × kırılganlık); yayaya değmek de biraz sarsar.
- Ödeme: taban (12 + mesafe/10) × (0,4 + 0,6 × sağlamlık) + kalan saniye × 0,6; geç kalınca azalır. Yıldız: zamanında ve sağlam 3, zamanında 2, geç 1. 3 yıldıza 5 bahşiş.
- Kontroller: klavye (ok/WASD araca göre, boşluk el freni, H korna, Esc mola), gamepad (sol çubuk, RT/LT, A el freni, B korna), dokunmatik (solda sürükle: minibüs o yöne döner ve gider; sağda FREN (geri), DRİFT, KORNA).

## Lab

- Kayıt hesaba eşitlenmez (`data-kayit` yok): en iyi vardiya cihazda `user://kurye.cfg`'de.
- Not: vardiya başı (`Vardiya başladı`) ve sonu (`Vardiya bitti · 7 teslimat · 412 jeton · 17 yıldız`).
- "Nasıldı?" molada (`mola`) ve vardiya sonunda (`oyun-sonu`), `Hesap.nasildi({ oyun: 'kurye', yer })` (Godot'tan `JavaScriptBridge`).

## Çalıştırma, test ve dışa aktarma

- Simge/ses: `python3 art_src/make_assets.py`, sonra `godot --headless --path . --import`. SVG'ler 4 kat ölçekle içe alınır (`art/*.svg.import`).
- Bot testi (ekransız, hızlı): `godot --headless --path . --fixed-fps 60 -- --bot --seconds=150` siparişleri ve ödemeleri yazar.
- Ekran görüntüsü: `xvfb-run -a -s "-screen 0 1280x800x24" godot --rendering-driver opengl3 --path . --resolution 1280x800 -- --bot --warmup=45 --shot=/tmp/x.png --frame=30`. `--warmup=N` N saniyeyi çizmeden ileri sarar, `--title` başlık ekranında kalır, `--shift=N` vardiyayı kısaltır, `--cover` arayüzü gizler.
- `cover.png`: `--cover --warmup=52 --resolution 2400x1260` ile çekildi, 1200×630'a küçültülüp üstüne Baloo 2 ile "KURYE" yazıldı, `imagequant` ile küçültüldü (~120 KB).
- Web: `godot --headless --path . --export-release "Web" ../../lab/kurye/index.html`. Şablon `web_nothreads_release`. `index.wasm` motorun kendisi (otel-yeni ile aynı dosya); değişen `index.pck`.
- Web testi: `--export-release "WebTest" /tmp/kurye-web/index.html`, sonra `python3 tests/web_test.py /tmp/kurye-web /tmp/kurye-shots`.

## Dikkat (Compatibility çizici)

- Shader çıktısı olduğu gibi ekrana gider (doğrusal → sRGB dönüşümü yok): renkleri shader'a sRGB ver, `source_color` kullanma.
- MultiMesh'te tepe rengi (`COLOR`) örnek rengiyle çarpılır, `use_colors` kapalıysa sıfırla çarpılır ve her şey siyah çıkar. Trafik ve yayalarda `use_colors = true` + beyaz örnek rengi, boya `INSTANCE_CUSTOM`'da.
- Yazı tipi Baloo 2 800/600 (latin + latin-ext yedek). Fontta → ve ★ yok; arayüzde kullanma (yıldızlar simge).
