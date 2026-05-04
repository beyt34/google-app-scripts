/**
 * Cloudflare Worker - TEFAS Proxy (Yeni API)
 * TEFAS yeni sitesinden fon fiyat bilgisi çeker.
 *
 * Kullanım:
 *   GET /?fonkod=GTL          → sonFiyat + degisim24h
 *
 * Deploy:
 *   npx wrangler deploy tefas-worker.js --name tefas-proxy
 */

export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders() });
        }

        const fonkod = url.searchParams.get("fonkod");

        if (!fonkod) {
            return Response.json({ error: "fonkod gerekli (ör: ?fonkod=GTL)" }, { status: 400 });
        }

        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        try {
            // 1. Adım: Fon sayfasını yükle → session cookie al
            const pageRes = await fetch("https://www.tefas.gov.tr/tr/fon-detayli-analiz/" + fonkod, {
                method: "GET",
                headers: {
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "tr-TR,tr;q=0.9"
                },
                redirect: "follow"
            });

            const allCookies = extractCookies(pageRes.headers);

            // 2. Adım: Fon fiyat API'sini çağır (periyod:1 = son 1 ay)
            const apiRes = await fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": ua,
                    "Referer": "https://www.tefas.gov.tr/tr/fon-detayli-analiz/" + fonkod,
                    "Origin": "https://www.tefas.gov.tr",
                    "Accept": "application/json, */*",
                    "Accept-Language": "tr-TR,tr;q=0.9",
                    "Cookie": allCookies
                },
                body: JSON.stringify({ fonKodu: fonkod, dil: "TR", periyod: 1 })
            });

            const text = await apiRes.text();

            if (apiRes.status !== 200 || text.includes("Request Rejected") || text.includes("<html")) {
                return Response.json({
                    error: "TEFAS API engeli",
                    status: apiRes.status,
                    detail: text.substring(0, 300)
                }, { status: 502, headers: corsHeaders() });
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                return Response.json({
                    error: "JSON parse hatası",
                    raw: text.substring(0, 500)
                }, { status: 502, headers: corsHeaders() });
            }

            const list = data.resultList;
            if (!list || list.length === 0) {
                return Response.json({ error: "Veri bulunamadı", fonkod }, { status: 404, headers: corsHeaders() });
            }

            const son = list[list.length - 1];
            const onceki = list.length >= 2 ? list[list.length - 2] : null;
            const degisim = onceki ? (son.fiyat - onceki.fiyat) / onceki.fiyat : 0;

            return new Response(JSON.stringify({
                fonKodu: son.fonKodu,
                fonUnvan: son.fonUnvan,
                tarih: son.tarih,
                sonFiyat: son.fiyat,
                oncekiFiyat: onceki ? onceki.fiyat : null,
                degisim24h: degisim
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });

        } catch (e) {
            return Response.json({ error: e.message, stack: e.stack }, {
                status: 500, headers: corsHeaders()
            });
        }
    }
};

/**
 * Set-Cookie header'larından tüm cookie'leri çıkarır.
 */
function extractCookies(headers) {
    const parts = [];
    for (const [name, value] of headers) {
        if (name.toLowerCase() === "set-cookie") {
            parts.push(value.split(";")[0]);
        }
    }
    return parts.join("; ");
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}
