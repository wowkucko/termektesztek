import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Szerkesztő';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL és ADMIN_PASSWORD environment változók kötelezőek a seedeléshez.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });
  console.log(`Admin felhasználó kész: ${admin.email}`);

  const categories = [
    { name: 'Okostelefonok', description: 'Mobiltelefon tesztek és összehasonlítások.' },
    { name: 'Otthon és konyha', description: 'Háztartási gépek, konyhai eszközök tesztjei.' },
    { name: 'Hordható eszközök', description: 'Okosórák, fülhallgatók, fitneszkarkötők.' },
    { name: 'Számítástechnika', description: 'Laptopok, perifériák, gaming eszközök.' },
    { name: 'Szépségápolás', description: 'Szépségápolási és testápolási eszközök tesztjei.' },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description },
    });
  }
  console.log(`${categories.length} kategória kész.`);

  const tags = ['Ár-érték arány', 'Kezdőknek ajánlott', 'Prémium', 'Teszt győztes', 'Energiatakarékos', 'Utazáshoz'];
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { name: t },
      update: {},
      create: { name: t, slug: slugify(t) },
    });
  }
  console.log(`${tags.length} címke kész.`);

  const existingPosts = await prisma.post.count();
  if (existingPosts === 0) {
    const cat = await prisma.category.findFirst({ where: { name: 'Okostelefonok' } });
    const tag1 = await prisma.tag.findFirst({ where: { name: 'Ár-érték arány' } });
    const tag2 = await prisma.tag.findFirst({ where: { name: 'Teszt győztes' } });
    if (cat) {
      const title = 'Példa termékteszt: így írj majd valódi cikket';
      await prisma.post.create({
        data: {
          title,
          slug: slugify(title),
          excerpt: 'Ez egy minta bejegyzés, amit bátran törölhetsz az admin felületen. Mutatja a rovatok felépítését.',
          content: `## Bevezető\n\nEz egy **minta bejegyzés**, amelyet a seed script hozott létre, hogy lásd, hogyan néz ki egy kész cikk. Nyugodtan töröld az admin felületen, és írd meg az első valódi teszted!\n\n### Mit érdemes kiemelni?\n\n- A tesztkörülményeket\n- A mért adatokat\n- A napi használat tapasztalatait\n\n> A végső verdiktet mindig a lenti dobozban foglaljuk össze.`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          categoryId: cat.id,
          productName: 'Minta Termék X1',
          productBrand: 'PéldaMárka',
          rating: 8.4,
          pros: JSON.stringify(['Kiváló akkumulátor-üzemidő', 'Prémium anyaghasználat', 'Gyors, sima szoftver']),
          cons: JSON.stringify(['Nincs bővíthető tárhely', 'Az ára a felső kategóriában van']),
          verdict: 'Kiváló választás azoknak, akik hosszú távra terveznek beruházni egy megbízható eszközbe.',
          seoTitle: 'Minta Termék X1 teszt: érdemes megvenni? | Terméktesztek és vélemények',
          seoDescription: 'Alaposan végigteszteltük a Minta Termék X1-et: akkumulátor, teljesítmény, ár-érték. Íme a végső verdiktünk.',
          tags: {
            create: [tag1, tag2].filter(Boolean).map((t) => ({ tagId: t!.id })),
          },
        },
      });
      console.log('Minta bejegyzés létrehozva.');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
