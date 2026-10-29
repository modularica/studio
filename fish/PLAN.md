# Fish — Multiplayer planı (taslak)

> Durum: Tek kişilik sürüm çalışıyor ve `/fish` adresinde yayında (`fish/index.html`). Bu belge snake.io tarzı çok oyunculu sürüm için bir **taslak**. Kararlar Claude Code'da birlikte üzerinden geçilip netleşecek. Açık sorular en altta.

## Hedef

Tarayıcıdan (önce mobil) girilen, isim yazıp hemen oynanan bir io oyunu. Aynı gölde 30–40 oyuncu olacak. Oda koduyla özel göl de açılabilecek, böylece ebeveyn ve çocuk aynı gölde oynayabilecek.

## Mimari

- **Otoriter sunucu.** Kim kimi yedi, kim öldü, kim büyüdü kararını yalnızca sunucu verir. İstemci asla bu kararı vermez.
- **İstemci yalnızca girdi gönderir:** `{ seq, angle, throttle }`, saniyede yaklaşık 20 kez.
- **Sunucu simülasyonu:** 20 Hz tick. Her oyuncuya görüş alanı ve kenar payındaki varlıklar gönderilir (area of interest).
- **Kendi koi'n:** Anında hareket eder (client-side prediction). Sunucudan gelen durumla düzeltilir (reconciliation).
- **Diğer oyuncular ve balıklar:** Yaklaşık 100 ms geriden yumuşatılarak çizilir (interpolation).
- **Paylaşılan simülasyon:** Hareket, yeme kuralları ve türler `shared/` içinde saf TypeScript olarak durur. Aynı kod hem sunucuda hem istemcide çalışır.

## Teknoloji (önerilen)

| Katman | Seçim | Not |
|---|---|---|
| İstemci | Vite + TypeScript + Canvas 2D | Vercel'de barınır |
| Oyun sunucusu | Colyseus (Node.js) | Oda, eşleştirme ve durum senkronu hazır gelir. Fly.io ya da Hetzner, Frankfurt gibi Türkiye'ye yakın bir bölge |
| Paylaşılan kod | `shared/` TS paketi | Türler, kurallar, `step()` fonksiyonu |
| Kalıcı veri | Supabase | Skor tablosu, ileride hesaplar |
| Ölçüm | GA4 | Oturum süresi, tekrar gelme oranı |
| Alternatif sunucu | Cloudflare Durable Objects / PartyKit | Her oda ayrı birim; ölçeklemesi kolay ama oyuna özel hazır özellikleri daha az |

Vercel uzun süreli WebSocket bağlantısı tutmadığı için oyun sunucusu ayrı bir yerde çalışır.

## Hedef klasör yapısı

Fish, stüdyo reposunun (`modularica/studio`) içinde kendi klasöründe büyür.

```
fish/
  index.html   şu an yayındaki tek kişilik sürüm (multiplayer hazır olana kadar kalır)
  shared/      türler, kurallar, simülasyon (saf TS, DOM yok)
  client/      Vite + canvas çizim, girdi, ağ istemcisi; derlenmiş hali /fish adresinde yayınlanır
  server/      Colyseus odaları, NPC balık doğurma, botlar; ayrı bir sunucuda çalışır
```

## Prototipten gelen kurallar

- **Yeme:** Hedef boyu < 0.9 × senin boyun.
- **Tehlike:** Hedef boyu > 1.1 × senin boyun. Aradaki fark küçükse balıklar birbirini iter.
- **Büyüme:** `L_yeni = ∛(L³ + 1.3 · l³)`
- **Türler ve boyları (cm):** minnow 3–10, bleak 10–18, rudd 18–30, perch 30–45, carp 45–80, pike 80–130, wels catfish 130+.
- **Başlangıç:** 10 cm koi, 3 can.
- **Kamera:** Oyuncu büyüdükçe uzaklaşır. Koi'nin ekrandaki boyu büyümeyle `(L/10)^0.15` oranında artar.
- **Arayüz:** En altta besin zinciri şeridi var. Tehlikeli balıklar kırmızı kontur ve kırmızı gözle gösterilir. Ekran dışından kovalayan avcıyı kenardaki ok gösterir.

## Multiplayer'da değişenler

- Sonsuz havuz yerine sınırlı, büyük bir göl olur. Her odada 30–40 oyuncu yer alır.
- Herkes bir koi'dir; isim ve desen seçer (kohaku, showa, ogon…).
- Oyuncular birbirini yiyebilir. Ölen koi küçük balıklara dağılır ve yem olur.
- Sunucu, belli bir yoğunlukta yapay zekâlı balık doğurur, böylece yeni gelenin yiyecek bir şeyi olur.
- Oyuncu azken odayı botlar doldurur.
- Yeni doğan oyuncu 2–3 saniye korunur.
- Odada ilk 10 listesi gösterilir.
- Oda koduyla özel göl açılabilir.
- **Güvenlik:** Serbest sohbet yok. İsimler filtrelenir. İletişim yalnızca hazır tepkilerle olur.

## Yol haritası

### Aşama 1 — Ayır
- [ ] Tek kişilik sürümü Vite + TS projesine taşı (`client/`).
- [ ] Simülasyonu `shared/` içine çıkar: `step(state, inputs, dt)`. `Math.random` yerine seed'li RNG kullan.
- [ ] Çizim katmanı sadece state'i okusun.
- [ ] Tek kişilik oyun yeni yapıda prototiple aynı hissettirsin.

### Aşama 2 — İki kişilik prototip
- [ ] Tek odalı bir Colyseus sunucusu kur.
- [ ] Girdi gönderimini ve state senkronunu bağla.
- [ ] Prediction ve interpolation'ı ekle.
- [ ] İki telefonla yerel ağda dene. 100–200 ms yapay gecikmeyle de test et.

### Aşama 3 — Tam oda
- [ ] Sınırlı göl ve oda kapasitesi.
- [ ] Sunucuda NPC balık doğurma; ölen oyuncunun yeme dönüşmesi.
- [ ] İsim, koi deseni, ilk 10 listesi.
- [ ] Botlar ve doğma koruması.
- [ ] Oda koduyla özel göl.

### Aşama 4 — Yayına al
- [ ] İstemci derlemesini `/fish` adresine bağla (stüdyo sitesiyle aynı Vercel projesi), sunucuyu Fly.io ya da Hetzner'e koy.
- [ ] GA4 ölçümünü ekle.
- [ ] Arkadaş grubunun çocuklarıyla kapalı test yap.

### Aşama 5 — Dağıt
- [ ] itch.io, CrazyGames gibi web oyun portallarına koy.

## Açık sorular

1. **Canlar:** io oyunlarında genelde tek can ve anında yeniden doğma olur. Prototipteki 3 can kalsın mı?
2. **Sıra:** Önce herkese açık göl mü, önce özel oda (aile/arkadaş) mı?
3. **İsim:** Oyunun adı "Fish" olarak mı kalacak?
4. **Giriş:** Hesap gerekli mi, yoksa sadece isim yeterli mi?
5. **Dağıtım:** Kendi domain dışında hangi portallar?
