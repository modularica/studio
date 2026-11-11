# Fish — oyun notları

Tepeden görünen bir gölette geçen "ye ya da yen" oyunu. Oyuncu 10 cm'lik bir koi ile başlar. Kendinden küçük balıkları yiyerek büyür, büyüklerden kaçar. Tek başına ya da arkadaşlarla aynı gölde (odalar) oynanır. Durum ve sonraki adımlar: `PLAN.md`.

## Bu klasörde

- `index.html`: Oyunun tamamı (tek kişilik ve odalar). Bağımlılıksız, tek dosya.
- `cover.png`: Paylaşım önizlemesi ve ana sayfa kartı (1200×630).
- Oda sunucusu repo kökünde `fish/sunucu/` (Cloudflare Worker + Durable Objects; Cloudflare oradan kurduğu için yeri değişmiyor). Ayrıntı `fish/sunucu/README.md`.
- Leaderboard: tek kişilik tur bitince boy `Hesap.skor` ile kaydedilir; sıralama `Hesap.siralama` ile okunur (ayrıntı kök `CLAUDE.md`'de). İki tablo: Solo (oyun `fish`) ve Rooms (oyun `fish-oda`, odada bir turda ulaşılan en büyük boy). `lbAc(oyun, geriEkran)` tabloyu açar; Back açıldığı ekrana döner. Hesap yoksa (oyun tek başına açılırsa) leaderboard ve odalar gizlenir.

## Haritalar ve seviye

- Dört su (`MAPS`): Gölet, Nehir, Deniz, Okyanus. Her birinin kendi suyu, süsü ve 7 türü var; türlerin boy basamakları (min/max) her yerde aynı, çünkü oda sunucusu sadece basamağı bilir.
  - Nehir: su +x yönünde şeritler halinde akar: koi, balıklar ve parçacıklar sürüklenir. Odalarda `akintiOda(x, y)` (en çok 14 cm/sn, büyüdükçe az hissedilir); tek başına `akintiSolo` (aşağıda). Dipte taşlar.
  - Deniz: yosun yatakları (`yosunda(x, y)`, hücre başına hash): içindeki koi'yi avcılar kovalamaz. Dipte deniz yıldızları. Tek başına gelgit de var.
  - Okyanus: koi'nin ışığı dışı karanlık (`drawDark`); avcıların gözleri karanlıkta kırmızı parlar. Tek başına buzdağları da var.
- `akintiOda()` ve `yosunda()` sunucuda da var (`fish/sunucu/src/kurallar.js`, orada adı `akinti`): ikisi aynı kalmalı. `akinti()` odadayken `akintiOda`'yı, tek başınayken `akintiSolo`'yu çağırır.
- Seviye: `fish.toplam`'daki her balık boy basamağı + 1 XP (`xpOf`); L. seviye için `25 × (L−1)^1.7` XP. Haritalar 1, 3, 6, 10. seviyede açılır. Tur sonunda "+XP" ve açılanlar gösterilir; tur içinde seviye atlayınca bildirim çıkar.
- Odalarda suyu kurucu seçer (kendi açtığı sulardan); bekleme odasının arkasında o su görünür, oda listesinde suyun adı yazar.
- Koi desenleri (`DESENLER`): 18 gerçek koi çeşidi seviye seviye açılır, 6 özel desen inciyle alınır ("My koi" ekranı). Desenler `koiDeseni()` ile çizilir: büyük lekeler (`patch`, `patch2`), mürekkep benekleri (`spots`), kafada kırmızı daire (`crown`), pul ağı (`net`), yanlarda renk (`sides`), sırtta çizgi (`line`), parlaklık (`metal`) ve özel olanlar için çizgiler, yıldızlar, gökkuşağı, hayalet, uzun yüzgeç. Menüdeki resimler aynı çizim koduyla küçük bir tuvale çizilir (`koiResmi`).
- Odalarda her sayfa kendi desenini `merhaba`'da yollar, sunucu diğerlerine iletir; diğer koi'ler o desende çizilir (desen yollamayan eski sayfalarda oyuncunun renginde lekeler). İsim etiketi ve haritadaki nokta oyuncunun renginde kalır.
- İnci: suda arada bir inci belirir, üstünden geçince +3 (odada sadece sana görünür). Tur sonunda her iki balığa 1, her 10 cm'ye 1 inci; odada birinciye +10. Gerçek para yok.
- Gizli at: F11 (dizüstünde fn+F11), H tuşu ya da başlıktaki "Fish" yazısına 2,5 sn içinde 5 kez dokunmak koi'yi eyerli bir ata çevirir (`atMi`, stil `AT`, çizim `drawHorse`); aynı tuşla geri döner. Sadece görünüş: boy, hız, çarpışma aynı. Kaydedilmez, sayfa yenilenince koi'ye döner. Odada sayfa `desen {d: 'at'}` yollar, diğerleri de atı görür.
- Gizli palyaço: AltGr+3 (Türkçe klavyede # tuşu; Mac'te Option+3) koi'yi durmadan dönen bir palyaço yüzüne çevirir (`kilik = 'palyaco'`, çizim `drawPalyaco`): yaka, gökkuşağı peruk, külah, kırmızı burun. Yüz koi'nin ön yarısının üstünde (yediği ve ısırıldığı yer) döner, yön tuşları/joystick yine yönetir. Dönüşürken korna sesi ve konfeti. At ile palyaço aynı anda olmaz (`kilik`: '' / 'at' / 'palyaco'); aynı tuş geri çevirir. Odada `desen {d: 'palyaco'}`.
- Deneme: `localStorage.setItem('fish.debug', '1')` sayfanın içini `window.__fish` olarak açar (`__fish.atResmi(faz, bükülme, 'at' | 'palyaco')` atı ya da palyaçoyu büyük çizip resim adresi verir).

## Tek başına: yolculuk ve Ejder Kapısı (Kasım 2026)

Bu bölümdeki her şey sadece tek kişilik oyunda. Odalar eski kurallarla oynanır (oda sunucusu değişmedi); kod `mode === 'oda'` iken bunların hiçbirini çalıştırmaz, odaya girerken (`odaOyunu`) yolculuk sıfırlanır.

- Büyüme yavaşlar: `buyume(l, f)` = ∛(l³ + 1.3·(10/l)^0.6·f³). 10 cm'de eski formülle aynı; lokma başına büyüme 50 cm'de eskinin yarısından az, 1 m'de dörtte biri kadar. 10 cm'den 1 m'ye boyunun %60'ı kadar balıklarla 28 değil 56 lokma.
- Her suyun boy sınırı var (`MAPS[id].tavan`, cm): Gölet 100, Nehir 200, Deniz 400, Okyanus sınırsız (0). Sınıra gelince bildirim çıkar.
- Gölette 1 m'ye gelince 25 m ötede bir dere açılır (`dereAc`, `yol.dere`); ekran kenarındaki altın ok ve uzaklık yolu gösterir (`drawHedef`). Dereye girince ekran kararır ve koi aynı boyla nehre geçer (`suyaGec`). Menüde Nehir seçilmemiş olsa da (seviye 3'ten önce de) böyle.
- Nehirde Ejder Kapısı (`yol.kapi`, bir şelale çizgisi, x sabit) akıntının tersinde, 60 m yukarıda çıkar: dereden gelene hemen, nehirde başlayana 70 cm'de (`KAPI_BOY`). Kapı 80 m'den uzağa düşmez. 1,5 m'den (`EJDER_BOY`) küçük koi şelaleyi geçemez ("Too small to leap"); büyüğü sıçrar (`sicramaBasla`, `sicramaGuncelle`): koi havada büyür, gölgesi uzaklaşır, altın bir ışık patlamasıyla ejdere döner (`ejderStili`: Gold Dragon deseni, ince gövde, uzun bıyık, yele, boynuz, pençeli dört ayak; `ejderSusu`, `ejderBacak`). Sonra `zafer()`: tur biter, bitiş ekranı "Your koi became a dragon". Ejder +50 inci getirir; ilk ejder Gold Dragon desenini bedava açar (`fish.desenler`'e `dragon`). Ejder bitiş ekranının arkasında yüzmeye devam eder.
- Hafif açlık (`ACLIK`): 30 cm'den büyük koi 9 sn yemezse saniyede boyunun %1'i kadar küçülür, ama turdaki en büyük boyunun %70'inin altına inmez. HUD'da "Hungry" turuncu yazar. Skor, rekor ve leaderboard turun en büyük boyudur (`P.zirve`), açlıkla küçülmek skoru düşürmez.
- Kayalar ve buz (`ENGEL`, hücre başına hash, haritaya göre önbellek): her yer hep aynı görünür. Küme: ortada büyük bir kaya, çevresinde küçükler; aralarındaki boşluktan küçük balık geçer, büyük geçemez. Gölette, nehirde ve denizde kaya; okyanusta buzdağı; nehirde akıntıyla sürüklenen buz kütleleri (`BUZ`, `yol.buzKayma`). Çarpışma sadece kafayla (`engeldenCik`), gövde noktaları da kayanın çevresinden kayar. Kayaya çarpan koi yavaşlar, hızlı çarparsa ses (`sfxCarp`). Yabani balıklar kayaların yanından döner (`engelKac`). İnci kaya içinde doğmaz. Şelalenin 2,5 m yakınında kaya ve buz yok.
- Akıntı (`akintiSolo`): nehirde akıntı koi'nin en yüksek hızına göre ölçeklenir (`akintiOlcek`), yani 2 m'lik koi'yi de 10 cm'lik kadar zorlar (en hızlı şeritte hızının %39'u). Şelalenin altındaki 26 m'de su hızlanır (`hizliSu`, en çok 1,8 kat). Kayaların akıntı altındaki tarafında su sakin (`girdap`, %90'a kadar). Denizde gelgit x yönünde akar ve 90 sn'lik döngünün her yarısında yön değiştirir (`gelgitDeger`); dönmeden önce ve sonra bildirim çıkar (`gelgitUyar`). Parçacıklar akıntının yönünde çizgi olur.
- Skor: `Hesap.skor` ayrıntısında `v: 2` (bu kurallarla oynanan turlar) ve ejder olduysa `ejder: true`.
- Deneme: `window.__fish` içinde `yol`, `buyume`, `akinti`, `gelgitDeger`, `engellerYakin`, `engelHucre`, `engeldenCik`, `dereAc`, `suyaGec`, `sicramaBasla`, `boyYap(cm)`, `akintiOlcek`; `atResmi(faz, bükülme, 'ejder')` ejderin resmini verir.

## Tek kişilik sürümün yapısı

- Büyük balık daha yavaş: bütün hızlar (oyuncu, kaçan, kovalayan, gezinen) boy/saniye × `hizCarpani(boy)` = (boy/10)^-0.3. 10 cm'de 1, 30 cm'de 0.72, 1 m'de 0.5, 3 m'de 0.36. Avcının kovalama hızı oyuncunun en yüksek hızının %78'ini geçmez ve 3 saniye kovalayıp vazgeçer; kaçan balıklar oyuncuyu daha yakından fark eder ve boy/sn × 2.6 ile kaçar (çocukların "büyükler çok hızlı, küçükler kaçıp duruyor" yorumlarından sonra, Kasım 2026). Bu ayarlar sadece tek kişilik; odalarda balıkları sunucu yönetir.

- Her balık 10 noktalı bir "omurga" zinciridir (follow-the-leader). Kafa hareket eder, diğer noktalar sabit aralıkla izler; bükülme açısı sınırlıdır. Kuyruk dalgalanması sadece çizimde eklenir.
- Çarpışma, omurganın 1., 3. ve 5. noktalarındaki dairelerle yapılır. Yeme kontrolü oyuncunun ağız dairesine göre yapılır.
- Kamera ölçeği `targetScale(L)` ile belirlenir. Balıklar ekran kenarının hemen dışında doğar ve görüş alanının epey dışına çıkınca silinir.
- Nilüferler dünya hücrelerine göre hash'lenir; havuz sonsuzdur ama her yer hep aynı görünür.
- Sesler WebAudio ile üretilir; ses dosyası yoktur.
- Titreşim: ses efektleri (`sfxGulp`, `sfxBite`, `sfxOver`, `sfxLevel`, `sfxInci`) `titret()`'i de çağırır; ses kapalıyken de çalışır. iOS uygulamasında `window.uygulama.titret` (`apps/fish/uygulama.js`), Android tarayıcılarda `navigator.vibrate`. iPad ve iOS Safari titremez.

## Odalar (index.html içinde "rooms" bölümü)

- `mode === 'oda'`: ortak göldeyiz. `updateFish`, `collide`, `spawnTick` çalışmaz; yerine `odaGuncelle` çalışır. Yabani balıklar (`fish`) ve diğer koiler (`oda.rakip`) sunucudan gelir.
- Kendi koi'n her zamanki gibi `steerPlayer` ile yüzer; konumu sunucuya `k` mesajıyla gider. Boy (`P.l`) sunucudan gelir.
- Sunucu adresi `ODA_SUNUCU` sabitinde. Boşsa "Play with friends" görünmez. Deneme için `localStorage.setItem('fish.sunucu', 'ws://127.0.0.1:8787')`.
- Giriş için `Hesap.anahtar()` (Supabase erişim anahtarı) ve `Hesap.profil.id` gönderilir.
- Tur sonu skoru `Hesap.skor(enBuyuk, {mod:'oda', ...}, 'fish-oda')`. Odada yenen balıklar `fish.toplam` sayacına da eklenir. `fish.best` sadece tek kişilik içindir.
- Kurallar (`SPECIES` sırası ve boyları, odadaki büyüme ∛(l³ + 1.3·f³), 0.9 / 1.1 eşikleri, hız 3.6 boy/sn × `hizCarpani`, kamera formülü, `akintiOda`) `fish/sunucu/src/kurallar.js` ile aynı kalmalı. Birini değiştirirsen ötekini de değiştir. Tek kişilikteki yeni kurallar (yavaş büyüme, sınırlar, açlık, kayalar) sunucuya bağlı değil.

## Kurallar

- Sunucu otoriterdir. İstemci yeme ya da ölme kararı vermez.
- Çocuklar da oynayacak: serbest sohbet yok, isimler hesaplardan gelir, kan ve şiddet yok.
- Önce mobil: dokunmatikte parmak nereye konursa joystick orada çıkar; parmağı o noktadan sürükleme yönü ve hızı belirler (çok uzağa çekilirse joystick parmağı izler). Bırakınca kaybolur. Sadece oyun sırasında çalışır. Farede koi imlece doğru yüzer. Klavyede ok tuşları ve WASD de çalışır.
- Oyunun arayüzü İngilizce.
