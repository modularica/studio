# Uzi Games — uzigames.com

Uzay ile babası Umut'un oyun stüdyosu **Uzi Games** (uzigames.com). Repo adı şimdilik `studio`.

- `uzigames.com/` herkese açık stüdyo sayfası. İlk oyun Little Koi App Store'da (Apple ID 6831537348, https://apps.apple.com/app/id6831537348); sayfada oyun kartı ve "Download on the App Store" bağlantısı var, `apple-itunes-app` etiketi iPhone Safari'de uygulama şeridini gösterir. İkon `img/little-koi.png`; oyun videosu (sessiz, döngü, 432 px), afiş ve mağaza ekran görüntüleri `img/little-koi/`. En üstte Uzi Games logosu (El ele: uzun baba, kısa Uzay, tek U; siyah, karanlık modda beyaz; açılışta uygulamadaki animasyonun aynısı bir kez oynar; tasarım "Uzi Games logo" tuvalinde). Sayfa sadece İngilizce; altta Lab'a giden büyük "Enter the Lab" düğmesi var. Arama motorlarına açık, giriş istemez.
- `uzigames.com/lab/` Lab: Uzay'ın sayfası ve bütün deneme oyunları. Seçilen kişilere açılır, giriş ister, arama motorlarına kapalı (`noindex`, `robots.txt`). Burada tutan oyunlar sonra ilgili platformlarda (App Store, Google Play, web portalları) yayınlanır.
- Her oyun kendi klasöründe, kendi adresinde açılır: `/lab/<slug>/`.

Sitedeki metinler (stüdyo sayfası ve Lab) Uzay'ın ağzından yazılır: "Games my dad and I made", "Hi, I'm Uzay!", "Let my dad know". Yeni metin eklerken bu sesi koru. Sitenin kendisi İngilizce (10 Kasım 2026'dan beri): stüdyo sayfası, Lab ana sayfası, giriş ve "Who's playing?", bekleme ekranı, takip, yorumlar, onaylar, `hesap.js` hata metinleri, "How was it?" penceresi (`nasildi.js`) ve `lab/oyunlar.json` açıklamaları. Oyunların içi kendi dilinde (çoğu Türkçe; Fish, SONGbox, Drawing Board İngilizce); Türkçe oyunların notunda "in Turkish" yazar. Ortak oda arayüzü (`oda.js`) oyunun `dil` ayarına göre Türkçe ya da İngilizce. `hesap.js`'teki `toLocaleLowerCase('tr')` kullanıcı adını eşlemek için, değiştirme.

## Yapı

