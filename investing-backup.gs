/**
 * =============================================
 * YEDEK / DEPRECATED FONKSIYONLAR
 * =============================================
 * Bu fonksiyonlar artık çalışmıyor veya kullanılmıyor.
 * Investing.com ve TradingView sayfa scraping
 * istekleri 403 Forbidden döndürüyor.
 *
 * Alternatifler:
 *   Fiyat     → BYF_PRICE(symbol)          [Yahoo Finance]
 *   Değişim   → BYF_CHANGE(symbol)         [Yahoo Finance]
 *   Dönemsel  → BYF_CHANGE_PERIOD(s, days) [TradingView Scanner]
 * =============================================
 */

function getBnbUsdt() {
    var response = UrlFetchApp.fetch('https://api.bitci.com/api/ReturnTicker');
    var json = JSON.parse(response.getContentText());
    var price = null;

    json.forEach(function (item) {
        if (item.coinCode === "BNB" && item.currencyCode === "USDT") {
            price = item.price;
        }
    });

    if (price) {
        Logger.log("BNB/USDT fiyatı: " + price);
    } else {
        Logger.log("BNB/USDT çiftine ait fiyat bulunamadı.");
    }

    return price;
}

function getInvestingFiyat(symbol) {
    if (symbol == null)
        symbol = "ZGOLD.F";

    const map = {
        "ZGOLD.F": 952106,
        "GLDTR.F": 1140533,
        "GMSTR.F": 1177214
    };

    if (!map[symbol]) return "0";

    const id = map[symbol];
    const now = Math.floor(Date.now() / 1000);

    const url = `https://tvc-invdn-com.investing.com/history?symbol=${id}&resolution=1&from=${now - 600}&to=${now}`;
    Logger.log("URL: " + url);

    const res = UrlFetchApp.fetch(url, {
        "muteHttpExceptions": true,
        "headers": {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.investing.com",
            "Accept": "application/json, text/plain, */*"
        }
    });

    const content = res.getContentText();
    Logger.log("content: " + content);

    const json = JSON.parse(content);

    if (!json.c || json.c.length === 0) return "0";

    return json.c[json.c.length - 1];
}

function getInvestingDegisimYuzde(symbol) {
    if (symbol == null)
        symbol = "zgoldf"

    if (symbol == 'ZGOLD.F')
        symbol = "zgoldf";
    else if (symbol == 'GLDTR.F')
        symbol = "istanbul-gold-etf"
    else if (symbol == 'GMSTR.F')
        symbol = "non-financial-istanbul-20"

    var url = "https://tr.investing.com/etfs/" + symbol;
    var options = {
        muteHttpExceptions: true,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        }
    };

    var html = UrlFetchApp.fetch(url, options).getContentText();

    // 1) İlgili span bloğunu yakala
    var blockRe = /data-test="instrument-price-change-percent"[^>]*>([\s\S]*?)<\/span>/;
    var blockMatch = html.match(blockRe);
    if (!blockMatch) return "Yüzde Bulunamadı";

    // 2) Blok içinden -6,09 gibi sayıyı çıkar
    var numRe = /-?\d+(?:,\d+)?/;
    var numMatch = blockMatch[1].match(numRe);
    if (!numMatch) return "Yüzde Bulunamadı";

    // 3) "-6,09" -> -6.09
    return parseFloat(numMatch[0].replace(",", ".") / 100);
}

function getBYF(symbol) {
    if (symbol == null)
        symbol = "GLDTR.F";

    const map = {
        "ZGOLD.F": "BIST-ZGOLD",
        "GLDTR.F": "BIST-GLDTR",
        "GMSTR.F": "BIST-GMSTR"
    };

    const tv = map[symbol];
    if (!tv) return 0;

    const url = `https://tr.tradingview.com/symbols/${tv}/`;

    const res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "tr-TR"
        }
    });

    const html = res.getContentText();

    const patterns = [
        { name: "regularMarketPrice", regex: /"regularMarketPrice":\s*([\d\.]+)/ },
        { name: "lp", regex: /"lp":\s*([\d\.]+)/ },
        { name: "price", regex: /"price":\s*([\d\.]+)/ }
    ];

    for (let p of patterns) {
        const m = html.match(p.regex);
        if (m) {
            Logger.log("Bulunan fiyat (" + p.name + "): " + m[1]);
            return parseFloat(m[1]);
        }
    }

    Logger.log("Fiyat bulunamadı!");
    return 0;
}
