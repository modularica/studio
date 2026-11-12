# Little Koi v2 — plan (Fish'in planından; odalar Fish'le ortak)

## Şu an

- **Tek kişilik:** `lab/little-koi-v2/index.html`, `/lab/little-koi-v2/` adresinde (12 Kasım 2026'dan beri; Fish'in yeni sürümü, ayrı kayıt). Sonsuz gölet, 3 can, leaderboard (`scores`, oyun `little-koi-v2`).
  - Kasım 2026 (`fish-ejder` dalı): büyüme yavaşlar, hafif açlık, kayalar ve buz, akıntıda girdap ve şelale altı hızlı su, denizde gelgit. Her su bir bölüm (gölet 10 cm, nehir 1 m, deniz 2 m, okyanus 4 m'den başlar); sınırda sonraki suya geçit açılır, oraya yüzülen su menüde de açılır; boyun altında hedef çubuğu. 12 Kasım'dan beri tek yol: Ejder Kapısı okyanusun sonunda (6 m, bir su hortumu); içinden geçen koi ejder olur ve tur ejder olarak sürer, hedef en büyük ejder (`koi2.ejder`). (11 Kasım'daki ilk sürümde kapı nehirdeydi ve tur zaferle bitiyordu.) 12 Kasım'dan beri Jetpack Joyride gibi: her tur gölette başlar, sular kolaydan zora Level 1–4, her biçimin kendi fiziği var, su ve Dragon kartları kalktı (menüde yolculuk sırası ve rekor), amaç en büyük balık (rekor). Aynı gün incilerle Shop: desenler inciyle alınır (XP görünmez; XP'nin açtıkları oyuncuya kaldı), bazıları yolculukta kazanılır, kalıcı geliştirmeler ve bir sonraki tur için boostlar. Deniz ve okyanus hızlandı (büyüme 1,5 m'den sonra daha fazla yavaşlamıyor, 1 m'den büyükler 1 m'lik birinin boy/sn hızında), her yeni suda canlar 3'e döner. Denemek için N tuşu: +1 m, o tur hiçbir şey kaydetmez. Koi her suda o suyun biçimine döner (nehir, deniz, okyanus koisi; her birinin kendi fiziği) ve "My koi"de gelişim sırası var. Ayrıntı `CLAUDE.md`. Odalar eski kurallarla.
- **Odalar (arkadaşlarla):** Başlangıç ekranında "Play with friends".
  - Odalar bir listede görünür, kod yok. Biri oda kurar, arkadaşları listeden katılır, kurucu "Start the round" der.
  - Tur 5 dakika sürer, odaya en çok 8 koi girer. Tur sürerken de katılınabilir.
  - Göl sınırlı ve kare. Kenarında kıyı vardır. Koi sayısıyla ve en büyük koi büyüdükçe göl de büyür.
  - Her koi oyuncunun renginde benekli olur, üstünde adı yazar.
  - Büyük koi küçüğü bir lokmada yer. Yabani balık 3 kez ısırınca koi yenir ve küçük balıklara dağılır (başkalarına yem olur).
  - Yenen koi 3 saniye sonra 10 cm olarak, büyük koilerden uzak bir yerde geri gelir. 3 saniye korunur.
  - Sağda canlı sıralama, süre ve gölün haritası durur. Tur sonunda kürsü ve sonuç listesi çıkar.
  - Tur skoru `scores` tablosuna oyun `fish-oda` olarak yazılır. Tek kişilik leaderboard'a karışmaz.
  - Bağlantı koparsa oyun kendiliğinden yeniden bağlanır. Sunucu koiyi 30 saniye, boyuyla birlikte tutar.
  - Sunucu: `fish/sunucu/` (Cloudflare Workers + Durable Objects). Ayrıntı `fish/sunucu/README.md`.

## Mimari

- Her sayfa kendi koi'sini anında yüzdürür ve konumunu saniyede 15 kez sunucuya yollar. Sunucu hızı denetler; imkânsız bir hareketi düzeltir (`duz`).
- Yemeye, ısırmaya, ölmeye, büyümeye ve yabani balıklara yalnızca sunucu karar verir.
- Yabani balıklar her koi'nin ekranının hemen dışında, o koi'nin boyuna göre doğar (tek kişilik gibi). Hiçbir koi'nin yakınında olmayan balık silinir.
- Sunucu saniyede 10 kez, her koiye yalnızca kendi çevresindeki balıkları gönderir. Sayfa diğerlerini son bilinen hız ve yönle ileri tahmin edip yumuşatarak çizer.
- Kurallar `fish/sunucu/src/kurallar.js` içinde, `lab/fish/index.html` ile aynı. Türlerin sırası iki yerde aynı kalmalı.

## Sonra yapılabilecekler

- [ ] Herkese açık sürekli bir göl (oda kurmadan girilen).
- [ ] Oyuncu azken gölü dolduran botlar.
- [ ] Hazır tepkiler (serbest sohbet yok).
- [ ] Odalar için haftalık "en büyük koi" tablosu (`fish-oda` skorlarından).
- [x] Dört su: Gölet, Nehir (akıntı), Deniz (yosun), Okyanus (karanlık); seviyelerle açılır. Odalarda kurucu seçer.
- [x] Koi deseni seçme (kohaku, showa, ogon…): her seviyede bir desen.
- [x] İnci: oynadıkça kazanılır, özel desenler inciyle alınır.
- [ ] Uygulama mağazasına çıkınca: gerçek parayla inci (uygulama içi satın alma).
- [ ] itch.io, CrazyGames gibi portallar.
- [ ] Tek kişilikteki yolculuğu Lab'da oynatıp ayarla: geçit uzaklıkları (dere 25 m, nehrin ağzı 30 m, çukur 30 m, Ejder Kapısı 30 m), kapı boyu (6 m: okyanus bölümü öbürleri kadar lokma, 8 m olsa denizin bir buçuk katı), açlık hızı. Oyuncu notlarına ("Nasıldı?") ve `plays` notlarına bak (`Gölete sığmıyor`, `Nehre geçti`, `Ejder Kapısı açıldı`, `Ejder oldu`).
- [x] Leaderboard ve bölümler: okyanus 4 m'den başladığı için en büyük boy tablosunu okyanus turları dolduruyordu. 12 Kasım'dan beri her tur gölette başladığı için tablo yine adil (`v: 4`).
- [ ] Leaderboard: haftalık tablo ve ödül; formül değişti (`v: 2`, sonra tek yol `v: 3`), tüm zamanlar tablosunda eski turlar karışık. "En büyük ejder" tablosu bir seçenek (skorda `ejder` ve `ejderBoy` var). Plan proje dokümanında (Little Koi oyun tasarımı, bölüm 6), henüz yapılmadı.
- [ ] Odalara da gelsin mi? Gelirse sunucu (`fish/sunucu/src/kurallar.js`) da değişmeli.
- [x] Shop (12 Kasım): incilerle desenler (Butterfly, Rainbow, Galaxy, Gold Dragon ve Little Dragon yolculukta kazanılır), kalıcı geliştirmeler (Extra life, Faster growth, Slower hunger, Pearl magnet) ve bir sonraki tur için boostlar (Shield, Head start, Second chance). Sadece kazanılan inciyle. Ayrıntı `CLAUDE.md` → "Shop".
- [ ] Shop fiyatlarını Lab'daki turlara göre ayarla: `scores` ayrıntısında `v: 5`, `gel`, `yardim`; takip notlarında "Dükkân: …". Upgrades leaderboard'u kolaylaştırıyor: gerekirse tabloyu geliştirmesiz turlarla ayır.
- [ ] Biçimlerin fiziğini ve suların zorluğunu (`FIZIK`, `ZORLUK`) Lab'daki turlara ve notlara göre ayarla: `scores` ayrıntısında `v: 4` ve `harita` (turun bittiği level).
