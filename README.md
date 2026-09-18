# Terméktesztelő Blog

Igényes, modern Next.js alapú terméktesztelő blog admin felülettel. Kategóriák, címkék,
értékelés (verdikt-pecsét), előnyök/hátrányok, affiliate linkek, teljes SEO-optimalizálás
(metaadatok, Open Graph, JSON-LD Review séma, sitemap, RSS).

Az adatbázis **SQLite** — nincs szükség külön adatbázis szerverre (PostgreSQL, MySQL stb.),
minden egyetlen fájlban tárolódik a szerveren. Ez a beállítás kifejezetten egy egyszerű
DigitalOcean droplet (vagy bármilyen sima VPS) telepítéshez lett kialakítva.

## Technológiák

- **Next.js 14** (App Router, TypeScript)
- **Prisma + SQLite** — adatbázis, nincs külön DB szerver
- **Tailwind CSS** — egyedi designrendszerrel
- Saját, könnyűsúlyú admin bejelentkezés (JWT + bcrypt, NextAuth nélkül — egyetlen adminnak nem kell)
- **react-markdown** — a cikkek Markdown formátumban íródnak, a beépített szerkesztő eszköztárral
- Helyi képfeltöltés (`public/uploads`)

## Fájlstruktúra dióhéjban

```
src/app/(site)/         → publikus oldalak (főoldal, cikk, kategória, címke, keresés)
src/app/admin/          → admin felület (bejelentkezés + irányítópult)
src/app/api/admin/      → admin API végpontok (posztok, kategóriák, címkék, feltöltés)
src/components/site/    → publikus komponensek
src/components/admin/   → admin komponensek
src/lib/                → Prisma kliens, session/JWT, SEO helperek, validáció
prisma/schema.prisma    → adatbázis séma
prisma/seed.ts          → admin felhasználó + minta kategóriák létrehozása
deploy/                 → Nginx minta konfig, backup script
ecosystem.config.js     → PM2 konfiguráció
```

---

## 1. Helyi fejlesztés

Előfeltétel: Node.js 20+ és npm.

```bash
npm install
cp .env.example .env
```

Nyisd meg a `.env` fájlt, és állítsd be:

- `JWT_SECRET` — generálj egy hosszú, véletlen stringet: `openssl rand -base64 48`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — ezzel tudsz majd bejelentkezni az admin felületre
- `NEXT_PUBLIC_SITE_URL` — helyi fejlesztéshez maradhat `http://localhost:3000`

Ezután hozd létre az adatbázist és töltsd fel alapadatokkal (admin felhasználó + minta
kategóriák/címkék):

```bash
npx prisma migrate dev --name init
npm run db:seed
```

Indítsd el a fejlesztői szervert:

```bash
npm run dev
```

- Publikus oldal: http://localhost:3000
- Admin felület: http://localhost:3000/admin/login (a `.env`-ben megadott e-maillel/jelszóval)

---

## 2. Éles telepítés DigitalOcean dropletre (PM2 + Nginx, PostgreSQL nélkül)

Ez a menet egy sima Ubuntu droplet-et feltételez, Docker és külön adatbázis-szerver nélkül.

### 2.1 Node.js és PM2 telepítése a droplet-en

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2.2 A projekt feltöltése

Töltsd fel a projektet a droplet-re (pl. `git clone` a saját repódból, vagy `scp -r`),
javasolt hely: `/var/www/termektesztelo`.

```bash
cd /var/www/termektesztelo
npm install
```

### 2.3 `.env` beállítása éles értékekkel

```bash
cp .env.example .env
nano .env
```

Fontos különbségek a helyi fejlesztéshez képest:

- `DATABASE_URL="file:/var/www/termektesztelo/prisma/prod.db"` — **abszolút útvonal**
  ajánlott éles környezetben, hogy egy esetleges munkakönyvtár-váltás se okozzon problémát.
- `JWT_SECRET` — generálj **új**, egyedi értéket éles környezethez (`openssl rand -base64 48`),
  ne használd a fejlesztői gépeden lévőt.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — az admin belépési adataid. A jelszót seedelés után is
  megváltoztathatod közvetlenül az adatbázisban, vagy újra futtathatod a seedet más jelszóval
  (a seed script `upsert`-tel dolgozik, tehát felülírja a meglévő admin jelszavát).
