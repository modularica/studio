# Fish — çok oyunculu plan

## Şu an

- **Tek kişilik:** `fish/index.html`, `/fish/` adresinde. Sonsuz gölet, 3 can, leaderboard (`scores`, oyun `fish`).
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
- Kurallar `fish/sunucu/src/kurallar.js` içinde, `fish/index.html` ile aynı. Türlerin sırası iki yerde aynı kalmalı.

## Sonra yapılabilecekler

- [ ] Herkese açık sürekli bir göl (oda kurmadan girilen).
- [ ] Oyuncu azken gölü dolduran botlar.
- [ ] Hazır tepkiler (serbest sohbet yok).
- [ ] Odalar için haftalık "en büyük koi" tablosu (`fish-oda` skorlarından).
- [ ] Koi deseni seçme (kohaku, showa, ogon…).
- [ ] itch.io, CrazyGames gibi portallar.
