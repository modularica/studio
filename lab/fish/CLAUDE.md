# Fish — oyun notları

Tepeden görünen bir gölette geçen "ye ya da yen" oyunu. Oyuncu 10 cm'lik bir koi ile başlar. Kendinden küçük balıkları yiyerek büyür, büyüklerden kaçar. Tek başına ya da arkadaşlarla aynı gölde (odalar) oynanır. Durum ve sonraki adımlar: `PLAN.md`.

## Bu klasörde

- `index.html`: Oyunun tamamı (tek kişilik ve odalar). Bağımlılıksız, tek dosya.
- `cover.png`: Paylaşım önizlemesi ve ana sayfa kartı (1200×630).
- Oda sunucusu repo kökünde `fish/sunucu/` (Cloudflare Worker + Durable Objects; Cloudflare oradan kurduğu için yeri değişmiyor). Ayrıntı `fish/sunucu/README.md`.
- Leaderboard: tek kişilik tur bitince boy `Hesap.skor` ile kaydedilir; sıralama `Hesap.siralama` ile okunur (ayrıntı kök `CLAUDE.md`'de). İki tablo: Solo (oyun `fish`) ve Rooms (oyun `fish-oda`, odada bir turda ulaşılan en büyük boy). `lbAc(oyun, geriEkran)` tabloyu açar; Back açıldığı ekrana döner. Hesap yoksa (oyun tek başına açılırsa) leaderboard ve odalar gizlenir.

## Haritalar ve seviye

- Dört su (`MAPS`): Gölet, Nehir, Deniz, Okyanus. Her birinin kendi suyu, süsü ve 7 türü var; türlerin boy basamakları (min/max) her yerde aynı, çünkü oda sunucusu sadece basamağı bilir.
  - Nehir: su +x yönünde şeritler halinde akar (`akinti(x, y)`, en çok 14 cm/sn): koi, balıklar ve parçacıklar sürüklenir; büyüdükçe akıntı az hissedilir. Dipte taşlar.
  - Deniz: yosun yatakları (`yosunda(x, y)`, hücre başına hash): içindeki koi'yi avcılar kovalamaz. Dipte deniz yıldızları.
  - Okyanus: koi'nin ışığı dışı karanlık (`drawDark`); avcıların gözleri karanlıkta kırmızı parlar.
- `akinti()` ve `yosunda()` sunucuda da var (`fish/sunucu/src/kurallar.js`): ikisi aynı kalmalı.
- Seviye: `fish.toplam`'daki her balık boy basamağı + 1 XP (`xpOf`); L. seviye için `25 × (L−1)^1.7` XP. Haritalar 1, 3, 6, 10. seviyede açılır. Tur sonunda "+XP" ve açılanlar gösterilir; tur içinde seviye atlayınca bildirim çıkar.
- Odalarda suyu kurucu seçer (kendi açtığı sulardan); bekleme odasının arkasında o su görünür, oda listesinde suyun adı yazar.
- Koi desenleri (`DESENLER`): 18 gerçek koi çeşidi seviye seviye açılır, 6 özel desen inciyle alınır ("My koi" ekranı). Desenler `koiDeseni()` ile çizilir: büyük lekeler (`patch`, `patch2`), mürekkep benekleri (`spots`), kafada kırmızı daire (`crown`), pul ağı (`net`), yanlarda renk (`sides`), sırtta çizgi (`line`), parlaklık (`metal`) ve özel olanlar için çizgiler, yıldızlar, gökkuşağı, hayalet, uzun yüzgeç. Menüdeki resimler aynı çizim koduyla küçük bir tuvale çizilir (`koiResmi`).
- Odalarda her sayfa kendi desenini `merhaba`'da yollar, sunucu diğerlerine iletir; diğer koi'ler o desende çizilir (desen yollamayan eski sayfalarda oyuncunun renginde lekeler). İsim etiketi ve haritadaki nokta oyuncunun renginde kalır.
- İnci: suda arada bir inci belirir, üstünden geçince +3 (odada sadece sana görünür). Tur sonunda her iki balığa 1, her 10 cm'ye 1 inci; odada birinciye +10. Gerçek para yok.
- Gizli at: F11 (dizüstünde fn+F11), H tuşu ya da başlıktaki "Fish" yazısına 2,5 sn içinde 5 kez dokunmak koi'yi eyerli bir ata çevirir (`atMi`, stil `AT`, çizim `drawHorse`); aynı tuşla geri döner. Sadece görünüş: boy, hız, çarpışma aynı. Kaydedilmez, sayfa yenilenince koi'ye döner. Odada sayfa `desen {d: 'at'}` yollar, diğerleri de atı görür.
- F7 (dizüstünde fn+F7): tek kişilik oyunda koi 1 cm uzar (`birSantim`; basılı tutmak bir kez sayar). F7 kullanılan tur (`buyutme` > 0) leaderboard'a yazılmaz, en iyi boyu değiştirmez; tur sonunda "… cm from F7" yazar, takip notuna da eklenir. Odalarda boyu sunucu verdiği için çalışmaz, "only works when you play alone" der.
- Deneme: `localStorage.setItem('fish.debug', '1')` sayfanın içini `window.__fish` olarak açar (`__fish.atResmi(faz, bükülme)` atı büyük çizip resim adresi verir).

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
