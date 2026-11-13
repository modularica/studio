# Uzay Hattı

Uzay limanı tycoon (Türkçe). Yolcular soldan gelir, check-in'den geçer, rotalarının roketine biner; bilet parası kalkışta kasaya girer.

## Dosyalar

- `index.html` derlenmiş sayfa. Elle düzenleme: `src/`'yi değiştirip `python3 lab/uzay-hatti/src/build.py` çalıştır.
- `src/game.html` sayfa (CSS, sahne, arayüz, rehber, ses); `/*@ECON@*/` yerine `src/econ.js` gelir.
- `src/econ.js` ekonomi (saf fonksiyonlar): rotalar, maliyetler, akış (`flow`). Oyundaki canlı simülasyon bu formülle %1 içinde aynı geliri verir; çevrimdışı kazanç da bundan hesaplanır.
- `src/sim.js` tempo simülasyonu (`node lab/uzay-hatti/src/sim.js`): açgözlü bir oyuncunun rotaları ne zaman açtığı. Ekonomiyi değiştirirsen çalıştır; şu an Mars ~2 dk, Venüs ~6, Europa ~14, Satürn ~30, Titan ~70 dk (araştırmasız, pasif).
- `build.py` `<head>`'e paylaşım etiketlerini ve hesap satırlarını ekler (`data-oyun="uzay-hatti" data-kayit="uzay-hatti-v1"`).

## Oyun

- Akış: gelen yolcu (Tanıtım Panoları) → check-in (Bankolar) → roketler (rota başına koltuk, motor, 1–3 roket). En küçük halka darboğaz; yükseltme düğmeleri alırsan gelirin ne kadar artacağını gösterir, işe yaramayan sönük durur. Her 25 seviyede x2.
- Yolcular rotalara paylarına göre dağılır, dolu kapıdan taşan yolcu boş koltuklu en pahalı rotaya geçer (yeni rota açmak geliri hiç düşürmez).
- FIRLAT: roket dolunca çıkar; ibre yeşilde x2 (Hassas Fırlatma araştırmasıyla artar), sarıda x1,3; basılmazsa 2 sn sonra kendi kalkar. Art arda 10 mükemmel = 1 kristal.
- Kristal: görevler, göktaşı yağmuru, VIP yolcu, keşif sondası. Araştırma 8 dal × 5 seviye. Keşif sondası gerçek zamanlı (3/12/45 dk), 12 hatıra (her biri biletlere +%5).
- Olaylar (oyunda ~1–1,5 dk'da bir, hepsi ödüllü): göktaşı, VIP, UFO turistleri, gazeteciler (seçim), güneş rüzgarı.
- Yeni üs: bu sezon 100 milyon kazanınca açılır, yıldız başına biletlere kalıcı +%10; kristal, araştırma, koleksiyon kalır.
- Reklam yok, satın alma yok, bekletip para isteyen yer yok.

## Rehber

`src/game.html` içinde `TOURS`. Üç adım türü: `modal` (oyun durur, "İleri"), `action` (oyuncu hedefi yapınca geçer; örn. ilk FIRLAT, ilk yükseltme, Mars'ı açma; ilk fırlatmada roket bekler), `tip` (oyun durmaz, olaylarda). Her rehber bir kez gösterilir (`flags.guides`), büyük rehberler arasında en az 20 sn oyun süresi var; Menü → Rehberler'den tekrar izlenir. Yeni özellik eklersen ona da bir rehber yaz ve `guideTriggers()`'a koşulunu ekle.
