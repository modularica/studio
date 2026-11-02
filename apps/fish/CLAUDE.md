# Fish — iOS uygulaması

Fish'in App Store sürümü. Capacitor 8 ile `lab/fish/index.html` bir iOS uygulamasına sarılır. Oyunun kendisi burada değil, `lab/fish/` klasöründe; oyunu orada düzelt, uygulama oradan alır.

## Bu klasörde

- `build.mjs`: `lab/fish/index.html`'den `www/` klasörünü üretir (`www/` repoya girmez):
  - `/hesap/...` betiklerini çıkarır. Uygulamada Lab hesap sistemi yok; oyun `window.Hesap` yoksa leaderboard ve odaları kendisi gizler. Kalan tek kişilik oyun internetsiz çalışır.
  - Google Fonts yerine fontları (`@fontsource`, sadece latin + latin-ext woff2) `www/fonts/` içine koyar.
  - "Nasıldı?" düğmelerini gizler (Lab hesap sistemine yazar).
  - Her değişiklik `lab/fish/index.html`'de tam bir kez eşleşmeli; eşleşmezse derleme durur. Oyunun `<head>` kısmını değiştirirsen burayı da güncelle.
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
