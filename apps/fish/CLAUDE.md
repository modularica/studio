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
- Game Center (uygulamada Lab hesapları yerine leaderboard): `ios/App/App/GameCenterPlugin.swift` (kendi küçük eklentimiz: `signIn`, `submitScore`, `showLeaderboard`), `MainViewController.swift` (eklentiyi kaydeder; `SceneDelegate.swift` pencereyi bununla açar. Storyboard sahnede kullanılmıyor, oraya yazmak yetmez), `App.entitlements` (`com.apple.developer.game-center`). `uygulama.js` açılışta oturum açar, cihazdaki `fish.best`'i yollar, `uygulama.gameCenter = true` yapıp `gamecenter` olayını atar; Leaderboard düğmeleri (başlangıç ekranı `lbBtn`, oyun sonu `gcBtn`) uygulamada hep görünür; giriş yoksa `uygulama.liderlik()` bir kez daha giriş dener, olmazsa düğme "Sign in to Game Center in Settings" yazar. `[gamecenter]` ile başlayan console satırları Xcode konsolunda görünür. Her tur sonunda `uygulama.skor(cm)`. Leaderboard kimliği `com.uzigames.fish.biggest` (App Store Connect → Game Center; skor milimetre, ekranda 1 ondalıklı cm).
- Puan isteme: `ios/App/App/ReviewPlugin.swift` (Apple'ın kendi "Enjoying Little Koi?" penceresi; çıkıp çıkmayacağına iOS karar verir, yılda en çok 3 kez). `uygulama.js` → `puanIste()`: 5. turdan sonra, yeni en iyi boyla biten bir turun oyun sonu ekranında, bizim tarafımızdan en sık 60 günde bir (`koi.turlar`, `koi.puanSorusu`). Oyun sırasında asla sorma; Apple kendi penceresi dışında puan karşılığı ödül vermeyi yasaklıyor.
- iCloud kaydı: `ios/App/App/CloudSavePlugin.swift` (`get` → `{cloud, device}`, `set({data})`, başka cihaz kaydedince `change` olayı) + `App.entitlements` (`com.apple.developer.ubiquity-kvstore-identifier`). `uygulama.js` → kayit bölümü: `fish.best`, `fish.toplam`, `fish.desen`, `fish.desenler`, `fish.inci` iCloud anahtar-değer deposuna (aynı Apple hesabındaki iPhone ve iPad paylaşır, uygulama silinse de geri gelir) ve UserDefaults'a (iOS web deposunu temizlerse) kopyalanır; tek JSON, anahtar `koi.kayit`. Açılışta sayfa gizli kalır, kopyalar birleştirilir (en iyi boy ve yenen balıklar en büyüğü, alınan desenler birleşimi, inci ve giyilen desen yeni olan kayıttan; zaman `koi.kayitT`), cihazdaki değişirse localStorage'a yazılıp sayfa bir kez yenilenir (`sessionStorage koi.yenilendi`). Sonra 10 sn'de bir, tur sonunda ve uygulama arka plana geçince yazar. Su seçimi (`fish.harita`) ve ses cihazda kalır. `[kayit]` satırları Xcode konsolunda.
- Açılış: `uygulama.js` → acilis bölümü. Her açılışta beyaz zeminde Uzi Games logosu (El ele, siyah; tasarım "Uzi Games logo" tuvalinde) ~2,5 sn oynar, dokununca geçer. Açılış ekranı (`LaunchScreen.storyboard`, `Splash.imageset`) ve web görünümünün arka planı (`capacitor.config.json`) bu yüzden beyaz.
- Her yüklemede build numarası artmalı: `project.pbxproj` → `CURRENT_PROJECT_VERSION` (1.0 = build 6 yayında; 1.0.1 = build 8: puan isteme, iCloud kaydı, açılış logosu; build 7 incelemeden geri çekildi). Xcode yüklerken numara çakışırsa kendisi artırır; o zaman Mac'teki arşiv eski numarayı gösterir. Sürüm `MARKETING_VERSION`.
- `capacitor.config.json`: uygulama kimliği `com.uzigames.fish` (App Store Connect'te bir kez kaydedilince değişmez), görünen ad, beyaz arka plan (açılış logosu beyaz zeminde).
- `ios/`: Xcode projesi (Swift Package Manager; CocoaPods yok).
  - `Info.plist`: durum çubuğu gizli, `ITSAppUsesNonExemptEncryption = false` (sadece HTTPS kullanıyoruz; yükleme sırasında şifreleme sorusu çıkmaz).
  - İkon (`Assets.xcassets/AppIcon.appiconset`, 1024×1024, alfa kanalı yok; koi oyunun kendi çizim koduyla çizildi). Açılış ekranı (`Splash.imageset`) düz beyaz.
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
