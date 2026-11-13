# Harf Kutusu

Masada oynanan Türkçe Boggle kutusu (13 Kasım 2026). Umut ile eşi Boggle oynamak istedi: telefon masanın ortasında, sırası gelen sallar, harfler çıkar, süre ayarlanır, kurallar sayfada; puanları kâğıda kendileri yazar ("kâğıt kalem severiz"). Sayfa kutunun yerine geçer: zarlar, kapak, kum saati, kural kitapçığı. Oyuncuların kelimelerini denetlemez, puan saymaz (bilerek, kâğıtta); el sonunda tahtadaki kelimeleri listeler (aynı akşam Umut istedi). Ölçümler ve kararlar claude.ai'daki uzigames projesinde (`harf-kutusu.md`).

## Akış

- **Salla**'ya basılı tut (ya da telefonu salla) → zarlar titrer, harfler karışır, tıkırtı sesi → bırakınca zarlar kapağın altına dizilir → 3-2-1 (sallayan harfleri önce görmesin diye kapak kapalı; ayarlarda yok / 3 / 5 sn) → kapak açılır, süre başlar.
- Üstte karşıdaki oyuncu için ters çevrilmiş süre ve çubuk.
- Son dakikada zil, son 10 sn'de tık, sonunda alarm ve titreşim (Android). Alarm `<audio>` ile çalan bir WAV (iPhone sessizdeyken de duyulsun diye; Salla'ya ilk basışta açılır), olmazsa WebAudio. Süre bitince tahta açık kalır, altta puan tablosu ve "Nasıldı?".
- **Durdur:** kapak kapanır (harfler görünmez); "Devam et" ya da "Eli bitir".
- **Bitir** (el sürerken sağdaki düğme; aynı akşam Umut "erken bitirme olsun" dedi): herkes bitirdiyse eli erken bitirir. Masadaki telefona yanlışlıkla değilmesin diye iki dokunuş ister ("Emin misiniz?", 3 sn). Alarm çalmaz, kısa bir iki nota çalar.
- **Kelimeleri göster** (el sonunda): alt panelin üstüne açılır, tahta görünür kalır. Bilinen kelimeler puan gruplarına göre (8+ harf · 11 puan … 3–4 harf · 1 puan), "+N az bilinen" kesik çizgili olarak eklenir. Kelimeye dokununca harfleri tahtada sırayla (köşede 1, 2, 3…) yanar, öbür zarlar söner, kelime karşıdaki oyuncunun şeridinde de yazar. Yeni sallayışta kapanır.
- **Ekran açık kalsın:** Wake Lock, olmazsa sessiz 16×16 döngü video (`src/wake.mp4`; iPhone'da tam ekrana geçerse kapatılır ve bir daha denenmez: `noVid`).
- **Telefonu sallamak:** `devicemotion` → `accelerationIncludingGravity`; art arda iki örnek arasındaki fark (üç eksenin toplamı) 25'i geçerse sarsıntı. 0,9 sn içinde 4 sarsıntı sallamayı başlatır, 0,45 sn sarsıntı gelmezse zarlar dizilir. Yalnız bekleme ve el sonu ekranında; el sürerken masaya çarpmak bir şey yapmaz. iPhone'da izin bir dokunuşla istenir: bekleme ekranında "Sallayarak oyna" düğmesi; izin verildiyse sonraki açılışlarda ilk dokunuşta sessizce yeniden istenir (`S.motion`). Android'de izin gerekmez. Claude'un artifact çerçevesinde sensör kapalı (düğme de çıkmaz); orada yalnız basılı tutarak.

## Kayıt (`harf-kutusu.v1`, cihazda; hesaba eşitlenmez)

- `S` ayarlar: `dur` süre 30–600 sn (varsayılan 180), `size` 4 / 5, `min` en az 3 / 4 harf (yalnız ekrandaki puan tablosu için; sayfa kelime denetlemez), `rot` harf yönü (`flat` Düz, varsayılan · `two` Karşılıklı: 0/180° · `mix` Karışık: dört yön, harfin altı ince çizgili), `count` geri sayım 0 / 3 / 5, `sound`, `motion` (iPhone izni: 1 verildi, 0 verilmedi), `noVid`.
- İlk sürümde (aynı gün) varsayılan Karışık'tı; Umut oynarken "harfler aynı yönde olsun" dedi. Kaydında `rotV: 2` olmayan cihaz bir kez Düz'e geçer (`rotV` `DEF`'e konmamalı, yoksa geçiş hiç olmaz).
- `G` o anki el: tahta (`letters`, `rot`, `tilt`), `phase`, `endAt`, `total`, `left`, `round`. Sayfa yenilenirse el kaldığı yerden sürer; süresi geçmişse "Süre doldu".

## Kelime listesi (`src/words.txt`)

- `src/tools/words.py` üretir ve Kelime Düellosu'nun `lab/kelime-tenisi/src/tools/words.py`'sini içe aktarır: aynı kaynaklar (Zemberek sözlüğü, LDNOOBW), aynı `BLOCK`, `SOFT`, `NOT_COMMON`, `EXTRA`, `NOT_ROOTS`. Orada değişiklik olursa burada da yeniden üret.
- Kelimeler 3–12 harf: sözlük maddeleri (özel ad, kısaltma, ünlem yok; şapka düz), `EXTRA` türetilmişler (ünlü, uçuş), bütün -mek fiillerinin kökü (GEL, OKU, TEMİZLE; isim etiketi olan -mek'ler değil: parmak, ekmek). `BLOCK` ve LDNOOBW hiç yok; `SOFT` (şiddet, alkol, hakaret, tuvalet) da yok: Kelime Düellosu'ndaki gibi listeler onları göstermez, oyuncu yazarsa sözlüğe bakılır.
- Bilinen (satır sonunda `.`): wordfreq Zipf ≥ 3 ve `NOT_COMMON`'da değil; yaygın bir fiilin kökü (fiilin Zipf'i ≥ 3) `NOT_COMMON` isim okunuşunu saysa da bilinen (KAL, TAK, KES), `NOT_COMMON_ROOTS` hariç. 31.855 kelime, 8.257 bilinen, 286 KB (sayfa 420 KB; Vercel sıkıştırarak yollar).
- Satırlar büyük Türkçe harfle (i → İ, ı → I), kod sırasıyla dizili; sayfa ikili aramayla önek ve kelime bakar, tahtada derinlemesine arar (5×5 dahil anında).
- Yeniden üretmek: Kelime Düellosu'nun betiğinin başındaki adreslerden `master-dictionary.dict`, `non-tdk.dict` ve npm `naughty-words`'ten `naughty-tr.json`'ı bir klasöre koy, `pip install wordfreq`, `python3 lab/harf-kutusu/src/tools/words.py <klasör>`, sonra derle.

## Kurallar (sayfadaki Kurallar penceresi)

- Klasik kutu kuralları. Türkçe için: sözlükte maddesi olan kelimeler ve fiil kökü ya da mastarı (GEL, GELMEK) geçer; ekli hâller geçmez (Kelime Düellosu'ndaki kararla aynı: EVDE, KAPIYI, GELDİ yok; EVLİ, GÖZLÜK var); özel ad ve kısaltma yok; noktalı ve noktasız harfler ayrı; şapka sayılmaz.
- Puan: 3–4 harf 1, 5: 2, 6: 3, 7: 5, 8 ve üstü 11; birden çok kişinin yazdığı kelime çizilir. İtiraz: önce "Kelimeleri göster", listede yoksa sozluk.gov.tr.
- Ev kuralları: ekli kelimeler serbest, hepsi sayılır, küçüklerle (çocuğun kelimesi çizilmez), 5×5'te en az 4 harf.

## Zarlar (`src/dice.json`)

- 4×4: 16 zar (96 yüz), 5×5: 25 zar (150 yüz). Harf sıklığı yazı dilinden değil, bilinen sözlük kelimelerinden (yazı dilinde ekler yüzünden I, D, N, Y şişkin; köklerde K, T, M, S daha sık). 4×4'te 8 zar 1 sesli + 5 sessiz, 8 zar 4 sesli + 2 sessiz: tahtadaki sesli sayısı daha az oynar. J ile F aynı zarda (ikisi bir arada çıkmaz). Her harf en az bir yüzde, bir zarda aynı harf iki kez yok.
- Ölçüm (`src/tools/dice.py`, `words.txt` ile, en az 3 harf, yeniden atma olmadan): 4×4 tahtada ortalama 25,5 bilinen kelime (medyan 23, en kötü %10'da 10), az bilinenlerle 60; 5×5'te 48 (medyan 45, en kötü %10'da 24), az bilinenlerle 114. En az 4 harfte 4×4 14'e, 5×5 28'e düşüyor; o yüzden Türkçede 5×5'te de varsayılan 3 harf. Zarlar daha gevşek bir "bilinen"le (yalnız wordfreq Zipf ≥ 3, `NOT_COMMON` yok) tasarlandı: o ölçümle 4×4'te ~41, İngilizce kutu aynı ölçümle ~53.
- **Kötü tahta yeniden atılır** (`rollGood`, `GOOD`; 13 Kasım akşamı Umut'a tek sesli bir tahta geldi): 4×4'te 4'ten az sesli ya da 12'den az bilinen kelime (en az 3 harf sayılır, oyundaki "en az" ayarından bağımsız), 5×5'te 7 sesli / 25 kelime. Bu zarlarla ret oranı 4×4'te ~%14, 5×5'te ~%12; kalanlarda ortalama 28 ve 51 bilinen kelime. Kural olmasa (bir milyon tahta): 4×4'te tek sesli tahta 1.700'de bir, 3 ya da daha az sesli 35'te bir. 40 denemede iyisi çıkmazsa en çok kelimelisi alınır (pratikte olmuyor). Tahta başına 1–2 ms (masaüstü).
- Zarları değiştirirsen `dice.py` ile ölç; buradaki sayıları, `GOOD` eşiklerini ve Kurallar'daki "Kutudaki zarlar" paragrafını güncelle.

## Dosyalar

- `index.html` siteye çıkan tek dosya. **Elle düzenleme**: `src/page.html`'i değiştirip derle. Dış bağlantı yok (yazı tipleri, zarlar ve video gömülü).
- `cover.png` (1200×630) ve `icon.png` (180×180): `src/tools/cover.py` çizer.
- `src/` (siteye çıkmaz, `.vercelignore`): `page.html` (iskelet, stil, kod), `build.py`, `dice.json`, `words.txt` (üretilmiş, elle düzenleme), `fonts/` (Bricolage Grotesque 800, Atkinson Hyperlegible Next 400/700; ikisi de OFL, Türkçe harflere indirilmiş, latin ve latin-ext ayrı dosya), `wake.mp4`, `tools/words.py`, `tools/dice.py`, `tools/cover.py`, `test/browser.py`.
- Derleme: `python3 lab/harf-kutusu/src/build.py --lab` → `index.html`. Hesapsız tek başına kopya (Claude artifact'i için): `python3 lab/harf-kutusu/src/build.py /tmp/hk.html`.
- Deneme: tek başına kopyayı derle, sonra `python3 lab/harf-kutusu/src/test/browser.py /tmp/hk.html` (sahte hesap ve sahte iPhone sensörüyle bir el: izin, sallama, kapak, süre, mola, "Nasıldı?", Bitir ile erken bitirme, kelime listesi ve tahtada yanan yol, sabit bir 5×5 tahtada sayfanın bulduğu kelimelerin düz bir çözücüyle birebir aynı olması, eski karışık ayarın düze geçmesi, 300 + 60 atışta hiç kötü tahta gelmemesi). Deneme kancası: `localStorage['harf-kutusu.debug'] = '1'` sayfanın içini `window.__hk` olarak açar (`roll`, `rollGood`, `solveBoard`, `GOOD`, `G`, `S`).
- Umut'a özel Claude artifact kopyası: https://claude.ai/artifact/LmbLD3Vo1oGm8GTM6fHBE7 (orada sensör ve ekran kilidi çalışmaz).

## Lab

- `data-kayit` yok. Not: el başı (`3. el başladı · 4×4 · 3:00`) ve el sonu (`3. el bitti · 4×4`, erken bitince `· erken bitirildi`). "Nasıldı?": kapakta molada (`mola`) ve el sonunda puanların yanında (`el-sonu`). Odası yok, skor yazmaz (puanlar kâğıtta).
