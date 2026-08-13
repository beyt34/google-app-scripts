/**
 * TEFAS yatırım fonu verisi çeker.
 *
 * Not (2026-06): TEFAS resmi sitesi F5/Imperva tabanlı JavaScript bot koruması
 * ekledi; Apps Script'in UrlFetchApp'i bu challenge'ı çözemiyor ve hem fon
 * detay sayfası hem de fonFiyatBilgiGetir API'si engelleniyor.
 *
 * Veri, fonyatirimcisi.com'un kendi JSON API'sinden tek çağrıda alınır:
 *   GET https://api.fonyatirimcisi.com/api/v1/funds/{KOD}
 *   → current_price, daily_change, monthly_return, three_month_return,
 *     six_month_return, yearly_return (getiriler yüzde cinsinden)
 *
 * API "Origin not allowed" ile 403 döndüğü için Origin + Referer başlıkları
 * gönderilir; fon kodu büyük harf olmalıdır.
 *
 * Not (2026-08): fonrapor.com client-side render'a geçti — statik HTML'de artık
 * getiri tablosu yok ve /fon/{kod} tüm kodlar için "Fon Bulunamadı" döndürüyor.
 * Bu yüzden HTML scraping tamamen bırakıldı; eski og:image parse'ı yalnızca
 * API erişilemezse fiyat/değişim için yedek olarak kullanılıyor.
 *
 * Sonuç 1 saat boyunca CacheService'te tutulur — aynı fon için
 * TEFAS_FON_PRICE / TEFAS_FON_CHANGE / TEFAS_FON_GETIRI tek HTTP turu yapar.
 *
 * @param {string} fonKod
 * @return {object|null} {sonFiyat, degisim24h, getiri1ay, getiri3ay, getiri6ay, getiri12ay}
 */
function _fetchTefasFon(fonKod) {
    fonKod = String(fonKod).toUpperCase();
    var cacheKey = "tefas_fon_v4_" + fonKod;
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    var ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    var fetchOpts = {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "tr-TR,tr;q=0.9"
        }
    };

    var result = {
        sonFiyat: null,
        degisim24h: null,
        getiri1ay: null,
        getiri3ay: null,
        getiri6ay: null,
        getiri12ay: null
    };

    // 1) Tek JSON çağrısı: fiyat + günlük değişim + dönemsel getiriler
    try {
        var apiOpts = {
            muteHttpExceptions: true,
            followRedirects: true,
            headers: {
                "User-Agent": ua,
                "Accept": "application/json",
                // API yalnızca yetkili origin'lere açık; ikisi de tek başına yeterli,
                // Apps Script biri filtrelerse diğeri devrede kalsın diye ikisi de gönderiliyor.
                "Origin": "https://fonyatirimcisi.com",
                "Referer": "https://fonyatirimcisi.com/"
            }
        };
        var rApi = UrlFetchApp.fetch("https://api.fonyatirimcisi.com/api/v1/funds/" + encodeURIComponent(fonKod), apiOpts);
        if (rApi.getResponseCode() === 200) {
            var d = JSON.parse(rApi.getContentText());
            if (d.current_price != null) {
                result.sonFiyat = parseFloat(d.current_price);
            }
            result.degisim24h = _yuzdeToOran(d.daily_change);
            result.getiri1ay = _yuzdeToOran(d.monthly_return);
            result.getiri3ay = _yuzdeToOran(d.three_month_return);
            result.getiri6ay = _yuzdeToOran(d.six_month_return);
            result.getiri12ay = _yuzdeToOran(d.yearly_return);
        } else {
            Logger.log("fonyatirimcisi API HTTP " + rApi.getResponseCode() + " (" + fonKod + ")");
        }
    } catch (e) {
        Logger.log("fonyatirimcisi API hata (" + fonKod + "): " + e.message);
    }

    // 2) Yedek: API erişilemezse HTML sayfasındaki og:image URL'sinden fiyat + değişim
    // (og-fund?code=TP2&amp;...&amp;price=2.055579&amp;...&amp;change=0.1260599778) —
    // dönemsel getiriler bu yolla alınamaz, sadece fiyat kurtarılır.
    if (result.sonFiyat == null) {
        try {
            var r1 = UrlFetchApp.fetch("https://fonyatirimcisi.com/fon/" + encodeURIComponent(fonKod), fetchOpts);
            if (r1.getResponseCode() === 200) {
                var mFull = r1.getContentText().match(
                    new RegExp("og-fund\\?code=" + fonKod + "&amp;[^\"]*price=([\\d.]+)[^\"]*change=([+\\-]?[\\d.]+)")
                );
                if (mFull) {
                    result.sonFiyat = parseFloat(mFull[1]);
                    result.degisim24h = parseFloat(mFull[2]) / 100;
                } else {
                    Logger.log("fonyatirimcisi og-fund parse edilemedi: " + fonKod);
                }
            } else {
                Logger.log("fonyatirimcisi HTML HTTP " + r1.getResponseCode() + " (" + fonKod + ")");
            }
        } catch (e) {
            Logger.log("fonyatirimcisi HTML hata (" + fonKod + "): " + e.message);
        }
    }

    if (result.sonFiyat == null) {
        return null;
    }

    cache.put(cacheKey, JSON.stringify(result), 3600); // 1 saat cache
    return result;
}

