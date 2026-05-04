# Google Sheets'te Yatirim Takibi: TEFAS, BIST, BYF ve Kripto Verilerini Apps Script ile Cekmek

Bir sure once TEFAS fonlarimi Google Sheets'te takip ediyordum, gayet guzel calisan bir `IMPORTHTML` formuluyle. Sonra bir gun sabah actigimda hucrelerin hepsinde hata. TEFAS site yapisini degistirmis, eski URL'ler artik calismiyordu.

Bu nokta benim icin bir donus noktasi oldu. "Sayfa scraping ile ne kadar ileri gidebilirsin ki?" sorusunu kendime sormak zorunda kaldim. Cevap basitti: fazla ileri gidemezsin.

O gunden bu yana farkli bir yapi kurdum. TEFAS fonlari, BIST sertifikalari, BYF'ler ve kripto — hepsini tek bir Google Sheets dosyasinda, Apps Script custom function'lariyla toparliyorum. Bu yazida o yapiyi, nasil kuruldugunu ve hangi API'leri kullandigimi anlatiyorum.

---

## Genel Yapi

Temel fikir su: Google Sheets'te bir hucreye normal formul gibi yazdigim custom function'lar, arka planda Apps Script uzerinden ilgili API'leri cagiriyor ve sayiyi dogrudan hucreye donduruyor.

```
Sheets hucre → custom function → UrlFetchApp.fetch → API → JSON → sayi
```

Bu yapi HTML parsing'e gore cok daha stabil. Cunku veri kaynagi degismedikce, yani API ayakta oldukca, formul calismaya devam ediyor.

---

## Baslangic: Apps Script Projesini Kurmak

Google Sheets dosyaniza Apps Script baglamak icin:

1. `Uzantilar > Apps Script` menusunu acin
2. Mevcut icerik varsa temizleyin
3. GitHub'daki `myPortfoyApp.gs` dosyasinin icerigini yapistirin
4. Kaydedin ve ilk calistirmada izin isteklerini onaylayin

Bundan sonra asagidaki tum fonksiyonlari herhangi bir hucrede kullanabilirsiniz.

---

## Kripto: BtcTurk ve CoinTR

Kripto tarafinda iki kaynagi kullaniyorum: BtcTurk ve CoinTR.

### BtcTurk

```gs
=getBtcturkPrice("BTCUSDT")
=getBtcturkPriceChange("BTCUSDT")
```

