# myPortfoy - Google Sheets Apps Script

Google E-Tablolar'da portföy takibi için özel fonksiyonlar. Kripto, BIST hisseleri ve BYF fiyat/değişim verilerini çeşitli API'lerden çeker.

## Kurulum

1. Google Sheets'te **Uzantılar → Apps Komut Dosyası** açın
2. `myPortfoyApp.gs` içeriğini yapıştırın
3. Kaydedin

> **Not:** Türkçe locale'de formül parametreleri `;` ile ayrılır (ör: `=BYF_CHANGE_PERIOD("GLDTR.F"; 7)`)

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
=getBtcturkPrice("BTCUSDT")        → 95000
=getBtcturkPriceChange("BTCUSDT")  → 0.023 (%2,3)
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
=getCoinTrPrice("BNBUSDT")
=getCoinTrPriceChange("BNBUSDT")
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
=BYF_PRICE("GLDTR.F")    → 557
=BYF_CHANGE("GLDTR.F")   → 0.0036 (%0,36)
```

**Yardımcı fonksiyon:** `_fetchYahooChart(symbol)` — Yahoo Finance chart API'sinden `meta` nesnesini döner (`regularMarketPrice`, `chartPreviousClose` vb.)

---

### BIST - Dönemsel Değişim (TradingView)

| Fonksiyon | Açıklama | Kaynak |
|-----------|----------|--------|
| `BYF_CHANGE_PERIOD(symbol, days)` | Belirli dönem değişim oranı | [TradingView Scanner](https://scanner.tradingview.com) |

**Desteklenen semboller:** Tüm BIST sembolleri — `GLDTR.F`, `ZGOLD.F`, `GMSTR.F`, `ALTIN.S1` vb.

**Sembol dönüşümü:** Nokta ve sonrası kaldırılır → `BIST:` eklenir
- `GLDTR.F` → `BIST:GLDTR`
- `ALTIN.S1` → `BIST:ALTIN`

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
=BYF_CHANGE_PERIOD("GLDTR.F"; 7)      → -0.0611 (%-6,11)
=BYF_CHANGE_PERIOD("ALTIN.S1"; 30)    → -0.0706 (%-7,06)
=BYF_CHANGE_PERIOD("GMSTR.F"; 365)    → 1.4114 (%141,14)
```

**Dönüş:** Ondalık oran (100'e bölünmüş). Hücre formatını `%` yapınca doğru görünür.

---

## API Kaynakları Özet

| Kaynak | Kullanım | Veri Tipi |
|--------|----------|-----------|
| **Yahoo Finance** | BYF fiyat + günlük değişim | JSON API |
| **TradingView Scanner** | 7d/30d/90d/180d/365d değişim | JSON POST API |
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
| **TEFAS** (`tefas.gov.tr`) | F5 BIG-IP WAF — JavaScript challenge + obfuscated bot koruması | Apps Script, Cloudflare Worker'dan erişilemiyor |
| **Investing.com** | TVC API ve ETF sayfası 403 Forbidden dönüyor | `getInvestingFiyat`, `getInvestingDegisimYuzde` → `investing-backup.gs`'e yedeklendi |
| **Bitci** | Kullanılmıyor | `getBnbUsdt` → `investing-backup.gs`'e yedeklendi |
| **Yahoo Finance tarihsel** | ZGOLD/GLDTR için geçmiş veri dönmüyor (`validRanges: ["1d","5d"]`) | Sadece günlük fiyat alınabilir |
| **TradingView sayfa scraping** | SPA — fiyat client-side JS ile yükleniyor | `getBYF` → `investing-backup.gs`'e yedeklendi; Scanner API çalışıyor |

---

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `myPortfoyApp.gs` | Ana Apps Script dosyası (tüm fonksiyonlar) |
| `BYF_PRICE.gs` | BYF fonksiyonlarının ayrı kopyası (referans) |
| `investing-backup.gs` | Kaldırılan fonksiyonlar: Investing.com, TradingView scraping, Bitci (yedek) |
| `tefas-worker.js` | TEFAS proxy Cloudflare Worker (WAF nedeniyle çalışmıyor) |

---

## Yeni Fonksiyon Ekleme Rehberi

### Yeni bir API kaynağı eklemek için:

1. API'nin Apps Script'ten (`UrlFetchApp.fetch`) erişilebilir olduğunu doğrula
2. Yanıt formatını kontrol et (JSON mu, HTML mi?)
3. WAF/bot koruması var mı test et
4. Fonksiyonu `myPortfoyApp.gs`'e ekle
5. Bu dokümana ekle

### TradingView Scanner'a yeni sütun eklemek için:

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

### Yeni BIST hissesi için `BYF_CHANGE_PERIOD` kullanımı:

Ek kod gerekmez — herhangi bir BIST sembolü çalışır:
```
=BYF_CHANGE_PERIOD("THYAO"; 30)
=BYF_CHANGE_PERIOD("ASELS"; 365)
=BYF_CHANGE_PERIOD("GARAN"; 7)
```
