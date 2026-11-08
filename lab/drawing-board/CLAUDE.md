# Drawing Board

The Incredible Machine tarzı fizik bulmacası (Kasım 2026'ya kadarki adı "Küçük Mühendisler"; büyükler de oynadığı için İngilizce ad aldı). Her çizimde parça listesindeki parçaları tahtaya koyup topu kovaya ulaştıran makineyi kurarsın. TIM'den farkı: makine çalışırken turuncu cihazlar (piston, pervane, kapı, mıknatıs, flipper) oyuncunun elinde; sensör koyup cihaza bağlarsan makine dokunmadan çalışır ("Fully automatic" damgası). Tasarım notları, bölüm tablosu, doğru çözüm yerleri ve zamanlama pencereleri claude.ai'daki uzigames projesinde (`drawing-board.md`).

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Planck.js 1.5.1 jsDelivr'dan, fontlar (Big Shoulders Stencil, Barlow Semi Condensed) Google Fonts'tan gelir.
- `cover.png` paylaşım görseli (8. çizim tam otomatik çalışırken: sensör pistonu tetiklemiş, piston topu itiyor).
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `sim.js` fizik çekirdeği (Planck.js, sabit 1/120 sn adım, DOM yok; Node'da da çalışır): parçalar, sensörler, çoklu top/kova, top çeşitleri, `runHeadless`
  - `levels.js` 25 çizim, üç defter (`book`); her birinde ipuçları, damgalar ve testlerin doğruladığı çözümler (`sol`)
  - `game.js` arayüz: sürükle-bırak, kumanda, damgalar, bölüm seçimi (defter başlıklarıyla), teknik çizim (bkz. Görünüm), çalışırken efektler, kutlama ve yenilik anları (bkz. Oyun hissi), Lab bağlantıları
  - `audio.js` müzik ve sesler (`window.KM_AUDIO`, WebAudio sentezi, ses dosyası yok)
  - `index.html` sayfa iskeleti, `style.css` görünüm
  - `build.js` derleme; `test/` bölüm doğrulama ve tarayıcı denemeleri
- Derleme: `node lab/drawing-board/src/build.js --lab` → `index.html`. Hesap satırları olmayan tek başına kopya: `node lab/drawing-board/src/build.js /tmp/db.html`. İnternetsiz kopya (fontlar ve Planck içinde): önce `cd lab/drawing-board/src && npm install`, sonra `node build.js --local /tmp/km-local.html`.
- Bölüm testi: `cd lab/drawing-board/src && npm install && node test/design.js` (her bölüm: boş kurulum başarısız, kayıtlı çözümler başarılı). `node test/design.js <bölüm-id> --brute --sweep` tek parçalık bütün yerleşimleri ve elle basma pencerelerini tarar. Fizik ayarı (`sim.js` → `T`) ya da bir bölüm değişirse bunu çalıştır.
- Tarayıcı denemesi: `--local` derlemesinden sonra `python3 test/browser.py` (25 bölümü oynar) ve `python3 test/shots.py` (masaüstü, telefon, iPad, sürükleme anı, çalışma anı, başarısız deneme izi ve bölüm kartları; `/tmp/km-shots/`). `python3 test/juice.py` kutlamayı, sonuç kartını, "unlocked" anlarını ve NEW etiketlerini sıfır ilerlemeyle dener ve görüntüler. `python3 test/music.py` müziği ve sesleri bir dakikalık akışla çevrimdışı çalar: `music.wav`/`music.mp3` ve bölüm bölüm tepe/RMS düzeyi (tepe 0.98'i geçerse hata).

## Parçalar

- Rampa, yay, konveyör, tampon, piston (bas), pervane (basılı tut), flipper (bas / basılı tut), sensör, kapı, mıknatıs. Turuncu olanlar elle kumandalı; sensöre bağlanabilirler. Pervaneye ve mıknatısa bağlı sensör anahtar gibidir (açar, bir daha tetiklenirse kapatır); kapıya bağlı sensör kapıyı açar ya da kapatır.
- Kapı (`gate`): bir kare geçit, yanındaki kare yuva. Basınca levha yuvaya çekilir (açık), bir daha basınca geri gelir. `u` dik kapı (yuva üstte, yerde yuvarlanan topu durdurur; geçidin zemini karenin alt kenarında olmalı), `r` / `l` yatay kapak (yuva sağda / solda; üstü ve yuvası karenin 0.6 yüksekliğinde, zeminle aynı hizada olmalı). Kapanan levha önündeki topu ezmez, top çekilene kadar bekler. Yönüne göre alanı değişir: `KM.sizeOf(p)`.
- Mıknatıs (`magnet`): basılı tutunca yüzünün önündeki yarım dairede (`T.magRange`, 2.5 kare) çelik bilyeyi yüzün önündeki yuvaya çeker ve orada tutar; sarı topa etkisi yok. Çekiş fizik değil yönlendirme: alan içindeki bilye ağırlıksız gibi yuvaya doğru hızlanır, kuvvet sınırlı (`magV`, `magA`, `magK`, `magMax`). Bırakınca bilye düşer.
- Tampon (`bumper`, Defter 3): hücrenin köşegeninde sekitici levha, sürtünmesiz, top en az `T.bumpMin` (9) hızla geri seker. `r` \ biçiminde (düşen topu sağa atar, sağa giden topu aşağı çevirir), `l` / biçiminde (düşen topu sola, sağa yuvarlanan topu yukarı). Levha köşeden köşeye biraz taşar ki yerde yuvarlanan top ucuna değil yüzüne çarpsın; yukarı çıkan top sütun sınırında (x + 0.03) yükselir, ikinci tampon bir sütun solda iki satır yukarıda olur (Periscope).
- Flipper (`flipper`, Defter 3): 2×1, menteşe bir uçta (`l`: menteşe sağda, kol sola uzanır; `r` tersi), kinematik kol `T.flipDown` (-0.3) ile `T.flipUp` (0.45) arasında `flipW` hızla kalkar. Basılı tutunca kalkık kalır; kısa dokunuş ya da sensör en az `flipPulse` (0.25 sn) tam vuruş yapar. Kolun ucunda bir dikmeye dayanıp duran top dik yukarı uçar (her basışta aynı, bölümler buna dayanıyor); yuvarlanırken vurulan top yukarı ve uca doğru, zamanlamaya göre çok farklı yerlere gider. Sensörlü çözümde flipper top gelirken vurduğu için yol elle çözümden farklıdır (Bank Shot, Pinball).
- Top çeşitleri: `balls[i].kind` (`yellow` / `steel`); yazılmazsa ilk top sarı, diğerleri çelik. Yeni bölümlerde her topa `kind` yaz. Kovaya `kind` yazılırsa (bayraklı kova) yalnızca o renkten topu sayar; bayrak ve hedef o topun renginde çizilir.

## Notlar

- Kayıt `drawing-board.v1` (hesaba eşitlenir): çizim başına çözüldü/damgalar, her çizimdeki kurulum, son açılan çizim. Ses ve müzik tercihi `drawing-board.device` (`muted`, `music`; cihazda kalır, daha önce sesi kapatmış olanda müzik de kapalı başlar). Eski anahtarlardaki (`kucuk-muhendisler.v1`, `kucuk-muhendisler.cihaz`) kayıt açılışta bir kez taşınır.
- Çizimler sırayla açılır (defterden deftere de); adres sonuna `#hepsi` yazınca hepsi açılır (deneme için). Defter adları `game.js` → `BOOKS`.
- Lab'da (`window.Hesap` varsa) her çözülen çizimde not yazılır (Türkçe: çizim, damga sayısı, elle basış); sonuç penceresinde ve bölümler sayfasında "Nasıldı?" düğmesi çıkar (Lab'ın düğmesi, Türkçe kalır). Hesap yoksa bunlar görünmez.
- Görünüm tek: mavi kâğıtta teknik çizim. Gerçek malzemeli "canlı" görünüm denendi, beğenilmedi ve kaldırıldı; geri getirme. Çizim dili `game.js` → "çizim dili": kalın çizgi görünen kenar, ince çizgi ayrıntı, kesik çizgi görünmeyen kenar, çizgi-nokta eksen, çizgi-iki nokta hareketli parçanın öbür konumu, 45° tarama kesit (duvar, kova, boru, piston başlığı, kapı levhası, mıknatıs kutbu). Turuncu sadece elle kumanda edilen cihazlar, camgöbeği sensörler, sarı top ve hedef, gri çelik bilye.
- Kurarken ölçü ve hareket çizgileri görünür: pistonun basınca varacağı yer, pervanenin erimi ("6 squares"), mıknatısın erimi (yarım daire, "2.5 squares"), yayın fırlatma yönü, kapının aç-kapa oku; sürüklerken parçanın kenarları çerçeveye kadar uzar ve sütun/satır harfleri yanar. Çalışırken bunlar gizlenir; yerine çarpma çizgileri, sensör kablosunda sinyal noktası, mıknatıs alan çizgileri ve kovada hedef halkaları çıkar. Başarısız denemenin izi noktalı yol ve yön oklarıyla kalır, topun son görüldüğü yer kırmızı çarpıdır.
- Ayrıntı ekrana göre azalır (`makeView` → `lod`): parça listesi ve bölüm kartları sade çizilir.
- Oyunun içi İngilizce, kod İngilizce, yorumlar Türkçe. Odası yok.

## Atölye (kendi çizimin)

- Bölümler sayfasında "+ New drawing", Atölye çiziminde "Edit this drawing". Düzenlerken (`S.mode === 'edit'`) yan panelde araçlar: Wall (dokun/sürükle; duvardan başlarsan siler), Ball (boru; aynı yere dokununca yön r → l → d), Cup (2 kare), Part (sabit parça; dokununca döner), Erase; oyuncunun parça listesi (− / +), ad. "Test it" kaydeder ve oynatır, "Share link" adresi kopyalar (telefonda paylaş penceresi).
- Çizim sıkışık tutulur (`cleanDoc`: id `ws-…`, ad, boru, kova, duvar hücreleri, sabit parçalar, tray); `wsLevel()` oynanır bölüme çevirir (yan yana duvar hücreleri tek blok, damgalar: Machine works, elle kumandalı sabit cihaz + sensör varsa Fully automatic). `syncWS()` Atölye çizimlerini `LEVELS`'in sonuna `book: 'W'` olarak ekler; hep açıktır, antette "Workshop" yazar.
- Kayıt `drawing-board.workshop` (hesaba eşitlenir). Değişen çizimin damgaları ve kurulumu silinir.
- Paylaşım: `#cizim=<base64url JSON>`; açılışta `importFromHash()` çizimi süzüp (bilinen alanlar, tahtanın içi, ad yalnız harf/rakam/basit noktalama) Atölye defterine ekler ve açar. Ad sayfaya yazılırken de süzülür (`cleanName`).
- Sensör sabit parça olarak konamaz (yalnız oyuncunun listesinde). Çizimin çözülebilir olduğunu bot denetlemiyor; yapan kişi "Test it" ile kendisi dener.

## Oyun hissi (müzik, kutlama, yenilik)

- Müzik (`audio.js`): her çizimin kendi tonu, akor yürüyüşü, marimba ostinatosu ve ezgisi var (çizim kimliğinden tohum; aynı çizim hep aynı şarkı). 84 BPM, hafif swing. Kipler: `build` kurarken sakin (piyano akorları, bas, seyrek marimba, iki turda bir ezgi), `run` makine çalışırken saat tıkırtısı, yumuşak davul, akor vuruşları ve ostinato girer, `menu` pencere açıkken kısık ve boğuk. Katmanlar bir sonraki vuruşta girer; yeni çizimin şarkısı bir sonraki ölçüde başlar. Müzik ilk dokunuşta başlar (tarayıcı kuralı), sekme gizlenince durur. Antetteki nota düğmesi müziği, hoparlör düğmesi sesleri açıp kapatır.
- Sesler o an çalan akordan nota seçer (yay, sensör, kapı, piston, mıknatıs, kova); topun çarpması yüksekliğine göre pentatonikten nota çalar, merdivenden inen top inen bir ezgi çalar. Kova sesi her topta bir basamak yukarıdan başlar.
- Son top kovaya girince: an donar (0.09 sn), sonra ağır çekim; tahta bir an aydınlanır, kovadan ışınlar çıkar ve üstünde onay işareti kendini çizer; müzik o anki akorda bir arpejle biter ve sonraki ölçüde baştan başlar. Sonuç 1.05 sn sonra açılır.
- Sonuç kartı sırayla açılır: kart gelir, sarı APPROVED damgası basılır (kart sarsılır), damgalar tek tek düşer (yenileri halkalı, yükselen notayla), ilk çözümde ve bütün damgalar yeni tamamlandığında konfeti. Başlık: ilk çözüm "It works!" (hepsi birden alındıysa "Perfect!"), yeni damga "New stamp!" / "All stamps!", tekrarlarda değişen kısa başlıklar.
- Yenilik (`NEWS`, `INTRO`): bir çizim ilk kez çözülünce sonraki çizim yeni bir şey getiriyorsa kartta "New part unlocked!" (parça), "New ball unlocked!" (çelik bilye), "New cup unlocked!" (bayraklı kova) ve defter değişiyorsa "Notebook 2 unlocked" çıkar: dönen ışınlar önünde parçanın çizimi, adı ve tek cümlelik açıklama. Çizimin içinde, çözülene kadar yeni parça listede "New" etiketli; tahtadaki yeni sabit parça ilk çalıştırmaya kadar kesik sarı çerçeveli ve "NEW" etiketli. Bölüm kartlarında da "New: Spring" gibi rozet var (kilitliyken merak uyandırsın diye).
- Hareket azaltılmışsa (`prefers-reduced-motion`) konfeti, ağır çekim ve kart animasyonları yok; sesler ve yenilik kartı kalır.
- Yeni bir parça ya da kural eklenince `NEWS`'e bir satır ekle; `INTRO` hangi çizimde ilk görüldüğünü kendisi bulur.
- Deneme: sayfa içi `window.KM` (fizik), `window.KM_LEVELS`, `window.KM_GAME` (durum, `loadLevel`, `startRun`…).
