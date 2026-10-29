# Uzay'ın sayfası — oyunlar

Uzay ile babası Umut'un birlikte yaptığı oyunların yayınlandığı tek repo. Ana sayfa Uzay'ın sayfasıdır ve oyunları listeler. Her oyun kendi klasöründe, kendi adresinde açılır. Repo adı şimdilik `studio`.

Sitedeki metinler Uzay'ın ağzından yazılır: "Babamla birlikte yaptığımız oyunlar", "Merhaba, ben Uzay!". Yeni metin eklerken bu sesi koru.

## Yapı

```
index.html     ana sayfa (Uzay'ın sayfası); oyunları oyunlar.json'dan okur
oyunlar.json   oyun listesi: slug, ad, açıklama, not, listed
defter.css     ana sayfa, giriş ve takip sayfalarının ortak görünümü (kareli defter)
hesap/         ortak hesap sistemi: hesap.js + supabase.js (supabase-js 2.117.3 UMD, kopya)
giris/         giriş ve "Kim oynuyor?" (oyuncu seçme, ekleme, düzenleme, şifre değiştirme)
takip/         "Kim ne oynuyor?": son 7 günün oynama kayıtları
vercel.json    Vercel ayarı (adresler / ile biter: /fish/)
fish/          Fish: koi oyunu. Multiplayer planı fish/PLAN.md
yelken/        Rüzgâr Kaptanı: adım adım yelken okulu
songbox/       SONGbox: karakterlerle şarkı yapma (arayüz İngilizce)
sur-muhafizi/  Sur Muhafızı: 20 dalgalık tower defense
sekme/         Sekme: topu duvarlardan sektirip hedefi vurma, 50 seviye
```

Her oyun klasörünün kendi `CLAUDE.md` dosyası olabilir; o oyunda çalışırken onu da oku.

## Yayın

- Repo Vercel'e bağlı. `main` dalına gönderilen her değişiklik yayına çıkar.
- Başka bir dala gönderilen değişiklik Vercel'de ayrı bir önizleme adresi alır. Yeni sürümü önce oradan test et.
- Şimdilik derleme adımı yok: dosyalar olduğu gibi yayınlanır.

## Yeni oyun eklemek

1. `<slug>/index.html` olarak koy. Slug kısa, küçük harf, Türkçe karaktersiz olsun (örnek: `kar-savasi`).
2. Oyun tek dosyaysa dış bağlantısı sadece Google Fonts ya da sabit sürümlü bir CDN olsun. Göreli yollar `/<slug>/` altına göre çalışmalı.
3. `<head>` içine paylaşım etiketlerini ekle: `description`, `og:title`, `og:description`, `og:image` (`cover.png`), `twitter:card`. Örnek: `fish/index.html`.
4. Oyunun açılış ekranından 1200×630 bir `cover.png` çıkar ve klasöre koy.
5. `<head>` içine hesap satırlarını ekle (giriş kapısı ve oynama takibi):
   ```html
   <meta name="robots" content="noindex">
   <script src="/hesap/supabase.js"></script>
   <script src="/hesap/hesap.js" data-oyun="<slug>" data-kayit="<oyunun localStorage anahtarları>"></script>
   ```
   `data-kayit`: oyunun ilerlemesini tuttuğu localStorage anahtarları, boşlukla ayrılmış. Ses, sahne gibi cihaz tercihlerini koyma. İstersen oyunun önemli anlarında `Hesap.not('...')` ile takip sayfasına kısa bir ilerleme notu yaz (`window.Hesap` yoksa çağırma).
6. `oyunlar.json` listesine bir satır ekle. Sadece linkle paylaşılacak, ana sayfada görünmeyecek oyunlar için `"listed": false` yaz.

## Hesap sistemi

- Supabase projesi: `uzay-oyunlar` (Frankfurt, ref `cuihsjlhhbmwnzhldqvp`). Adres ve yayınlanabilir anahtar `hesap/hesap.js` içinde; bu anahtar tarayıcıya açık olabilir, güvenliği satır kuralları (RLS) sağlar.
- Herkes kendi hesabını açabilir: sadece kullanıcı adı + şifre, e-posta yok. Supabase e-posta istediği için kullanıcı adı arka planda `<ad>@oyuncu.bringthepoint.com` adresine çevrilir (`hesap.js` → `KULLANICI_ALANI`, `epostaya()`). Bu adrese hiç e-posta gitmez; bu alanı asla değiştirme, yoksa mevcut hesaplar açılmaz. Kullanıcı adı küçük harfe ve Türkçe karaktersiz hale çevrilir: "Uzay" ile "uzay" aynı hesaptır.
- Supabase ayarları: yeni kayıt açık, "Confirm email" kapalı. "Confirm email" açılırsa kayıt bozulur (onay e-postası gönderilemez).
- Giriş alanına gerçek bir e-posta da yazılabilir (içinde @ varsa olduğu gibi kullanılır). Yönetici hesabı umutguncan@gmail.com bu yolla açılır.
- Bir hesabın altında birden fazla oyuncu (`profiles`: ad, renk) olabilir. Hesap açılınca ilk oyuncu kullanıcı adıyla kendiliğinden oluşur. Tek oyunculu hesaplar oyuncu seçmeden doğrudan oyuna döner; "Değiştir" bağlantısı (`?degistir=1`) her zaman "Kim oynuyor?" ekranını açar.
- Şifre unutulursa e-postayla sıfırlanamaz. SQL ile sıfırlanır:
  `update auth.users set encrypted_password = extensions.crypt('yeni-sifre', extensions.gen_salt('bf')) where email = '<ad>@oyuncu.bringthepoint.com';`
