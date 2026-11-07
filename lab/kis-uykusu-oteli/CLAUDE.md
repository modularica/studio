# Kış Uykusu Oteli

Tycoon tarzı otel oyunu. Bir yıl dört mevsim: sonbaharda misafirler sıraya girer ve sürüklenip odalarına bırakılır, kışın uyurlar (battaniye düşer, ayı/porsuk horlar, ağaçkakan sütunundaki odaları uyandırır, soba söner ya da fazla ısınır), baharda iyi uyuyan fındıkla öder ve kalp bırakır, yazın oteli büyütürsün.

Kışı eğlenceli tutan şeyler (`sim.js` → `updateFun`, ayarlar `TUNE`'da): gökten yaprağa binmiş fındıklar düşer, dokunup yakalanır (bazen altın fındık). Misafirler rüya görür (rüya bulutunda yiyecekleri: fındık faresi fındık, kirpi böcek, kurbağa sinek, ayı bal ya da balık, porsuk solucan, yarasa güve); alttaki kilerden doğru yiyecek sürüklenince uyku artar ve bahşiş gelir. Kimsenin bir sorunu yokken (ve her düzeltmede, hızlı düzeltmede daha çok) üstteki kuzey ışıkları çubuğu dolar; dolunca birkaç saniye yeni sorun çıkmaz, herkes derinleşir ve gökten fındık yağar. Yakalanan fındık ve rüya bahşişi baharda kasaya girer. Tasarım notları ve denge tablosu claude.ai'daki uzigames projesinde (`kis-uykusu-oteli.md`).

## Dosyalar

- `index.html` siteye çıkan tek dosya: kod, fontlar (Fredoka, Nunito) ve hesap satırları içinde. **Elle düzenleme**, kaynağı değiştirip yeniden derle.
- `src/` kaynak (siteye çıkmaz, `.vercelignore`):
  - `data.js` misafirler, odalar, yardımcılar, geliştirmeler, ekonomi ve `TUNE` ayarları
  - `sim.js` oyunun kuralları, DOM yok (`Game`, `newSave`, `cleanSave`)
  - `draw.js` bütün çizimler (canvas), yerleşim (`computeLayout`)
  - `audio.js` WebAudio sesleri ve ninni (yer tutucu)
  - `app.js` ekranlar, dokunma, HUD, sayfalar, ipuçları, Lab bağlantıları (`lab.note`, `lab.ask`)
  - `index.html` sayfa iskeleti ve CSS
  - `fonts/` gömülen woff2 dosyaları (OFL)
- Derleme: `python3 lab/kis-uykusu-oteli/src/build.py --lab` → `index.html`. Hesap satırları olmayan tek başına kopya için çıktı yolu ver: `python3 lab/kis-uykusu-oteli/src/build.py /tmp/otel.html`.
- Denge testi: `cd lab/kis-uykusu-oteli/src && node test/run-sim.js 14` (botlar 14 yıl oynar; yavaş çocuk, ortalama, hızlı ve yardımcısız oyuncu).

## Notlar

- Kayıt `otel.save` (hesaba eşitlenir), ses `otel.sound` (cihazda). Kayıt bahar başında ve yazın her alışverişte yazılır; yıl ortasında çıkılırsa o yıl baştan başlar. Kayıt bozuksa `cleanSave` yeni otel açar.
- Lab'da (`window.Hesap` varsa) yıl başı ve yıl sonu notu yazılır, mola ve bahar özetinde "Nasıldı?" düğmesi çıkar. Hesap yoksa bunlar görünmez.
- Arayüz Türkçe, kod İngilizce. App Store'a gidecekse metinler çevrilmeli.
- Deneme: `localStorage.setItem('otel.debug', 'true')` sayfanın içini `window.__otel` olarak açar.
