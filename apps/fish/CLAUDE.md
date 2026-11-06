# Fish — iOS uygulaması (App Store adı: Little Koi)

Fish'in App Store sürümü. Capacitor 8 ile `lab/fish/index.html` bir iOS uygulamasına sarılır. Oyunun kendisi burada değil, `lab/fish/` klasöründe; oyunu orada düzelt, uygulama oradan alır.

## Bu klasörde

- `build.mjs`: `lab/fish/index.html`'den `www/` klasörünü üretir (`www/` repoya girmez):
  - `/hesap/...` betiklerini çıkarır. Uygulamada Lab hesap sistemi yok; oyun `window.Hesap` yoksa leaderboard ve odaları kendisi gizler. Kalan tek kişilik oyun internetsiz çalışır.
  - Google Fonts yerine fontları (`@fontsource`, sadece latin + latin-ext woff2) `www/fonts/` içine koyar.
  - "Nasıldı?" düğmelerini gizler (Lab hesap sistemine yazar).
  - Başlığı ve sayfa adını "Little Koi" yapar (iki satırlık başlık). Lab'da oyunun adı hâlâ Fish.
  - Oyundan önce `capacitor.js` (Capacitor çekirdeği, paketleyicisiz) ve `uygulama.js`'i yükler.
  - Her değişiklik `lab/fish/index.html`'de tam bir kez eşleşmeli; eşleşmezse derleme durur. Oyunun `<head>` kısmını değiştirirsen burayı da güncelle.
- `uygulama.js`: oyunla iOS arasındaki yapıştırıcı, sadece uygulamada yüklenir. `window.uygulama.titret(tur, guc)`: titreşim (`@capacitor/haptics`). Oyun bunu ses efektlerinden çağırır: `yut` (hafif; yenen balık büyükse orta, 45 ms'den sık değil), `isir` (ağır), `olum` (hata), `seviye` (başarı), `inci` (hafif). iPad'lerde titreşim motoru yok, orada hiçbir şey olmaz; sadece iPhone'da hissedilir.
- Her yüklemede build numarası artmalı: `project.pbxproj` → `CURRENT_PROJECT_VERSION` (1.0 için 2. build yüklendi). Sürüm `MARKETING_VERSION`.
- `capacitor.config.json`: uygulama kimliği `com.uzigames.fish` (App Store Connect'te bir kez kaydedilince değişmez), görünen ad, su rengi arka plan.
- `ios/`: Xcode projesi (Swift Package Manager; CocoaPods yok).
  - `Info.plist`: durum çubuğu gizli, `ITSAppUsesNonExemptEncryption = false` (sadece HTTPS kullanıyoruz; yükleme sırasında şifreleme sorusu çıkmaz).
  - İkon (`Assets.xcassets/AppIcon.appiconset`, 1024×1024, alfa kanalı yok) ve açılış ekranı (`Splash.imageset`, su rengi üstünde "Uzi Games") geçici. İkondaki koi oyunun kendi çizim koduyla çizildi. Oyunun mağaza adı belli olunca yenilenecek.
  - `ios/App/App/public` ve `capacitor.config.json` kopyası `cap sync` ile üretilir, repoya girmez.

## Mac'te çalıştırmak

```
cd apps/fish
npm install
npm run ios        # www/ üretir, ios/ ile eşitler, Xcode'u açar
```

Xcode'da: App hedefi → Signing & Capabilities → Team seç → üstte cihaz/simülatör seç → ▶︎.
Oyunda değişiklik yaptıktan sonra `npm run sync` ve Xcode'da yeniden ▶︎.

## Yayın

- `.vercelignore` içindeki `/apps/` bu klasörün siteye çıkmasını engeller.
- Repo herkese açık: App Store Connect API anahtarları, sertifikalar ve imzalama dosyaları asla repoya girmez.
