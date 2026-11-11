# Kelime Tenisi

Kelime merdiveni, tenis gibi oynanır. Umut ile eşinin isteğinden çıktı: karşılıklı ve kısa süren bir kelime oyunu (Boggle gibi ama ikisi ayrı ayrı oynamıyor, attığın kelime rakibin sorunu oluyor). Fikir, pazar taraması ve diğer konseptler claude.ai'daki uzigames projesinde (`kelime-oyunu.md`).

## Kurallar

- **Servis:** sunucuya üç kelime gösterilir (sözlüğün `serve` listesinden: iyi bilinen, en az 4 bilinen komşusu olan kelimeler), biri seçilir. 10 sn içinde seçmezse rastgele biri gider. Bir maçta aynı servis kelimesi iki kez gelmez.
- **Dönüş:** gelen kelimenin tek harfi değiştirilir (aynı uzunluk). Yeni kelime sözlükte olmalı ve o sayıda oynanmamış olmalı (oynanan kelime yanar). Hatalı deneme sırayı değiştirmez, sadece süre gider.
- **Süre:** Rahat 10 sn'den 5'e, Normal 7'den 3,5'e, Hızlı 5'ten 2,5'e; her vuruşta 0,5 / 0,4 / 0,3 sn kısalır. İki kişide oyuncu başına +0 / +2 / +4 sn handikap (anne-baba ile çocuk için).
- **Sayı:** süresinde dönemeyen kaybeder. Kaybedenin yarısında yazabileceği kelimeler çıkar (önce bilinenler, en çok 5).
- **Smaç:** gönderilen kelimenin sözlükte kullanılmamış hiç komşusu yoksa sayı hemen gönderenin.
- **Skor:** 15-30-40-oyun; 40-40'ta sıradaki sayı oyunu alır (altın sayı, "deuce" yok). Kısa maç 1 oyun (varsayılan), uzun maç 3'te 2. Servis her oyunda el değiştirir; iki kişide ilk servis yazı tura, bota karşı oyuncu başlar.
- **İki kişi:** tek ekran; üst yarı 180° dönük, karşılıklı oturmak için (iPad masada). Herkesin kendi klavyesi var, sırası olmayanınki sönük. Maç sonu kartının bir kopyası üstteki oyuncu için ters durur.
- **Bota karşı:** oyuncu altta, bot üstte küçük bir şeritte.
- **Giriş:** önce değişecek harfe dokun, sonra ekran klavyesinden yeni harfe. Bilgisayarda bütün kelimeyi yazmak da olur (4 harf yazılınca kendiliğinden gönderilir); 1–4 ile harf seçip tek harf yazmak da. Esc mola.

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Dış bağlantı yok (yazı tipi gömülü).
- `cover.png` paylaşım görseli, `icon.png` ana ekran simgesi: `src/tools/cover.py` üretir.
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `words.js` üretilmiş sözlük. **Elle düzenleme**: `tools/words.py` üretir.
  - `core.js` DOM'suz kurallar, sözlük araması (tek harf farkı için `k_sa` kovaları) ve bot. Node'da da çalışır.
  - `app.js` arayüz (menü, oyun, mola, sonuç, nasıl oynanır), `audio.js` WebAudio sesleri, `index.html` iskelet, `style.css` görünüm, `build.js` derleme.
  - `fonts/` Nunito (OFL). Fredoka kullanma: Fredoka'da ğ, ş, İ yok.
  - `test/core.test.js` sözlük, Türkçe büyük/küçük harf, kurallar, bot maçları (sonunda bot maçlarının ralli/süre tablosu); `test/browser.py` telefonda bota karşı, iPad dik ve yatay iki kişi, İngilizce, gerçek dokunma (görüntüler `/tmp/kt-shots/`).
- Derleme: `node lab/kelime-tenisi/src/build.js --lab` → `index.html`. Hesapsız tek başına kopya: `node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html`.
- Deneme: `node lab/kelime-tenisi/src/test/core.test.js`, sonra tek başına kopyayı derleyip `python3 lab/kelime-tenisi/src/test/browser.py`.

## Sözlük

