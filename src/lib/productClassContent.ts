/**
 * Szerkesztői tartalom a termékosztály-toplistákhoz: vásárlási tanácsok,
 * rangsorolási szempontok és gyakori kérdések.
 *
 * Miért külön fájl? A `productClasses.ts` a besorolás logikáját tartalmazza
 * (kulcsszavak, ársávok), ez pedig a szöveges tartalmat. A két dolog eltérő
 * ütemben változik: a kulcsszabályt akkor igazítjuk, ha új terméktípus kerül
 * a blogra, a szöveget pedig akkor, ha a vásárlói kérdések változnak.
 *
 * Fontos: ezek vásárlási szempontok és általános tanácsok, NEM saját mérések.
 * A szöveg ezért nem állítja, hogy mi mértük volna az adatokat - a pontszámok
 * a blogon megjelent tesztek értékelései (lásd /rolunk).
 */

export type ProductClassContent = {
  /** "Mire figyelj ... vásárlásnál?" - 3 tanács, rövid, döntést segítő mondatokkal. */
  tips: { title: string; text: string }[];
  /** "Mik alapján rangsoroltunk?" - átlátható szempontok (E-E-A-T). */
  criteria: { title: string; text: string }[];
  /** Gyakori kérdések - a látható szöveg és a FAQPage séma ugyanebből épül. */
  faq: { q: string; a: string }[];
};

