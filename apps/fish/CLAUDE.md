# Fish — iOS uygulaması (App Store adı: Little Koi)

Little Koi'nin App Store sürümü. Capacitor 8 ile `lab/little-koi-v2/index.html` bir iOS uygulamasına sarılır (1.1'den beri; 1.0 ve 1.0.1 `lab/fish/`'ten, `fish-app` dalından çıktı). Oyunun kendisi burada değil, `lab/little-koi-v2/` klasöründe; oyunu orada (`main`'de) düzelt, sonra bu dala `git checkout main -- lab/little-koi-v2` ile al.

**Dal:** `little-koi-app` (`main`'den açıldı, `apps/fish` `fish-app`'ten geldi; 16 Kasım 2026). Mac'te: `git fetch && git checkout little-koi-app`. `main`'de `apps/fish` yok, sadece üretilen dosyalar `.gitignore`'da.

## Bu klasörde

- `build.mjs`: `lab/little-koi-v2/index.html`'den `www/` klasörünü üretir (`www/` repoya girmez):
  - `/hesap/...` betiklerini çıkarır. Uygulamada Lab hesap sistemi yok; oyun `window.Hesap` yoksa leaderboard ve odaları kendisi gizler. Kalan tek kişilik oyun internetsiz çalışır.
  - Google Fonts yerine fontları (`@fontsource`, sadece latin + latin-ext woff2) `www/fonts/` içine koyar.
  - "Nasıldı?" düğmelerini gizler (Lab hesap sistemine yazar).
  - Sayfa adını "Little Koi" yapar ve başlıktaki Lab'ın "v2" etiketini kaldırır (iki satırlık başlık oyunda zaten var).
  - Oyundan önce `capacitor.js` (Capacitor çekirdeği, paketleyicisiz) ve `uygulama.js`'i yükler.
  - Her değişiklik `lab/little-koi-v2/index.html`'de tam bir kez eşleşmeli; eşleşmezse derleme durur. Oyunun `<head>` kısmını ya da başlığını değiştirirsen burayı da güncelle.
  - Oyun uygulamada (`window.uygulama` varken) N tuşuyla test turu açmaz (iPad klavyesi).
