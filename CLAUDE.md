# Uzi Games — uzigames.com

Uzay ile babası Umut'un oyun stüdyosu **Uzi Games** (uzigames.com). Repo adı şimdilik `studio`.

- `uzigames.com/` herkese açık stüdyo sayfası. Henüz yayınlanmış oyun yok, "yakında" diyor. Arama motorlarına açık, giriş istemez.
- `uzigames.com/lab/` Lab: Uzay'ın sayfası ve bütün deneme oyunları. Seçilen kişilere açılır, giriş ister, arama motorlarına kapalı (`noindex`, `robots.txt`). Burada tutan oyunlar sonra ilgili platformlarda (App Store, Google Play, web portalları) yayınlanır.
- Her oyun kendi klasöründe, kendi adresinde açılır: `/lab/<slug>/`.

Sitedeki metinler (stüdyo sayfası ve Lab) Uzay'ın ağzından yazılır: "Babamla birlikte yaptığımız oyunlar", "Merhaba, ben Uzay!". Yeni metin eklerken bu sesi koru.

## Yapı

```
index.html         uzigames.com stüdyo sayfası (herkese açık, hesap yok)
robots.txt         /lab/ ve /hesap/ arama motorlarına kapalı
vercel.json        Vercel ayarı (adresler / ile biter) + eski adreslerden /lab/'a yönlendirmeler
.vercelignore      kökteki fish/ (sunucu), supabase/ ve .md dosyaları siteye çıkmaz (kalıplar / ile başlar, yoksa lab/fish de gider)
hesap/             ortak hesap sistemi: hesap.js + supabase.js (supabase-js 2.117.3 UMD, kopya) + nasildi.js ("Nasıldı?" geri bildirim penceresi)
lab/index.html     Lab ana sayfası (Uzay'ın sayfası); oyunları lab/oyunlar.json'dan okur
lab/oyunlar.json   oyun listesi: slug, ad, açıklama, not, listed
lab/defter.css     Lab ana sayfası, giriş ve takip sayfalarının ortak görünümü (kareli defter)
lab/giris/         giriş ve "Kim oynuyor?" (oyuncu seçme, ekleme, düzenleme, şifre değiştirme)
lab/takip/         "Kim ne oynuyor?": son 7 günün oynama kayıtları
lab/yorumlar/      "Nasıldı?" cevapları: yönetici herkesinkini, diğerleri kendi hesabınınkini görür
lab/fish/          Fish: koi oyunu (tek kişilik + arkadaşlarla odalar). Plan lab/fish/PLAN.md
lab/yelken/        Rüzgâr Kaptanı: adım adım yelken okulu
lab/songbox/       SONGbox: karakterlerle şarkı yapma (arayüz İngilizce)
lab/sur-muhafizi/  Sur Muhafızı: 20 dalgalık tower defense
lab/sekme/         Sekme: topu duvarlardan sektirip hedefi vurma, 50 seviye
lab/kar-savasi/    Kar Savaşı: karlı ormanda dalga dalga gelen çocuklara karşı kartopu (açık dünya, tek kişilik)
lab/kanyon/        Kanyon: kanyondaki nehirde jetle uçuş; yakıt al, gemi ve helikopterleri vur, bölge sonundaki köprüyü yık
fish/sunucu/       Fish oda sunucusu (Cloudflare Worker, Durable Objects). Yeri değişmesin: Cloudflare buradan kuruyor
supabase/          veritabanı migration'ları
```

Her oyun klasörünün kendi `CLAUDE.md` dosyası olabilir; o oyunda çalışırken onu da oku.

## Yayın

- Repo Vercel'e bağlı. `main` dalına gönderilen her değişiklik yayına çıkar.
- Başka bir dala gönderilen değişiklik Vercel'de ayrı bir önizleme adresi alır. Yeni sürümü önce oradan test et.
- Şimdilik derleme adımı yok: dosyalar olduğu gibi yayınlanır.
- Alan adı `uzigames.com` Vercel'e bağlı.
- Eski adresler (`/fish/`, `/giris/`, `/takip/`, …) `vercel.json` ile `/lab/...`'a yönlenir; paylaşılmış eski linkler çalışmaya devam eder. Lab'a yeni oyun eklerken oraya da bir satır ekle.
- Fish oda sunucusu (`fish/sunucu/`) Vercel'de değil, Cloudflare'de çalışır: Workers Builds `main` dalını `fish/sunucu` klasöründen `fish-odalar` adlı Worker'a (`wss://fish-odalar.umutguncan.workers.dev`) yayınlar. Root directory ayarı bu klasörü gösterir; klasörü taşırsan Cloudflare'de de değiştir.

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

## Hesap sistemi

