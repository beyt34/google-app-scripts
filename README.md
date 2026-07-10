# myPortfoy - Google Sheets Apps Script

Google E-Tablolar'da portföy takibi için özel fonksiyonlar. Kripto, BIST hisseleri ve BYF fiyat/değişim verilerini çeşitli API'lerden çeker.

## Kurulum

1. Google Sheets'te **Uzantılar → Apps Komut Dosyası** açın
2. `myPortfoyApp.gs` içeriğini yapıştırın
3. Kaydedin

> **Not:** Türkçe locale'de formül parametreleri `;` ile ayrılır (ör: `=BYF_CHANGE_PERIOD("GLDTR.F"; 7)`)

---

## Otomatik Yenileme (Refresh)

Google Sheets custom function'ları sayfa açılışında bazen `0` döner (eşzamanlı API kota aşımı). Bu sorunu çözmek için refresh mekanizması eklenmiştir.

**Nasıl çalışır:**

1. `onOpen()` trigger'ı sayfa açılışında **Summary** sayfasının **O1** hücresine timestamp yazar
2. Menüden **Portföy → Verileri Yenile** ile elle tetiklenebilir
3. Formüller `Summary!$O$1` referansını dummy parametre olarak alır → O1 değişince yeniden hesaplanır

**Formül formatı:**

```
=BIST_PRICE("ALTIN.S1"; Summary!$O$1)
=BIST_CHANGE("DMLKT"; Summary!$O$1)
=getBtcturkPrice("BTCUSDT"; Summary!$O$1)
=TEFAS_FON_PRICE("GTL"; Summary!$O$1)
=BYF_CHANGE_PERIOD("GLDTR.F"; 7; Summary!$O$1)
```

> **Not:** Custom function'lar ekstra parametreyi yoksayar — sadece Sheets'in recalculate mekanizmasını tetikler.

---

## Fonksiyonlar

