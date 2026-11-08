# Drawing Board

The Incredible Machine tarzı fizik bulmacası (Kasım 2026'ya kadarki adı "Küçük Mühendisler"; büyükler de oynadığı için İngilizce ad aldı). Her çizimde parça listesindeki parçaları tahtaya koyup topu kovaya ulaştıran makineyi kurarsın. TIM'den farkı: makine çalışırken turuncu cihazlar (piston, pervane, kapı, mıknatıs) oyuncunun elinde; sensör koyup cihaza bağlarsan makine dokunmadan çalışır ("Fully automatic" damgası). Tasarım notları, bölüm tablosu, doğru çözüm yerleri ve zamanlama pencereleri claude.ai'daki uzigames projesinde (`drawing-board.md`).

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Planck.js 1.5.1 jsDelivr'dan, fontlar (Big Shoulders Stencil, Barlow Semi Condensed) Google Fonts'tan gelir.
- `cover.png` paylaşım görseli (8. çizim tam otomatik çalışırken: sensör pistonu tetiklemiş, piston topu itiyor).
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `sim.js` fizik çekirdeği (Planck.js, sabit 1/120 sn adım, DOM yok; Node'da da çalışır): parçalar, sensörler, çoklu top/kova, top çeşitleri, `runHeadless`
  - `levels.js` 20 çizim, iki defter (`book`); her birinde ipuçları, damgalar ve testlerin doğruladığı çözümler (`sol`)
  - `game.js` arayüz: sürükle-bırak, kumanda, damgalar, bölüm seçimi (defter başlıklarıyla), teknik çizim (bkz. Görünüm), çalışırken efektler, sesler (WebAudio, yer tutucu), Lab bağlantıları
  - `index.html` sayfa iskeleti, `style.css` görünüm
  - `build.js` derleme; `test/` bölüm doğrulama ve tarayıcı denemeleri
- Derleme: `node lab/drawing-board/src/build.js --lab` → `index.html`. Hesap satırları olmayan tek başına kopya: `node lab/drawing-board/src/build.js /tmp/db.html`. İnternetsiz kopya (fontlar ve Planck içinde): önce `cd lab/drawing-board/src && npm install`, sonra `node build.js --local /tmp/km-local.html`.
- Bölüm testi: `cd lab/drawing-board/src && npm install && node test/design.js` (her bölüm: boş kurulum başarısız, kayıtlı çözümler başarılı). `node test/design.js <bölüm-id> --brute --sweep` tek parçalık bütün yerleşimleri ve elle basma pencerelerini tarar. Fizik ayarı (`sim.js` → `T`) ya da bir bölüm değişirse bunu çalıştır.
- Tarayıcı denemesi: `--local` derlemesinden sonra `python3 test/browser.py` (20 bölümü oynar) ve `python3 test/shots.py` (masaüstü, telefon, iPad, sürükleme anı, çalışma anı, başarısız deneme izi ve bölüm kartları; `/tmp/km-shots/`).

## Parçalar

- Rampa, yay, konveyör, piston (bas), pervane (basılı tut), sensör, kapı, mıknatıs. Turuncu olanlar elle kumandalı; sensöre bağlanabilirler. Pervaneye ve mıknatısa bağlı sensör anahtar gibidir (açar, bir daha tetiklenirse kapatır); kapıya bağlı sensör kapıyı açar ya da kapatır.
- Kapı (`gate`): bir kare geçit, yanındaki kare yuva. Basınca levha yuvaya çekilir (açık), bir daha basınca geri gelir. `u` dik kapı (yuva üstte, yerde yuvarlanan topu durdurur; geçidin zemini karenin alt kenarında olmalı), `r` / `l` yatay kapak (yuva sağda / solda; üstü ve yuvası karenin 0.6 yüksekliğinde, zeminle aynı hizada olmalı). Kapanan levha önündeki topu ezmez, top çekilene kadar bekler. Yönüne göre alanı değişir: `KM.sizeOf(p)`.
- Mıknatıs (`magnet`): basılı tutunca yüzünün önündeki yarım dairede (`T.magRange`, 2.5 kare) çelik bilyeyi yüzün önündeki yuvaya çeker ve orada tutar; sarı topa etkisi yok. Çekiş fizik değil yönlendirme: alan içindeki bilye ağırlıksız gibi yuvaya doğru hızlanır, kuvvet sınırlı (`magV`, `magA`, `magK`, `magMax`). Bırakınca bilye düşer.
- Top çeşitleri: `balls[i].kind` (`yellow` / `steel`); yazılmazsa ilk top sarı, diğerleri çelik. Yeni bölümlerde her topa `kind` yaz. Kovaya `kind` yazılırsa (bayraklı kova) yalnızca o renkten topu sayar; bayrak ve hedef o topun renginde çizilir.

## Notlar

- Kayıt `drawing-board.v1` (hesaba eşitlenir): çizim başına çözüldü/damgalar, her çizimdeki kurulum, son açılan çizim. Ses tercihi `drawing-board.device` (cihazda kalır). Eski anahtarlardaki (`kucuk-muhendisler.v1`, `kucuk-muhendisler.cihaz`) kayıt açılışta bir kez taşınır.
- Çizimler sırayla açılır (defterden deftere de); adres sonuna `#hepsi` yazınca hepsi açılır (deneme için). Defter adları `game.js` → `BOOKS`.
- Lab'da (`window.Hesap` varsa) her çözülen çizimde not yazılır (Türkçe: çizim, damga sayısı, elle basış); sonuç penceresinde ve bölümler sayfasında "Nasıldı?" düğmesi çıkar (Lab'ın düğmesi, Türkçe kalır). Hesap yoksa bunlar görünmez.
- Görünüm tek: mavi kâğıtta teknik çizim. Gerçek malzemeli "canlı" görünüm denendi, beğenilmedi ve kaldırıldı; geri getirme. Çizim dili `game.js` → "çizim dili": kalın çizgi görünen kenar, ince çizgi ayrıntı, kesik çizgi görünmeyen kenar, çizgi-nokta eksen, çizgi-iki nokta hareketli parçanın öbür konumu, 45° tarama kesit (duvar, kova, boru, piston başlığı, kapı levhası, mıknatıs kutbu). Turuncu sadece elle kumanda edilen cihazlar, camgöbeği sensörler, sarı top ve hedef, gri çelik bilye.
- Kurarken ölçü ve hareket çizgileri görünür: pistonun basınca varacağı yer, pervanenin erimi ("6 squares"), mıknatısın erimi (yarım daire, "2.5 squares"), yayın fırlatma yönü, kapının aç-kapa oku; sürüklerken parçanın kenarları çerçeveye kadar uzar ve sütun/satır harfleri yanar. Çalışırken bunlar gizlenir; yerine çarpma çizgileri, sensör kablosunda sinyal noktası, mıknatıs alan çizgileri ve kovada hedef halkaları çıkar. Başarısız denemenin izi noktalı yol ve yön oklarıyla kalır, topun son görüldüğü yer kırmızı çarpıdır.
- Ayrıntı ekrana göre azalır (`makeView` → `lod`): parça listesi ve bölüm kartları sade çizilir.
- Oyunun içi İngilizce, kod İngilizce, yorumlar Türkçe. Odası yok.
- Deneme: sayfa içi `window.KM` (fizik), `window.KM_LEVELS`, `window.KM_GAME` (durum, `loadLevel`, `startRun`…).
