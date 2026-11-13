# Uzay Hattı

Uzay limanı tycoon (Türkçe). Yolcular soldan gelir, terminalde biletini alır, rotasının roketine biner; bilet parası kalkışta kasaya girer.

13 Kasım 2026'da sakinleştirildi ("çok hızlı akıyor, her yerde yazı ve sayı var" geri bildirimi). Kurallar: roket sen basmadan kalkmaz, rehber açıkken oyun durur ve başka hiçbir şey çıkmaz, özellikler tek tek açılır, ekranda az yazı ve az sayı.

## Dosyalar

- `index.html` derlenmiş sayfa. Elle düzenleme: `src/`'yi değiştirip `python3 lab/uzay-hatti/src/build.py` çalıştır.
- `src/game.html` sayfa (CSS, sahne, arayüz, rehber, ses); `/*@ECON@*/` yerine `src/econ.js` gelir.
- `src/econ.js` ekonomi (saf fonksiyonlar): rotalar, maliyetler, akış (`flow`). `flow(s, boost, { autoOnly: true })` sadece otomatik pilotlu roketleri sayar; çevrimdışı kazanç bundan hesaplanır.
- `src/sim.js` tempo simülasyonu (`node lab/uzay-hatti/src/sim.js`): açgözlü bir oyuncunun rotaları ne zaman açtığı (bütün roketler otomatik pilotlu varsayılır). Ekonomiyi değiştirirsen çalıştır; şu an aktif oyuncu için Mars ~2,5 dk, Venüs ~7, Europa ~15, Satürn ~32, Titan ~80 dk. Rastgele alım yapan bir test oyuncusu (her roketi elle fırlatan) Mars'ı ~6,5 dk'da açtı.
- `build.py` `<head>`'e paylaşım etiketlerini ve hesap satırlarını ekler (`data-oyun="uzay-hatti" data-kayit="uzay-hatti-v2"`). `src/standalone.html` hesapsız deneme kopyası (git'e girmez).

## Oyun

- Roketler: dolunca (ya da 12 sn bekleyip en az bir yolcu alınca) "Hazır" olur ve FIRLAT'a basılana kadar bekler. İbre yeşildeyken basınca bilet x2 (Hassas Fırlatma araştırması artırır), sarıda x1,3. Art arda 10 mükemmel = 1 kristal.
- Otomatik pilot: rota başına satın alınır; o roket dolunca 3 sn sonra kendi kalkar (Akıllı Pilot araştırması kısaltır). Sen yokken sadece otomatik pilotlu roketler uçar (12 sa, Gece Vardiyası ile 42 sa'e kadar).
- Liman sekmesi gezegen kartlarından oluşur: kartın başında doluluk çubuğu, "3/4" ve durum (Yolcu alıyor / Yolcu bekliyor / Hazır! Fırlat / Yolda / İniyor). Altında satırlar: Koltuk, Motor, Roket sayısı (1–3), Otomatik pilot; Terminal kartında Reklam panosu (gelen yolcu) ve Check-in bankosu. Her satır "şimdi → sonra" gösterir. Sıradaki gezegen kartı birikim çubuğuyla en üstte.
- Üç işaret, sahnede ve onu çözen düğmede aynı resim (`PROB`): kum saati = roket yolcu bekliyor (Reklam panosu), kırmızı ünlem = check-in kuyruğu uzun (Check-in bankosu), mavi insanlar = kapıda yolcu birikti (Koltuk ya da Roket sayısı). Roket yoldayken pistte dolan bir halka dönüşü gösterir.
- Yolcular rotalara paylarına göre dağılır, dolu kapıdan taşan yolcu boş koltuklu en pahalı rotaya geçer. Her 25 seviyede x2.
- Kristal: görevler, göktaşı yağmuru, VIP yolcu, gazeteciler, keşif sondası. Araştırma 8 dal × 5 seviye. Keşif sondası gerçek zamanlı (3/12/45 dk), 12 hatıra (her biri biletlere +%5).
- Olaylar (göktaşı, VIP, UFO turistleri, gazeteciler, güneş rüzgarı) Görevler açıldıktan sonra başlar, 2,5–4 dk'da bir gelir. Her olay ilk gelişinde önce kendi rehberiyle anlatılır (oyun durur), sonra başlar.
- Yeni üs: bu sezon 100 milyon kazanınca açılır, yıldız başına biletlere kalıcı +%10; kristal, araştırma, koleksiyon ve açılmış özellikler kalır.
- Reklam yok, satın alma yok, bekletip para isteyen yer yok.

## Özelliklerin açılması ve rehber

- `FEATS` (game.html, `progressTick`) sırası: intro → launch (ilk dolu roket) → seats (ilk kalkıştan sonra) → reklam (kum saati ya da Ay'a 7 sefer) → banko (kuyruk ya da 11 sefer) → motor (9 sefer) → oto (14 sefer) → mars (Mars'ın %35'i kadar para ya da 20 sefer) → unlock (para yetince) → newRoute → fleet (Mars'tan 30 sn sonra) → gorev (60 sn) → events → bilim (ilk kristal) → kesif ve bulk (Venüs) → prestige.
- Açılan özellik `flags.reveal`'e yazılır; satırı ve sahnedeki işareti ancak o zaman görünür. Satın alma rehberi para yetince başlar. Bir rehber ekrandayken, sıradayken ya da bittikten sonraki 8 sn içinde yeni bir şey açılmaz.
- `TOURS` adım türleri: `modal` (oyun durur, "İleri"), `action` (oyuncu hedefi yapınca geçer; örn. ilk FIRLAT, ilk koltuk), `tip`. Her rehber bir kez gösterilir (`flags.guides`); Menü → Rehberler'den tekrar izlenir (görülmüş olanlar listelenir; tekrarda `action` adımları açıklama olur, `done` çalışmaz).
- Yeni özellik eklersen: rehberini `TOURS`'a, açılma koşulunu `FEATS`'e, listedeki adını `GUIDE_LIST`'e ekle; ilk görüldüğü yere bir işaret koymayı düşün.
- Deneme: sayfa içi `window.__UZ` (`S()`, `RT`, `GD`, `ev('meteor')`, `guide(id, true)`, `gt()`, `needle()`, `sim(sn)`).
