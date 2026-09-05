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

## 4. SEO, amit a projekt automatikusan kezel

- Minden oldalhoz egyedi `<title>`, meta leírás, canonical URL, Open Graph és Twitter Card
- JSON-LD strukturált adat: `Review`/`Product` séma értékeléssel rendelkező cikkekhez (ez
  teszi lehetővé a csillagos értékelés megjelenését a Google találatokban), `FAQPage`
  (az előnyök/hátrányok listából automatikusan), `BreadcrumbList`, `WebSite`, `Organization`
- Article altípusok (`BlogPosting`/`Article`) `wordCount` és `timeRequired` mezőkkel
- Dinamikus `sitemap.xml` és `robots.txt`
- RSS feed a `/rss.xml` alatt
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
főbb oldalakra (főoldal, legfrissebb cikk, egy kategória, egy címke — az URL-eket a
`scripts/resolve-audit-urls.mjs` oldja fel az adatbázisból), és a `lighthouserc.js`
`assert` szakaszában lévő küszöbértékekhez hasonlítja:

- **Performance ≥ 80**
- **Accessibility ≥ 90**
- **Best Practices ≥ 90**
- **SEO ≥ 95**

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
- Termék-összehasonlító táblázatok több teszt között