/**
 * API'den yüzde cinsinden gelen değeri orana çevirir (4.1021 → 0.041021).
 * @param {number|null} v
 * @return {number|null} null ise fonun o dönem için geçmişi yetmiyordur
 */
function _yuzdeToOran(v) {
    if (v == null) {
        return null;
    }
    return v / 100;
}

/**
 * TEFAS'tan yatırım fonu son fiyatını çeker.
 * Kullanım: =TEFAS_FON_PRICE("GTL")
 *
 * @param {string} fonKod - TEFAS fon kodu (ör: GTL, YAC, MAC)
 * @return {number} Son fon fiyatı (TRY)
 * @customfunction
 */
function TEFAS_FON_PRICE(fonKod) {
    if (!fonKod) return 0;
    try {
        var data = _fetchTefasFon(fonKod);
        if (data && data.sonFiyat != null) {
            Logger.log(fonKod + " fiyat: " + data.sonFiyat);
            return data.sonFiyat;
        }
        return 0;
    } catch (e) {
        Logger.log("TEFAS_FON_PRICE hata (" + fonKod + "): " + e.message);
        return 0;
    }
}

/**
 * TEFAS'tan yatırım fonu 24 saatlik değişim oranını çeker.
 * Kullanım: =TEFAS_FON_CHANGE("GTL")
 *
 * @param {string} fonKod - TEFAS fon kodu (ör: GTL, YAC, MAC)
 * @return {number} Değişim oranı (ör: 0.00394 = %0,394)
 * @customfunction
 */
function TEFAS_FON_CHANGE(fonKod) {
    if (!fonKod) return 0;
    try {
        var data = _fetchTefasFon(fonKod);
        if (data && data.degisim24h != null) {
            Logger.log(fonKod + " 24h değişim: " + (data.degisim24h * 100).toFixed(4) + "%");
            return data.degisim24h;
        }
        return 0;
    } catch (e) {
        Logger.log("TEFAS_FON_CHANGE hata (" + fonKod + "): " + e.message);
        return 0;
    }
}

/**
 * TEFAS'tan yatırım fonu dönemsel getirisini hesaplar.
 * Kullanım: =TEFAS_FON_GETIRI("GTL"; 1)
 *
 * @param {string} fonKod - TEFAS fon kodu (ör: GTL, YAC, MAC)
 * @param {number} ay - Kaç aylık getiri: 1, 3, 6 veya 12
 * @return {number} Getiri oranı (ör: 0.0305 = %3,05)
 * @customfunction
 */