- `NEXT_PUBLIC_SITE_URL="https://peldablog.hu"` — a végleges domained, `https://`-vel.
  Ez kerül bele a sitemap-be, az RSS feedbe és minden SEO metaadatba, ezért fontos, hogy
  pontos legyen.

### 2.4 Adatbázis létrehozása és build

```bash
npx prisma migrate deploy
npm run db:seed
npm run build
```

A `npx prisma migrate deploy` létrehozza a `prisma/prod.db` SQLite fájlt a séma alapján.

### 2.5 Indítás PM2-vel

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # kövesd a kiírt utasítást, hogy szerver-újraindításkor is induljon
```

Hasznos PM2 parancsok:

```bash
pm2 status
pm2 logs termektesztelo-blog
pm2 restart termektesztelo-blog
```

### 2.6 Nginx reverse proxy + HTTPS

Telepítsd az Nginx-et és a Certbot-ot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Másold be a `deploy/nginx.conf.example` fájlt mintaként (cseréld le a domaint és az
útvonalakat), majd:

```bash
sudo ln -s /etc/nginx/sites-available/termektesztelo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d peldablog.hu -d www.peldablog.hu
```

Ezután az oldal `https://peldablog.hu` alatt elérhető, a Certbot pedig automatikusan
gondoskodik az SSL tanúsítvány megújításáról.

### 2.7 Képfeltöltések perzisztenciája

A feltöltött képek a `public/uploads` mappába kerülnek, közvetlenül a droplet lemezére —
mivel ez egy sima VPS (nem szerver nélküli/konténeres környezet felhő tárolóval), ez a
mappa a szerver újraindítása után is megmarad. Érdemes időnként lementeni ezt a mappát is
(pl. `rsync`-kel egy másik gépre), hasonlóan az adatbázis fájlhoz.

### 2.8 Adatbázis mentés

A `deploy/backup-db.sh` script naponta lementi a SQLite fájlt egy külön mappába, és 30 napnál
régebbi mentéseket töröl. Állítsd be cron jobként:

```bash
crontab -e
# add hozzá:
0 3 * * * /var/www/termektesztelo/deploy/backup-db.sh
```

### 2.9 Frissítés (új verzió kiadása)

```bash
cd /var/www/termektesztelo
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart termektesztelo-blog
```

---

## 3. Tartalomkezelés

Jelentkezz be a `/admin/login` oldalon. Az admin felületen:

- **Áttekintés** — gyors statisztikák, legutóbb szerkesztett bejegyzések
- **Bejegyzések** — új teszt írása, szerkesztés, törlés. A szerkesztő négy fülre van osztva:
  - *Tartalom*: cím, URL, összefoglaló, borítókép, Markdown szerkesztő (eszköztárral és
    élő előnézettel)
  - *Termék adatok*: termék neve/márkája, 0–10 értékelés (ez jelenik meg a verdikt-pecsétben
    és a Google-ben csillagos értékelésként), előnyök/hátrányok listák, végső verdikt szöveg,
    affiliate/vásárlási link
  - *SEO*: egyedi keresőoptimalizált cím és leírás, egyedi megosztási kép
  - *Beállítások*: kategória, címkék (begépelve automatikusan létrejönnek), publikálási állapot
- **Kategóriák** / **Címkék** — létrehozás, átnevezés, törlés. Kategória csak akkor törölhető,
  ha nincs hozzá tartozó bejegyzés.

Minden mentés után a publikus oldal érintett részei (főoldal, az adott cikk, kategória oldal,
sitemap) azonnal frissülnek — nincs szükség újraindításra vagy külön cache-ürítésre.

### 18+ korhatár-kapu (szexuális jellegű termékek tesztjei)

A blogon előfordulhatnak felnőtt termékekről szóló tesztek (pl. szexuális segédeszközök).
Ezek a cikkek a kiskorúak védelme érdekében **csak 18 éven felülieknek** érhetők el:

- A cikkoldal helyett egy **korhatár-kapu** jelenik meg, amelyen a látogatónak nyilatkoznia
  kell arról, hogy elmúlt 18 éves (és a nyilatkozatot el kell fogadnia).
- A cikk **teljes tartalma szerveroldalon marad vissza**: elfogadás előtt a szöveg a HTML-be sem
  kerül bele, így a kapu nem kerülhető meg kliens-oldali trükkel.
- Az elfogadást egy `adult-consent` süti tárolja (30 napig), ezen kívül **nem gyűjtünk és nem
  tárolunk semmilyen személyes adatot** (nincs regisztráció, életkor- vagy okmányadat).
  A „Nem vagyok 18 éves” választás nem nyitja meg a cikket, csak a többi cikket ajánlja fel.
- A listakártyákon és a keresőtalálatokon **18+ jelzés** figyelmeztet előre, a cikk metaadataiban
  pedig `<meta name="rating" content="adult">` jelzi a tartalom jellegét.

A 18+ cikkeket a rendszer **automatikusan** ismeri fel a cím, az összefoglaló, a terméknév/márka,
valamint a címkék és a kategória alapján (erős kulcsszavak: pl. szexjáték, dildó, pornó;
gyenge, súlyozott jelzések: pl. intim, kegel). Az éppen kapu alá eső cikkek listája ellenőrizhető:

```bash
npm run adult:check
```

Ha egy cikk tévesen került a kapu alá (vagy épp kimaradna), a `src/lib/adultContent.ts`
`MANUAL_SAFE_SLUGS`, illetve `MANUAL_ADULT_SLUGS` listájában kézzel felülírható.
A szabályrendszer és a süti állandói (`ADULT_CONSENT_*`) ugyanebben a fájlban vannak.

### Termékosztály-toplisták ("legjobb air fryer", "legjobb porszívó")

A kategórianevek ("Otthon és konyha") nem keresési szándékok — senki nem írja be őket a Google-be.
A valódi kereslet termékosztály-szinten van ("legjobb air fryer 40 ezer alatt"), ezért a
`/legjobb/{slug}` útvonal kétfajta rangsort szolgál ki:

- **termékosztály** (pl. `/legjobb/air-fryer`) — a `src/lib/productClasses.ts` regiszterből,
  kulcsszó-alapú besorolással, kategóriától függetlenül, saját ársávokkal és bevezető szöveggel;
- **kategória** (pl. `/legjobb/otthon-es-konyha`) — a szélesebb gyűjtőoldal, változatlanul.

A besorolás a **cím + terméknév/márka + címkék** alapján történik, ékezet nélküli szövegen, szó
eleji egyezéssel (a "porsziv" kulcsszó így a "porszívóval" alakot is elkapja, a "eger" viszont
nem illeszkedik a "keverő" szóra). Az összefoglalót szándékosan nem használjuk: az gyakran
hasonlítja a terméket egy másik osztályhoz ("nem hajformázó, hanem szárító"), és ilyenkor a
termék átkerülne a másik listába. A kiegészítők, tartozékok, pótaskatrészek és szakácskönyvek
kimaradnak a rangsorokból (`isAccessoryPost`), mert egy "legjobb X" listában nem termékek.

Az osztály-oldalakon a rangsor mellé **szerkesztői tartalom** is kerül a
`src/lib/productClassContent.ts`-ből: „Mire figyelj X vásárlásnál?" (3 tanács), „Mik alapján
rangsoroltunk?" (3 átlátható szempont) és „Gyakori kérdések" (4 kérdés-válasz, amiből a
`FAQPage` séma is épül — a Google elvárása szerint ugyanaz látható az oldalon). A szöveg
osztályonként egyedi, mert a sablonos, minden oldalon ismétlődő blokk pont az, amit a kereső
duplikált tartalomként kezel. A tanácsok vásárlási szempontok, nem saját mérési állítások —
a pontszámok a blogon megjelent tesztek értékelései.

Új osztály felvétele: egy bejegyzés a `PRODUCT_CLASSES` tömbben (slug, név, kategória, kulcsszavak,
opcionális kizárások, ársávok, bevezető), és hozzá a szöveges tartalom a
`PRODUCT_CLASS_CONTENT` térképben (ha nincs, a listaoldal tartalom nélkül, de hibátlanul
megjelenik). Ellenőrzés:

```bash
npm run classes:check   # osztályonkénti cikkszám + példacímek
```

A 3 cikk alatti osztályok ugyanúgy `noindex, follow`-t kapnak és kimaradnak a sitemapből, mint a
vékony címkeoldalak (`MIN_POSTS_FOR_PRODUCT_CLASS`). A toplista-oldalak és a cikkek kölcsönösen
linkelik egymást: a kategóriaoldal a saját osztályait, a cikkoldal pedig a hozzá tartozó
osztály-toplistákat sorolja fel ("A kategória legjobbjai").

## 4. SEO, amit a projekt automatikusan kezel

- Minden oldalhoz egyedi `<title>`, meta leírás, canonical URL, Open Graph és Twitter Card
- **OG/Twitter kép minden oldalon**: a Next.js metadata shallow merge-t használ — ha egy oldal saját
  `openGraph`-ot ad meg, az felülírja a layoutét, ezért az `images`-t mindig explicit módon kell megadni.
  Erre való a `defaultOgImages()` segéd a `src/lib/seo.ts`-ben (a `DEFAULT_OG_IMAGE` konstansból).
  Új oldalnál, ha saját OG-t adsz meg, mindig add hozzá az images-t is!
- JSON-LD strukturált adat: `Review`/`Product` séma értékeléssel rendelkező cikkekhez (ez
  teszi lehetővé a csillagos értékelés megjelenését a Google találatokban), `FAQPage`
  (az előnyök/hátrányok listából automatikusan), `BreadcrumbList`, `WebSite`, `Organization`
- Article altípusok (`BlogPosting`/`Article`) `wordCount` és `timeRequired` mezőkkel
- Dinamikus `sitemap.xml` és `robots.txt`
- **Crawl budget kímélése**: a vékony listaoldalak (címke-, márka- és kategóriaoldal
  `MIN_POSTS_FOR_LISTING_INDEX = 3` publikált cikk alatt, valamint minden 2. és további lapozott
  oldal) `noindex, follow`-t kapnak — nem indexeljük őket, de a bennük lévő linkeket követjük,
  így a crawler továbbra is eljut a cikkekhez. Ugyanez a küszöb szűri a sitemapet: a
  egy-két cikkes címke- és márkaoldalak (a törzskészlet nagy része) kimaradnak belőle.
  A szabály egy helyen van: `MIN_POSTS_FOR_LISTING_INDEX` + `listingRobots()` a `src/lib/seo.ts`-ben.
- RSS feed a `/rss.xml` alatt
- **Dinamikus OG-képek**: minden cikk (`/blog/{slug}/og`) és toplistalap (`/legjobb/{slug}/og`)
  saját, kérelemkor renderelt megosztási képet kap (cím, terméknév, pontszám) — sharp + SVG
  úton, a site arculatával. A cikkeknél az admin `ogImage` override-ja elsőbbségű.
  (A Next 14 `next/og` satori-alapú `opengraph-image.tsx` konvenciója Windows-on modul-
  betöltési hibával elszáll, ezért nem az van használva — lásd `src/lib/ogImage.ts` fejlécét.)
- **`npm run seo:audit`** — build/deploy után futtatható audit: lekéri a fő oldaltípusok
  (főoldal, cikk, kategória, címke, márka, toplistalap, szezonális hubok) HTML-jét egy futó
  szerverről, és hibát jelez, ha hiányzik az og:image, a canonical vagy az elvárt JSON-LD.
  Az URL-eket az adatbázisból oldja fel (a legtöbb cikkel), a 18+ cikkeket kikerüli.
  Cél URL: `SEO_AUDIT_BASE_URL=http://localhost:3100 npm run seo:audit`
- Képoptimalizálás a `next/image`-dzsel (a `sharp` csomag telepítve van hozzá)
- Szemantikus HTML, olvasható URL-ek (ékezetes címekből is helyes, ékezet nélküli slug készül)

## 5. Indulás előtti teendő: saját arculati elemek

