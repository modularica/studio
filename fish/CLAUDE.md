# Fish — oyun notları

Tepeden görünen bir gölette geçen "ye ya da yen" oyunu. Oyuncu 10 cm'lik bir koi ile başlar. Kendinden küçük balıkları yiyerek büyür, büyüklerden kaçar. Hedef, bunu snake.io tarzı çok oyunculu bir oyuna dönüştürmek. Plan ve açık sorular: `PLAN.md`.

## Şu an bu klasörde

- `index.html`: Tek dosya, bağımlılıksız, tek kişilik sürüm. `/fish` adresinde yayında. Hissin ve kuralların referansıdır.
- `cover.png`: Paylaşım önizlemesi ve ana sayfa kartı (1200×630).
- Multiplayer kodu `client/`, `shared/`, `server/` altına gelecek. Multiplayer hazır olana kadar `index.html` yayında kalır.

## Tek kişilik sürümün yapısı (taşırken bilmen gerekenler)

- Her balık 10 noktalı bir "omurga" zinciridir (follow-the-leader). Kafa hareket eder, diğer noktalar sabit aralıkla izler; bükülme açısı sınırlıdır. Kuyruk dalgalanması sadece çizimde eklenir.
- Çarpışma, omurganın 1., 3. ve 5. noktalarındaki dairelerle yapılır. Yeme kontrolü oyuncunun ağız dairesine göre yapılır.
- Kamera ölçeği `targetScale(L)` ile belirlenir. Balıklar ekran kenarının hemen dışında doğar ve görüş alanının epey dışına çıkınca silinir.
- Nilüferler dünya hücrelerine göre hash'lenir; havuz sonsuzdur ama her yer hep aynı görünür.
- Sesler WebAudio ile üretilir; ses dosyası yoktur.

## Kurallar

- Sunucu otoriterdir. İstemci yeme ya da ölme kararı vermez.
- Çocuklar da oynayacak: serbest sohbet yok, isimler filtrelenir, kan ve şiddet yok.
- Önce mobil: dokunmatikte koi parmağa doğru yüzer. Klavyede ok tuşları ve WASD de çalışır.
