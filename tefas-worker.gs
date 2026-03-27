// ==================== TEFAS (Cloudflare Worker proxy) ====================

var TEFAS_WORKER_URL = "https://rapid-unit-afb4.beyt34.workers.dev";

var TEFAS_MAP = {
    "GLDTR.F": "FGA",
    "ZGOLD.F": "ZGD",
    "GMSTR.F": "FGS"
};

function _formatDate(d) {
    var day = ("0" + d.getDate()).slice(-2);
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var y = d.getFullYear();
    return day + "." + m + "." + y;
}

function _fetchTefas(fonkod, basTarih, bitTarih) {
    var url = TEFAS_WORKER_URL + "?fonkod=" + fonkod + "&bas=" + encodeURIComponent(basTarih) + "&bit=" + encodeURIComponent(bitTarih);

    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (res.getResponseCode() !== 200) {
        Logger.log("TEFAS Worker hata: " + res.getResponseCode() + " - " + res.getContentText().substring(0, 200));
        return null;
    }

    var data = JSON.parse(res.getContentText());
    if (data && data.data && data.data.length > 0) {
        return data.data;
    }
    return null;
}

/**
 * TEFAS'tan BYF fon fiyatını çeker (Cloudflare Worker proxy).
 * Kullanım: =TEFAS_PRICE("GLDTR.F")
 *
 * @param {string} symbol
 * @return {number} Son fon fiyatı (TRY)
 * @customfunction
 */
function TEFAS_PRICE(symbol) {
    if (!symbol) symbol = "GLDTR.F";
    var fonkod = TEFAS_MAP[symbol];
    if (!fonkod) return 0;

    try {
        var bugun = new Date();
        var onceki = new Date();
        onceki.setDate(bugun.getDate() - 5);

        var data = _fetchTefas(fonkod, _formatDate(onceki), _formatDate(bugun));
        if (data && data.length > 0) {
            var price = data[0].FIYAT;
            Logger.log(symbol + " TEFAS fiyat: " + price);
            return price;
        }
        return 0;
    } catch (e) {
        Logger.log("TEFAS hata (" + symbol + "): " + e.message);
        return 0;
    }
}

/**
 * TEFAS'tan BYF belirli dönem değişim yüzdesini hesaplar (Cloudflare Worker proxy).
 * Kullanım: =TEFAS_CHANGE("GLDTR.F"; 7)
 *
 * @param {string} symbol
 * @param {number} days - Kaç günlük değişim (1, 7, 30, 365)
 * @return {number} Değişim oranı (ör: -0.0929 = %-9,29)
 * @customfunction
 */
function TEFAS_CHANGE(symbol, days) {
    if (!symbol) symbol = "GLDTR.F";
    if (!days) days = 1;
    var fonkod = TEFAS_MAP[symbol];
    if (!fonkod) return 0;

    try {
        var bugun = new Date();
        var onceki = new Date();
        onceki.setDate(bugun.getDate() - days - 10);

        var data = _fetchTefas(fonkod, _formatDate(onceki), _formatDate(bugun));
        if (!data || data.length < 2) return 0;

        var sonFiyat = data[0].FIYAT;

        var targetDate = new Date();
        targetDate.setDate(bugun.getDate() - days);
        var targetTime = targetDate.getTime();

        var eskiFiyat = null;
        var minDiff = Infinity;

        for (var i = 0; i < data.length; i++) {
            var tarih = new Date(data[i].TARIH);
            var diff = Math.abs(tarih.getTime() - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                eskiFiyat = data[i].FIYAT;
            }
        }

        if (eskiFiyat && eskiFiyat !== 0) {
            var change = (sonFiyat - eskiFiyat) / eskiFiyat;
            Logger.log(symbol + " TEFAS " + days + "d: " + (change * 100).toFixed(2) + "%");
            return change;
        }
        return 0;
    } catch (e) {
        Logger.log("TEFAS hata (" + symbol + "): " + e.message);
        return 0;
    }
}