- Tablolar: `profiles` (oyuncular), `saves` (oyuncu + oyun başına tek JSON kayıt), `plays` (oynama oturumları: başlangıç, süre, son görülme, kısa not), `admins` (herkesin oynama kaydını görebilen e-postalar; şu an umutguncan@gmail.com).
- Kurallar: giriş yapan herkes bütün oyuncuların adını/rengini ve oynama kayıtlarını görür ("Kim ne oynuyor?" herkese açık). Oyun kayıtları (`saves`) sadece sahibine açık. Herkes sadece kendi oyuncularını, kayıtlarını ve oynama kayıtlarını yazar. `admins` tablosu şu an bir şey açmıyor, ileride yönetici özellikleri için duruyor. Kural yardımcıları `private` şemasında.
- Oyunlardan kullanım (`hesap/hesap.js` başındaki açıklamaya bak):
  - `Hesap.hazir` giriş kapısı geçilince çözülür, `Hesap.profil` seçili oyuncu.
  - `Hesap.yukle()` / `Hesap.kaydet(veri)` bu oyunun kaydı. Kaydı seviye ya da ders sonu gibi anlarda yaz, her karede değil.
  - `Hesap.not('12. dalga')` takip sayfasında görünen kısa ilerleme notu.
- Kayıt eşitleme (`data-kayit`): oyunlar ilerlemeyi her zamanki gibi localStorage'a yazar; `hesap.js` bu anahtarları oyuncunun hesabındaki `saves` satırına (`data.keys`) taşır. Oyun açılırken karar verir, karar verene kadar sayfa gizli kalır:
  - Hesapta kayıt yok, cihazdaki kayıt bu oyuncunun ya da hesaplardan önceki eski kayıt → hesaba yüklenir (eski ilerleme ilk girişte aktarılır).
  - Cihazdaki kayıt başka bir oyuncunun → bu oyuncu sıfırdan başlar.
  - Hesaptaki kayıt farklı → hesaptaki cihaza yazılır ve sayfa bir kez yenilenir. Cihazda hesaba gitmemiş daha yeni değişiklik varsa cihazdaki kazanır.
  - Cihazdaki eşitleme durumu `hesap.senk.<oyun>` anahtarında. İnternet yoksa oyun cihazdaki kayıtla açılır, karar bir sonraki açılışta verilir.
  - Aynı oyunda hem `data-kayit` hem `Hesap.kaydet` kullanma: ikisi aynı satıra yazar.
- Oyun oyun ne kaydediliyor:
  - Fish: `fish.best` (en iyi boy), `fish.toplam` (şimdiye kadar yenen balıklar, tür tür). Not: boy, yenen balık, yakalayan tür.
  - Rüzgâr Kaptanı: biten dersler, son ders, parkur rekoru, yeke/dümen dolabı tercihi. Not: açık ders ve kaç ders bittiği, parkur süresi.
  - SONGbox: açılan karakterler, kendi karakterleri, verilen adlar, ödül almış şarkılar, kayıtlı şarkılar. Not: karakter sayısı, şarkı sayısı, son puan.
  - Sekme: `sekme.v1` (seviye başına yıldızlar, son seviye, ses). Seviyeler sırayla açılır: bir seviye en az bir yıldızla geçilince sonraki açılır. Not: açık seviye, geçilen seviye ve toplam yıldız.
    Buradaki, oyuncular için olan normal sürüm. Tüm seviyeleri açan geliştirici sürümü (Sekme Dev: `SEKME_DEV = true`, çözüm gösterme, Atölye seviye editörü) siteye konmaz.
  - Sur Muhafızı: `sur-muhafizi-best` (en iyi dalga), `sur-muhafizi-kayit` (tahta temizken alınan savaş görüntüsü: dalga başlarken ve dalga püskürtülünce). Açılışta kayıt varsa "Kaldığın yerden devam?" sorulur. Oyun bitince kayıt silinir. Not: dalga ve can.
- Bir oyun ayrıca (App Store ya da başka bir adres) yayınlanırsa aynı Supabase projesine bağlanır; hesaplar ve kayıtlar her yerde aynı kalır. O zaman `/hesap/...` yolları ve giriş sayfası o yayına göre ayarlanmalı.

## Alan adı bağlanınca

- Paylaşım görselleri (`og:image`) için göreli `cover.png` yerine tam adres yaz (örnek: `https://alanadi.com/fish/cover.png`). WhatsApp gibi uygulamalar tam adres ister.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olsun.
- Oyunlar ebeveyn ve çocuğun birlikte oynaması için. Serbest sohbet, kan ya da şiddet yok.
- Önce mobil: her sayfa telefonda düzgün açılmalı.