- **Türkçe:** Zemberek-NLP sözlüğü (Apache-2.0; `master-dictionary.dict` + `non-tdk.dict`). Yalnız sözlük maddeleri, çekimli biçim yok; şapkalı harfler düz (kâr → kar). Alfabe 29 harf (q, w, x yok). Büyük harf `toLocaleUpperCase('tr-TR')`: i → İ, ı → I.
- **İngilizce:** ENABLE (kamu malı), çekimli biçimler dahil (cats, ran).
- **Bilinen (`common`):** wordfreq Zipf ≥ 3 (wordfreq verisi CC-BY-SA 4.0) eksi elle ayıklananlar (`NOT_COMMON`: eski, teknik, dini, etnik, ünlem, kısaltma; Türkçede sıklığı başka kelimenin çekiminden gelenler (gele, dine…), İngilizcede çoğunlukla ad olarak geçenler (tony, jill…)). Bot yalnız bilinenleri oynar; servisler bilinenlerden; ipucunda önce bilinenler.
- **`rare`:** öbür sözlük kelimeleri; oyuncu yazarsa kabul edilir.
- **`BLOCK`:** hiç kabul edilmez (aile oyunu; LDNOOBW listeleri + elle; Türkçe sözlüğe karışmış İngilizce kelimeler). **`SOFT`:** oyuncu yazarsa kabul, ama bot, servis ve ipucu kullanmaz (şiddet, alkol, hakaret, tuvalet).
- **Yoğunluk (11 Kasım 2026):** TR 4 harf 838 bilinen, ortalama 2,6 bilinen komşu, %19'unun hiç bilinen komşusu yok → kısa ralliler, sık smaç fırsatı. TR 3 harf 342 bilinen, ortalama 7,2. EN 4 harf 1640, ortalama 6,5; EN 3 harf 512, ortalama 10,3. 5 harf çok seyrek (TR ortalama 1,6), oyunda yok. Ayrıntı `src/tools/stats.json`.
- Yeniden üretmek: betiğin başındaki URL'lerden kaynakları bir klasöre indir (LDNOOBW listeleri npm `naughty-words` paketinden `naughty-tr.json` / `naughty-en.json` adıyla), `pip install wordfreq`, `python3 lab/kelime-tenisi/src/tools/words.py <klasör>`.
- **App Store'dan önce:** wordfreq verisi CC-BY-SA 4.0. "Bilinen" işaretinin buradan türemesi için atıf ve lisans kontrolü gerekir (ya da kendi listemizi çıkarırız). Zemberek (Apache-2.0) ve ENABLE (kamu malı) sorun değil.

## Kayıt ve Lab

- `kelime-tenisi.v1` (hesaba eşitlenir, `data-kayit`): bota karşı galibiyet/yenilgi (seviye seviye), iki kişilik maç sayısı, en uzun ralli ve kelimeleri, smaç sayısı. Menüde rekor satırı buradan.
- `kelime-tenisi.device` (cihazda): dil, kelime boyu, süre, maç biçimi, bot seviyesi, adlar, handikap, ses, "nasıl oynanır" görüldü mü. İlk oyuncu adı Lab profilinden gelir.
- Not (Türkçe): maç başı (mod, dil, harf, süre, biçim), maç sonu (sonuç, skor, en uzun ralli, smaç, süre).
- "Nasıldı?" mola penceresinde (`mola`) ve maç sonunda (`mac-sonu`). Odası yok.
- Deneme: `kelime-tenisi.debug` = `1` sayfanın içini `window.__kt` olarak açar (`G`, `speed`, `timeout()`).

## Bot

- Kolay: bilinen dönüşlerin %50'sini görür, 2,4–4,6 sn düşünür. Orta: %72, 1,6–3,6 sn, yarı yarıya rakibe en az dönüş bırakan kelimeyi seçer. Zor: %90, 1,0–2,5 sn, %85 en sıkıştıran kelime. Az seçenek varken daha geç bulur; süresi biterse sayıyı verir. Ayarlar `core.js` → `LEVELS`.
- Bot maçlarında (normal süre) TR 4 harf sayı ortalama 4,8 kelime; eşit iki oyuncuyla 3'te 2 maç ~7 dk. Varsayılan bu yüzden kısa maç (~3 dk).

## Sıradaki

- Umut ile eşinin denemesi: süre (Rahat mı Normal mi), 3 harf mi 4 harf mi, smaç sıklığı, ipucu listesi okunuyor mu.
- Online, iki telefonda karşılıklı: ortak odalar (`oda.js`) burada uymaz (sıra tabanlı ve canlı); ayrı bir Durable Object gerekir.
- Özel vuruşlar: harf ekle/çıkar (3-4-5 harf arası), Türkçe "ek ekleme" modu.