function TEFAS_FON_GETIRI(fonKod, ay) {
    if (!fonKod) return 0;
    if (!ay) ay = 1;
    try {
        var data = _fetchTefasFon(fonKod);
        if (!data) return 0;
        var getiri;
        if (ay <= 1)       getiri = data.getiri1ay;
        else if (ay <= 3)  getiri = data.getiri3ay;
        else if (ay <= 6)  getiri = data.getiri6ay;
        else               getiri = data.getiri12ay;
        if (getiri != null) {
            Logger.log(fonKod + " " + ay + "ay getiri: " + (getiri * 100).toFixed(4) + "%");
            return getiri;
        }
        return 0;
    } catch (e) {
        Logger.log("TEFAS_FON_GETIRI hata (" + fonKod + " " + ay + "ay): " + e.message);
        return 0;
    }
}

function getBtcturkPrice(symbol) {
    // USDTTRY
    // BTCUSDT
    // ETHUSDT
    // SOLUSDT
    // AVAXUSDT
    // XRPUSDT

    if (symbol == null) {
        symbol = "BTCUSDT"
    }

    var url = 'https://api.btcturk.com/api/v2/ticker?pairSymbol=' + encodeURIComponent(symbol);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
        Logger.log("BtcTurk API hata (" + symbol + "): " + response.getResponseCode());
        return 0;
    }
    var json = JSON.parse(response.getContentText());

    var price = json.data[0].last;

    if (price) {
        Logger.log(symbol + " fiyatı: " + price);
    } else {
        Logger.log(symbol + " ait fiyat bulunamadı.");
    }

    return price;
}

function getBtcturkPriceChange(symbol) {
    // USDTTRY
    // BTCUSDT
    // ETHUSDT
    // SOLUSDT
    // AVAXUSDT
    // XRPUSDT

    if (symbol == null) {
        symbol = "BTCUSDT"
    }

    var url = 'https://api.btcturk.com/api/v2/ticker?pairSymbol=' + encodeURIComponent(symbol);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
        Logger.log("BtcTurk API hata (" + symbol + "): " + response.getResponseCode());
        return 0;
    }
    var json = JSON.parse(response.getContentText());

    var dailyPercent = (json.data[0].dailyPercent) / 100.0;

    if (dailyPercent) {
        Logger.log(symbol + " değişim: " + dailyPercent);
    } else {
        Logger.log(symbol + " ait değişim bilgisi bulunamadı.");
    }

    return dailyPercent;
}

function getCoinTrPrice(symbol) {
    // BNBUSDT

    if (symbol == null) {
        symbol = "BNBUSDT"
    }

    var url = 'https://api.cointr.com/api/v2/spot/market/tickers?symbol=' + encodeURIComponent(symbol);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
        Logger.log("CoinTR API hata (" + symbol + "): " + response.getResponseCode());
        return 0;
    }
    var json = JSON.parse(response.getContentText());

    var price = json.data[0].lastPr;

    if (price) {
        Logger.log(symbol + " fiyatı: " + price);
    } else {
        Logger.log(symbol + " ait fiyat bulunamadı.");
    }

    // Eğer price sayıysa veya string ise, noktayı virgüle çevir
    var priceStr = price.toString().replace('.', ',');

    // Sayıya çevirmek için
    var priceNum = parseFloat(priceStr.replace(',', '.'));

    return priceNum;
}

function getCoinTrPriceChange(symbol) {
    // BNBUSDT

    if (symbol == null) {
        symbol = "BNBUSDT"
    }

    var url = 'https://api.cointr.com/api/v2/spot/market/tickers?symbol=' + encodeURIComponent(symbol);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
        Logger.log("CoinTR API hata (" + symbol + "): " + response.getResponseCode());
        return 0;
    }
    var json = JSON.parse(response.getContentText());

    var change24h = json.data[0].change24h;

    if (change24h) {
        Logger.log(symbol + " değişim: " + change24h);
    } else {
        Logger.log(symbol + " ait değişim bilgisi bulunamadı.");
    }

    // Eğer change24h sayıysa veya string ise, noktayı virgüle çevir
    var change24hStr = change24h.toString().replace('.', ',');

    // Sayıya çevirmek için
    var change24hNum = parseFloat(change24hStr.replace(',', '.'));

    return change24hNum;
}

