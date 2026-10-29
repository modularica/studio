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
   <script src="/hesap/hesap.js" data-oyun="<slug>"></script>
   ```
6. `oyunlar.json` listesine bir satır ekle. Sadece linkle paylaşılacak, ana sayfada görünmeyecek oyunlar için `"listed": false` yaz.

## Hesap sistemi

- Supabase projesi: `uzay-oyunlar` (Frankfurt, ref `cuihsjlhhbmwnzhldqvp`). Adres ve yayınlanabilir anahtar `hesap/hesap.js` içinde; bu anahtar tarayıcıya açık olabilir, güvenliği satır kuralları (RLS) sağlar.
- Hesaplar velilere ait (e-posta + şifre). Çocukların e-postası yok; her hesabın altında oyuncular (`profiles`: ad, renk) var. Cihaz bir kere giriş yapar, oyuncu "Kim oynuyor?" ekranından seçilir ve tarayıcıda hatırlanır.
- Tablolar: `profiles` (oyuncular), `saves` (oyuncu + oyun başına tek JSON kayıt), `plays` (oynama oturumları: başlangıç, süre, son görülme, kısa not), `admins` (tüm ailelerin oynama kaydını görebilen e-postalar; şu an umutguncan@gmail.com).
- Kurallar: her aile sadece kendi oyuncularını, kayıtlarını ve oynama geçmişini görür ve yazar. `admins` listesindekiler bütün ailelerin oyuncularını ve oynama kayıtlarını okuyabilir (kayıtları değil). Kural yardımcıları `private` şemasında.
- Yeni kayıt kapalı tutulur. Yeni aile: Supabase panelinde Authentication → Users → Add user → Create new user (e-posta + şifre, otomatik onaylı). Şifreyi veliye ilet; veli giriş sayfasından değiştirebilir.
- Oyunlardan kullanım (`hesap/hesap.js` başındaki açıklamaya bak):
  - `Hesap.hazir` giriş kapısı geçilince çözülür, `Hesap.profil` seçili oyuncu.
  - `Hesap.yukle()` / `Hesap.kaydet(veri)` bu oyunun kaydı. Kaydı seviye ya da ders sonu gibi anlarda yaz, her karede değil.
  - `Hesap.not('12. dalga')` takip sayfasında görünen kısa ilerleme notu.
- Oyunların şu anki ilerlemesi hâlâ tarayıcıda (localStorage). Sıradaki iş: oyun oyun `Hesap.kaydet`/`Hesap.yukle` ve `Hesap.not` ile hesaba taşımak.
- Bir oyun ayrıca (App Store ya da başka bir adres) yayınlanırsa aynı Supabase projesine bağlanır; hesaplar ve kayıtlar her yerde aynı kalır. O zaman `/hesap/...` yolları ve giriş sayfası o yayına göre ayarlanmalı.

## Alan adı bağlanınca

- Paylaşım görselleri (`og:image`) için göreli `cover.png` yerine tam adres yaz (örnek: `https://alanadi.com/fish/cover.png`). WhatsApp gibi uygulamalar tam adres ister.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olsun.
- Oyunlar ebeveyn ve çocuğun birlikte oynaması için. Serbest sohbet, kan ya da şiddet yok.
- Önce mobil: her sayfa telefonda düzgün açılmalı.