A projekt kódja hivatkozik néhány képfájlra, amit neked kell feltöltened a `public/` mappába,
mert ezek márkaspecifikusak (a JSON-LD strukturált adat és a közösségimédia-megosztás ezekre
támaszkodik):

- `public/logo.png` — négyzetes logó (ajánlott: min. 112×112 px), ez kerül a `Organization`
  JSON-LD sémába
- `public/og-default.png` — alapértelmezett megosztási kép (ajánlott: 1200×630 px), ez jelenik
  meg, ha egy cikkhez nem töltesz fel borítóképet
- `src/app/favicon.ico` — a Next.js automatikusan felismeri, ha ide teszed, nincs hozzá extra
  beállítás

A repóban mostantól **generált, semleges helykitöltő verziók** is megtalálhatók
(`public/logo.png`, `public/og-default.png`, `src/app/icon.png`, `src/app/apple-icon.png`),
tehát a fenti képeknél nem lesz 404 — de **cseréld le őket a saját márkás változataidra**
(pl. a logódra és egy szöveges megosztási képre), mert a generáltak csak alapértelmezések.

## 6. Google Search Console — beküldés és ellenőrzés (SEO-kézikönyv)

Rövid menet, amivel a blogbejegyzések bekerülnek a Google találatai közé. A technikai alap
(sitemap, robots, strukturált adat, meta) készen van a projektben — a Google Search Console
(GSC) oldalán csak az alábbi lépéseket kell elvégezni.

### 6.1 Domain igazolása

1. A https://search.google.com/search-console oldalon add hozzá a tulajdont
   **URL-előtag** típusként: `https://peldablog.hu`.
2. Igazolási módnak a **DNS TXT rekord** a legegyszerűbb (a domain-szolgáltatónál kell
   felvenni, kódot nem érint), vagy a **HTML meta tag**, amit a GSC ad. Utóbbit a
   `src/app/layout.tsx`-be kell beilleszteni — igazolás után akár ki is vehető.

### 6.2 Sitemap beküldése

1. Előbb ellenőrizd, hogy a sitemap elérhető és jól néz ki:

   ```bash
   curl -s https://peldablog.hu/sitemap.xml | head -40
   ```

   Tartalmaznia kell a főoldalt, a kategória- és címkeoldalakat és minden **publikált**
   bejegyzést. Ha nem, valószínűleg a `NEXT_PUBLIC_SITE_URL` rossz a `.env`-ben — ez kerül
   minden URL elejére.
2. GSC → **Sitemaps** → „Új sitemap hozzáadása”: `sitemap.xml` → **Küldés**.
3. A státusz hamarosan „Sikeres” legyen. Ha hibát jelez, kattints a sitemap sorára — a
   jelentés megmutatja, melyik URL-lel van baj.

### 6.3 Indexálási hibák ellenőrzése és javítása

GSC → **Oldalindexelés** (Pages / Indexing) fül:

- **„Feltérképezett, jelenleg nem indexelt”** — a Google látta az oldalt, de nem tartotta
  elég értékesnek (leggyakoribb ok: friss poszt kevés tartalommal vagy hivatkozás nélkül).
  Javíts a poszton, majd a **URL-ellenőrzés** (URL Inspection) eszközben kérd az
  újraindexelést.
- **„Felderített, jelenleg nem indexelt”** — a Google ismeri az URL-t, de még nem mászta
  be. Várj pár napot, vagy kérd az indexelést URL-ellenőrzéssel.
- **404 / lágy 404** — törölt bejegyzések. Ha szándékosan törölted, semmi teendő; ha
  tévedésből, állítsd vissza a posztot.
- **A `noindex` oldalak (keresés, `?page=2+` lapozás) nem hibák** — ez szándékos, hogy ne
  legyen duplikált tartalom.

Új bejegyzés publikálása után a leggyorsabb: a **URL-ellenőrzés** eszközben írd be a cikk
URL-jét, és nyomd meg az **„Indexelés kérése”** gombot.

### 6.4 Amit érdemes rendszeresen nézni

- **Teljesítmény** (Performance) — mely posztokra kattintanak, milyen keresőszavakra
- **Alapvető webes mutatók** (Core Web Vitals) — a képek már optimalizáltak; ha itt
  problémát jelez, a részletek megmondják, melyik oldalon