```
index.html         uzigames.com stüdyo sayfası (herkese açık, hesap yok)
robots.txt         /lab/ ve /hesap/ arama motorlarına kapalı
privacy/, support/ App Store'un istediği gizlilik ve destek sayfaları (İngilizce, herkese açık, iletişim hello@uzigames.com); görünüm legal.css. Uygulamalara veri toplama ya da oyun eklenirse gizlilik metnini güncelle
vercel.json        Vercel ayarı (adresler / ile biter) + eski adreslerden /lab/'a yönlendirmeler
.vercelignore      kökteki fish/ (sunucu), supabase/, apps/, lab/kis-uykusu-oteli/src/, lab/drawing-board/src/, lab/vagon-defteri/src/, lab/kelime-tenisi/src/, godot/ ve .md dosyaları siteye çıkmaz (kalıplar / ile başlar, yoksa lab/fish de gider)
hesap/             ortak hesap sistemi: hesap.js + supabase.js (supabase-js 2.117.3 UMD, kopya) + nasildi.js ("Nasıldı?" geri bildirim penceresi) + oda.js (ortak "Arkadaşlarla oyna" odaları)
lab/index.html     Lab ana sayfası (Uzay'ın sayfası); oyunları lab/oyunlar.json'dan okur
lab/oyunlar.json   oyun listesi: slug, ad, açıklama, not, listed
lab/defter.css     Lab ana sayfası, giriş ve takip sayfalarının ortak görünümü (kareli defter)
lab/giris/         giriş ve "Kim oynuyor?" (oyuncu seçme, ekleme, düzenleme, şifre değiştirme)
lab/takip/         "Kim ne oynuyor?": son 7 günün oynama kayıtları
lab/yorumlar/      "Nasıldı?" cevapları: yönetici herkesinkini, diğerleri kendi hesabınınkini görür
lab/onay/          Hesap onayları (sadece yönetici): yeni hesapları onayla ya da kapat; Lab ana sayfasında "Onaylar" bağlantısı bekleyen sayısını gösterir
lab/fish/          Fish: koi oyunu (tek kişilik + arkadaşlarla odalar). Plan lab/fish/PLAN.md
lab/yelken/        Rüzgâr Kaptanı: adım adım yelken okulu; parkur yarışı arkadaşlarla odalarda da yapılır
lab/songbox/       SONGbox: karakterlerle şarkı yapma (arayüz İngilizce); odalarda şarkı yarışması
lab/sur-muhafizi/  Sur Muhafızı: 20 dalgalık tower defense; odalarda kim daha uzağa gider
lab/sekme/         Sekme: topu duvarlardan sektirip hedefi vurma, 50 seviye; odalarda yıldız yarışı
lab/kar-savasi/    Kar Savaşı: karlı ormanda dalga dalga gelen çocuklara karşı kartopu (açık dünya; tek başına ya da arkadaşlarla odalarda). Kurallar lab/kar-savasi/oyun.js (sunucu da kullanır)
lab/kanyon/        Kanyon: kanyondaki nehirde jetle uçuş; yakıt al, gemi ve helikopterleri vur, bölge sonundaki köprüyü yık (tek başına ya da arkadaşlarla odalarda)
lab/tank/          Tank Arenası: 2–8 tank, her isabet bir puan; botlarla ya da arkadaşlarla odalarda. Kurallar lab/tank/oyun.js (sunucu da kullanır)
lab/balon-yarisi/  Balon Yarışı: botla ya da arkadaşlarla (odalar) matematik yarışı; 4 işlem, her işlemin kendi 8 seviyesi, zorlanılan sorular sonraki yarışlarda tekrar gelir
lab/karinca-yolu/  Karınca Yolu: yuva kapmaca strateji; sık kullanılan yol feromon izi olup karıncaları hızlandırır. 8 bölüm (bilgisayara karşı) + aynı ekranda iki kişi. Fontlar dosyaya gömülü
lab/kis-uykusu-oteli/  Kış Uykusu Oteli: tycoon; sonbaharda hayvanları odalarına yerleştir, kış boyunca uyut (battaniye, horlama, ağaçkakan, soba; gökten düşen fındıkları yakala, rüya görene yiyeceğini ver, kimse rahatsız olmazsa kuzey ışıkları ve fındık yağmuru), baharda fındıkla öderler, yazın oteli büyüt. Aynı ekranda iki kişi (çoklu dokunma). Fontlar dosyaya gömülü
lab/drawing-board/  Drawing Board (eski adı Küçük Mühendisler; eski adresler buraya yönlenir): The Incredible Machine tarzı fizik bulmacası; parçaları koyup topu kovaya ulaştıran makineyi kur, çalışırken turuncu cihazlara (piston, pervane, kapı, mıknatıs) elle bas ya da sensörle tam otomatik yap. 41 çizim, beş defter (her yeni parça rehberli bir çizimle gelir: parçanın yeri tahtada gösterilir, elle kumandada makine doğru anda durup "şimdi bas" der; Defter 1–3'ün sonunda ikişer "Challenge" çizimi; Defter 3: flipper ve tampon; Defter 4: balon, ip, makas, iğne; Defter 5: kol, dişli, asansör, rüzgâr türbini), çoklu top, renkli bayraklı kovalar, tek görünüm: teknik çizim. Telefonda yalnız yatay (yan panel daraltılabilir). Oyunun içi İngilizce. Aynı ekranda iki kişi. Sayfa src/'den derlenir
lab/kelime-tenisi/ Kelime Düellosu (eski adı Kelime Tenisi; klasör, adres ve kayıt anahtarları eski adla): gelen kelimenin tek harfini değiştirip geri gönder, süre her kelimede kısalır (ya da "Saat": satranç saati gibi maç boyu 20–60 sn, her kelime +2 sn, süresi biten maçı kaybeder, takılan "Sayıyı ver"le sayıyı bırakır), çıkışı olmayan kelime sayıyı hemen alır; sayı yarışı (kısa 5, uzun 9). İki kişi tek ekranda karşılıklı (üst yarı ters), iki telefondan (ortak odalar, sıra tabanlı) ya da bota karşı; Türkçe (sözlük kelimeleri ve fiil kökleri: GEL, ANLA; ekli haller geçmez: EVDE, ALDI) ve İngilizce. Tenis teması 11 Kasım 2026'da kaldırıldı, yeni tema konuşulacak. Sayfa src/'den derlenir
lab/otel-yeni/     Kış Uykusu Oteli'nin iPad için yeni görünüm denemesi (Godot'tan dışa aktarılır, elle düzenleme; sadece linkle). Kaynak godot/kis-uykusu-oteli/
lab/vagon-defteri/ Vagon Defteri (oyun değil, araç; sadece linkle): Umut'un trende telefonda çizmesi için defter. Üç kalem modu (Parmak, parmağın kapatmadığı Uç, iki başparmakla Trackpad), ivme ölçerle sarsıntıda kayan çizgiyi düzelten süzgeç, Marmaray'da her durak arası yeni sayfa, sensör kaydı. Sayfa src/'den derlenir
godot/             Godot projeleri (siteye çıkmaz). godot/kis-uykusu-oteli/: Kış Uykusu Oteli'nin iPad sürümü; kurallar web sürümüyle birebir aynı, testi ve dışa aktarma adımları kendi CLAUDE.md'sinde
fish/sunucu/       Lab'ın oda sunucusu: Fish, Tank Arenası, Kar Savaşı ve ortak odalar (Cloudflare Worker, Durable Objects). Yeri değişmesin: Cloudflare buradan kuruyor
supabase/          veritabanı migration'ları
```

