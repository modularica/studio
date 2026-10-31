# Kar Savaşı — oyun notları

Tepeden görünen, sonsuz karlı bir orman. Mahallenin çocukları dalga dalga her yönden gelir, oyuncu kartopuyla devirir. Tek başına ya da arkadaşlarla odalarda (en çok 8 kişi, ortak takım puanı) oynanır. Arayüz Türkçe. Düşmanlar kardan adam değil, hepsi bereli çocuk; görünüm İskandinav (kırmızı kulübeler, örgü desenli paneller).

## Bu klasörde

- `index.html`: Sayfa (menüler, tek başına oyun, odalar, çizim, ses, kontroller).
- `oyun.js`: Kurallar. Tohumdan orman (`World`: ağaç, kaya, kar yığını, donmuş gölet, kulübe), yürüme, kartopu uçuşu ve `Battle` (dalgalar, çocukların yapay zekâsı ve atışları, isabet, düşme, kaldırma, kar yığınları, kakao, puan). DOM ya da Node kullanmaz: oda sunucusu (`fish/sunucu/src/kar-oda.js`) aynı dosyayı içe aktarır. Bu yüzden yerini ya da adını değiştirme. Sayfa ile sunucunun anlaşması gereken bir şey değişirse `VERSION`'ı bir artır; eski sayfa "Sayfayı yenile" der.
- `cover.png`: Paylaşım önizlemesi ve Lab kartı (1200×630).

## Nasıl çalışıyor

- Tek başına: sayfa bir `Battle` kurar ve her karede `step(dt)` çalıştırır. Oyuncuyu sayfa yürütür (`walk`), kartopu cebini de sayfa tutar (`ammo`; kendiliğinden 6'ya kadar dolar, kar yığını 9 yapar).
- Odalarda: sunucu otoriterdir. Dalgalar, çocuklar, atışları, isabet, düşme, kaldırma, yığınlar ve kakao sunucuda. Sayfa kendi oyuncusunu anında yürütür, konumunu saniyede 15 kez yollar (`k`), atınca `a` yollar ve kendi kartopunu hemen çizer. Diğer oyuncular ve çocuklar sunucunun anlık görüntülerinden (saniyede 15) ileri tahminle yumuşatılarak çizilir; kartopları olaydan (`t`) alınıp sayfada yürütülür. Ağaca ya da kara düşen kartopunu sayfa kendisi patlatır; bir çocuğa ya da oyuncuya değen sadece kaybolur, vuruşu sunucu söyler.
- Orman sunucudan gelmez: `basla` mesajındaki `tohum` ile iki taraf da aynı ormanı `new World(tohum)` ile kurar.
- İki mod da aynı olayları (`Battle` üstündeki listede) aynı `onEvent` ile sese ve kar parçalarına çevirir.
- Takım: herkes aynı puanı toplar. Canı biten oyuncu karlara gömülür; bir arkadaşı yanında 1,6 saniye durursa 2 canla kalkar, dalga bitince de tam canla kalkar. Herkes aynı anda gömülünce oyun biter. Oyun sürerken gelen oyuncu bir arkadaşının yanında başlar. Bağlantısı kopan oyuncunun yeri bir dakika bekler.
- Dalgalar oyuncu sayısıyla büyür; çocuklar oyuncuların ekranlarının hemen dışında doğar (sayfa ekranının ne kadar uzağı gördüğünü `g` ile bildirir).
- Davet linki: bekleme odasındaki "Arkadaşını çağır" `/lab/kar-savasi/?oda=<id>` linkini paylaşır (telefonda paylaşma menüsü, bilgisayarda panoya kopyalar). Link açılınca giriş yapılmışsa doğrudan o odaya katılır.

## Kontroller

- Dokunmatik: ekranın sol yarısı yürüme çubuğu, sağ yarısında parmağı geri çekip bırakmak sapan gibi atar. Sağ tarafa kısa dokunuş en yakın çocuğa atar.
- Bilgisayar: WASD / oklar yürür, fareyle tıklayınca oraya atar, boşluk en yakın çocuğa atar. Esc / P mola (odada oda menüsü).

## Kayıt ve skor

- `karSavasi.best`: tek başına en iyi puan (`data-kayit`, hesapla eşitlenir).
- Oda oyunu bitince (ya da yarıda çıkınca) takım puanı `Hesap.skor(puan, {mod:'oda', dalga, devirdi, oyuncu, bitti}, 'kar-savasi-oda')`.
- Deneme: `localStorage.setItem('karSavasi.sunucu', 'ws://127.0.0.1:8787')` yerel sunucuya bağlar (`fish/sunucu/README.md`); `karSavasi.debug` = `1` sayfanın içini `window.__kar` olarak açar.

## Kurallar

- Çocuklar da oynayacak: kan ve şiddet yok (vurulan çocuk kara devrilir), serbest sohbet yok, isimler hesaplardan gelir.
- Önce mobil: her şey telefonda dikey ve yatayda düzgün görünmeli.