export const PRODUCT_CLASS_CONTENT: Record<string, ProductClassContent> = {
  'air-fryer': {
    tips: [
      {
        title: 'A kapacitást az adaghoz mérd',
        text: '4-5 liter két személynek elég, 6-8 liter egy négytagú családnak. A túl nagy kosár lassabban melegszik fel, a kicsiben pedig egymásra ragad az étel.',
      },
      {
        title: 'A kosár formája a liternél is fontosabb',
        text: 'A széles, lapos kosárban egyenletesebben sül a feltét, a keskeny és magas kosárban könnyebben megég a teteje. A kivehető, mosogatógépben tisztítható betét nagy könnyebbség.',
      },
      {
        title: 'Nézd meg a pótalkatrész-ellátást',
        text: 'A kosár, a rács és a szűrő kopó alkatrész: ha egy év múlva nem kapható pótlás, a gép használhatatlan lesz. Ez a tartósság valódi mércéje.',
      },
    ],
    criteria: [
      {
        title: 'Elért pontszám',
        text: 'A blogon megjelent teszt értékelése: sütési eredmény, kezelhetőség, tisztíthatóság és a hétköznapi használhatóság együtt.',
      },
      {
        title: 'Ár-érték az adott ársávban',
        text: 'Nem abszolút árban hasonlítunk: egy 30 ezer forintos gép csak az azonos árú modellekhez mérhető. Ezért bontottuk ársávokra a rangsort.',
      },
      {
        title: 'Hosszú távú használat',
        text: 'Mennyire egyszerű a tisztítás, mennyire hangos, és mennyire kényelmes a mindennapi vezérlés - ezek döntenek 3 hónap után, nem a csomagolás.',
      },
    ],
    faq: [
      {
        q: 'Mennyi olajat használ egy air fryer?',
        a: 'Gyakorlatilag egy evőkanálnyit vagy semennyit. A keringtetett forró levegővel sül az étel, ezért a hagyományos olajsütőhöz képest nagyságrendekkel kevesebb olaj is elég a ropogós eredményhez.',
      },
      {
        q: 'Air fryer vagy olajsütő - melyiket válasszam?',
        a: 'Nagy adaghoz és klasszikus bundához az olajsütő a biztosabb választás. Ha gyorsan, kevés olajjal és kevesebb szaggal főznél, és a sütés mellett melegítenél, grilleznél is, az air fryer a praktikusabb.',
      },
      {
        q: 'Mennyi idő alatt melegszik fel egy air fryer?',
        a: 'A legtöbb modell 2-4 perc alatt éri el a 180 fokot. A felfűtés kihagyható, ha a sütési időt pár perccel meghosszabbítod, de az egyenletes eredményhez az előmelegítés segít.',
      },
      {
        q: 'Miért lesz hangos az air fryer?',
        a: 'A belső ventilátor és a levegőkeringtetés adja a zajt, jellemzően 55-65 dB-t. A kisebb, kompaktabb gépek gyakran halkabbak, de lassabban is végeznek egy nagyobb adaggal.',
      },
    ],
  },

  'konyhai-robotgep': {
    tips: [
      {
        title: 'Dagasztáshoz a hajtás számít, nem csak a watt',
        text: 'Sűrű kenyértésztához legalább 800 W és fém hajtómű ajánlott. A kisebb motor rövid távon elviszi a feladatot, hosszú távon viszont túlmelegszik.',
      },
      {
        title: 'Csak azt a tartozékot nézd, amit tényleg használsz',
        text: 'Ha nem darálsz húst és nem préselsz tésztát, a dagasztókar, a habverő és a tál mérete fontosabb - így nem fizetsz olyan funkcióért, ami a fiókban marad.',
      },
      {
        title: 'A tál anyaga a tisztítást dönti el',
        text: 'A fém tál a legtartósabb, az üveg látványos és mosogatógépben tisztítható, a műanyag könnyű, de könnyebben karcolódik és szagot vehet fel.',
      },
    ],
    criteria: [
      {
        title: 'Terhelhetőség',
        text: 'Mennyire bírja a folyamatos, sűrű tészta dagasztását - ez a leggyakoribb meghibásodási pont a konyhai gépeknél.',
      },
      {
        title: 'Kapacitás és tartozékkészlet',
        text: 'A tál mérete és a valóban használható tartozékok köre: ezek határozzák meg, mennyire illik a gép a család méretéhez.',
      },
      {
        title: 'Kezelhetőség',
        text: 'Sebességfokozatok, tisztíthatóság, helyigény és zaj. A nagy teljesítmény sem ér semmit, ha használat után 20 perc a mosogatás.',
      },
    ],
    faq: [
      {
        q: 'Milyen teljesítmény kell a kenyértészta dagasztásához?',
        a: 'Legalább 800 W és fém hajtómű ajánlott. A sűrű tészta nagy terhelést jelent, ezért a kisebb teljesítményű gépek motorja hosszú távon gyorsan elfárad.',
      },
      {
        q: 'Konyhai robotgép vagy kézi mixer?',
        a: 'Rendszeres sütéshez, dagasztáshoz a robotgép a jobb választás, alkalmi habveréshez a kézi mixer is elég. A robotgép akkor éri meg, ha legalább hetente használod.',
      },
      {
        q: 'Elég az 5 literes tál egy négytagú családnak?',
        a: 'Általában igen: 4-5 liter 2-3 főnek kényelmes, egy nagyobb családnak az 5-7 literes tál az ideális. Süteménynél a tál ne legyen csordultig, mert a keverés közben terjed a massza.',
      },
      {
        q: 'Meddig bírja egy konyhai robotgép?',
        a: 'Heti néhány használat mellett a jobb gépek 5-10 évig is elmennek, a leggyakrabban a motor és a hajtómű megy tönkre. Ezt a terhelés és a karbantartás (tisztítás, kenés) nagyban befolyásolja.',
      },
    ],
  },

  'robotporszivo': {
    tips: [
      {
        title: 'A navigáció nem extra, hanem alap',
        text: 'Lézeres (LiDAR) térképezés vagy kamerás navigáció nélkül a robot összevissza jár és elakad. Ez az a pont, ahol a legtöbbet lehet spórolni - és a legtöbbet bosszankodni.',
      },
      {
        title: 'A kefe típusát a padlóhoz válaszd',
        text: 'Szőnyeghez a gumi- és szőrkeverő kefe, kemény padlóhoz a finomabb, puha kefe a jó. A szívóerő (Pa) önmagában félrevezető, mert a kefe és a tömítés is számít.',
      },
      {
        title: 'Az állomás hosszú távú költség is',
        text: 'Az önürítős, mosó- és szárítófunkciós állomás kényelmes, de a porzsák, a szűrő és a tisztítószer rendszeres kiadás. Számold hozzá a gép árához, mielőtt a drágább modellt választod.',
      },
    ],
    criteria: [
      {
        title: 'Takarítási lefedettség',
        text: 'Mennyire járja be a lakást, mennyire dolgozza ki a sarkokat, és mennyire akad el szőnyegen vagy küszöbön.',
      },
      {
        title: 'Szívóerő és kefetípus',
        text: 'A szívóteljesítmény és a kefe együtt határozza meg, mit szed fel a padlóról és mit a szőnyegből - a Pa érték önmagában nem dönt.',
      },
      {
        title: 'Karbantartás és zaj',
        text: 'Porzsák és szűrő csere, a kefe tisztítása, a tartály ürítése és az üzem közbeni hangerő: ezek a napi használat valódi költségei.',
      },
    ],
    faq: [
      {
        q: 'Milyen szívóerő kell a robotporszívóhoz?',
        a: 'A gyártói ajánlások jellemzően 2000-4000 Pa között mozognak kemény padlóra, szőnyeghez pedig 4000 Pa fölött javasolnak. Fontos, hogy a szívóerőt a kefe minőségével együtt érdemes nézni, mert a legjobb szám sem segít, ha a kefe nem dolgozza fel a szőnyeget.',
      },
      {
        q: 'Mennyi idő alatt takarít végig egy lakást?',
        a: 'Egy 60-80 m²-es lakást a legtöbb modell 60-120 perc alatt jár végig. A szűk helyek, a bútorok alatti rés és a szőnyegek száma növeli ezt az időt.',
      },
      {
        q: 'Megéri az önürítős állomás?',
        a: 'Kényelmi szempontból igen: hetekig nem kell a tartállyal foglalkozni. Cserébe a porzsák és a szűrők rendszeres költséget jelentenek, ezért érdemes utána nézni a hozzájuk tartozó fogyóeszközök árának is.',
      },
      {
        q: 'Kell a robotporszívó mellé külön porszívó?',
        a: 'A legtöbb háztartásban igen: a robot a napi por és szőr eltakarítására való, a magasban lévő felületekhez, a kanapéhoz és a mélyebb szőnyegtisztításhoz kézi vagy rudas porszívó kell.',
      },
    ],
  },

  'porszivo': {
    tips: [
      {
        title: 'Az akkuidőt a lakás méretéhez mérd',
        text: 'Egy 60 m²-es lakás 20-30 perc alatt végigtakarítható, de a szőnyeges, bútorokkal teli otthonhoz 40-60 perc üzemidő a biztonságos. Az akku később nem bővíthető, ezért ne itt spórolj.',
      },
      {
        title: 'A súly és a tartály mérete a mindennapokban számít',
        text: 'A 3 kg körüli vezeték nélküli porszívó még kényelmes, efelett a hosszabb takarítás fárasztó. A kisebb tartályt gyakrabban kell üríteni, ami porral jár.',
      },
      {
        title: 'Allergiánál a szűrés a fő szempont',
        text: 'Hepa szűrő és jó tömítés nélkül a finom por visszajut a levegőbe. A ciklonos rendszer és a mosható szűrő hosszú távon kevesebb költség.',
      },
    ],
    criteria: [
      {
        title: 'Szívási teljesítmény és szűrés',
        text: 'Mennyire szedi fel a finom port és a szőrt, és mennyire tartja vissza a szűrő - padlón, szőnyegen és résekben.',
      },
      {
        title: 'Üzemidő és használhatóság',
        text: 'Mennyi a valós üzemidő a legnagyobb fokozaton, mennyi a töltés, és mennyire kényelmes a gép használat közben (súly, tartály, kiefe menedzsment).',
      },
      {
        title: 'Karbantartási költség',
        text: 'Szűrő, porzsák, pót akkumulátor és a kefe cseréje - a hosszú távú fenntartás gyakran többet nyom a latban, mint a vételár.',
      },
    ],
    faq: [
      {
        q: 'Mennyi akkuidőre van szükség?',
        a: 'Kis lakásba 20-30 perc, nagyobb, szőnyeges otthonba 40-60 perc üzemidő kényelmes. A gyártói adatok gyakran a legalacsonyabb fokozatra vonatkoznak, ezért a valós üzemidő általában rövidebb.',
      },
      {
        q: 'Vezeték nélküli vagy vezetékes porszívó?',
        a: 'Mindennapi gyors takarításhoz a vezeték nélküli a praktikusabb, alapos, hosszú takarításhoz viszont a vezetékes erősebb és fáradhatatlan. Sok háztartásban a kettő együtt működik jól.',
      },
      {
        q: 'Kell hepa szűrő a porszívóba?',
        a: 'Allergiásoknak és porérzékenyeknek ajánlott, mert visszatartja a legfinomabb részecskéket. Egészséges háztartásban a jó tömítésű, ciklonos rendszer is elegendő.',
      },
      {
        q: 'Milyen gyakran kell szűrőt tisztítani?',
        a: 'A mosható szűrőt havonta-kéthavonta érdemes vízzel átöblíteni, és teljesen megszárítva visszahelyezni. A porzsákot 1-3 havonta cserélni kell, a használat intenzitásától függően.',
      },
    ],
  },

  'okostv': {
    tips: [
      {
        title: 'A fényerő és a HDR kezelése a leglátványosabb különbség',
        text: 'Világos nappaliba a magasabb fényerejű (nits) panel és a jó HDR-kezelés többet számít, mint a felbontás. Sötét szobába viszont az OLED mélysége verhetetlen.',
      },
      {
        title: 'Konzolhoz a HDMI 2.1 és a 120 Hz kell',
        text: 'Ha PS5 vagy Xbox Series X a nappaliban, a HDMI 2.1, a 120 Hz és a VRR támogatás a fontos. Enélkül a konzol a legszebb játékainál is korlátozva lesz.',
      },
      {
        title: 'Az okosrendszer sebességét ne hagyd ki',
        text: 'A tévé 5-10 évig szolgál, az appok viszont folyamatosan nehezednek. A gyorsabb processzor és a rendszeres frissítések később sokkal kevésbé bosszantók.',
      },
    ],
    criteria: [
      {
        title: 'Képminőség',
        text: 'Fekete szintek, fényerő, mozgáskezelés és a HDR valódi megjelenítése - a teszteket ezek alapján pontoztuk.',
      },
      {
        title: 'Csatlakozók és játékhoz szükséges funkciók',
        text: 'HDMI 2.1, 120 Hz, VRR, ALLM: ezek döntik el, mennyire használható a tévé konzollal vagy PC-vel.',
      },
      {
        title: 'Okosrendszer és hang',
        text: 'Mennyire gyors a menü, milyen appok érhetők el, és mennyire elfogadható a beépített hang - vagy kell-e soundbar mellé.',
      },
    ],
    faq: [
      {
        q: 'Mekkora tévét vegyek a szobába?',
        a: 'Ülőtávolság / 1,6 körül érdemes számolni a 4K felbontásnál: 2,5 méterről a 65 hüvelyk, 3 méterről a 75 hüvelyk kényelmes. A mérethez a szoba mérete és a fal távolsága is számít, ne csak a nappali szélessége.',
      },
      {
        q: 'OLED vagy QLED?',
        a: 'Sötét szobába, filmekhez és a tökéletes feketéhez az OLED, világos nappaliba és magas fényerőhöz a QLED (Mini LED) jobb. Beégés-veszélye az OLED-nek van, de a mai modelleknél ez a hétköznapi használatban ritka.',
      },
      {
        q: 'Elég a 60 Hz játékhoz?',
        a: 'Filmezéshez és alkalmi játékhoz igen, komolyabb konzolos vagy PC-s játékhoz viszont a 120 Hz-es panel és a VRR ad simább képet. Ha a vételár közel azonos, érdemes a 120 Hz-es modellt választani.',
      },
      {
        q: 'Kell külön soundbar a tévéhez?',
        a: 'A vékony tévék beépített hangja jellemzően vékony és zárt. Filmnézéshez, sorozatokhoz egy belépő soundbar is látványosan javítja az élményt, és gyakran olcsóbb, mint a magasabb kategóriás tévé.',
      },
    ],
  },

  'olajsuto': {
    tips: [
      {
        title: 'A kapacitás és az olajmennyiség együtt számít',
        text: '2-3 liter olaj 4-6 főnek elég, de a nagyobb tartály több olajat igényel, amit cserélni kell. A kisebb gép gyakrabban kerül elő, viszont kisebb adagokat süt.',
      },
      {
        title: 'A szag- és gőzelszívás a konyha mérete miatt fontos',
        text: 'Zárt, szűrős fedelű modelleknél kevesebb szag terjed a lakásban. Kis konyhába ez gyakran fontosabb, mint a néhány ezer forintos árkülönbség.',
      },
      {
        title: 'A tisztítható alkatrészek száma dönti el a használat gyakoriságát',
        text: 'Kivehető, mosogatógépben tisztítható kosár és mosható szűrő: enélkül a gép használat után sokáig a szekrényben marad.',
      },
    ],
    criteria: [
      {
        title: 'Sütési eredmény',
        text: 'Egyenletes átsülés, ropogós külső és a hőmérséklet tartása a teljes sütés alatt - ezt értékelik a tesztek.',
      },
      {
        title: 'Kezelhetőség és biztonság',
        text: 'Hőfokszabályozás, időzítő, automatikus kikapcsolás, hideg fal és a fedél biztonságos nyitása.',
      },
      {
        title: 'Tisztíthatóság',
        text: 'Mennyire egyszerű az olajszűrés, a kosár és a szűrő tisztítása, és mennyire szagmentes a használat után a konyha.',
      },
    ],
    faq: [
      {
        q: 'Mennyi olaj kell egy olajsütőbe?',
        a: 'A modellek jellemzően 1,5-3 liter olajat igényelnek. A minimum szint alá nem érdemes menni, mert az étel nem sül át egyenletesen, és a magas szintnél kifuthat az olaj.',
      },
      {
        q: 'Meddig használható ugyanaz az olaj?',
        a: 'A fáradt olaj sötétedik, habzik és szagot kap - ilyenkor cserélni kell. Többszöri használatnál a szűrés és a hűvös, sötét tárolás jelentősen meghosszabbítja az élettartamát.',
      },
      {
        q: 'Olajsütő vagy air fryer?',
        a: 'Nagy adaghoz és klasszikus bundához az olajsütő, kevesebb olajhoz és gyorsabb, szagtalanabb sütéshez az air fryer jobb. A két gép funkciója részben átfed, ezért ritkán éri meg mindkettő.',
      },
      {
        q: 'Hogyan lesz ropogós a sült krumpli az olajsütőben?',
        a: 'A kétszeri sütés a titka: először alacsonyabb hőfokon átfő a burgonya, majd magasabb fokon kap ropogós héjat. A sütés előtti alapos szárítás és a nem túl zsúfolt kosár szintén sokat számít.',
      },
    ],
  },

  'okostelefon': {
    tips: [
      {
        title: 'A szoftveres támogatás hossza legalább annyit ér, mint a kamera',
        text: 'A hosszabb frissítési ígéret biztonságosabb és hosszabb élettartamot ad. Ez az a pont, ahol az olcsóbb készülék 3 év múlva drágábbnak bizonyulhat.',
      },
      {
        title: 'A kamerát a valós fényviszonyok alapján ítéld meg',
        text: 'A nappali tesztek szinte mindenhol szépek. Az esti, mozgó felvételek és a gyors exponálás mutatják meg, mennyire használható a kamera a mindennapokban.',
      },
      {
        title: 'Az akku és a töltés tempója',
        text: '5000 mAh fölött a legtöbb felhasználó kényelmesen kijön egy nappal. A gyors töltés és a vezeték nélküli töltés támogatása hosszú távon nagyobb kényelmet ad.',
      },
    ],
    criteria: [
      {
        title: 'Mindennapi teljesítmény',
        text: 'Mennyire folyamatos a rendszer, mennyire melegszik és mennyire bírja a terhelést - nem csak a benchmark számok.',
      },
      {
        title: 'Kamera és kijelző',
        text: 'Valós fényviszonyok közötti fotók, videó stabilitás, valamint a kijelző fényereje és színhűsége.',
      },
      {
        title: 'Üzemidő és támogatás',
        text: 'A valós üzemidő, a töltés sebessége és a gyártó frissítési időszaka: ez dönti el, mennyi ideig lesz korszerű a készülék.',
      },
    ],
    faq: [
      {
        q: 'Mennyi RAM kell egy okostelefonba?',
        a: 'A hétköznapi használathoz 6-8 GB kényelmes, a játékokkal és sok nyitott alkalmazással terhelt használathoz 12 GB fölött javasolt. A RAM mellett a tároló sebessége és a lapkakészlet teljesítménye legalább ennyit számít.',
      },
      {
        q: 'Meddig kap frissítést egy középkategóriás telefon?',
        a: 'A gyártói ígéretek 2-7 év között szórnak, a középkategóriában jellemzően 3-5 év. Ha hosszú távra vásárolsz, érdemes a hosszabb támogatást ígérő modellt választani.',
      },
      {
        q: 'Megéri a drágább kategória?',
        a: 'A középkategória ma már a legtöbb feladatra elég, a csúcskategória elsősorban a kamerát, a kijelzőt és a tartós terhelhetőséget javítja. Ha nem fotózol és nem játszol sokat, a középkategória a jobb ár-érték.',
      },
      {
        q: 'Mennyi akkumulátor-kapacitás elég?',
        a: '4500-5000 mAh a legtöbb felhasználónak egy teljes napot ad. A valós üzemidőt a kijelző, a lapkakészlet és a szoftver is befolyásolja, ezért a mAh önmagában nem garancia.',
      },
    ],
  },

  'okosora': {
    tips: [
      {
        title: 'A mérés pontossága a legfontosabb',
        text: 'A pulzus- és az alvásmérés megbízhatósága sok modellnél komolyan eltér. A sportoláshoz a pulzusöv pontosságát továbbra sem éri el a legtöbb csuklón mérő szenzor.',
      },
      {
        title: 'Az akkuidőt az always-on kijelző viszi el',
        text: 'A mindig bekapcsolt kijelzővel a legtöbb óra üzemideje 30-50%-kal rövidebb. Ha nem szeretnél naponta tölteni, 1 hetes üzemidő fölött érdemes választani.',
      },
      {
        title: 'A platform illeszkedjen a telefonodhoz',
        text: 'Az Apple Watch csak iPhone-nal működik teljesen, a Wear OS és a gyártói rendszerek Androidon (és részben iOS-en) használhatók. Ez a legelső döntési szempont.',
      },
    ],
    criteria: [
      {
        title: 'Egészségmérés',
        text: 'Pulzus, alvás, véroxigén, sportmódok és az adatok feldolgozása: mennyire használható információ, nem csak nyers számok.',
      },
      {
        title: 'Üzemidő és kijelző',
        text: 'Mennyit bír egy töltéssel, mennyire világos a kijelző, és mennyire kényelmes a napi használat.',
      },
      {
        title: 'Alkalmazás-ökoszisztéma',
        text: 'Milyen appok és fizetési megoldások érhetők el, és mennyire zökkenőmentes az értesítések kezelése.',
      },
    ],
    faq: [
      {
        q: 'Meddig bírja egy okosóra egy töltéssel?',
        a: 'Az Apple Watch és a Wear OS modellek jellemzően 1-2 napot, a sportos, egyszerűbb rendszerek 5-14 napot is elmennek. Az always-on kijelző és a sportmód jelentősen csökkenti ezt az időt.',
      },
      {
        q: 'Pontosan méri az okosóra a pulzust?',
        a: 'Nyugalmi állapotban és egyenletes tempójú mozgásnál elfogadhatóan pontos, gyors tempóváltásnál és súlyzós edzésnél viszont késhet. Intervall edzéshez a mellkasi pulzusöv a pontosabb.',
      },
      {
        q: 'Kell eSIM az okosórába?',
        a: 'Akkor éri meg, ha edzés közben vagy rövid időre telefon nélkül szeretnél elérhető maradni. Az eSIM extra havi díjat jelent, és a legtöbb használat mellett a Bluetooth-os telefonkapcsolat is elég.',
      },
      {
        q: 'Okosóra vagy fitness karkötő?',
        a: 'Ha az értesítések, a fizetés és az okosfunkciók is fontosak, az óra a jobb választás. Pusztán edzéskövetéshez és alváshoz a könnyebb karkötő gyakran elég, és hetekig bírja töltés nélkül.',
      },
    ],
  },

  'gamer-fejhallgato': {
    tips: [
      {
        title: 'A mikrofon minősége legalább annyit számít',
        text: 'A csapattal való játék során a mikrofon a legfontosabb alkatrész. A levehető és a külön kábelen csatlakoztatható mikrofon hosszú távon praktikusabb.',
      },
      {
        title: 'A kényelmet a súly és a párna dönti el',
        text: '300 g alatti fejhallgató órákig hordható kényelmesen, 350 g fölött a fejtetőn érezni fogod. A hőt vezető, cserélhető párnák a hosszú játékhoz jobbak.',
      },
      {
        title: 'A csatlakozást a késleltetés és a kényelem dönti el',
        text: 'A 2,4 GHz-es dongle a legkisebb késleltetésű, a Bluetooth hordozhatóbb, de késhet. USB-kábelen a legbiztosabb a kapcsolat, ha a játék kritikus.',
      },
    ],
    criteria: [
      {
        title: 'Hang és térérzet',
        text: 'Mennyire követhető a helyzet a játékban, mennyire kontrolált a mélyhang, és mennyire terhelő a hosszú használat.',
      },
      {
        title: 'Mikrofon',
        text: 'A beszéd tisztasága és a környezeti zaj kiszűrése - a csapatjátékban ez a gyakorlati használhatóság mércéje.',
      },
      {
        title: 'Kényelem és kapcsolat',
        text: 'Súly, párna, szorítás, valamint a csatlakozási módok és azok késleltetése.',
      },
    ],
    faq: [
      {
        q: 'USB-s vagy Bluetooth-os gamer fejhallgatót vegyek?',
        a: 'Játékhoz a 2,4 GHz-es USB dongle a legjobb választás, mert szinte nincs késleltetés. A Bluetooth kényelmesebb a hétköznapokban, de a játékban érezhetően késhet.',
      },
      {
        q: 'Kell 7.1 térhangzás a játékhoz?',
        a: 'A virtuális térhangzás segít a helyzetmeghatározásban, de nem csodaszer: a jó sztereó kép gyakran többet ad. Versenyjátékokban sokan a tiszta sztereót részesítik előnyben.',
      },
      {
        q: 'Mennyi a jó késleltetés játékhoz?',
        a: '40 ms alatt a legtöbb játékos nem érzékeli a késést. A Bluetooth-os modellek 100-200 ms között is lehetnek, ami lövöldözős játékokban már zavaró.',
      },
      {
        q: 'Mennyi ideig kényelmes egy gamer fejhallgató?',
        a: 'A 250-300 grammos, puha párnás modellek általában 3-5 órán át kényelmesek. A fejszorítás és a párna anyaga legalább ilyen fontos, mint a tömeg.',
      },
    ],
  },

  'gamer-eger': {
    tips: [
      {
        title: 'A forma illeszkedjen a fogáshoz',
        text: 'Pálmás fogáshoz a nagyobb, ergonomikus egér, ujjas fogáshoz a kisebb és laposabb típus kényelmesebb. Ez a választás legalább annyit számít, mint a szenzor.',
      },
      {
        title: 'A súlyt a játéktípushoz válaszd',
        text: 'Gyors reakciót igénylő játékokhoz a 60-80 grammos egér az ideális. A 100 g fölötti, stabilabb egér viszont a célzásnál lehet kellemesebb.',
      },
      {
        title: 'A kapcsolók élettartama és a programozhatóság',
        text: 'A hivatalos kattintás-élettartam tájékoztató adat, de a programozható gombok és a makrók a legtöbb használónak többet adnak a hétköznapokban.',
      },
    ],
    criteria: [
      {
        title: 'Szenzor és követés',
        text: 'A mozgás pontossága és a felbontás (DPI) - de a legtöbb modern szenzor már a belépőszinten is elegendő.',
      },
      {
        title: 'Forma, súly és anyaghasználat',
        text: 'Mennyire kényelmes a hosszú használat, mennyire stabil a fogás és mennyire tartós a burkolat.',
      },
      {
        title: 'Kapcsolat és szoftver',
        text: 'A késleltetés, az akkuidő és a beállítási lehetőségek: mennyire testre szabható az egér.',
      },
    ],
    faq: [
      {
        q: 'Elég gyors a vezeték nélküli gamer egér?',
        a: 'Igen: a mai 2,4 GHz-es vezeték nélküli egerek késleltetése a vezetékes szinten van. A Bluetooth-os mód viszont hordozhatóbb, de lassabb, ezért játékhoz érdemes a dongle-t használni.',
      },
      {
        q: 'Mennyi a jó súly egy gamer egérhez?',
        a: '60-80 gramm a könnyű, gyors játékokhoz és az e-sportos mozgáshoz, 90-110 gramm a stabilabb, célzós játékokhoz. A forma és a súlyelosztás fontosabb, mint a gramm önmagában.',
      },
      {
        q: 'Kell 8K polling rate?',
        a: 'A 8000 Hz-es jelentési gyakoriság mérhetően csökkenti a késleltetést, de a legtöbb játékos a 1000 Hz-en sem érez különbséget. Több CPU-t is terhel, ezért nem érdemes kizárólag ez alapján dönteni.',
      },
      {
        q: 'Mennyi ideig bírja az akkumulátor?',
        a: 'A világítás nélküli, energiatakarékos modellek 50-100 órát is elmennek egy töltéssel, a világító, nagy felbontású egerek 20-40 órát. Az RGB kikapcsolása érezhetően meghosszabbítja az üzemidőt.',
      },
    ],
  },

  'mechanikus-billentyuzet': {
    tips: [
      {
        title: 'A kapcsoló típusát a használat dönti el',
        text: 'Íráshoz a tapintható vagy kattogó kapcsoló ad visszajelzést, játékhoz a lineáris, gyorsan működésbe lépő típus a jobb. A hangos kattogás irodában vagy éjszaka zavaró lehet.',
      },
      {
        title: 'A ház és a csillapítás a hangot adja',
        text: 'A fém ház merevebb és kevésbé cseng, a műanyag könnyebb és olcsóbb. A hab- és gumi csillapítás sokat javít a hangzáson anélkül, hogy cserélni kellene a kapcsolót.',
      },
      {
        title: 'A hot-swap és a programozhatóság hosszú távon megéri',
        text: 'Ha a kapcsolók cserélhetők, egy meghibásodott darab nem teszi tönkre a billentyűzetet, és később más típusra is válthatsz. A programozható rétegek (VIA/QMK) szintén értékesek.',
      },
    ],
    criteria: [
      {
        title: 'Gépelési élmény',
        text: 'A kapcsoló érzete, a billentyűk stabilitása és a hosszú távú kényelem - nem csak a specifikáció.',
      },
      {
        title: 'Felépítés',
        text: 'Mennyire merev a ház, mennyire cseng a hang, és mennyire stabil a lábak vagy a gumik',
      },
      {
        title: 'Funkciók és szoftver',
        text: 'Vezeték nélküli mód, makrók, rétegek, világítás és a beállítások testreszabhatósága.',
      },
    ],
    faq: [
      {
        q: 'Melyik kapcsoló jó íráshoz és melyik játékhoz?',
        a: 'Íráshoz a tapintható (brown) vagy kattogó (blue) kapcsoló ad visszajelzést, játékhoz a lineáris (red) a leggyorsabb. A mágneses (Hall-effektusos) kapcsolók állítható működési pontja mindkét használatot kiszolgálja.',
      },
      {
        q: 'Mennyire hangos egy mechanikus billentyűzet?',
        a: 'A kattogó kapcsolók és a fémes ház együtt igazán hangosak lehetnek. Kattogás nélküli (lineáris vagy tapintható) kapcsolóval és csillapítással a hang a membrános szintre szorítható.',
      },
      {
        q: 'Megéri a hot-swap billentyűzet?',
        a: 'Ha szeretnéd később más kapcsolóra cserélni, vagy egy kapcsoló meghibásodik, akkor igen: ekkor nem kell új billentyűzetet venni. A javítást és a testreszabást is megkönnyíti.',
      },
      {
        q: 'Mennyi a jó késleltetés és a vezeték nélküli mód?',
        a: 'A 2,4 GHz-es vezeték nélküli mód játékhoz is elegendően gyors, a Bluetooth inkább íráshoz kényelmes. Kábeles módban a legkisebb a késleltetés, ezért versenyjátékban sokan azt használják.',
      },
    ],
  },

  '3d-nyomtato': {
    tips: [
      {
        title: 'A nyomtatási térfogat határozza meg, mit tudsz majd nyomtatni',
        text: 'A 220×220×250 mm a leggyakoribb belépő méret, a nagyobb tárgyakhoz viszont 300 mm fölötti építőtér kell. Utólag ezt nem lehet bővíteni, ezért ez az első döntés.',
      },
      {
        title: 'Zárt ház vagy nyitott váz?',
        text: 'Zárt házzal az ABS, ASA és más hőérzékeny anyagok is nyomtathatók, és a zaj is kisebb. Nyitott vázzal a PLA-val kezdeni egyszerűbb és olcsóbb.',
      },
      {
        title: 'A kalibráció és a kezelhetőség dönti el a mindennapi élményt',
        text: 'Az automatikus szintezés és a hálózati vezérlés sok bosszúságtól megkímél. Az első nyomtatóhoz ez többet ér, mint a legmagasabb nyomtatási sebesség.',
      },
    ],
    criteria: [
      {
        title: 'Nyomtatási minőség',
        text: 'Rétegillesztés, felület, méretpontosság és a híd- valamint túlnyúlások kezelése.',
      },
      {
        title: 'Használhatóság',
        text: 'Összeszerelés, kalibráció, szeletelő szoftver és a nyomtatás elindításának egyszerűsége.',
      },
      {
        title: 'Zaj, fogyasztás és üzemeltetés',
        text: 'Mennyire hangos, mennyit fogyaszt, és mennyire egyszerű a karbantartás (fúvóka, szíj, tengely).',
      },
    ],
    faq: [
      {
        q: 'Melyik 3D nyomtatót érdemes elsőként venni?',
        a: 'Első nyomtatóhoz az automatikus szintezésű, közepes építőterű (kb. 220-256 mm) FDM gépek a legkényelmesebbek. A zárt ház elsősorban akkor fontos, ha PLA-n kívül más anyagokat is használnál.',
      },
      {
        q: 'Mennyi az anyagköltség egy nyomtatáshoz?',
        a: 'A filament kilója jellemzően 6-12 ezer forint, egy kisebb tárgy 20-50 grammot használ, így néhány száz forintból kijön. A nagyobb tárgyaknál az áram és az idő is számít, de az anyag marad a fő költség.',
      },
      {
        q: 'Kell szellőztetni a 3D nyomtatáshoz?',
        a: 'PLA-hoz elég egy jól szellőző szoba, ABS-hez és ASA-hoz viszont erősen ajánlott a szűrés vagy a külső szellőzés. A zárható, szűrős ház ezt biztonságosabbá teszi, főleg lakásban.',
      },
      {
        q: 'Mennyire hangos egy 3D nyomtató?',
        a: 'A csendesebb modellek 40-50 dB között dolgoznak, ami egy hálószobába még éjszaka is zavaró lehet. A hangot a ventilátorok, a motorok és a sebesség adja, a gumilábak sokat segítenek.',
      },
    ],
  },

  'hajszarito': {
    tips: [
      {
        title: 'A hőfok és a légmennyiség együtt kíméli a hajat',
        text: 'A túl forró levegő roncsolja a hajszerkezetet, ezért a szabályozható hőfok és az erős, de langyos légáram a legjobb kombináció. Az ionos technológia a szőrszálak feltöltődését csökkenti.',
      },
      {
        title: 'A súly és a kábelhossz a napi kényelem',
        text: 'A 400-500 grammos gép hosszabb szárításnál még kényelmes, a nehezebb, nagy motoros modellek viszont gyorsabbak. A rövid kábel gyakran nagyobb bosszúság, mint a kicsit nagyobb súly.',
      },
      {
        title: 'A tartozékok és a hővédelem',
        text: 'A diffúzor fürtös hajhoz, a lapos fúvóka a sima beszárításhoz kell. Az automatikus túlmelegedés elleni védelem és a hideg levegős beállítás a használat értékét növeli.',
      },
    ],
    criteria: [
      {
        title: 'Szárítási teljesítmény',
        text: 'Mennyi idő alatt szárít meg egy hajkoronát, és mennyire egyszerűen érhető el vele a kívánt forma.',
      },
      {
        title: 'Hajkímélő működés',
        text: 'A hőmérséklet szabályozhatósága, az egyenletes légáram és a hosszú távú használat hatása a haj állapotára.',
      },
      {
        title: 'Kényelem',
        text: 'Súly, markolat, zaj, kábelhossz és a tartozékok használhatósága - ezek döntik el a napi használat hangulatát.',
      },
    ],
    faq: [
      {
        q: 'Hány wattos hajszárítót érdemes venni?',
        a: '1600-2000 W a legtöbb hajtípushoz elegendő és elég gyors. A teljesítmény önmagában nem garancia: a légmennyiség és a hőfok szabályozása legalább ennyit számít.',
      },
      {
        q: 'Kíméli a hajat az ionos hajszárító?',
        a: 'Az ionos technológia csökkenti a szőrszálak elektrosztatikus feltöltődését, ettől kevésbé száll a haj és simább lesz. A hő roncsolását viszont a kímélő hőfok és a nem túl közeli szárítás akadályozza meg.',
      },
      {
        q: 'Mennyi ideig tart a hajszárítás?',
        a: 'Vállig érő hajnál 5-8 perc, hosszú, vastag hajnál 10-15 perc reális. Az erős légáram és a magasabb, de kímélő hőfok rövidíti a legtöbbet az időn.',
      },
      {
        q: 'Diffúzor vagy lapos fúvóka kell?',
        a: 'Fürtös, hullámos hajhoz a diffúzor, sima, egyenes beszárításhoz a lapos fúvóka. Ha mindkét stílust használod, érdemes olyan modellt választani, amelyhez mindkét tartozék jár.',
      },
    ],
  },

  'hajvasalo': {
    tips: [
      {
        title: 'A hőfok állíthatósága fontosabb a maximum értéknél',
        text: 'Vékony, sérült hajhoz 150-170 fok is elég, vastag hajhoz 190-200 fok kell. Az egyenletes hőmérsékletű, alsóbb fokozaton használt vasaló kevésbé károsít.',
      },
      {
        title: 'A lemez anyaga és bevonata',
        text: 'A kerámia és a turmalin egyenletesen vezeti a hőt, a bevonat sérülése viszont kárt okoz a hajban. Az íves lemez a hullámosításhoz és a beszárításhoz is jobb.',
      },
      {
        title: 'A gyors felfűtés és az automatikus kikapcsolás',
        text: 'A 15-30 másodperces felfűtés és a biztonsági kikapcsolás a napi használatot kényelmessé teszi. A vezeték nélküli modellek szabadságot adnak, de kevesebb ideig tartják a hőfokot.',
      },
    ],
    criteria: [
      {
        title: 'Hőmérséklet-kezelés',
        text: 'A pontos hőfokszabályozás, az egyenletes eloszlás és a tartós hőtartás a vasalás során.',
      },
      {
        title: 'Eredmény és kímélet',
        text: 'Mennyire sima lesz a haj, hány menetben kell végigmenni, és mennyire száraz utána a haj.',
      },
      {
        title: 'Használat és biztonság',
        text: 'Felfűtési idő, automatikus kikapcsolás, a lemez tisztíthatósága és a gép kényelmes használhatósága.',
      },
    ],
    faq: [
      {
        q: 'Milyen hőfokon vasaljam a hajamat?',
        a: 'Vékony, festett vagy sérült hajhoz 150-170 fok, átlagos hajhoz 180 fok, vastag, erős hajhoz 190-200 fok ajánlott. A 230 fokos maximumot csak ritkán és rövid ideig érdemes használni.',
      },
      {
        q: 'Mennyit károsít a hajvasaló?',
        a: 'A rendszeres, magas hőfokú vasalás hosszú távon töredezettséget és szárazságot okoz. Hővédő sprayjel, alacsonyabb hőfokon és hetente néhány alkalommal használva a kár jelentősen csökkenthető.',
      },
      {
        q: 'Kerámia vagy titán lemez a jobb?',
        a: 'A kerámia egyenletesebben melegít és kíméletesebb, a titán gyorsabban melegszik és tartósabb. Vastag hajhoz a titán, vékonyabb, sérülékeny hajhoz a kerámia válik be jobban.',
      },
      {
        q: 'Meddig tart egy hajvasaló?',
        a: 'Heti néhány használat mellett a jó minőségű vasaló 3-6 évig is elmegy. A bevonat lekopása és a hőfokszabályozás pontatlanná válása jelzi, hogy ideje cserélni.',
      },
    ],
  },

  'parfum': {
    tips: [
      {
        title: 'A koncentráció határozza meg a tartósságot',
        text: 'Az EDT könnyebb és rövidebb életű, az EDP tartósabb és testesebb, a parfum koncentráció pedig egész nap veled marad. A hétköznapokra gyakran az EDT is elég.',
      },
      {
        title: 'A bőrkémia miatt lesz más mindenkin',
        text: 'Ugyanaz az illat a te bőrödön másképp mutat, mint a barátodén. Ezért érdemes először mintát venni vagy üzletben felpróbálni, és megvárni a 30 percet, mielőtt döntesz.',
      },
      {
        title: 'Az alkalom és az évszak is számít',
        text: 'Nyárra a friss, citrusos és vizes jegyek, télire a fás, fűszeres és édesebb illatok illenek. Egy illat nem minden helyzetre alkalmas, ezért két-három darab a praktikus.',
      },
    ],
    criteria: [
      {
        title: 'Illatprofil',
        text: 'Az összetétel felépítése (fej-, szív- és aljegyek), a karakter és az, mennyire illik a hétköznapi alkalmakhoz.',
      },
      {
        title: 'Tartósság és vetítés',
        text: 'Meddig érezhető a bőrön, és mennyire erős a szomszédok felé - az irodai használathoz a visszafogottabb illat jobb.',
      },
      {
        title: 'Ár-érték',
        text: 'Az árhoz képest mennyire összetett és tartós az illat, és mennyibe kerül a 100 ml-es (vagy hp) kiszerelés.',
      },
    ],
    faq: [
      {
        q: 'Meddig tart egy EDP parfüm?',
        a: 'A bőrön jellemzően 6-10 órán át érezhető, a ruhán ennél tovább is. A tartósságot a bőr típusa, az időjárás és az illat összetétele is befolyásolja.',
      },
      {
        q: 'Miért lesz más az illat a bőrömön, mint a boltban?',
        a: 'A bőr zsírtartalma, pH-ja és hőmérséklete mindenkinél más, ezért az összetétel is más ütemben bomlik. Ezért érdemes legalább 30 percet várni a felpróbálás után, mert a fejjegyek után jön a szívjegy.',
      },
      {
        q: 'Hogyan tároljam a parfümöt?',
        a: 'Sötét, hűvös helyen, dobozában, napsütés nélkül - a fürdőszobai polc a párától és a hőtől minden elemet rontó hely. Így a bontástól számított 3-5 évig is megőrzi az összetételét.',
      },
      {
        q: 'Mennyit érdemes költeni a mindennapi illatra?',
        a: 'Az illatprofil és a tartósság érződik meg az árkülönbségben. A 20-40 ezer forintos sávban már összetett, hosszan tartó illatok vannak, a luxuskategória inkább a ritka összetevőkért drágább - de nem hordható minden napra.',
      },
    ],
  },
};

/** Az osztály szerkesztői tartalma (nincs minden osztályhoz - a kategóriáknak nincs). */
export function productClassContent(slug: string): ProductClassContent | null {
  return PRODUCT_CLASS_CONTENT[slug] ?? null;
}