Her oyun klasörünün kendi `CLAUDE.md` dosyası olabilir; o oyunda çalışırken onu da oku.

## Yayın

- Repo Vercel'e bağlı. `main` dalına gönderilen her değişiklik yayına çıkar.
- Başka bir dala gönderilen değişiklik Vercel'de ayrı bir önizleme adresi alır. Yeni sürümü önce oradan test et.
- Şimdilik derleme adımı yok: dosyalar olduğu gibi yayınlanır.
- Alan adı `uzigames.com` Vercel'e bağlı.
- Eski adresler (`/fish/`, `/giris/`, `/takip/`, …) `vercel.json` ile `/lab/...`'a yönlenir; paylaşılmış eski linkler çalışmaya devam eder. Lab'a yeni oyun eklerken oraya da bir satır ekle.
- Oda sunucusu (`fish/sunucu/`) Vercel'de değil, Cloudflare'de çalışır: Workers Builds `main` dalını `fish/sunucu` klasöründen `fish-odalar` adlı Worker'a (`wss://fish-odalar.umutguncan.workers.dev`) yayınlar. Root directory ayarı bu klasörü gösterir; klasörü taşırsan Cloudflare'de de değiştir. Fish odaları `/lobi` ve `/oda/<id>`, Tank Arenası odaları `/tank/lobi` ve `/tank/oda/<id>`, Kar Savaşı odaları `/kar/lobi` ve `/kar/oda/<id>` adreslerindedir. Ortak odaları kullanan oyunlar `/<oyun>/lobi` ve `/<oyun>/oda/<id>` adreslerindedir (`balon`, `kanyon`, `yelken`, `sekme`, `sur`, `songbox`, `kelime`).
- Tank sunucusu oyunun kurallarını `lab/tank/oyun.js`'ten alır (`fish/sunucu/src/tank-oda.js` onu içe aktarır). Bu dosyayı taşıma ya da adını değiştirme; değiştirince sunucu da yeniden yayınlanır. Harita ya da kurallar sayfa ile sunucu arasında uyuşmayacak şekilde değişirse `oyun.js`'teki `SURUM`'u bir artır.
- Kar Savaşı da aynı düzende: kurallar `lab/kar-savasi/oyun.js` (`fish/sunucu/src/kar-oda.js` içe aktarır). Orman üreticisi ya da kurallar sayfa ile sunucu arasında uyuşmayacak şekilde değişirse oradaki `VERSION`'ı bir artır.

## Yeni oyun eklemek

Yeni oyunlar önce Lab'a girer.

1. `lab/<slug>/index.html` olarak koy. Slug kısa, küçük harf, Türkçe karaktersiz olsun (örnek: `kar-savasi`).
2. Oyun tek dosyaysa dış bağlantısı sadece Google Fonts ya da sabit sürümlü bir CDN olsun. Göreli yollar `/lab/<slug>/` altına göre çalışmalı.
3. `<head>` içine paylaşım etiketlerini ekle: `description`, `og:title`, `og:description`, `og:image` (tam adres: `https://uzigames.com/lab/<slug>/cover.png`), `twitter:card`. Örnek: `lab/fish/index.html`.
4. Oyunun açılış ekranından 1200×630 bir `cover.png` çıkar ve klasöre koy.
5. `<head>` içine hesap satırlarını ekle (giriş kapısı ve oynama takibi):
   ```html
   <meta name="robots" content="noindex">
   <script src="/hesap/supabase.js"></script>
   <script src="/hesap/hesap.js" data-oyun="<slug>" data-kayit="<oyunun localStorage anahtarları>"></script>
   ```
   `data-kayit`: oyunun ilerlemesini tuttuğu localStorage anahtarları, boşlukla ayrılmış. Ses, sahne gibi cihaz tercihlerini koyma. İstersen oyunun önemli anlarında `Hesap.not('...')` ile takip sayfasına kısa bir ilerleme notu yaz (`window.Hesap` yoksa çağırma). Not, "Nasıldı?" cevabına da eklenir; "çok zordu" diyenin nerede olduğunu gösterir.
   Oyunun mola ve bitiş ekranlarına (oyun sırasında değil) bir "Nasıldı?" düğmesi koy: oyunun kendi düğme sınıfıyla `<button type="button" data-nasildi="oyun-sonu">Nasıldı?</button>`. `data-nasildi` değeri nerede sorulduğunu yazar (`oyun-sonu`, `mola`, `seviye-sonu`…). Tıklamayı `hesap.js` yakalar.
6. `lab/oyunlar.json` listesine bir satır ekle. Sadece linkle paylaşılacak, Lab ana sayfasında görünmeyecek oyunlar için `"listed": false` yaz.
7. `vercel.json` yönlendirmelerine `/<slug>/:path*` → `/lab/<slug>/:path*` satırını ekle (biri eski usul kısa adresi yazarsa diye).

