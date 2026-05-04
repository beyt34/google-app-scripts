/**
 * TEFAS'tan yatırım fonu verisi çeker (direkt, Worker gerektirmez).
 * Sonuç 5 dakika boyunca CacheService'te tutulur — aynı fon için
 * TEFAS_FON_PRICE / TEFAS_FON_CHANGE / TEFAS_FON_GETIRI tek API çağrısı yapar.
 * @param {string} fonKod
 * @return {object|null} {sonFiyat, oncekiFiyat, degisim24h, tarih, getiri1ay, getiri3ay, getiri6ay, getiri12ay}
 */
function _fetchTefasFon(fonKod) {
    var cacheKey = "tefas_fon_" + fonKod;
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    var ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // 1. Adım: Fon sayfasını yükle → session cookie'leri al
    var pageRes = UrlFetchApp.fetch("https://www.tefas.gov.tr/tr/fon-detayli-analiz/" + fonKod, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "tr-TR,tr;q=0.9"
        }
    });

    // Cookie'leri topla
    var cookies = [];
    var headers = pageRes.getAllHeaders();
    var setCookie = headers["Set-Cookie"];
    if (setCookie) {
        var cookieList = Array.isArray(setCookie) ? setCookie : [setCookie];
        cookieList.forEach(function(c) { cookies.push(c.split(";")[0]); });
    }
    var cookieStr = cookies.join("; ");

    // 2. Adım: API çağrısı
    var apiRes = UrlFetchApp.fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        payload: JSON.stringify({ fonKodu: fonKod, dil: "TR", periyod: 12 }),
        headers: {
            "User-Agent": ua,
            "Referer": "https://www.tefas.gov.tr/tr/fon-detayli-analiz/" + fonKod,
            "Origin": "https://www.tefas.gov.tr",
            "Accept": "application/json, */*",
            "Accept-Language": "tr-TR,tr;q=0.9",
            "Cookie": cookieStr
        }
    });

    if (apiRes.getResponseCode() !== 200) {
        Logger.log("TEFAS API hata " + apiRes.getResponseCode() + ": " + apiRes.getContentText().substring(0, 300));
        return null;
    }

    var data = JSON.parse(apiRes.getContentText());
    var list = data.resultList;
    if (!list || list.length === 0) return null;

    var son = list[list.length - 1];
    var onceki = list.length >= 2 ? list[list.length - 2] : null;
    var degisim = onceki ? (son.fiyat - onceki.fiyat) / onceki.fiyat : 0;

    // Dönemsel getiri hesabı: N ay önceki fiyatı bul
    function getiriHesapla(ayFarki) {
        var hedefTarih = new Date(son.tarih);
        hedefTarih.setMonth(hedefTarih.getMonth() - ayFarki);
        var hedefZaman = hedefTarih.getTime();
        var enYakin = null;
        var minFark = Infinity;
        for (var i = 0; i < list.length - 1; i++) {
            var fark = Math.abs(new Date(list[i].tarih).getTime() - hedefZaman);
            if (fark < minFark) { minFark = fark; enYakin = list[i]; }
        }
        return enYakin ? (son.fiyat - enYakin.fiyat) / enYakin.fiyat : null;
    }

    var result = {
        sonFiyat: son.fiyat,
        oncekiFiyat: onceki ? onceki.fiyat : null,
        degisim24h: degisim,
        tarih: son.tarih,
        getiri1ay: getiriHesapla(1),
        getiri3ay: getiriHesapla(3),
        getiri6ay: getiriHesapla(6),
        getiri12ay: getiriHesapla(12)
    };

    cache.put(cacheKey, JSON.stringify(result), 3600); // 1 saat cache
    return result;
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
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    //console.log(json);

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
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    //console.log(json);

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
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    //console.log(json);

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
    var response = UrlFetchApp.fetch(url);
    var json = JSON.parse(response.getContentText());
    //console.log(json);

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