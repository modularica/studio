# Kelime Düellosu (eski adı Kelime Tenisi)

Kelime merdiveni, karşılıklı oynanır. Umut ile eşinin isteğinden çıktı: karşılıklı ve kısa süren bir kelime oyunu (Boggle gibi ama ikisi ayrı ayrı oynamıyor, gönderdiğin kelime rakibin sorunu oluyor). Fikir, pazar taraması, mekanik ölçümleri ve diğer konseptler claude.ai'daki uzigames projesinde (`kelime-oyunu.md`); sıralama/lig araştırması `kelime-tenisi-rekabet.md`.

- İlk sürüm tenis gibiydi (servis, 15-30-40, kort, top, smaç). Umut'a karışık geldi; 11 Kasım 2026'da tenis kaldırıldı. Ad şimdilik "Kelime Düellosu", konsept ve tasarım sonra konuşulacak.
- **Adres ve anahtarlar eski adla kalıyor:** klasör ve slug `kelime-tenisi`, kayıt `kelime-tenisi.v1`, cihaz ayarı `kelime-tenisi.device`, deneme `kelime-tenisi.debug`. Paylaşılan link ve kayıtlar bozulmasın diye değiştirme; ad kesinleşince taşınır.

## Kurallar

- **Başlangıç:** sırası gelen oyuncuya üç kelime gösterilir (sözlüğün `serve` listesinden: iyi bilinen, en az 4 bilinen komşusu olan kelimeler), biri seçilip karşıya gönderilir. 10 sn içinde seçmezse rastgele biri gider. Bir maçta aynı başlangıç kelimesi iki kez gelmez. Başlayan her sayıda değişir; iki kişide ilk başlayan yazı tura, bota karşı oyuncu başlar.
- **Cevap:** gelen kelimenin tek harfi değiştirilir (aynı uzunluk). Yeni kelime listede olmalı ve o sayıda oynanmamış olmalı (oynanan kelime yanar). Hatalı deneme sırayı değiştirmez, sadece süre gider.
- **Süre:** Rahat 10 sn'den 5'e, Normal 7'den 3,5'e, Hızlı 5'ten 2,5'e; her kelimede 0,5 / 0,4 / 0,3 sn kısalır. İki kişide oyuncu başına +0 / +2 / +4 sn handikap (anne-baba ile çocuk için).
- **Sayı:** süresinde cevap veremeyen kaybeder. Kaybedenin yarısında yazabileceği kelimeler çıkar (önce bilinenler, en çok 5).
- **Çıkmaz:** gönderilen kelimenin listede kullanılmamış hiç komşusu yoksa sayı hemen gönderenin.
- **Maç:** sayı yarışı. Kısa maç 5 sayı (varsayılan), uzun maç 9 (`core.js` → `TARGET`). Hedefe bir sayı kalınca "Maç sayısı".
- **Hangi kelimeler (Türkçe):** sözlük kelimeleri (türetilmişler dahil: ÜNLÜ, UÇUŞ) ve iyi bilinen fiillerin kökü (GEL, ANLA, OTUR; sözlüklerde fiiller -mek'li durduğu için). Ekli haller geçmez (EVDE, YOLU, ALDI, BANA). 11 Kasım 2026'da bir günlüğüne "Ekli kelimeler: Geçer" ayarı vardı (commit 7407cb2, kökü kelimenin yanında yazıyordu); ekli isimler saçma geldi (Umut), aynı gün kaldırıldı. İngilizcede ENABLE zaten çekimli biçimleri içeriyor (cats, ran).
- **İki kişi:** tek ekran; üst yarı 180° dönük, karşılıklı oturmak için (iPad masada). Herkesin kendi klavyesi var, sırası olmayanınki sönük. Ortadaki koyu şeritte gönderilen kelime karşıya uçar (karşıya geçerken döner). Maç sonu kartının bir kopyası üstteki oyuncu için ters durur.
- **Bota karşı:** oyuncu altta, bot üstte küçük bir şeritte.
- **Giriş:** önce değişecek harfe dokun, sonra ekran klavyesinden yeni harfe. Bilgisayarda bütün kelimeyi yazmak da olur (4 harf yazılınca kendiliğinden gönderilir); 1–4 ile harf seçip tek harf yazmak da; 1–3 başlangıç kelimesini seçer. Esc mola.

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**, kaynağı değiştirip yeniden derle. Dış bağlantı yok (yazı tipi gömülü).
- `cover.png` paylaşım görseli, `icon.png` ana ekran simgesi: `src/tools/cover.py` üretir.
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `words.js` üretilmiş sözlük. **Elle düzenleme**: `tools/words.py` üretir.
  - `core.js` DOM'suz kurallar, sözlük araması (tek harf farkı için `k_sa` kovaları, `Lexicon(words, lang, len)`) ve bot. Node'da da çalışır.
  - `app.js` arayüz (menü, oyun, mola, sonuç, nasıl oynanır), `audio.js` WebAudio sesleri, `index.html` iskelet, `style.css` görünüm, `build.js` derleme.
  - `fonts/` Nunito (OFL). Fredoka kullanma: Fredoka'da ğ, ş, İ yok.
  - `test/core.test.js` sözlük (fiil kökleri geçer, ekli haller geçmez), Türkçe büyük/küçük harf, kurallar, bot maçları (sonunda bot maçlarının zincir/süre tablosu); `test/browser.py` telefonda bota karşı, 3 harfte fiil kökü (eski ekli ayarlı cihazla), iPad dik ve yatay iki kişi, dil, gerçek dokunma (görüntüler `/tmp/kt-shots/`). Rastgelelik tohumlu, her seferinde aynı maçlar.
- Derleme: `node lab/kelime-tenisi/src/build.js --lab` → `index.html`. Hesapsız tek başına kopya: `node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html`.
- Deneme: `node lab/kelime-tenisi/src/test/core.test.js`, sonra tek başına kopyayı derleyip `python3 lab/kelime-tenisi/src/test/browser.py`.

## Sözlük

- **Türkçe:** Zemberek-NLP sözlüğü (Apache-2.0; `master-dictionary.dict` + `non-tdk.dict`). Şapkalı harfler düz (kâr → kar). Alfabe 29 harf (q, w, x yok). Büyük harf `toLocaleUpperCase('tr-TR')`: i → İ, ı → I.
- **Türetilmiş kelimeler (`EXTRA`, 91 kelime):** Zemberek'in sözlükte tutmayıp kuralla ürettiği kelimeler (-lI ünlü, -CI okçu, -mA yeme, -Iş uçuş, -sI otsu, -CA azca). Zemberek'in çözümleyicisiyle (pip `zemberek-python`; Python 3.13'te `typing.io` yamasıyla çalışır) bulundu, yalnız Türkçe Vikisözlük'ün kelime listesinde de olanlar tutuldu (GitHub `mertemin/turkish-word-list`, Vikisözlük'ten toplanmış, CC-BY-SA), yanlış köklü çözümlemeler (aklı = ak+lı) elle atıldı.
- **Fiil kökleri:** Zemberek'in çözümleyicisiyle bütün 3 ve 4 harfli diziler denendi (ilk çalıştırma ~4 dk, sonuç önbellekte `tr-forms-v2.json`). Kökünün kendisi olan fiil okunuşu (emir: gel, anla) olan ve fiili (gelmek) wordfreq Zipf ≥ 3 olan biçimler alındı (`VERB_ZIPF`): 3 harfte 44, 4 harfte 35 kelime (liste `src/tools/stats.json` → `tr-roots`). İsim gibi okunanlar atıldı (`NOT_ROOTS`: taşı, dile, akla, arın). Kaba okunuşu olan hiç geçmez (sik). Şiddet ve tuvalet fiilleri (döv, boğ, kus) `SOFT`. `NOT_COMMON_ROOTS`: geçer ama bot oynamaz (sok, göm; sıklığı başka kelimeden gelen sun, kon, öner).
- **TDK'ya yakın bir listeye göre (Vikisözlük, ölçüm için; liste oyuna girmez):** sözlük kelimelerinde 3 harflilerin %97,5'i, 4 harflilerin %96,9'u geçerli. Eksikler: çekimli zamirler (bana, sana; ekli haller geçmediği için bilerek yok), engellenenler, Türkçe sözlüğe karışmış İngilizceler (mail, idea), birkaç eski kelime (borş, tuşe).
- **İngilizce:** ENABLE (kamu malı), çekimli biçimler dahil (cats, ran).
- **Bilinen (`common`):** wordfreq Zipf ≥ 3 (wordfreq verisi CC-BY-SA 4.0) eksi elle ayıklananlar (`NOT_COMMON`: eski, teknik, dini, etnik, ünlem, kısaltma; Türkçede sıklığı başka kelimenin çekiminden gelenler (gele, dine…), İngilizcede çoğunlukla ad olarak geçenler (tony, jill…)). Bot yalnız bilinenleri oynar; başlangıç kelimeleri bilinenlerden; ipucunda önce bilinenler.
- **`rare`:** öbür kelimeler; oyuncu yazarsa kabul edilir. 3'ten az bilinen seçenek varsa ipucunda da çıkar.
- **`BLOCK`:** hiç kabul edilmez (aile oyunu; LDNOOBW listeleri + elle; Türkçe sözlüğe karışmış İngilizce kelimeler). **`SOFT`:** oyuncu yazarsa kabul, bot ve başlangıç kullanmaz (şiddet, alkol, hakaret, tuvalet).
- **Yoğunluk (11 Kasım 2026, `src/tools/stats.json`):** TR 4 harf 2.077 geçerli, 902 bilinen, ortalama 2,8 bilinen komşu; 152 bilinen kelimenin hiç bilinen komşusu yok. TR 3 harf 810 / 377 / 7,8. EN 4 harf 3.864 / 1.640 / 6,5; EN 3 harf 964 / 512 / 10,3. 5 harf çok seyrek (TR sözlük ortalama 1,8), oyunda yok. Ekli kural açıkken TR 4 harf 4.381 / 1.220 / 4,1 idi; artışın neredeyse hepsi isim eklerinden geliyordu (fiillerin bütün biçimleri tek başına 2,9'a çıkarıyordu). Ezber ve seyreklik için kelime eklemek yerine mekanik düşünülecek (harf ekle/çıkar, aşağıda).
- Yeniden üretmek: betiğin başındaki URL'lerden kaynakları bir klasöre indir (LDNOOBW listeleri npm `naughty-words` paketinden `naughty-tr.json` / `naughty-en.json` adıyla), `pip install wordfreq zemberek-python`, `python3 lab/kelime-tenisi/src/tools/words.py <klasör>`.
- **App Store'dan önce:** wordfreq verisi CC-BY-SA 4.0. "Bilinen" işaretinin buradan türemesi için atıf ve lisans kontrolü gerekir (ya da kendi listemizi çıkarırız). `EXTRA`'nın süzgeci Vikisözlük (CC-BY-SA): atıf yeter ya da 91 kelimeye elle bakılır. Zemberek (Apache-2.0) ve ENABLE (kamu malı) sorun değil.

## Kayıt ve Lab

- `kelime-tenisi.v1` (hesaba eşitlenir, `data-kayit`): bota karşı galibiyet/yenilgi (seviye seviye), iki kişilik maç sayısı, en uzun zincir ve kelimeleri, çıkmaz sayısı (`deadEnds`; ilk sürümde `smashes`, açılışta taşınır). Menüde rekor satırı buradan.
- `kelime-tenisi.device` (cihazda): dil, kelime boyu, süre, maç biçimi (`format` 1 kısa, 2 uzun), bot seviyesi, adlar, handikap, ses, "nasıl oynanır" görüldü mü (11 Kasım'daki `ekli` alanı açılışta silinir). İlk oyuncu adı Lab profilinden gelir.
- Dil: cihazın dili ne olursa olsun oyun Türkçe açılır. İngilizce yalnız menüdeki "English"e dokunulunca (`langPicked`), sonra hatırlanır.
- Not (Türkçe): maç başı (mod, dil, harf, süre, hedef sayı), maç sonu (sonuç, skor, en uzun zincir, çıkmaz, süre).
- "Nasıldı?" mola penceresinde (`mola`) ve maç sonunda (`mac-sonu`). Odası yok.
- Deneme: `kelime-tenisi.debug` = `1` sayfanın içini `window.__kt` olarak açar (`G`, `speed`, `timeout()`, `lexFor(dil, harf)`).

## Bot

- Kolay: bilinen cevapların %50'sini görür, 2,4–4,6 sn düşünür. Orta: %72, 1,6–3,6 sn, yarı yarıya rakibe en az çıkış bırakan kelimeyi seçer. Zor: %90, 1,0–2,5 sn, %85 en sıkıştıran kelime. Az seçenek varken daha geç bulur; süresi biterse sayıyı verir. Ayarlar `core.js` → `LEVELS`.
- Bot maçları (normal süre, orta–orta): TR 4 harf sayı başına 4,8 kelime, kısa maç ~3,6 dk, uzun ~7 dk. 3 harf daha uzun sürer (8,6 kelime, ~7 / 14 dk): seçenek çok, ralliler uzun. EN 4 harf 7,2 kelime, ~5,4 / 11 dk.

## Sıradaki

- Umut ile eşinin denemesi: ekli halleri kaldırılmış sürüm (fiil kökleri geçiyor), süre (Rahat mı Normal mi), 3 harf mi 4 harf mi, maç uzunluğu, ipucu listesi okunuyor mu.
- Konsept, ad ve tasarım (tenis kalktı; yeni tema konuşulacak). Ad kesinleşince klasör, slug ve anahtarlar taşınır (eski adres yönlendirilir, kayıt bir kez taşınır).
- Online, iki telefonda karşılıklı: ortak odalar (`oda.js`) burada uymaz (sıra tabanlı ve canlı); ayrı bir Durable Object gerekir. Sıralama ve ligler bunun üstüne (`kelime-tenisi-rekabet.md`).
- Özel vuruşlar: harf ekle/çıkar (3-4-5 harf arası), Türkçe "ek ekleme" modu.
