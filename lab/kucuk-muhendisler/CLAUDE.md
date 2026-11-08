# Küçük Mühendisler

The Incredible Machine tarzı fizik bulmacası. Her çizimde parça listesindeki parçaları (rampa, yay, konveyör, sensör) tahtaya koyup topu kovaya ulaştıran makineyi kurarsın. TIM'den farkı: makine çalışırken turuncu cihazlar (piston, pervane) oyuncunun elinde; sensör koyup cihaza bağlarsan makine dokunmadan çalışır ("Tam otomatik" damgası). Tasarım notları, bölüm tablosu, doğru çözüm yerleri ve zamanlama pencereleri claude.ai'daki uzigames projesinde (`kucuk-muhendisler.md`).

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Planck.js 1.5.1 jsDelivr'dan, fontlar (Big Shoulders Stencil, Barlow Semi Condensed) Google Fonts'tan gelir.
- `cover.png` paylaşım görseli (8. çizim tam otomatik çalışırken: sensör pistonu tetiklemiş, piston topu itiyor).
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `sim.js` fizik çekirdeği (Planck.js, sabit 1/120 sn adım, DOM yok; Node'da da çalışır): parçalar, sensörler, çoklu top/kova, `runHeadless`
  - `levels.js` 14 çizim; her birinde ipuçları, damgalar ve testlerin doğruladığı çözümler (`sol`)
  - `game.js` arayüz: sürükle-bırak, kumanda, damgalar, bölüm seçimi, teknik çizim (bkz. Görünüm), çalışırken efektler, sesler (WebAudio, yer tutucu), Lab bağlantıları
  - `index.html` sayfa iskeleti, `style.css` görünüm
  - `build.js` derleme; `test/` bölüm doğrulama ve tarayıcı denemeleri
- Derleme: `node lab/kucuk-muhendisler/src/build.js --lab` → `index.html`. Hesap satırları olmayan tek başına kopya: `node lab/kucuk-muhendisler/src/build.js /tmp/km.html`. İnternetsiz kopya (fontlar ve Planck içinde): önce `cd lab/kucuk-muhendisler/src && npm install`, sonra `node build.js --local /tmp/km-local.html`.
- Bölüm testi: `cd lab/kucuk-muhendisler/src && npm install && node test/design.js` (her bölüm: boş kurulum başarısız, kayıtlı çözümler başarılı). `node test/design.js <bölüm-id> --brute --sweep` tek parçalık bütün yerleşimleri ve elle basma pencerelerini tarar. Fizik ayarı (`sim.js` → `T`) ya da bir bölüm değişirse bunu çalıştır.
- Tarayıcı denemesi: `--local` derlemesinden sonra `python3 test/browser.py` (14 bölümü oynar) ve `python3 test/shots.py` (masaüstü, telefon, iPad, sürükleme anı, çalışma anı, başarısız deneme izi ve bölüm kartları; `/tmp/km-shots/`).

## Notlar

- Kayıt `kucuk-muhendisler.v1` (hesaba eşitlenir): çizim başına çözüldü/damgalar, her çizimdeki kurulum, son açılan çizim. Ses tercihi `kucuk-muhendisler.cihaz` (cihazda kalır).
- Çizimler sırayla açılır; adres sonuna `#hepsi` yazınca hepsi açılır (deneme için).
- Lab'da (`window.Hesap` varsa) her çözülen çizimde not yazılır (çizim, damga sayısı, elle basış); sonuç penceresinde ve bölümler sayfasında "Nasıldı?" düğmesi çıkar. Hesap yoksa bunlar görünmez.
- Görünüm tek: mavi kâğıtta teknik çizim. Gerçek malzemeli "canlı" görünüm denendi, beğenilmedi ve kaldırıldı; geri getirme. Çizim dili `game.js` → "çizim dili": kalın çizgi görünen kenar, ince çizgi ayrıntı, kesik çizgi görünmeyen kenar, çizgi-nokta eksen, çizgi-iki nokta hareketli parçanın öbür konumu, 45° tarama kesit (duvar, kova, boru, piston başlığı). Turuncu sadece elle kumanda edilen cihazlar, camgöbeği sensörler, sarı top ve hedef.
- Kurarken ölçü ve hareket çizgileri görünür: pistonun basınca varacağı yer, pervanenin erimi ("6 kare"), yayın fırlatma yönü; sürüklerken parçanın kenarları çerçeveye kadar uzar ve sütun/satır harfleri yanar. Çalışırken bunlar gizlenir; yerine çarpma çizgileri, sensör kablosunda sinyal noktası ve kovada hedef halkaları çıkar. Başarısız denemenin izi noktalı yol ve yön oklarıyla kalır, topun son görüldüğü yer kırmızı çarpıdır.
- Ayrıntı ekrana göre azalır (`makeView` → `lod`): parça listesi ve bölüm kartları sade çizilir.
- Arayüz Türkçe, kod İngilizce. App Store'a gidecekse metinler çevrilmeli. Odası yok.
- Deneme: sayfa içi `window.KM` (fizik), `window.KM_LEVELS`, `window.KM_GAME` (durum, `loadLevel`, `startRun`…).