function _fetchYahooChart(symbol) {
    var yahooSymbol = symbol.replace(/\.F$/i, ".IS");
    var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + yahooSymbol + "?interval=1d&range=1d";

    var res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    if (res.getResponseCode() !== 200) {
        Logger.log("HTTP hata: " + res.getResponseCode() + " - " + yahooSymbol);
        return null;
    }

    var data = JSON.parse(res.getContentText());
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
        return data.chart.result[0].meta;
    }
    return null;
}

function BYF_PRICE(symbol) {
    if (!symbol) symbol = "GLDTR.F";
    try {
        var meta = _fetchYahooChart(symbol);
        if (meta && meta.regularMarketPrice) {
            Logger.log(symbol + " fiyat: " + meta.regularMarketPrice);
            return meta.regularMarketPrice;
        }
        Logger.log("Fiyat bulunamadı: " + symbol);
        return 0;
    } catch (e) {
        Logger.log("Hata (" + symbol + "): " + e.message);
        return 0;
    }
}

function BYF_CHANGE(symbol) {
    if (!symbol) symbol = "GLDTR.F";
    try {
        var meta = _fetchYahooChart(symbol);
        if (meta && meta.regularMarketPrice && meta.chartPreviousClose) {
            var change = (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose;
            Logger.log(symbol + " değişim: " + (change * 100).toFixed(2) + "%");
            return change;
        }
        Logger.log("Değişim hesaplanamadı: " + symbol);
        return 0;
    } catch (e) {
        Logger.log("Hata (" + symbol + "): " + e.message);
        return 0;
    }
}

/**
 * TradingView Scanner'dan BIST sembolü için güncel fiyat ve değişim çeker.
 * @param {string} tvSymbol - "BIST:ALTIN" formatında
 * @param {string[]} columns - İstenilen sütunlar
 * @return {object|null}
 */
function _fetchTradingView(tvSymbol, columns) {
    var payload = JSON.stringify({
        symbols: { tickers: [tvSymbol] },
        columns: columns
    });
    var res = UrlFetchApp.fetch("https://scanner.tradingview.com/turkey/scan", {
        method: "post",
        contentType: "application/json",
        payload: payload,
        muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    if (data.data && data.data.length > 0 && data.data[0].d) {
        return data.data[0].d;
    }
    return null;
}

/**
 * TradingView'dan BIST sembolünün son fiyatını çeker.
 * Kullanım: =BIST_PRICE("ALTIN.S1")  veya =BIST_PRICE("GARAN")
 *
 * @param {string} symbol - BIST sembolü (ör: ALTIN.S1, GARAN, THYAO)
 * @return {number} Son fiyat (TRY)
 * @customfunction
 */
function BIST_PRICE(symbol) {
    if (!symbol) return 0;
    try {
        var tvTicker = symbol.replace(/\.[A-Z0-9]+$/i, "");
        var d = _fetchTradingView("BIST:" + tvTicker, ["close"]);
        if (d && d[0] != null) {
            Logger.log(symbol + " fiyat: " + d[0]);
            return d[0];
        }
        return 0;
    } catch (e) {
        Logger.log("BIST_PRICE hata (" + symbol + "): " + e.message);
        return 0;
    }
}

/**
 * TradingView'dan BIST sembolünün günlük değişim oranını çeker.
 * Kullanım: =BIST_CHANGE("ALTIN.S1")  veya =BIST_CHANGE("GARAN")
 *
 * @param {string} symbol - BIST sembolü (ör: ALTIN.S1, GARAN, THYAO)
 * @return {number} Değişim oranı (ör: 0.0123 = %1,23)
 * @customfunction
 */
function BIST_CHANGE(symbol) {
    if (!symbol) return 0;
    try {
        var tvTicker = symbol.replace(/\.[A-Z0-9]+$/i, "");
        var d = _fetchTradingView("BIST:" + tvTicker, ["change"]);
        if (d && d[0] != null) {
            var change = d[0] / 100;
            Logger.log(symbol + " günlük değişim: " + d[0].toFixed(2) + "%");
            return change;
        }
        return 0;
    } catch (e) {
        Logger.log("BIST_CHANGE hata (" + symbol + "): " + e.message);
        return 0;
    }
}

function BYF_CHANGE_PERIOD(symbol, days) {
    if (!symbol) symbol = "GLDTR.F";
    if (!days) days = 7;

    try {
        // Sembolü TradingView formatına çevir
        // GLDTR.F → BIST:GLDTR, ALTIN.S1 → BIST:ALTIN
        var tvTicker = symbol.replace(/\.[A-Z0-9]+$/i, "");
        var tvSymbol = "BIST:" + tvTicker;

        // days → TradingView performans sütunu
        var column;
        if (days <= 7) column = "Perf.W";
        else if (days <= 30) column = "Perf.1M";
        else if (days <= 90) column = "Perf.3M";
        else if (days <= 180) column = "Perf.6M";
        else column = "Perf.Y";

        var payload = JSON.stringify({
            symbols: { tickers: [tvSymbol] },
            columns: [column]
        });

        var res = UrlFetchApp.fetch("https://scanner.tradingview.com/turkey/scan", {
            method: "post",
            contentType: "application/json",
            payload: payload,
            muteHttpExceptions: true
        });

        if (res.getResponseCode() !== 200) {
            Logger.log("HTTP hata: " + res.getResponseCode() + " - " + tvSymbol);
            return 0;
        }

        var data = JSON.parse(res.getContentText());

        if (data.data && data.data.length > 0 && data.data[0].d && data.data[0].d[0] != null) {
            var pct = data.data[0].d[0] / 100;
            Logger.log(symbol + " " + days + "d değişim: " + data.data[0].d[0].toFixed(2) + "%");
            return pct;
        }

        Logger.log("Değişim bulunamadı: " + symbol + " " + days + "d");
        return 0;
    } catch (e) {
        Logger.log("Hata (" + symbol + " " + days + "d): " + e.message);
        return 0;
    }
}

// ============================================================
// REFRESH MEKANİZMASI
// Sayfa açıldığında custom function'lar bazen 0 döner çünkü
// çok sayıda UrlFetchApp isteği aynı anda tetiklenir ve kota aşılır.
// Çözüm: onOpen trigger'ı ile bir hücreye timestamp yazar,
// formüllerde bu hücre dummy parametre olarak geçilir → kademeli recalc.
// ============================================================

/**
 * Sayfa açıldığında otomatik çalışır.
 * "Portföy" menüsü ekler ve refresh hücresini günceller.
 */
function onOpen() {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu("Portföy")
        .addItem("Verileri Yenile", "refreshData")
        .addToUi();
    refreshData();
}

/**
 * Refresh hücresine timestamp yazar → bu hücreyi referans alan
 * tüm custom function'lar sırayla yeniden hesaplanır.
 *
 * Kullanım: Formüllerinize son parametre olarak Summary sayfasındaki O1'i ekleyin:
 *   =BIST_PRICE("ALTIN.S1"; Summary!$O$1)
 *   =getBtcturkPrice("BTCUSDT"; Summary!$O$1)
 *
 * O1 hücresi sadece sayfa açılışında veya menüden
 * "Portföy → Verileri Yenile" tıklandığında güncellenir.
 */
function refreshData() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Summary");
    if (!sheet) {
        Logger.log("Summary sayfası bulunamadı");
        return;
    }
    sheet.getRange("O1").setValue(new Date().getTime());
    SpreadsheetApp.flush();
}