- Supabase projesi: `uzay-oyunlar` (Frankfurt, ref `cuihsjlhhbmwnzhldqvp`). Adres ve yayınlanabilir anahtar `hesap/hesap.js` içinde; bu anahtar tarayıcıya açık olabilir, güvenliği satır kuralları (RLS) sağlar.
- Herkes kendi hesabını açabilir: sadece kullanıcı adı + şifre, e-posta yok. Supabase e-posta istediği için kullanıcı adı arka planda `<ad>@oyuncu.bringthepoint.com` adresine çevrilir (`hesap.js` → `KULLANICI_ALANI`, `epostaya()`). Bu adrese hiç e-posta gitmez; bu alanı asla değiştirme, yoksa mevcut hesaplar açılmaz. Kullanıcı adı küçük harfe ve Türkçe karaktersiz hale çevrilir: "Uzay" ile "uzay" aynı hesaptır.
- Supabase ayarları: yeni kayıt açık, "Confirm email" kapalı. "Confirm email" açılırsa kayıt bozulur (onay e-postası gönderilemez).
- Giriş alanına gerçek bir e-posta da yazılabilir (içinde @ varsa olduğu gibi kullanılır). Yönetici hesabı umutguncan@gmail.com bu yolla açılır.
- Bir hesabın altında birden fazla oyuncu (`profiles`: ad, renk) olabilir. Hesap açılınca ilk oyuncu kullanıcı adıyla kendiliğinden oluşur. Tek oyunculu hesaplar oyuncu seçmeden doğrudan oyuna döner; "Değiştir" bağlantısı (`?degistir=1`) her zaman "Kim oynuyor?" ekranını açar.
- Şifre unutulursa e-postayla sıfırlanamaz. SQL ile sıfırlanır:
  `update auth.users set encrypted_password = extensions.crypt('yeni-sifre', extensions.gen_salt('bf')) where email = '<ad>@oyuncu.bringthepoint.com';`
- Tablolar: `profiles` (oyuncular), `saves` (oyuncu + oyun başına tek JSON kayıt), `scores` (biten turların skorları; herkes okur, herkes sadece kendi oyuncusu için yazar), `plays` (oynama oturumları: başlangıç, süre, son görülme, kısa not), `feedback` ("Nasıldı?" cevapları: surat 1–4, hazır etiketler, isteğe bağlı not, cevabın verildiği an), `admins` (yönetici e-postaları; şu an umutguncan@gmail.com).
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
  - Fish: `fish.best` (en iyi boy), `fish.toplam` (şimdiye kadar yenen balıklar, tür tür). Not: boy, yenen balık, yakalayan tür. Leaderboard: her tur bitince boy (cm) `scores`'a yazılır; oyun sonunda bu haftanın ilk 5'i ve oyuncunun yeri, başlangıç ekranındaki Leaderboard düğmesinde bu hafta / tüm zamanlar ilk 10.
    Odalar ("Play with friends"): tur sonunda en büyük boy `scores`'a oyun `fish-oda` olarak yazılır (tek kişilik tabloya karışmaz). Odada yenen balıklar `fish.toplam`'a eklenir. Not: oda, boy, kaçıncı olduğu.
  - Rüzgâr Kaptanı: biten dersler, son ders, parkur rekoru, yeke/dümen dolabı tercihi. Not: açık ders ve kaç ders bittiği, parkur süresi.
  - SONGbox: açılan karakterler, kendi karakterleri, verilen adlar, ödül almış şarkılar, kayıtlı şarkılar. Not: karakter sayısı, şarkı sayısı, son puan.
  - Sekme: `sekme.v1` (seviye başına yıldızlar, son seviye, ses). Seviyeler sırayla açılır: bir seviye en az bir yıldızla geçilince sonraki açılır. Not: açık seviye, geçilen seviye ve toplam yıldız.
    Buradaki, oyuncular için olan normal sürüm. Tüm seviyeleri açan geliştirici sürümü (Sekme Dev: `SEKME_DEV = true`, çözüm gösterme, Atölye seviye editörü) siteye konmaz.
  - Kar Savaşı: `karSavasi.best` (en iyi puan). Not: yeni oyun, dalga ve puan, oyun sonu.
  - Kanyon: `kanyon.hi` (en iyi puan; ses tercihi `kanyon.mute` cihazda kalır). Not: yeni oyun, yıkılan köprü ve puan, oyun sonu. Her biten oyunun puanı `scores`'a yazılır (ayrıntı: köprü sayısı).
  - Sur Muhafızı: `sur-muhafizi-best` (en iyi dalga), `sur-muhafizi-kayit` (tahta temizken alınan savaş görüntüsü: dalga başlarken ve dalga püskürtülünce). Açılışta kayıt varsa "Kaldığın yerden devam?" sorulur. Oyun bitince kayıt silinir. Not: dalga ve can.
- Bir oyun ayrıca (App Store ya da başka bir adres) yayınlanırsa aynı Supabase projesine bağlanır; hesaplar ve kayıtlar her yerde aynı kalır. O zaman `/hesap/...` yolları ve giriş sayfası o yayına göre ayarlanmalı.

## Paylaşım görselleri

- `og:image` her zaman tam adres olsun (örnek: `https://uzigames.com/lab/fish/cover.png`). WhatsApp gibi uygulamalar tam adres ister.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olsun.
- Oyunlar ebeveyn ve çocuğun birlikte oynaması için. Serbest sohbet, kan ya da şiddet yok. ("Nasıldı?" notlarını sadece yöneticiler okur; oyuncular birbirine yazamaz.)
- Önce mobil: her sayfa telefonda düzgün açılmalı.
