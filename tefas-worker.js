/**
 * Cloudflare Worker - TEFAS Proxy
 * TEFAS API'sine proxy olarak çalışır, WAF engelini aşar.
 *
 * Kullanım:
 *   GET /?fonkod=FGA&bas=22.03.2026&bit=27.03.2026
 *   GET /?fonkod=FGA                                  → son 5 günün verisi
 *
 * Deploy:
 *   npx wrangler deploy tefas-worker.js --name tefas-proxy
 */

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const fonkod = url.searchParams.get("fonkod");

        if (!fonkod) {
            return Response.json({ error: "fonkod gerekli (ör: ?fonkod=FGA)" }, { status: 400 });
        }

        let bas = url.searchParams.get("bas");
        let bit = url.searchParams.get("bit");

        if (!bit) {
            const bugun = new Date();
            bit = formatDate(bugun);
        }
        if (!bas) {
            const onceki = new Date();
            onceki.setDate(onceki.getDate() - 5);
            bas = formatDate(onceki);
        }

        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        try {
            // 1. Adım: Ana sayfayı çağır
            const pageRes = await fetch("https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=" + fonkod, {
                method: "GET",
                headers: {
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "tr-TR,tr;q=0.9"
                },
                redirect: "follow"
            });

            // Cookie'leri topla
            const rawCookies = extractCookies(pageRes.headers);
            const pageHtml = await pageRes.text();

            // 2. Adım: f5_cspm JavaScript challenge'ı çöz
            const cspmCookie = solveF5Challenge(pageHtml);

            // Tüm cookie'leri birleştir
            let allCookies = rawCookies;
            if (cspmCookie) {
                allCookies += (allCookies ? "; " : "") + cspmCookie;
            }

            // 3. Adım: API isteği
            const payload = "fontip=YAT&session=&fonkod=" + fonkod + "&baession=" + bas + "&biession=" + bit;

            const apiRes = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": ua,
                    "Referer": "https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=" + fonkod,
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "tr-TR,tr;q=0.9",
                    "Cookie": allCookies
                },
                body: payload
            });

            const text = await apiRes.text();

            if (text.includes("Web Application Firewall") || text.includes("<title>Error</title>")) {
                return Response.json({
                    error: "TEFAS WAF engeli",
                    cookies: allCookies,
                    cspmCookie: cspmCookie || "hesaplanamadı",
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

            return new Response(JSON.stringify(data), {
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
    // Cloudflare Workers'da headers iterable
    for (const [name, value] of headers) {
        if (name.toLowerCase() === "set-cookie") {
            parts.push(value.split(";")[0]);
        }
    }
    return parts.join("; ");
}

/**
 * F5 BIG-IP WAF'ın f5_cspm JavaScript challenge'ını çözer.
 * HTML'den f5_p değerini ve cookie adını parse edip,
 * set_latency fonksiyonunu simüle eder.
 */
function solveF5Challenge(html) {
    // f5_p değerini çıkar
    const f5pMatch = html.match(/f5_p:'([A-Z]+)'/);
    if (!f5pMatch) return null;
    let f5p = f5pMatch[1];

    // Cookie adını çıkar (xid...._cspm_)
    const cookieNameMatch = html.match(/cookie='([^']+_cspm_)=/);
    if (!cookieNameMatch) return null;
    const cookieName = cookieNameMatch[1];

    // F5 set_byte fonksiyonunu simüle et
    function setCharAt(str, index, chr) {
        if (index > str.length - 1) return str;
        return str.substr(0, index) + chr + str.substr(index + 1);
    }

    function set_byte(str, i, b) {
        const s = (i / 16) | 0;
        const idx = i & 15;
        const base = s * 32;
        str = setCharAt(str, idx + 16 + base, String.fromCharCode((b >> 4) + 65));
        str = setCharAt(str, idx + base, String.fromCharCode((b & 15) + 65));
        return str;
    }

    // set_latency: sahte latency (200ms)
    const latency = 200 & 0xffff;
    f5p = set_byte(f5p, 40, latency >> 8);
    f5p = set_byte(f5p, 41, latency & 0xff);
    f5p = set_byte(f5p, 35, 2);

    return cookieName + "=" + encodeURIComponent(f5p);
}

function formatDate(d) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return day + "." + month + "." + year;
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}