`USDTTRY`, `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `AVAXUSDT`, `XRPUSDT` gibi semboller destekleniyor.

### CoinTR

```gs
=getCoinTrPrice("BNBUSDT")
=getCoinTrPriceChange("BNBUSDT")
```

Degisim fonksiyonlari ondalik oran dondurur — yani `-0.023` gibi bir deger. Hucre bicimini `%` yapmayi unutmayin.

---

## BYF: Fiyat, Gunluk Degisim ve Donemsel Getiri

BYF tarafinda iki farkli ihtiyac var: gunluk degisim ve donemsel performans. Bunlar icin farkli kaynaklar kullaniyorum.

### Gunluk Fiyat ve Degisim (Yahoo Finance)

```gs
=BYF_PRICE("GLDTR.F")
=BYF_CHANGE("GLDTR.F")
```

`GLDTR.F`, `ZGOLD.F`, `GMSTR.F` gibi semboller Yahoo Finance uzerinden geliyor.

### Donemsel Degisim (TradingView Scanner)

Donemsel performans icin Yahoo Finance yeterince kullanisli degil. Bu nedenle TradingView Scanner'a geciyorum:

```gs
=BYF_CHANGE_PERIOD("GLDTR.F"; 7)
=BYF_CHANGE_PERIOD("GLDTR.F"; 30)
=BYF_CHANGE_PERIOD("GLDTR.F"; 365)
```

---

## BIST: Hangi Durumlarda Script Gerekmiyor?

Standart BIST hisseleri icin aslinda hic Apps Script yazmaya gerek yok. Google Sheets'in dahili `GOOGLEFINANCE` fonksiyonu bu is icin yeterli:

```gs
=GOOGLEFINANCE("ASELS")
=GOOGLEFINANCE("ASELS"; "changepct") / 100
```

Kurulum gerektirmiyor, dogrudan Google'dan besleniyor, `GARAN`, `THYAO`, `BIMAS` gibi yaygin hisseler icin gayet saglam calisiyor.

### Script Gereken Durumlar

Ancak `ALTIN.S1` veya `GUMUS.S1` gibi BIST'te islem goren sertifikalar `GOOGLEFINANCE`'te yer almiyor. Bunlar icin ilk akla gelen `IMPORTXML` ile sayfa cekme, ama o da uzun omurlu olmuyor.

Bunun yerine TradingView Scanner API'sini kullandim:

```gs
=BIST_PRICE("ALTIN.S1")
=BIST_CHANGE("ALTIN.S1")
```

Bu fonksiyonlar `ALTIN.S1`'in yani sira standart hisseler icin de calisiyor. Yani isterseniz tum BIST satirlarinizi bu fonksiyonlarla da tutabilirsiniz.

Donemsel degisim icin `BYF_CHANGE_PERIOD` ayni sekilde BIST sembollerinde de calisiyor:

```gs
=BYF_CHANGE_PERIOD("ALTIN.S1"; 30)
=BYF_CHANGE_PERIOD("GARAN"; 365)
```

---

## TEFAS: En Cok Emek Bu Kisma Girdi

TEFAS, benim icin bu projenin baslangic noktasiydi ve en fazla is bu kisimda cikti.

Eski `IMPORTHTML` formulum TEFAS site guncellemesinden sonra tamamen bozuldu. Yeni site JavaScript ile render ediliyor, eski URL yapisi degisti ve dogrudan HTML cekme artik calismiyor.

Cozumu tarayicinin Network tab'ini acip sayfanin arka planda ne cagirdigina bakarak buldum. Fon fiyat verisi `fonFiyatBilgiGetir` adli bir endpoint'ten JSON olarak geliyordu. Bu endpoint'i Apps Script'ten dogrudan cagirmak yetmiyordu — once fon sayfasini ziyaret edip session cookie'lerini almak, sonra o cookie'lerle POST istek atmak gerekiyordu.

Endpoint:

```text
https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir
```

Kullandigim fonksiyonlar:

```gs
=TEFAS_FON_PRICE("GTL")
=TEFAS_FON_CHANGE("GTL")
=TEFAS_FON_GETIRI("GTL"; 1)
=TEFAS_FON_GETIRI("GTL"; 3)
=TEFAS_FON_GETIRI("GTL"; 6)
=TEFAS_FON_GETIRI("GTL"; 12)
```

`TEFAS_FON_GETIRI`'nin ikinci parametresi ay sayisi: 1, 3, 6 veya 12.

### Cache Meselesi

Portfoy sayfasinda ayni fon kodu onlarca hucrede gecebiliyor. Her hucre icin ayri API istegi gitmesi hem yavas hem de TEFAS'a gereksiz yuklenme. Bu yuzden `CacheService` ile 1 saatlik cache ekledim. Ilk istek API'ye gidiyor, sonraki istekler cache'den geliyor. Fon fiyatlari gun icinde cok sik degismediginden bu sure makul bir denge.

---

## Sayfayi Nasil Duzenliyorum?

Tum bu fonksiyonlari anlamli bir sekilde kullanmak icin sayfa yapisini da buna gore kurdum. Tipik bir satir soyle gorunuyor:

| Tur | Kod | Fiyat | 24s Degisim | 1 Ay | 3 Ay | 6 Ay | 1 Yil |
|-----|-----|-------|-------------|------|------|------|-------|
| TEFAS | GTL | `=TEFAS_FON_PRICE(B2)` | `=TEFAS_FON_CHANGE(B2)` | `=TEFAS_FON_GETIRI(B2; 1)` | `=TEFAS_FON_GETIRI(B2; 3)` | `=TEFAS_FON_GETIRI(B2; 6)` | `=TEFAS_FON_GETIRI(B2; 12)` |
| BIST | ALTIN.S1 | `=BIST_PRICE(B3)` | `=BIST_CHANGE(B3)` | `=BYF_CHANGE_PERIOD(B3; 30)` | `=BYF_CHANGE_PERIOD(B3; 90)` | `=BYF_CHANGE_PERIOD(B3; 180)` | `=BYF_CHANGE_PERIOD(B3; 365)` |
| KRIPTO | BTCUSDT | `=getBtcturkPrice(B4)` | `=getBtcturkPriceChange(B4)` | — | — | — | — |

Kod hucrede tutuldugunda formulleri kolon referansiyla yazabiliyorsunuz. Yeni bir enstruman eklemek de sadece bir satir kopyalamak oluyor.

Bir kac pratik not:

- Degisim ve getiri fonksiyonlari ondalik oran dondurur — hucre bicimini `%` yapin
- Turkce locale'de parametre ayirici `;` olur, Ingilizce locale'de `,`
- TEFAS cache 1 saatlik oldugu icin veriyi aninda gormek istiyorsaniz script tarafinda yenilemeniz gerekebilir

---

## Formul Ozeti

### Kripto

```gs
=getBtcturkPrice("BTCUSDT")         // BtcTurk fiyat
=getBtcturkPriceChange("BTCUSDT")   // BtcTurk 24s degisim
=getCoinTrPrice("BNBUSDT")          // CoinTR fiyat
=getCoinTrPriceChange("BNBUSDT")    // CoinTR 24s degisim
```

### BYF

```gs
=BYF_PRICE("GLDTR.F")              // Yahoo Finance fiyat
=BYF_CHANGE("GLDTR.F")             // Yahoo Finance gunluk degisim
=BYF_CHANGE_PERIOD("GLDTR.F"; 30)  // TradingView donemsel getiri
```

### BIST

```gs
// Script gerektirmeyen (standart hisseler):
=GOOGLEFINANCE("ASELS")
=GOOGLEFINANCE("ASELS"; "changepct") / 100

