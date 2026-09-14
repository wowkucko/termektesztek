import { PrismaClient } from "@prisma/client";
import { extname, basename } from "path";
const p = new PrismaClient();
// Mar lezajlott tomoritesek utan: remoteUrl kiterjesztes igazitasa, ahol
// az uuid megegyezik a helyi fajleval (eles .jpg torolve, .webp el).
const rows = await p.pushFile.findMany();
let n = 0;
for (const r of rows) {
  const lb = basename(r.localPath, extname(r.localPath));
  const rb = basename(r.remoteUrl, extname(r.remoteUrl));
  if (lb === rb && r.remoteUrl !== r.localPath.replace(/\\/g, "/").split("/").pop()?.replace(/^/, "/uploads/")) {
    const fixed = `/uploads/${rb}${extname(r.localPath)}`;
    if (fixed !== r.remoteUrl) {
      await p.pushFile.update({ where: { localPath: r.localPath }, data: { remoteUrl: fixed } });
      n++;
    }
  }
}
console.log(`remoteUrl igazitva: ${n} sor`);
await p.$disconnect();
