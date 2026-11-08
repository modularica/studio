# Küçük Mühendisler

The Incredible Machine tarzı fizik bulmacası. Her çizimde parça listesindeki parçaları (rampa, yay, konveyör, sensör) tahtaya koyup topu kovaya ulaştıran makineyi kurarsın. TIM'den farkı: makine çalışırken turuncu cihazlar (piston, pervane) oyuncunun elinde; sensör koyup cihaza bağlarsan makine dokunmadan çalışır ("Tam otomatik" damgası). Tasarım notları, bölüm tablosu, doğru çözüm yerleri ve zamanlama pencereleri claude.ai'daki uzigames projesinde (`kucuk-muhendisler.md`).

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Planck.js 1.5.1 jsDelivr'dan, fontlar (Big Shoulders Stencil, Barlow Semi Condensed) Google Fonts'tan gelir.
- `cover.png` paylaşım görseli (8. çizim, çizimin canlıya dönüştüğü an).
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `sim.js` fizik çekirdeği (Planck.js, sabit 1/120 sn adım, DOM yok; Node'da da çalışır): parçalar, sensörler, çoklu top/kova, `runHeadless`
  - `levels.js` 14 çizim; her birinde ipuçları, damgalar ve testlerin doğruladığı çözümler (`sol`)
  - `game.js` arayüz: sürükle-bırak, kumanda, damgalar, bölüm seçimi, iki çizim stili (çizim ve canlı) ve aralarındaki tarama, sesler (WebAudio, yer tutucu), Lab bağlantıları
  - `index.html` sayfa iskeleti, `style.css` görünüm
  - `build.js` derleme; `test/` bölüm doğrulama ve tarayıcı denemeleri
- Derleme: `node lab/kucuk-muhendisler/src/build.js --lab` → `index.html`. Hesap satırları olmayan tek başına kopya: `node lab/kucuk-muhendisler/src/build.js /tmp/km.html`. İnternetsiz kopya (fontlar ve Planck içinde): önce `cd lab/kucuk-muhendisler/src && npm install`, sonra `node build.js --local /tmp/km-local.html`.
- Bölüm testi: `cd lab/kucuk-muhendisler/src && npm install && node test/design.js` (her bölüm: boş kurulum başarısız, kayıtlı çözümler başarılı). `node test/design.js <bölüm-id> --brute --sweep` tek parçalık bütün yerleşimleri ve elle basma pencerelerini tarar. Fizik ayarı (`sim.js` → `T`) ya da bir bölüm değişirse bunu çalıştır.
- Tarayıcı denemesi: `--local` derlemesinden sonra `python3 test/browser.py` (14 bölümü oynar) ve `python3 test/looks.py` (üç görünümün ekran görüntüleri, `/tmp/km-shots/`).

## Notlar

- Kayıt `kucuk-muhendisler.v1` (hesaba eşitlenir): çizim başına çözüldü/damgalar, her çizimdeki kurulum, son açılan çizim. Ses ve görünüm `kucuk-muhendisler.cihaz` (cihazda kalır).
- Çizimler sırayla açılır; adres sonuna `#hepsi` yazınca hepsi açılır (deneme için).
- Lab'da (`window.Hesap` varsa) her çözülen çizimde not yazılır (çizim, damga sayısı, elle basış, görünüm); sonuç penceresinde ve bölümler sayfasında "Nasıldı?" düğmesi çıkar. Hesap yoksa bunlar görünmez.
- Görünüm düğmesi (üst bar): Çizim, Çizim → canlı (varsayılan; çalıştırınca tarama, makine taramadan sonra başlar), Canlı (kurarken de gerçek malzemeler). Fizik her görünümde aynı.
- Arayüz Türkçe, kod İngilizce. App Store'a gidecekse metinler çevrilmeli. Odası yok.
- Deneme: sayfa içi `window.KM` (fizik), `window.KM_LEVELS`, `window.KM_GAME` (durum, `loadLevel`, `setLook`…).