// Script (sertifikalar ve ozel enstrumanlar):
=BIST_PRICE("ALTIN.S1")
=BIST_CHANGE("ALTIN.S1")
```

### TEFAS

```gs
=TEFAS_FON_PRICE("GTL")
=TEFAS_FON_CHANGE("GTL")
=TEFAS_FON_GETIRI("GTL"; 1)
=TEFAS_FON_GETIRI("GTL"; 3)
=TEFAS_FON_GETIRI("GTL"; 6)
=TEFAS_FON_GETIRI("GTL"; 12)
```

---

## Kaynak Kod

Tum fonksiyonlarin guncel koduna GitHub'dan ulasabilirsiniz:

**<https://github.com/beyt34/google-app-scripts>**

`myPortfoyApp.gs` dosyasini kendi Google Sheets projenize kopyalamaniz yeterli.

---

## Sonuc

Bu yapiyi kurmanin asil degeri, kontrolun bende olmasi. Bir API degisirse sadece ilgili fonksiyonu guncelliyorum, geri kalan her sey oldugu gibi calismaya devam ediyor. HTML scraping'e dayali bir cozumde ise tek bir site guncellemesi her seyi bozabilir — ki benim basima tam olarak bu geldi.

Eger Google Sheets'te yatirim takibi yapiyorsaniz ve verileriniz artik guvenilmez hale geldiyse, bence bu yaklasimdaki asil kazanim sudur: hangi veriyi nereden cektiginizi bilmek ve bunu kontrol edebilmek.
