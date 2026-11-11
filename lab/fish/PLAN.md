# Fish — çok oyunculu plan

## Şu an

- **Tek kişilik:** `lab/fish/index.html`, `/lab/fish/` adresinde. Sonsuz gölet, 3 can, leaderboard (`scores`, oyun `fish`).
  - Kasım 2026 (`fish-ejder` dalı): büyüme yavaşlar, her suyun boy sınırı var, hafif açlık, kayalar ve buz, akıntıda girdap ve şelale altı hızlı su, denizde gelgit. Gölette 1 m'de dere açılır, nehre geçilir; nehirdeki Ejder Kapısı'nı 1,5 m'de geçen koi ejder olur ve tur zaferle biter. Ayrıntı `CLAUDE.md`. Odalar eski kurallarla.
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
- [ ] Tek kişilikteki yolculuğu Lab'da oynatıp ayarla: dere uzaklığı (25 m), kapı uzaklığı (60 m), şelale altı akıntı, açlık hızı. Oyuncu notlarına ("Nasıldı?") ve `plays` notlarına bak (`Gölete sığmıyor`, `Nehre geçti`, `Ejder oldu`).
- [ ] Leaderboard: haftalık tablo ve ödül; formül değişti (`v: 2`), tüm zamanlar tablosunda eski turlar karışık. Plan proje dokümanında (Little Koi oyun tasarımı, bölüm 6), henüz yapılmadı.
- [ ] Ejderden sonrası: deniz ve okyanusta ejder olarak devam mı, yoksa her tur gölette yeniden mi başlasın? Şimdilik tur ejderle biter.
- [ ] Odalara da gelsin mi? Gelirse sunucu (`fish/sunucu/src/kurallar.js`) da değişmeli.
