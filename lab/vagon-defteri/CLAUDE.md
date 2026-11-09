# Vagon Defteri

Umut'un trende (Marmaray) telefonda çizmesi için defter. Oyun değil, araç; Lab'da sadece linkle açılır (`listed: false`). Fikir ve pazar taraması claude.ai'daki uzigames projesinde (`trende-cizim.md`).

Telefonda çizimi zorlaştıran üç şey ve cevapları:
1. **Parmak çizgiyi kapatıyor** → üç kalem modu: Parmak (normal), Uç (kalemin ucu parmağın 62 px üstünde; ucu yerine getir, 260 ms bekle, halka dolunca çizer; ya da iki kez dokun, ikincide sürükle), Trackpad (bir parmak imleci göreli sürer, ikinci parmak basılıyken çizer; tek elle iki kez dokun-sürükle; hassasiyet 1 / 0.6 / 0.35).
2. **Tren sarsıntısı parmağı kaydırıyor** → sarsıntı süzgeci: ivme ölçerden ani sarsıntı pencereleri çıkar, çizginin o penceredeki parçası gerçekten saptıysa atılır ve iki ucu Hermite eğrisiyle birleştirilir. Düzeltilen yer sarı yanar, "Sarsıntı düzeltildi · Geri al" ham çizgiyi geri getirir.
3. **Zaman bölük pörçük** → yolculuk: Marmaray'da biniş durağı ve yön seçilir, her durak arası bir sayfa ("Göztepe → Feneryolu"). Tren durunca (titreşim düşer) durak ilerler, kalkınca yeni sayfa açılır; yanlışsa bildirimdeki "Geri al" sayfayı ve durağı geri alır. Elle: üstteki yolculuk düğmesi → "Sonraki durak".

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Dış bağlantı yok (yazı tipi sistemin `ui-rounded`'ı).
- `cover.png` paylaşım görseli, `icon.png` ana ekran simgesi (180×180; Safari → Paylaş → Ana Ekrana Ekle).
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `core.js` DOM'suz çekirdek (Node'da da çalışır): `MotionMeter` (sarsıntı pencereleri + titreşim düzeyi), `cleanStroke`, `smooth`, `simplify`, `encode`/`decode`, `StopDetector`, Marmaray'ın 43 istasyonu. **Ayarlar `TUNE`'da**; Marmaray kayıtlarına bakıp buradan düzeltilir.
  - `app.js` arayüz, dokunma, çizim, sayfalar (IndexedDB), yolculuk, kayıt, Lab bağlantıları
  - `index.html` sayfa iskeleti, `style.css` görünüm, `build.js` derleme
  - `test/core.test.js` yapay ivme ve çizgilerle çekirdek denemesi; `test/browser.py` telefon ekranında gerçek dokunma olaylarıyla uçtan uca deneme (görüntüler `/tmp/vd-shots/`)
- Derleme: `node lab/vagon-defteri/src/build.js --lab` → `index.html`. Hesapsız tek başına kopya: `node lab/vagon-defteri/src/build.js /tmp/vd/vd.html`.
- Deneme: `node lab/vagon-defteri/src/test/core.test.js`, sonra tek başına kopyayı `/tmp/vd/vd.html`'e derleyip `python3 lab/vagon-defteri/src/test/browser.py`.

## Veri

- Sayfalar cihazda, IndexedDB'de (`vagon-defteri` → `pages`). Hesaba eşitlenmez (`data-kayit` yok): çizimler büyüyebilir, `saves` satırı tek JSON. Paylaşım: defterde sayfaya dokun → PNG ya da SVG.
- Sayfa: `{ id, n, created, updated, title, trip, strokes: [{ b: kalem, c: renk, s: kalınlık, p: yarım birim farklarla noktalar, j: düzeltme sayısı }] }`. Sayfa 1200×2000 birim.
- Ayarlar `vagon.ayar`, yolculuk `vagon.yolculuk`, açık sayfa `vagon.sayfa`, son biniş durağı `vagon.binis` (localStorage, cihazda).
- **Yolculuk kaydı** (`rec` deposu, ayarlardan kapatılır): sensör açıkken her çizginin ham noktaları + çizgiden 0.6 sn önce ile 0.45 sn sonrası arasındaki ivme/dönme örnekleri, sarsıntı pencereleri, düzeltmeler, geri alınan düzeltmeler; saniyelik titreşim düzeyi; durak olayları (otomatik, elle, geri). Defter → "Kaydı paylaş" tek JSON dosyası verir. Umut bunu gönderince `TUNE` (eşikler, `pre`/`post`, durak oranları) bu veriyle ayarlanır: elle basılan "Sonraki durak"lar durak sezicisi için doğru cevaptır, geri alınan düzeltmeler süzgecin yanlışlarıdır.
- Lab'da (`window.Hesap` varsa): yolculuk başlayınca ve her sayfa bitince not (sayfa, başlık, çizgi, düzeltme, kalem modu); defter ekranında "Nasıldı?".

## Notlar

- iOS'ta hareket sensörü izni bir dokunuşun içinde istenir (`DeviceMotionEvent.requestPermission`). İzin bir kez verildiyse sonraki açılışlarda ilk dokunuşta sessizce yeniden istenir. Sensör yoksa süzgeç ve otomatik durak çalışmaz, gerisi çalışır.
- Saat: dokunma ve ivme olaylarının ikisi de `performance.now()` saatinde (`evTime`). Süzgeç ikisini bu saatle eşleştirir.
- Üstteki küçük ekran sarsıntı ölçer: çizgi anlık sarsıntı, kesikli sarı çizgi eşik, sarı dikmeler sarsıntı penceresi.
- Marmaray tünelde sinyal için durunca otomatik sezici bunu durak sanabilir; bunun için "Geri al" hem sayfayı hem durağı geri alır. Elle "Sonraki durak"tan sonraki 60 sn içindeki otomatik duruş yok sayılır.
- Arayüz Türkçe, kod İngilizce, yorumlar Türkçe.