- A sitemap minden cikkmentéskor automatikusan frissül; a Google napokon belül újra
  bekúszik, de a sitemap újraküldésével (6.2) felgyorsíthatod az indexelést

## 7. Teljesítmény-ellenőrzés (Lighthouse CI)

A `lighthouse:ci` script friss production builden lefuttatja a Lighthouse auditot a
főbb oldalakra (főoldal, legfrissebb cikk, a legtöbb cikket tartalmazó kategória és
címke — az URL-eket a `scripts/resolve-audit-urls.ts` oldja fel az adatbázisból), és a
`lighthouserc.js` `assert` szakaszában lévő küszöbértékekhez hasonlítja:

- **Performance ≥ 80**
- **Accessibility ≥ 90**
- **Best Practices ≥ 90**
- **SEO ≥ 95**

A crawl-budget szabály (6.1) alatti, kevés cikkes listaoldalakon a Lighthouse
`is-crawlable` auditja jogosan bukik — ott a `noindex` nem hiba, hanem szándékos. A
resolver ezért ezeket külön jelöli, és a `lighthouserc.js` **`assertMatrix`-szal**
URL-enként állítja a küszöböt: a szándékosan noindex oldalakra a SEO-küszöb 0.6 (ez
pontosan az `is-crawlable` súlyát engedi el), minden más oldalra a szigorú 0.95 marad,
és a minta negatív lookahead-del fedi le a maradék URL-eket, hogy egy oldal se ússzon
meg ellenőrzés nélkül. (A sima `assertions` érték csak egyetlen `[szint, beállítások]`
párt fogad el — listát adva a Lighthouse CI csendben a saját alapértelmezett 0.9-ére
esik vissza, ezért kell a mátrix.) Ha a fejlesztői/éles adatbázisban van már elég cikk,
a resolver egyet sem jelöl meg, és minden vizsgált oldalra a 0.95-ös küszöb érvényes.

A mérés **valódi (devtools) throttlinggal** történik: a Chrome ténylegesen 4×
CPU-lassítással és mobil hálózati korlátozással tölti be az oldalt, tehát a pontszámok
azt tükrözik, amit egy középkategóriás telefonon valóban látni. (A Lighthouse
alapértelmezett „szimulált” módja ezen az oldalon ~4 s LCP-t jósolt, miközben a valódi
throttled mérés ~2 s — a szimuláció modellje pesszimista a kis, statikus oldalakra.
A hátrány: a devtools mód gépenként kicsit ingadozhat (ugyanazon a gépen is
0.79–0.99 közt szóródhat egy zajos futtatás), ezért a Performance küszöb 0.8.
Referencia értékek (nyugodt gépen): főoldal 0.98, cikk 0.85–0.96, kategória/címke 0.99.)

A cikkoldal **saját kliens JS nélküli** (a megosztó linkek és a view-számláló szerver-
oldali/inline; a mobilmenü csak az első megnyitáskor töltődik), ezért a böngésző
~0.7 s-mal korábban fest (FCP ~1.5 s vs ~2.2 s). A Lighthouse a festés utáni hosszú
feladatokat TBT-ként számolja, így a cikkoldal TBT-je magasabban olvasható ki
(miközben a teljes main-thread munka változatlan — a feladatok csak átcsúsztak a
korábbi festés utánra), ami a Performance pontszámot ~0.85-re mérsékli.

```bash
npm run lighthouse:ci
```

- A build ~1–2 perc, az audit URL-enként ~20–40 mp.
- A HTML/JSON jelentések a `.lighthouseci/` mappába kerülnek (`.gitignore`-olva).
- `LHCI_RUNS=3` növeli az ismétlések számát (stabilabb mérés, lassabb futás).
- **GitHub Actions**: a `.github/workflows/lighthouse.yml` minden push/PR után lefuttatja
  (friss DB-vel, minta tartalommal), a jelentések artifactként letölthetők.
