# Fish — oyun notları

Tepeden görünen bir gölette geçen "ye ya da yen" oyunu. Oyuncu 10 cm'lik bir koi ile başlar. Kendinden küçük balıkları yiyerek büyür, büyüklerden kaçar. Tek başına ya da arkadaşlarla aynı gölde (odalar) oynanır. Durum ve sonraki adımlar: `PLAN.md`.

## Bu klasörde

- `index.html`: Oyunun tamamı (tek kişilik ve odalar). Bağımlılıksız, tek dosya.
- `cover.png`: Paylaşım önizlemesi ve ana sayfa kartı (1200×630).
- Oda sunucusu repo kökünde `fish/sunucu/` (Cloudflare Worker + Durable Objects; Cloudflare oradan kurduğu için yeri değişmiyor). Ayrıntı `fish/sunucu/README.md`.
- Leaderboard: tek kişilik tur bitince boy `Hesap.skor` ile kaydedilir; sıralama `Hesap.siralama` ile okunur (ayrıntı kök `CLAUDE.md`'de). Hesap yoksa (oyun tek başına açılırsa) leaderboard ve odalar gizlenir.

## Tek kişilik sürümün yapısı

- Büyük balık daha yavaş: bütün hızlar (oyuncu, kaçan, kovalayan, gezinen) boy/saniye × `hizCarpani(boy)` = (boy/10)^-0.3. 10 cm'de 1, 30 cm'de 0.72, 1 m'de 0.5, 3 m'de 0.36. Avcının kovalama hızı yine oyuncunun en yüksek hızının %86'sını geçmez, yani kaçmak her zaman mümkün.

- Her balık 10 noktalı bir "omurga" zinciridir (follow-the-leader). Kafa hareket eder, diğer noktalar sabit aralıkla izler; bükülme açısı sınırlıdır. Kuyruk dalgalanması sadece çizimde eklenir.
- Çarpışma, omurganın 1., 3. ve 5. noktalarındaki dairelerle yapılır. Yeme kontrolü oyuncunun ağız dairesine göre yapılır.
- Kamera ölçeği `targetScale(L)` ile belirlenir. Balıklar ekran kenarının hemen dışında doğar ve görüş alanının epey dışına çıkınca silinir.
- Nilüferler dünya hücrelerine göre hash'lenir; havuz sonsuzdur ama her yer hep aynı görünür.
- Sesler WebAudio ile üretilir; ses dosyası yoktur.

## Odalar (index.html içinde "rooms" bölümü)

- `mode === 'oda'`: ortak göldeyiz. `updateFish`, `collide`, `spawnTick` çalışmaz; yerine `odaGuncelle` çalışır. Yabani balıklar (`fish`) ve diğer koiler (`oda.rakip`) sunucudan gelir.
- Kendi koi'n her zamanki gibi `steerPlayer` ile yüzer; konumu sunucuya `k` mesajıyla gider. Boy (`P.l`) sunucudan gelir.
- Sunucu adresi `ODA_SUNUCU` sabitinde. Boşsa "Play with friends" görünmez. Deneme için `localStorage.setItem('fish.sunucu', 'ws://127.0.0.1:8787')`.
- Giriş için `Hesap.anahtar()` (Supabase erişim anahtarı) ve `Hesap.profil.id` gönderilir.
- Tur sonu skoru `Hesap.skor(enBuyuk, {mod:'oda', ...}, 'fish-oda')`. Odada yenen balıklar `fish.toplam` sayacına da eklenir. `fish.best` sadece tek kişilik içindir.
- Kurallar (`SPECIES` sırası ve boyları, büyüme, 0.9 / 1.1 eşikleri, hız 3.6 boy/sn × `hizCarpani`, kamera formülü) `fish/sunucu/src/kurallar.js` ile aynı kalmalı. Birini değiştirirsen ötekini de değiştir.

## Kurallar

- Sunucu otoriterdir. İstemci yeme ya da ölme kararı vermez.
- Çocuklar da oynayacak: serbest sohbet yok, isimler hesaplardan gelir, kan ve şiddet yok.
- Önce mobil: dokunmatikte parmak nereye konursa joystick orada çıkar; parmağı o noktadan sürükleme yönü ve hızı belirler (çok uzağa çekilirse joystick parmağı izler). Bırakınca kaybolur. Sadece oyun sırasında çalışır. Farede koi imlece doğru yüzer. Klavyede ok tuşları ve WASD de çalışır.
- Oyunun arayüzü İngilizce.
