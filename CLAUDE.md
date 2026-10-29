# Stüdyo — oyunlar ve stüdyo sitesi

Umut ile oğlunun birlikte yaptığı oyunların yayınlandığı tek repo. Ana sayfa stüdyoyu tanıtır ve oyunları listeler. Her oyun kendi klasöründe, kendi adresinde açılır. Stüdyo adı henüz belli değil; repo şimdilik `studio`.

## Yapı

```
index.html     stüdyo ana sayfası; oyun listesi bu dosyanın içindeki <script id="games"> bloğunda
vercel.json    Vercel ayarı (adresler / ile biter: /fish/)
fish/          Fish: koi oyunu. Multiplayer planı fish/PLAN.md
yelken/        Rüzgâr Kaptanı: adım adım yelken okulu
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
5. Ana sayfadaki `<script id="games">` listesine bir satır ekle. Sadece linkle paylaşılacak, ana sayfada görünmeyecek oyunlar için `"listed": false` yaz.

## Alan adı bağlanınca

- Paylaşım görselleri (`og:image`) için göreli `cover.png` yerine tam adres yaz (örnek: `https://alanadi.com/fish/cover.png`). WhatsApp gibi uygulamalar tam adres ister.
- Ana sayfadaki geçici stüdyo adını (sol üstteki `studio` yazısı ve sayfa başlığı `Oyunlarımız`) gerçek adla değiştir.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olsun.
- Oyunlar ebeveyn ve çocuğun birlikte oynaması için. Serbest sohbet, kan ya da şiddet yok.
- Önce mobil: her sayfa telefonda düzgün açılmalı.