- `uygulama.js`: oyunla iOS arasındaki yapıştırıcı, sadece uygulamada yüklenir. `window.uygulama.titret(tur, guc)`: titreşim (`@capacitor/haptics`). Oyun bunu ses efektlerinden çağırır: `yut` (hafif; yenen balık büyükse orta, 45 ms'den sık değil), `isir` (ağır), `olum` (hata), `seviye` (başarı), `inci` (hafif). iPad'lerde titreşim motoru yok, orada hiçbir şey olmaz; sadece iPhone'da hissedilir.
- Game Center (uygulamada Lab hesapları yerine leaderboard): `ios/App/App/GameCenterPlugin.swift` (kendi küçük eklentimiz: `signIn`, `submitScore`, `showLeaderboard`), `MainViewController.swift` (eklentiyi kaydeder; `SceneDelegate.swift` pencereyi bununla açar. Storyboard sahnede kullanılmıyor, oraya yazmak yetmez), `App.entitlements` (`com.apple.developer.game-center`). `uygulama.js` açılışta oturum açar ve `uygulama.gameCenter = true` yapar (1.1'den beri açılışta skor yollamaz: 1.0.1 cihazdaki en iyi boyu her açılışta yeniden yolluyordu, Game Center challenge'ında bu bir hak yerdi); Leaderboard düğmeleri (başlangıç ekranı `lbBtn`, oyun sonu `gcBtn`) uygulamada hep görünür; giriş yoksa `uygulama.liderlik()` bir kez daha giriş dener, olmazsa düğme "Sign in to Game Center in Settings" yazar. `[gamecenter]` ile başlayan console satırları Xcode konsolunda görünür. Her tur sonunda `uygulama.skor(cm)` iki tabloya ayrı ayrı yollar (biri yoksa öbürü yine gider): `com.uzigames.littlekoi.biggest` (tüm zamanlar) ve `com.uzigames.littlekoi.weekly` (haftalık, recurring, cuma başlar). Skor turun en büyük boyu, tam santimetre; Game Center metre gösterir (Fixed Point, 2 ondalık, sonek " m": 327 → 3.27 m), oyundaki gibi. 1.0.1'in tablosu milimetre yollayıp cm gösteriyordu (85,171.6 cm okunmuyordu). Leaderboard düğmesi kimlik vermeden açar: Game Center oyunun bütün tablolarını listeler. 1.0 ve 1.0.1'in tablosu `com.uzigames.fish.biggest`; 1.1 yayına çıkınca arşivlenir (silinemez).
- Puan isteme: `ios/App/App/ReviewPlugin.swift` (Apple'ın kendi "Enjoying Little Koi?" penceresi; çıkıp çıkmayacağına iOS karar verir, yılda en çok 3 kez). `uygulama.js` → `puanIste()`: 5. turdan sonra, yeni en iyi boyla biten bir turun oyun sonu ekranında, bizim tarafımızdan en sık 60 günde bir (`koi.turlar`, `koi.puanSorusu`). Oyun sırasında asla sorma; Apple kendi penceresi dışında puan karşılığı ödül vermeyi yasaklıyor.
- iCloud kaydı: `ios/App/App/CloudSavePlugin.swift` (`get` → `{cloud, device}`, `set({data})`, başka cihaz kaydedince `change` olayı) + `App.entitlements` (`com.apple.developer.ubiquity-kvstore-identifier`). `uygulama.js` → kayit bölümü: oyunun `koi2.*` anahtarları (`koi2.best koi2.toplam koi2.desen koi2.desenler koi2.inci koi2.sular koi2.bicimler koi2.ejder koi2.dukkan`) iCloud anahtar-değer deposuna (aynı Apple hesabındaki iPhone ve iPad paylaşır, uygulama silinse de geri gelir) ve UserDefaults'a (iOS web deposunu temizlerse) kopyalanır; tek JSON, anahtar `koi2.kayit`. Açılışta sayfa gizli kalır, kopyalar birleştirilir (rekor, en büyük ejder ve tür tür yenen balıklar en büyüğü; desenler, ulaşılan sular ve koi biçimleri birleşimi; inci, giyilen desen ve `koi2.dukkan` yeni olan kayıttan; zaman `koi2.kayitT`), cihazdaki değişirse localStorage'a yazılıp sayfa bir kez yenilenir (`sessionStorage koi2.yenilendi`). Sonra 10 sn'de bir, tur sonunda ve uygulama arka plana geçince yazar. Hikâye bildirimi (`koi2.hikaye`) ve ses cihazda kalır.
  - 1.1 herkesi sıfırdan başlatır (Umut, 16 Kasım 2026: 1.0.1'i sadece tanıdıklar oynadı; desen, inci, rekor taşınmaz). 1.0.1'in kaydı `koi.kayit` anahtarında ve cihazda `fish.*` olarak durur ama okunmaz; ayrı anahtar sayesinde hâlâ 1.0.1'de kalan bir cihaz 1.1'in kaydının üstüne yazamaz. `[kayit]` satırları Xcode konsolunda.
- Açılış: `uygulama.js` → acilis bölümü. Her açılışta beyaz zeminde Uzi Games logosu (El ele, siyah; tasarım "Uzi Games logo" tuvalinde) ~2 sn oynar (U tek çizgide çizilir, ucu Uzay’ın kafasına çarpıp onu zıplatır), dokununca geçer. Açılış ekranı (`LaunchScreen.storyboard`, `Splash.imageset`) ve web görünümünün arka planı (`capacitor.config.json`) bu yüzden beyaz.
- Her yüklemede build numarası artmalı: `project.pbxproj` → `CURRENT_PROJECT_VERSION` (1.0 = build 6; 1.0.1 = build 9: puan isteme, iCloud kaydı, açılış logosu; build 7 incelemeden geri çekildi, 8 eski animasyonlu; 1.1 = build 10: Little Koi v2, yeni tablolar, sıfırdan kayıt; build 11: TestFlight'taki ilk notlar, oyunda düzeltildi ve main'den alındı: sade menü, ekrandan taşan bildirim, yerinde duran joystick, "Now you can eat" bildirimi yok, My koi'de soldan kaydırınca geri). Xcode yüklerken numara çakışırsa kendisi artırır; o zaman Mac'teki arşiv eski numarayı gösterir. Sürüm `MARKETING_VERSION`.
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

## 1.1'in Game Center tabloları (App Store Connect → Game Center → Leaderboards)

- Tüm zamanlar: Classic. Reference name "Biggest Koi v2", ID `com.uzigames.littlekoi.biggest`.
- Haftalık: Recurring. Reference name "Biggest Koi This Week", ID `com.uzigames.littlekoi.weekly`. Süre 7 gün, her 7 günde yeniden; ilk tur 20 Kasım 2026 Cuma 00:00 Türkiye saati (Perşembe 21:00 UTC), yani her hafta Cuma gece yarısı sıfırlanır (Umut: aileler çoğunlukla hafta sonu oynuyor, hafta sonu boş tabloyla başlasın). Başlangıçtan önce haftalık tablo skor almaz; TestFlight'ta o zamana kadar boş kalması normal.
- Score Format, Range, Submission Type, Sort: Fixed Point 2 ondalık; aralık boş (ejder sınırsız büyüyor, üst sınır gerçek bir rekoru silebilirdi); Best Score (haftalıkta o haftanın en iyisi); High to Low.
- İkisinde de: Score Format Fixed Point, 2 ondalık (uygulama santimetre yollar, tablo metre gösterir: 327 → 3.27 m); Score Range boş; Sort Order High to Low; Score Submission Type Best Score; English localization: display name "Biggest Koi" / "Biggest Koi This Week", Score Format Suffix " m" (başında boşluk; tekil ve çoğul aynı).
- Resimler (English localization → Image): `gamecenter/biggest-koi.png` (tüm zamanlar: okyanusta ejder) ve `gamecenter/biggest-koi-this-week.png` (haftalık: gölette Kohaku); ikisi aynı duruşta, koi ejder oluyor. Oyunun kendi çiziminden (HUD gizli), 1024×1024 RGB PNG; balık ortadaki 1024×640 bantta, kırpılsa da görünür.
- Tablolar 1.1'in Draft Submission'ına eklenir (ilk tablo gibi). Eski `com.uzigames.fish.biggest` 1.1 yayına çıkınca arşivlenir.

## TestFlight

1. Tabloları yukarıdaki gibi aç. Henüz yayında olmayan tablolar TestFlight'ta çalışıyor (Apple forumlarındaki geliştiricilere göre); yeni tablo build'e bağlanana kadar "leaderboardID not found" verebilir, o zaman 1.1 taslağına ekle.
2. Mac: `git checkout -- ios/App/App.xcodeproj/project.pbxproj` (önceki derlemeden kalan değişiklik), `git fetch && git checkout little-koi-app && git pull`, `npm install`, `npm run ios`.
3. Xcode: Version 1.1, Build 10 → Product → Archive → Distribute App → App Store Connect → Upload.
4. App Store Connect → TestFlight: build işlenince Internal Testing'e kendini ekle (inceleme yok); iPhone'da TestFlight uygulamasından kur. App Store'daki 1.0.1'in üstüne kurulur.
5. Arkadaşlar için External Testing: ilk build Apple'ın beta incelemesinden geçer, sonra herkese açık bir bağlantı verilir.
6. Bakılacaklar: sıfırdan başlıyor mu (rekor, inci, desen), iPhone ile iPad arasında iCloud, iki tabloya skor gidiyor mu, Leaderboard düğmesi tablo listesini açıyor mu, uçak modu, eski bir cihazda akıcılık.

## Yayın

- `.vercelignore` içindeki `/apps/` bu klasörün siteye çıkmasını engeller.
- Repo herkese açık: App Store Connect API anahtarları, sertifikalar ve imzalama dosyaları asla repoya girmez.