### Kripto - BtcTurk

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `getBtcturkPrice(symbol)` | Son işlem fiyatı | [BtcTurk API](https://api.btcturk.com) |
| `getBtcturkPriceChange(symbol)` | 24 saatlik değişim oranı | BtcTurk API |

**Desteklenen semboller:** `USDTTRY`, `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `AVAXUSDT`, `XRPUSDT`

**Kullanım:**

```
=getBtcturkPrice("BTCUSDT"; Summary!$O$1)        → 95000
=getBtcturkPriceChange("BTCUSDT"; Summary!$O$1)  → 0.023 (%2,3)
```

**Dönüş:** `getBtcturkPriceChange` değeri 100'e bölünmüş gelir, hücre formatı `%` ise doğrudan görünür.

---

### Kripto - CoinTR

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `getCoinTrPrice(symbol)` | Son işlem fiyatı | [CoinTR API](https://api.cointr.com) |
| `getCoinTrPriceChange(symbol)` | 24 saatlik değişim oranı | CoinTR API |

**Desteklenen semboller:** `BNBUSDT` (ve CoinTR'de listelenen diğerleri)

**Kullanım:**

```
=getCoinTrPrice("BNBUSDT"; Summary!$O$1)
=getCoinTrPriceChange("BNBUSDT"; Summary!$O$1)
```

---

### BIST BYF - Fiyat & Günlük Değişim (Yahoo Finance)

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `BYF_PRICE(symbol)` | Son işlem fiyatı (TRY) | [Yahoo Finance](https://query1.finance.yahoo.com) |
| `BYF_CHANGE(symbol)` | Günlük değişim oranı | Yahoo Finance |

**Desteklenen semboller:** `GLDTR.F`, `ZGOLD.F`, `GMSTR.F` (ve `.F` uzantılı tüm BIST BYF'ler)

**Sembol dönüşümü:** `.F` → `.IS` (Yahoo Finance BIST formatı)

**Kullanım:**

```
=BYF_PRICE("GLDTR.F"; Summary!$O$1)    → 557
=BYF_CHANGE("GLDTR.F"; Summary!$O$1)   → 0.0036 (%0,36)
```

**Yardımcı fonksiyon:** `_fetchYahooChart(symbol)` — Yahoo Finance chart API'sinden `meta` nesnesini döner (`regularMarketPrice`, `chartPreviousClose` vb.)

---

### BIST - Fiyat & Günlük Değişim (TradingView)

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `BIST_PRICE(symbol)` | Son işlem fiyatı (TRY) | [TradingView Scanner](https://scanner.tradingview.com) |
| `BIST_CHANGE(symbol)` | Günlük değişim oranı | TradingView Scanner |

**Desteklenen semboller:** Tüm BIST sembolleri — `ALTIN.S1`, `GARAN`, `THYAO`, `ASELS`, `DMLKT` vb.

> **Not:** `DMLKT` (Damla Kent Projesi Gayrimenkul Sertifikası) gibi GYO/sertifika enstrümanları da TradingView Scanner üzerinden desteklenir. İş Yatırım'da `DMLKTG` olarak listelense de TradingView ticker'ı `DMLKT`'dir.

**Kullanım:**

```
=BIST_PRICE("ALTIN.S1"; Summary!$O$1)    → 3847.5
=BIST_CHANGE("ALTIN.S1"; Summary!$O$1)   → 0.0123 (%1,23)
=BIST_PRICE("DMLKT"; Summary!$O$1)       → 6.12
=BIST_CHANGE("DMLKT"; Summary!$O$1)      → 0.0099 (%0,99)
```

---

### BIST - Dönemsel Değişim (TradingView)

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `BYF_CHANGE_PERIOD(symbol, days)` | Belirli dönem değişim oranı | [TradingView Scanner](https://scanner.tradingview.com) |

**Desteklenen semboller:** Tüm BIST sembolleri — `GLDTR.F`, `ZGOLD.F`, `GMSTR.F`, `ALTIN.S1`, `DMLKT` vb.

**Sembol dönüşümü:** Nokta ve sonrası kaldırılır → `BIST:` eklenir (nokta yoksa aynen kalır)

- `GLDTR.F` → `BIST:GLDTR`
- `ALTIN.S1` → `BIST:ALTIN`
- `DMLKT` → `BIST:DMLKT`

**Dönem eşleşmesi:**

| `days` parametresi | TradingView sütunu | Açıklama |
|--------------------|--------------------|----------|
| ≤ 7 | `Perf.W` | Haftalık |
| ≤ 30 | `Perf.1M` | Aylık |
| ≤ 90 | `Perf.3M` | 3 aylık |
| ≤ 180 | `Perf.6M` | 6 aylık |
| > 180 | `Perf.Y` | Yıllık |

**Kullanım:**

```
=BYF_CHANGE_PERIOD("GLDTR.F"; 7; Summary!$O$1)      → -0.0611 (%-6,11)
=BYF_CHANGE_PERIOD("ALTIN.S1"; 30; Summary!$O$1)    → -0.0706 (%-7,06)
=BYF_CHANGE_PERIOD("GMSTR.F"; 365; Summary!$O$1)    → 1.4114 (%141,14)
=BYF_CHANGE_PERIOD("DMLKT"; 30; Summary!$O$1)       → -0.0016 (%-0,16)
=BYF_CHANGE_PERIOD("DMLKT"; 365; Summary!$O$1)      → -0.1947 (%-19,47)
```

**Dönüş:** Ondalık oran (100'e bölünmüş). Hücre formatını `%` yapınca doğru görünür.

---

### TEFAS - Yatırım Fonu (Ayna Siteler)

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `TEFAS_FON_PRICE(fonKod)` | Son fon fiyatı (TRY) | [fonyatirimcisi.com](https://fonyatirimcisi.com) |
| `TEFAS_FON_CHANGE(fonKod)` | 24 saatlik değişim oranı | fonyatirimcisi.com |
| `TEFAS_FON_GETIRI(fonKod, ay)` | Dönemsel getiri (1/3/6/12 ay) | [fonrapor.com](https://fonrapor.com) |

**Desteklenen semboller:** Tüm TEFAS fon kodları — `GTL`, `YAC`, `MAC`, `FGA`, `FGS`, `IPB`, `ZGD` vb.

**Cache:** Aynı fon kodu için tüm fonksiyonlar 1 saat boyunca **tek HTTP turu** yapar (fonyatirimcisi + fonrapor → tek cache).

**Hassasiyet:** Fiyat, sayfadaki `og:image` URL parametrelerinden (`og-fund?...&price=2.055579&change=0.126...`) **6 ondalık hane** olarak okunur; günlük değişim de yuvarlanmamış gelir. Bu parse başarısız olursa meta description'daki 4 haneye yuvarlanmış değere düşülür.

> **Neden ayna site?** TEFAS resmi sitesi (2026-06 itibarıyla) F5/Imperva tabanlı JavaScript bot koruması kullanıyor. Apps Script'in `UrlFetchApp`'i bu challenge'ı çözemediği için hem `/tr/fon-detayli-analiz/...` sayfası hem de `fonFiyatBilgiGetir` API'si engelleniyor. Çözüm: TEFAS verisini server-side scraping engeli olmadan yayınlayan iki açık ayna kullanılıyor — `fonyatirimcisi.com` (meta description'dan fiyat + günlük değişim, mikro fiyatlı fonlarda da doğru) ve `fonrapor.com` (statik HTML tablo satırlarından 1/3/6/12 ay getirileri).

**Kullanım:**

```
=TEFAS_FON_PRICE("GTL"; Summary!$O$1)        → 0.120084
=TEFAS_FON_CHANGE("GTL"; Summary!$O$1)       → 0.003946 (%0,39)
=TEFAS_FON_GETIRI("GTL"; 1; Summary!$O$1)    → 0.030507 (%3,05)
=TEFAS_FON_GETIRI("GTL"; 3; Summary!$O$1)    → 0.091564 (%9,16)
=TEFAS_FON_GETIRI("GTL"; 6; Summary!$O$1)    → 0.200288 (%20,03)
=TEFAS_FON_GETIRI("GTL"; 12; Summary!$O$1)   → 0.492487 (%49,25)
```

---

## API Kaynakları Özet

| Kaynak | Kullanım | Veri Tipi |
|--------|----------|-----------|
| **Yahoo Finance** | BYF fiyat + günlük değişim | JSON API |
| **TradingView Scanner** | BIST fiyat + günlük + dönemsel değişim | JSON POST API |
| **fonyatirimcisi.com** | TEFAS fonu fiyat + 24h değişim | HTML meta scrape |
| **fonrapor.com** | TEFAS fonu 1/3/6/12 ay getiri | HTML tablo scrape |
| **BtcTurk** | Kripto fiyat + 24h değişim | JSON API |
| **CoinTR** | Kripto fiyat + 24h değişim | JSON API |

---

## Dönüş Değeri Formatı

Tüm değişim fonksiyonları **ondalık oran** döner (100'e bölünmüş):

| Dönen değer | Anlamı | Hücre formatı `%` ile |
|-------------|--------|-----------------------|
| `0.0236` | %2,36 artış | 2,36% |
| `-0.0929` | %9,29 düşüş | -9,29% |
| `1.4114` | %141,14 artış | 141,14% |

---

## Denenen Ama Çalışmayan Kaynaklar

| Kaynak | Sorun | Not |
|--------|-------|-----|
| **Investing.com** | TVC API ve ETF sayfası 403 Forbidden dönüyor | `getInvestingFiyat`, `getInvestingDegisimYuzde` → `old/investing-old.gs`'e taşındı |
| **Bitci** | Kullanılmıyor | `getBnbUsdt` → `old/investing-old.gs`'e taşındı |
| **Yahoo Finance tarihsel** | ZGOLD/GLDTR için geçmiş veri dönmüyor (`validRanges: ["1d","5d"]`) | Sadece günlük fiyat alınabilir |
| **TradingView sayfa scraping** | SPA — fiyat client-side JS ile yükleniyor | `getBYF` → `old/investing-old.gs`'e taşındı; Scanner API çalışıyor |
| **TEFAS resmi sitesi** (2026-06) | F5/Imperva JS bot koruması — `UrlFetchApp` challenge'ı çözemiyor, fon sayfası ve `fonFiyatBilgiGetir` API'si engelleniyor | Önceki Cloudflare Worker (`old/tefas-worker-old.js`) ve doğrudan-fetch yöntemi de aynı sebepten çalışmıyor; fonyatirimcisi.com + fonrapor.com aynalarına geçildi |

---

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `myPortfoyApp.gs` | Ana Apps Script dosyası (tüm fonksiyonlar) |
| `old/investing-old.gs` | Kaldırılan fonksiyonlar: Investing.com, TradingView scraping, Bitci |
| `old/tefas-worker-old.js` | Eski TEFAS Cloudflare Worker |
| `old/tefas-worker-old.gs` | Eski TEFAS Apps Script kodu |

---

## Yeni Fonksiyon Ekleme Rehberi

### Yeni bir API kaynağı eklemek için

1. API'nin Apps Script'ten (`UrlFetchApp.fetch`) erişilebilir olduğunu doğrula
2. Yanıt formatını kontrol et (JSON mu, HTML mi?)
3. WAF/bot koruması var mı test et
4. Fonksiyonu `myPortfoyApp.gs`'e ekle
5. Bu dokümana ekle

### TradingView Scanner'a yeni sütun eklemek için

Mevcut `columns` listesine eklenebilecek TradingView sütunları:

```
close          → Son fiyat
Perf.W         → Haftalık değişim (%)
Perf.1M        → Aylık değişim (%)
Perf.3M        → 3 aylık değişim (%)
Perf.6M        → 6 aylık değişim (%)
Perf.Y         → Yıllık değişim (%)
Perf.YTD       → Yılbaşından bugüne (%)
Perf.5Y        → 5 yıllık değişim (%)
Perf.All       → Tüm zamanlar (%)
volume         → İşlem hacmi
market_cap     → Piyasa değeri
change         → Günlük değişim (mutlak)
change_abs     → Günlük değişim (mutlak fiyat farkı)
```

### Yeni BIST hissesi için `BIST_PRICE` / `BIST_CHANGE` / `BYF_CHANGE_PERIOD` kullanımı

Ek kod gerekmez — herhangi bir BIST sembolü çalışır (hisse, BYF, GYO sertifikası vb.):

```
=BIST_PRICE("ALTIN.S1"; Summary!$O$1)
=BIST_PRICE("DMLKT"; Summary!$O$1)
=BIST_CHANGE("ALTIN.S1"; Summary!$O$1)
=BIST_CHANGE("DMLKT"; Summary!$O$1)
=BYF_CHANGE_PERIOD("THYAO"; 30; Summary!$O$1)
=BYF_CHANGE_PERIOD("ASELS"; 365; Summary!$O$1)
=BYF_CHANGE_PERIOD("GARAN"; 7; Summary!$O$1)
=BYF_CHANGE_PERIOD("DMLKT"; 90; Summary!$O$1)
```