- Küszöbérték-módosítás: a `lighthouserc.js` `assert.assertions` szakasza. Ha egy
  küszöb túl szigorú (pl. a Performance esetében gépenként eltérő a mérés), előbb
  nézd meg a `.lighthouseci/` jelentést, hogy mennyivel csúszik el.

## 8. Lehetséges további bővítések

- Több szerkesztői fiók és jogosultsági szintek (jelenleg szándékosan egyetlen admin van)
- Kép-CDN vagy felhő tárhely (pl. S3-kompatibilis) a `public/uploads` helyett, ha a forgalom
  ezt indokolttá teszi
- Kommentek, hírlevél-feliratkozás
- Interaktív választó a cikkekben (dropdown a compare-partnerek közé)

## 9. Cikken belüli összehasonlító táblázat

A cikkoldalakon a **végső verdikt után** szerver-renderelt táblázat hasonlítja össze a
tesztelt terméket az azonos termékosztályú, tényleg hasonló párokkal („óra csak órával”).
Mobilon a tábla a konténerén belül vízszintesen görgethető (a grid-oszlop `min-w-0`, a
tábla `min-w-[640px]` — így nem húzza szét a layoutot), a linkek tap-targetje ≥36px.

**Szabályok (`src/lib/compare.ts`):**
- Kemény guardok: a partner azonos termékosztályba kell, hogy eszen („ora csak oraval”), nem
  lehet kiegészítő (`isAccessoryPost`), nem lehet 18+ (`isAdultContent`), és kell legyen pontszáma.
- Soft küszöb: `COMPARE_MIN_SCORE = 5` — azonos márka (+3), közös címke (+2), azonos sorozat
  (+2), közeli ársáv (+2/+1), közel egyenrangú pontszám (+1) jelzésekből. Emellett kell közös
  címke VAGY azonos márka is (puszta ár-közelség nem elég).
- Cikkenként max. 2 partner; cím, pontszám, ár, fő előny/hátrány (a cikkből), vásárlás gomb és
  „Részletes teszt →” link. Ha a cikknek nincs ára, az ár helyett `—` jelenik meg.
- A párok mellé „Miért ezek a párok?” magyarázat megy (a match `reasons` alapján).

**Kalibráció és ellenőrzés:** `npm run compare:check` — a valódi adatokon listázza, hány cikk
kap táblázatot és mik a párosok (a küszöb módosításánál mindig ezzel kalibrálj).

### Vs-oldalak (`/osszehasonlitas`)

A cikken belüli párosításból állóoldalak készülnek a „X vs Y" keresésekre:

- **`/osszehasonlitas`** — hub: a minőségi párosok termékosztályonként csoportosítva.
- **`/osszehasonlitas/{a-vs-b}`** — páros oldal: verdikt (pontszám + ár), táblázat, „Miért
  hasonlítjuk őket?" magyarázat, BreadcrumbList + FAQPage JSON-LD. **Csak él, ha a compare-motor
  minősíti a párost** (azonos osztály, pontozott, nem kiegészítő, nem 18+, küszöb) — minden más
  slug 404, a URL-t nem lehet rossz párossal megbukni.
- **Canonical az ábécérendi slug**: a csere-sorrend 308-as permanent redirect-tel odairányít.
- **Sitemap-szűrés**: csak a `VS_SITEMAP_MIN_SCORE` (9) pontot elérő, `VS_SITEMAP_LIMIT` (150)
  darab páros indexelhető és kerül a sitemapbe + a hub; a többi élő páros **noindex, follow**.
  Így a vs-oldalak tömege nem eszi meg a crawl budgetet (a címke-lecke alkalmazása).
- A cikken belüli táblázatban a minőségi párosokra „Párharc →" link visz.
- Buktató: a blogcikk-címek is tartalmazhatnak `-vs-`-t, ezért a URL-feloldás (`resolveComparePair`)
  a pool ellen próbálja ki az összes szétvágási pontot — ne egyszerűsítsd első `-vs-` vágásra.

**Fontos:** az osztály-besorolás memoizált modulszinten — új compare-forrás (pl. vs-oldal)
hozzáadásakor győződj meg róla, hogy a `findCompareMatches` hívás nem kerül per-kérés
súrlószáraz ismétlésbe.