## Odalar ("Arkadaşlarla oyna")

- Fish, Tank Arenası ve Kar Savaşı'nın odalarını oyunu sunucu yürütür (kendi Durable Object'leri). Diğer oyunlar ortak odaları kullanır: sayfa tarafı `hesap/oda.js`, sunucu tarafı `fish/sunucu/src/genel-oda.js`.
- Ortak odada her sayfa kendi oyununu oynar (herkese aynı tohum), skorunu ve küçük bir canlı durumunu (balonun yüksekliği, hayalet jet, tekne) odaya yollar; oda bekleme odasını, başlatmayı, durumları dağıtmayı, turun bitişini ve sıralamayı yapar. Skoru sayfa söyler (aile oyunu; hile denetimi yok).
- Sıra tabanlı oyun (`OYUNLAR`'da `kayit`; şimdilik Kelime Düellosu): hamleler `oda.olay(e)` ile gider, oda turun hamlelerini saklar ve geri gelen sayfaya `basla`/`geri` mesajında `log` olarak verir; kopan oyuncunun yeri `geri` saniye (5 dk) tutulur. `oda.js`: `enAz` (kurucu en az bu kadar kişiyle başlatır), `yazi` (oyunun kendi metinleri), `geri(m)` (aynı tura geri dönüş), ayarlarda `goster(ayar)` (bir seçim yalnız başka bir seçimle görünür), `odalariIzle(cb)` (açık odalar oyunun kendi ekranında, örneğin menüde canlı; Kelime Düellosu kullanıyor), `bitir(p, eser, v, ust, sk)`'da `sk` (sonuç `p` yerine buna göre sıralanır; `scores`'a yine `p` yazılır).
- `oda.js` oda listesini, bekleme odasını (kurucu başlatır, kurucunun seçebileceği ayarlar), davet linkini (`?oda=<id>`), oyun içi oda menüsünü, "bitirdin, diğerleri bekleniyor" ekranını, küçük canlı sıralamayı ve sonuç kürsüsünü kendisi gösterir (shadow DOM, oyunun renkleri ve yazı tipleriyle). Kullanımı dosyanın başında.
- Sunucudaki `OYUNLAR` listesi her oyunun kişi sınırını, en uzun tur süresini, ilk bitirenden sonra kalan süreyi (`sonra`) ve sıralamayı (`sure`: önce bitiren, `puan`: en yüksek skor) tutar. Yeni bir oyuna oda eklerken oraya bir satır ekle.
- Tur bitince skor `scores`'a `<oyun-slug>-oda` olarak yazılır (ayrıntı: sıra, oyuncu sayısı, bitirme süresi).
- Deneme: `fish/sunucu`'da `npx wrangler dev --var AUTH_YOK:1`, tarayıcıda `localStorage.setItem('oda.sunucu', 'ws://127.0.0.1:8787')`.

## Hesap sistemi

- Supabase projesi: `uzay-oyunlar` (Frankfurt, ref `cuihsjlhhbmwnzhldqvp`). Adres ve yayınlanabilir anahtar `hesap/hesap.js` içinde; bu anahtar tarayıcıya açık olabilir, güvenliği satır kuralları (RLS) sağlar.
- Herkes kendi hesabını açabilir: sadece kullanıcı adı + şifre, e-posta yok. Ama yeni hesap bir yönetici onaylayana kadar Lab'a giremez (`public.members`: `pending` / `approved` / `rejected`, migration 0006). Giriş sayfası onaysız hesaba "Neredeyse hazır!" ekranını gösterir ve 20 sn'de bir yeniden bakar; yönetici `lab/onay/`'dan onaylar. Onaysız hesap satır kurallarıyla da hiçbir oyuncuyu, kaydı, skoru, oynama kaydını göremez ve yazamaz (`private.approved()`, `owns_profile()` onu da sorar). İlk oyuncusu onaydan sonraki ilk girişte kullanıcı adıyla oluşur. `hesap.js` onayı cihazda hatırlar (`hesap.onay`), arka planda yine sorar; onayı kaldırılan hesap giriş sayfasına döner. 10 Kasım 2026'da var olan 36 hesap ve `admins` e-postaları onaylı sayılır. Supabase e-posta istediği için kullanıcı adı arka planda `<ad>@oyuncu.bringthepoint.com` adresine çevrilir (`hesap.js` → `KULLANICI_ALANI`, `epostaya()`). Bu adrese hiç e-posta gitmez; bu alanı asla değiştirme, yoksa mevcut hesaplar açılmaz. Kullanıcı adı küçük harfe ve Türkçe karaktersiz hale çevrilir: "Uzay" ile "uzay" aynı hesaptır.
- Supabase ayarları: yeni kayıt açık, "Confirm email" kapalı. "Confirm email" açılırsa kayıt bozulur (onay e-postası gönderilemez).
- Giriş alanına gerçek bir e-posta da yazılabilir (içinde @ varsa olduğu gibi kullanılır). Yönetici hesabı umutguncan@gmail.com bu yolla açılır.
- Bir hesabın altında birden fazla oyuncu (`profiles`: ad, renk) olabilir. Hesap açılınca ilk oyuncu kullanıcı adıyla kendiliğinden oluşur. Tek oyunculu hesaplar oyuncu seçmeden doğrudan oyuna döner; "Değiştir" bağlantısı (`?degistir=1`) her zaman "Kim oynuyor?" ekranını açar.
- Şifre unutulursa e-postayla sıfırlanamaz. SQL ile sıfırlanır:
  `update auth.users set encrypted_password = extensions.crypt('yeni-sifre', extensions.gen_salt('bf')) where email = '<ad>@oyuncu.bringthepoint.com';`
- Tablolar: `profiles` (oyuncular), `saves` (oyuncu + oyun başına tek JSON kayıt), `scores` (biten turların skorları; herkes okur, herkes sadece kendi oyuncusu için yazar), `plays` (oynama oturumları: başlangıç, süre, son görülme, kısa not), `feedback` ("Nasıldı?" cevapları: surat 1–4, hazır etiketler, isteğe bağlı not, cevabın verildiği an), `admins` (yönetici e-postaları; şu an umutguncan@gmail.com), `members` (hesap başına onay durumu; istemciler doğrudan okumaz: `onay_durumu()`, yönetici için `hesaplar()`, `hesap_karar(user, status)`, `bekleyen_sayisi()`).
- Kurallar: giriş yapan herkes bütün oyuncuların adını/rengini ve oynama kayıtlarını görür ("Kim ne oynuyor?" herkese açık). Oyun kayıtları (`saves`) sadece sahibine açık. Herkes sadece kendi oyuncularını, kayıtlarını ve oynama kayıtlarını yazar. `feedback` cevaplarını herkes yazar ama sadece kendi hesabınınkileri okur; yöneticiler hepsini okur (`lab/yorumlar/`). Kural yardımcıları `private` şemasında; `public.yonetici_mi()` sayfaların "yönetici miyim?" diye sorması için.
- Yönetici olmak: Lab'da "Hesap aç"ta kullanıcı adı yerine `admins` tablosundaki e-postayı (umutguncan@gmail.com) yaz. Başka birini yönetici yapmak için e-postasını (kullanıcı adı hesaplarında `<ad>@oyuncu.bringthepoint.com`) `admins` tablosuna ekle.
- Oyunlardan kullanım (`hesap/hesap.js` başındaki açıklamaya bak):
  - `Hesap.hazir` giriş kapısı geçilince çözülür, `Hesap.profil` seçili oyuncu.
  - `Hesap.yukle()` / `Hesap.kaydet(veri)` bu oyunun kaydı. Kaydı seviye ya da ders sonu gibi anlarda yaz, her karede değil.
  - `Hesap.not('12. dalga')` takip sayfasında görünen kısa ilerleme notu.
  - `Hesap.skor(deger, ayrinti)` biten bir turun skorunu `scores` tablosuna yazar (her tur bir satır, sonradan değişmez).
  - `Hesap.siralama({ hafta: true, limit: 100 })` oyuncu başına en iyi skor, büyükten küçüğe (`leaderboard` fonksiyonu). `hafta: true` bu haftanın pazartesisinden beri, yoksa tüm zamanlar. Satırlar: `profile_id, name, color, best, rounds, best_at`.
  - `Hesap.nasildi({ oyun, yer, puan })` "Nasıldı?" penceresini açar (`hesap/nasildi.js`'i ilk kullanımda yükler). `data-nasildi` düğmeleri bunu çağırır. `Hesap.yorum(...)` cevabı yazar, `Hesap.yorumlarim()` oyuncunun kendi cevapları, `Hesap.yoneticiMi()`.
  - `Hesap.anahtar()` oturumun erişim anahtarı. Başka bir sunucuya (Fish oda sunucusu) kim olduğunu göstermek için; o sunucu anahtarı Supabase'e sorarak doğrular.
- Kayıt eşitleme (`data-kayit`): oyunlar ilerlemeyi her zamanki gibi localStorage'a yazar; `hesap.js` bu anahtarları oyuncunun hesabındaki `saves` satırına (`data.keys`) taşır. Oyun açılırken karar verir, karar verene kadar sayfa gizli kalır:
  - Hesapta kayıt yok, cihazdaki kayıt bu oyuncunun ya da hesaplardan önceki eski kayıt → hesaba yüklenir (eski ilerleme ilk girişte aktarılır).
  - Cihazdaki kayıt başka bir oyuncunun → bu oyuncu sıfırdan başlar.
  - Hesaptaki kayıt farklı → hesaptaki cihaza yazılır ve sayfa bir kez yenilenir. Cihazda hesaba gitmemiş daha yeni değişiklik varsa cihazdaki kazanır.
  - Cihazdaki eşitleme durumu `hesap.senk.<oyun>` anahtarında. İnternet yoksa oyun cihazdaki kayıtla açılır, karar bir sonraki açılışta verilir.
  - Aynı oyunda hem `data-kayit` hem `Hesap.kaydet` kullanma: ikisi aynı satıra yazar.
- Oyun oyun ne kaydediliyor:
  - Fish: `fish.best` (en iyi boy), `fish.toplam` (şimdiye kadar yenen balıklar, tür tür), `fish.desen` (giyilen koi deseni), `fish.desenler` (inciyle alınan desenler), `fish.inci` (inci). Seviye `fish.toplam`'dan hesaplanır (her balık boy basamağına göre 1–7 XP); ayrı bir anahtarı yok. Seçili su (`fish.harita`) cihazda kalır.
    Koi desenleri: 1–18. seviyelerde birer gerçek koi çeşidi (Kohaku, Ogon, Tancho, Showa…) açılır; 6 özel desen (Tiger, Butterfly, Galaxy, Rainbow, Ghost, Gold Dragon) inciyle alınır. İnci: suda beliren incilerin üstünden geçince 3, tur sonunda her iki balığa 1 ve her 10 cm'ye 1 (odada birinciye +10). Gerçek para yok.
    Haritalar: Gölet (1. seviye), Nehir (3: akıntı), Deniz (6: yosun yatağında saklanılır), Okyanus (10: karanlık). Her haritanın kendi 7 türü var, boy basamakları aynı. Not: boy, yenen balık, yakalayan tür. Leaderboard: her tur bitince boy (cm) `scores`'a yazılır; oyun sonunda bu haftanın ilk 5'i ve oyuncunun yeri, başlangıç ekranındaki Leaderboard düğmesinde bu hafta / tüm zamanlar ilk 10.
    Odalar ("Play with friends"): tur sonunda en büyük boy `scores`'a oyun `fish-oda` olarak yazılır (tek kişilik tabloya karışmaz). Leaderboard'da "Solo" / "Rooms" diye iki tablo var; Rooms tablosu oda listesinden ve tur sonu ekranından da açılır. Odada yenen balıklar `fish.toplam`'a eklenir. Not: oda, boy, kaçıncı olduğu.
  - Rüzgâr Kaptanı: biten dersler, son ders, parkur rekoru, yeke/dümen dolabı tercihi. Not: açık ders ve kaç ders bittiği, parkur süresi.
    Odalar ("Arkadaşlarla yarış", ders listesinde ve parkur dersinin girişinde): herkes parkur yarışını aynı rüzgârda (rüzgâr salınımı yarış saatine bağlı) aynı anda yapar, diğer tekneler kendi renklerinde görünür, çarpışma yok. Bitişe ilk varan kazanır; ilk varandan sonra diğerlerinin bir dakikası kalır. Odadaki süre de parkur rekoru sayılır. Skor `yelken-oda` (geçilen şamandıra sayısı; süre ayrıntıda). Deneme: `ruzgar-kaptani.debug` = `1` sayfanın içini `window.__yelken` olarak açar.
  - SONGbox: açılan karakterler, kendi karakterleri, verilen adlar, ödül almış şarkılar, kayıtlı şarkılar. Not: karakter sayısı, şarkı sayısı, son puan.
    Odalar ("Play with friends"): şarkı yarışması. Kurucu süreyi seçer (2/3/5 dk); herkes boş sahneden şarkı yapar, "★ Send my song" her zamanki gibi puanlar (karakter açılabilir) ve şarkıyı yollar; süre bitmek üzereyken yollanmamış şarkı kendiliğinden gider. En yüksek puan kazanır; sonuçlarda her şarkı "▶ Listen" ile dinlenir (başkasının kendi yaptığı karakterler de gelir, rafa eklenmez). Odaya girerken sahnen saklanır, çıkınca geri gelir. Skor `songbox-oda`. Deneme: `songbox.debug` = `1` → `window.__songbox`.
  - Sekme: `sekme.v1` (seviye başına yıldızlar, son seviye, ses). Seviyeler sırayla açılır: bir seviye en az bir yıldızla geçilince sonraki açılır. Not: açık seviye, geçilen seviye ve toplam yıldız.
    Buradaki, oyuncular için olan normal sürüm. Tüm seviyeleri açan geliştirici sürümü (Sekme Dev: `SEKME_DEV = true`, çözüm gösterme, Atölye seviye editörü) siteye konmaz.
    Odalar (çubuktaki iki kişi simgesi): yıldız yarışı. Kurucu bölümü ve süreyi (3/5/10 dk) seçer; herkes o bölümün 10 seviyesini sırayla oynar, vurunca yıldızlar gelir ve sonraki seviye kendiliğinden açılır; üç atıştan sonra "Bu seviyeyi geç" çıkar. Süre bitince en çok yıldız kazanır. Odalar `sekme.v1`'i (tek kişilik ilerleme) değiştirmez; odada bütün bölümler açıktır. Skor `sekme-oda` (yıldız; ayrıntı: bölüm, geçilen seviye). Deneme: `sekme.debug` = `1` → `window.__sekme`.
  - Kar Savaşı: `karSavasi.best` (tek başına en iyi puan). Not: yeni oyun, dalga ve puan, oyun sonu.
    Odalar ("Arkadaşlarla oyna"): biten (ya da yarıda bırakılan) oyunun takım puanı `scores`'a oyun `kar-savasi-oda` olarak yazılır (ayrıntı: dalga, oyuncunun devirdiği çocuk sayısı, oyuncu sayısı). Not: oda, dalga ve takım puanı.
  - Kanyon: `kanyon.hi` (en iyi puan), `kanyon.uzak` (şimdiye kadar yıkılan en uzak köprü; ses tercihi `kanyon.mute` cihazda kalır). Not: yeni oyun, yıkılan köprü ve puan, oyun sonu. Her biten oyunun puanı `scores`'a yazılır (ayrıntı: köprü sayısı).
    Nehir ve üstündeki her şey her oyunda aynı (`RIVER_SEED`); oyuncular ezberleyip ilerliyor. Tohumu değiştirirsen herkesin öğrendiği harita ve `kanyon.uzak` anlamını yitirir.
    Odalar ("Arkadaşlarla uç"): herkes aynı nehirde aynı anda kendi uçağını uçurur, diğerleri renkli gölge uçak (ekran dışındakiler üstte/altta isimle) olarak görünür; uçaklar birbirine çarpmaz. Kurucu süreyi seçer (3/5/10 dk); süre bitince ya da herkesin uçakları bitince en yüksek puan kazanır. Odadayken mola yok: oda menüsü açılınca sadece kendi uçağın bekler. Skor `kanyon-oda` (ayrıntı: köprü).
  - Tank Arenası: `tank.rekor` (botlarla bir turdaki en çok isabet; bot sayısı/zorluk `tank.ayar` ve ses `tank.ses` cihazda kalır). Not: botlarla başlama, tur sonu (isabet ve sıra), oda turu. Botlarla biten her tur `scores`'a oyun `tank` olarak, oda turları `tank-oda` olarak yazılır (ayrıntı: bot sayısı, zorluk, sıra, kaç kez boyandığı).
  - Balon Yarışı: `balon.ayar` (seçili işlemler, işlem başına seviye, rakip), `balon.zayif` (yanlış yapılan sorular; yarışlarda tekrar sorulur, doğru bilinince azalır). Ses tercihi `balon.ses` cihazda kalır. Not: yarış başı (işlem ve seviyeler, rakip), yarış sonu (kazandı/kaybetti, doğru sayısı, süre).
    Odalar ("Arkadaşlarla yarış"): herkes kendi işlem ve seviyelerinde soru çözer, 1000 metreye ilk çıkan kazanır; ilk bitirenden sonra diğerlerinin 45 saniyesi kalır. Skor `balon-yarisi-oda` (doğru sayısı; ayrıntı: sıra, süre, işlemler).
  - Karınca Yolu: `karinca-yolu:progress` (bölüm başına yıldız, `all` = tüm bölümler açık). Ses tercihi `karinca-yolu:sound` cihazda kalır. Bölümler sırayla açılır; "Tüm bölümleri aç" Lab'da sadece yöneticilere görünür. Not: bölüm başı, bölüm sonu (kazandı/kaybetti, yıldız, süre), iki kişilik maç sonucu. Odası yok. Deneme: sayfa içi `window.karincaYolu` (Game, LEVELS, UI).
  - Kış Uykusu Oteli: `otel.save` (yıl, fındık, kalp, odalar, yardımcılar, geliştirmeler, görülen ipuçları). Kayıt bahar başında ve yazın her alışverişte yazılır; yıl ortasında çıkılırsa o yıl baştan başlar. Ses tercihi `otel.sound` cihazda kalır. Not: yıl başı (oda, yıldız, fındık), yıl sonu (misafir, kalp, fındık, uyanan, giden, yakalanan fındık, gerçek olan rüya, kuzey ışığı sayısı). "Nasıldı?" mola ve bahar özetinde. Odası yok. Deneme: `otel.debug` = `true` sayfanın içini `window.__otel` olarak açar. Sayfa `src/`'den derlenir, elle düzenleme: ayrıntı `lab/kis-uykusu-oteli/CLAUDE.md`.
  - Drawing Board: `drawing-board.v1` (çizim başına çözüldü ve damgalar, her çizimdeki kurulum, son açılan çizim), `drawing-board.workshop` (Atölye'de çizilen bölümler; paylaşım linki `#cizim=...` açanın Atölye defterine ekler). Ses ve müzik tercihi (`drawing-board.device`) cihazda kalır. Her çizimin kendi müziği var (sentez, `src/audio.js`); çizim ilk kez çözülünce sonraki çizimin yeni parçası "New part unlocked!" olarak açılır. Eski adın anahtarlarındaki (`kucuk-muhendisler.v1`, `.cihaz`) kayıt açılışta bir kez taşınır. Bütün çizimler açık (sıra öneri; 9 Kasım 2026'dan beri kilit yok). Not (Türkçe): çözülen çizim, damga sayısı ve elle basış. "Nasıldı?" sonuç penceresinde ve bölümler sayfasında. Odası yok. Sayfa `src/`'den derlenir, elle düzenleme: ayrıntı `lab/drawing-board/CLAUDE.md`.
  - Sur Muhafızı: `sur-muhafizi-best` (en iyi dalga), `sur-muhafizi-kayit` (tahta temizken alınan savaş görüntüsü: dalga başlarken ve dalga püskürtülünce). Açılışta kayıt varsa "Kaldığın yerden devam?" sorulur. Oyun bitince kayıt silinir. Not: dalga ve can.
    Odalar (üstteki "Arkadaşlarla"): herkes aynı haritada aynı dalgalara karşı kendi kalesini kendi hızında korur; kurucu süreyi seçer (10/15/25 dk). Süre bitince ya da bütün kaleler düşünce en uzağa giden kazanır (puan = dalga × 100 + can; düşen kalede o dalga sayılmaz). Oda savaşı tek kişilik kaydı (`sur-muhafizi-kayit`) değiştirmez; odadan çıkınca "Kaldığın yerden devam?" yine sorulur. Skor `sur-muhafizi-oda`.
  - Kelime Düellosu (`lab/kelime-tenisi/`, eski adı Kelime Tenisi): `kelime-tenisi.v1` (bota karşı galibiyet/yenilgi seviye seviye, iki kişilik maç sayısı, en uzun zincir ve kelimeleri, çıkmaz sayısı). Dil, kelime boyu, süre (saat modunda `pace: 'saat'` ve `bank` sn), maç biçimi, adlar, handikap ve ses `kelime-tenisi.device`'ta, cihazda kalır. Not: maç başı (mod, dil, harf, süre, hedef sayı), maç sonu (sonuç, skor, en uzun zincir, çıkmaz). "Nasıldı?" molada ve maç sonunda. Sözlük `src/words.js` (Zemberek sözlüğü ve çözümleyicisi + ENABLE, `src/tools/words.py` üretir).
    Odalar (menüde "İki telefondan"; açık odalar menüde "Açık odalar"da canlı görünür, linksiz katılınır): iki kişi kendi telefonundan aynı maçı oynar; kurucu dil, harf, süre (Saat seçilirse herkesin süresi) ve maç uzunluğunu seçer. Skor `kelime-tenisi-oda` (kazanılan sayı; ayrıntı: en uzun zincir, hedef, saat modunda başlangıç ve kalan süre). Oda sonucu maçı kazananı birinci gösterir (`sk`): süresi biten sayıda önde olsa da kaybeder. İki telefonlu maçlar `kelime-tenisi.v1`'de `online` sayısına eklenir. Not: iki telefonlu maç sonu (skor, rakip, zincir, çıkmaz). Deneme: `kelime-tenisi.debug` = `1` → `window.__kt`. Sayfa `src/`'den derlenir, elle düzenleme: ayrıntı `lab/kelime-tenisi/CLAUDE.md`.
  - Kış Uykusu Oteli · yeni görünüm (`otel-yeni`, Godot): görünüm denemesi, kayıt yok (`data-kayit` yok), not yazmaz. Sağ üstteki "Nasıldı?" `Hesap.nasildi({ oyun: 'otel-yeni', yer: 'gorunum' })` çağırır (Godot'tan `JavaScriptBridge`). Odası yok. Dışa aktarma ve test: `godot/kis-uykusu-oteli/CLAUDE.md`.
  - Vagon Defteri: hesaba eşitlenen kayıt yok (`data-kayit` yok). Sayfalar cihazda IndexedDB'de; ayarlar (`vagon.ayar`), yolculuk (`vagon.yolculuk`), açık sayfa (`vagon.sayfa`) localStorage'da. Sensör kaydı da cihazda kalır, kullanıcı "Kaydı paylaş"la dosya olarak verir. Not: yolculuk başı, biten sayfa (başlık, çizgi, sarsıntı düzeltmesi, kalem modu). "Nasıldı?" defter ekranında. Odası yok. Sayfa `src/`'den derlenir, elle düzenleme: ayrıntı `lab/vagon-defteri/CLAUDE.md`.
- Bir oyun ayrıca (App Store ya da başka bir adres) yayınlanırsa aynı Supabase projesine bağlanır; hesaplar ve kayıtlar her yerde aynı kalır. O zaman `/hesap/...` yolları ve giriş sayfası o yayına göre ayarlanmalı.

## Paylaşım görselleri

- `og:image` her zaman tam adres olsun (örnek: `https://uzigames.com/lab/fish/cover.png`). WhatsApp gibi uygulamalar tam adres ister.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olsun.
- Oyunlar ebeveyn ve çocuğun birlikte oynaması için. Serbest sohbet, kan ya da şiddet yok. ("Nasıldı?" notlarını sadece yöneticiler okur; oyuncular birbirine yazamaz.)
- Önce mobil: her sayfa telefonda düzgün açılmalı.
