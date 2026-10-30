# Tank Arenası — oyun notları

Tepeden görünen bir arenada boya topu atan tanklar. Herkes bir tank, her isabet bir puan. Üç isabet alan tank boyanır, 3 saniye sonra köşelerden birinden 2 saniyelik kalkanla yeniden çıkar. Tur 3 dakika sürer. Botlarla (1–7 bot, Kolay / Orta / Zor) ya da arkadaşlarla odalarda (2–8 tank, kurucu boş yerlere bot koyabilir) oynanır. Arayüz Türkçe.

## Bu klasörde

- `index.html`: Sayfa (menü, botlarla oyun, odalar, çizim, ses, kontroller).
- `oyun.js`: Kurallar. Harita üretici (tohumdan, dört yönde simetrik), tank sürme ve duvar çarpışması, atışlar, isabet, boyanma, yeniden doğma, bot yapay zekâsı, `Arena` sınıfı. DOM ya da Node kullanmaz: oda sunucusu (`fish/sunucu/src/tank-oda.js`) aynı dosyayı içe aktarır. Bu yüzden yerini ya da adını değiştirme.
- `cover.png`: Paylaşım önizlemesi ve Lab kartı (1200×630, oyundan bir sahne).

## Nasıl çalışıyor

- Botlarla: sayfa bir `Arena` kurar ve saniyede 60 adım çalıştırır. Menünün arkasındaki canlı arena da (vitrin) böyle: 4 bot kendi kendine oynar, ses çıkmaz.
- Odalarda: sunucu otoriterdir. Atış, isabet, puan, boyanma, botlar sunucuda. Sayfa kendi tankını anında sürer, konumunu saniyede 15 kez yollar (`k`), ateş edince `a` yollar ve kendi mermisini hemen çizer. Diğer tanklar sunucunun anlık görüntülerinden (saniyede 15) ileri tahminle yumuşatılarak çizilir; mermiler olaydan (`m`) alınıp sayfada yürütülür.
- Harita sunucudan gelmez: `basla` mesajındaki `tohum` ve tank sayısıyla iki taraf da aynı haritayı `harita(n, tohum)` ile üretir. Harita üreticisi ya da kurallar değişirse `SURUM`'u artır; eski sayfa "Sayfayı yenile" der.
- Olaylar (`Arena.olay`): `m` atış, `x` mermi durdu, `k` kalkan tuttu, `v` isabet, `o` boyandı, `d` yeniden çıktı, `c` ayrıldı. Sayfa ikisini de aynı `olayIsle` ile çizer.

## Kontroller

- Dokunmatik: ekranın sol yarısı sürme çubuğu, sağ yarısı nişan çubuğu (parmağın değdiği yerde çıkar). Nişan çubuğu çekili kaldıkça taret o yöne döner ve ateş eder. Sağ tarafa kısa dokunuş en yakın görünen tanka ateş eder.
- Bilgisayar: WASD / oklar sürer, fare nişan alır, tık ya da boşluk ateş eder. Esc / P mola, M ses.

## Kayıt ve skor

- `tank.rekor`: botlarla bir turdaki en çok isabet (`data-kayit`, hesapla eşitlenir). `tank.ayar` (bot sayısı, zorluk) ve `tank.ses` cihazda kalır.
- Botlarla biten tur `Hesap.skor(isabet, {...}, 'tank')`, oda turu `'tank-oda'` (odadan erken çıkınca da o ana kadarki puan yazılır).
- Deneme: `localStorage.setItem('tank.sunucu', 'ws://127.0.0.1:8787')` yerel sunucuya bağlar; `tank.debug` = `1` sayfanın içini `window.__tank` olarak açar.

## Kurallar

- Çocuklar da oynayacak: kan ve şiddet yok (tanklar boya atar, vurulan boyanır), serbest sohbet yok, isimler hesaplardan gelir.
- Önce mobil: her şey telefonda dikey ve yatayda düzgün görünmeli.
