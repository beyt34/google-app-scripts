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