const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  console.log("=== QQ Users ===");
  const qqUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, email: true, qqOpenId: true, qqUnionId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  qqUsers.forEach(u => console.log("  " + u.email + " | unionId: " + (u.qqUnionId || "null")));
  console.log("Total:", qqUsers.length);
  
  console.log("\n=== Mobile QQ Login Code ===");
  const qqOauth = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts', 'utf8');
  const mobileIdx = qqOauth.indexOf("qq/mobile");
  if (mobileIdx > 0) console.log(qqOauth.substring(mobileIdx, mobileIdx + 800));
  
  console.log("\n=== IM Send Restrictions ===");
  const im = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  const lines = im.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('send') || lines[i].includes('restrict') || lines[i].includes('block')) {
      console.log("  L" + (i+1) + ": " + lines[i].trim());
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
