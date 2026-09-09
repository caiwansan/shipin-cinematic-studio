const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // === 1. QQ Login issue - check how QQ users are identified ===
  console.log("=== QQ Login Flow ===");
  
  // Check auth routes for QQ login
  const authRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/auth.ts', 'utf8');
  const qqLines = authRoute.split('\n').filter(l => l.toLowerCase().includes('qq') || l.includes('openId') || l.includes('unionId'));
  qqLines.forEach(l => console.log("  " + l.trim()));
  
  // Check if there's a separate QQ mobile login
  console.log("\n=== QQ Mobile Login ===");
  try {
    const qqMobile = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/qq-mobile.ts', 'utf8');
    const lines = qqMobile.split('\n').filter(l => l.includes('openId') || l.includes('unionId') || l.includes('create') || l.includes('find'));
    lines.forEach(l => console.log("  " + l.trim()));
  } catch(e) { console.log("  No qq-mobile.ts"); }
  
  // Check the User model for QQ fields
  const schema = fs.readFileSync('/root/shipin-cinematic-studio/backend/prisma/schema.prisma', 'utf8');
  const userMatch = schema.match(/model User \{([\s\S]*?)\n\}/);
  if (userMatch) {
    const qqFields = userMatch[0].split('\n').filter(l => l.toLowerCase().includes('qq') || l.includes('openId') || l.includes('unionId'));
    console.log("\n=== User QQ fields ===");
    qqFields.forEach(l => console.log("  " + l.trim()));
  }
  
  // Check actual QQ users
  console.log("\n=== QQ Users in DB ===");
  const qqUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, email: true, username: true, qqOpenId: true, qqUnionId: true },
    take: 10
  });
  qqUsers.forEach(u => console.log("  " + JSON.stringify(u)));
  
  // === 2. IM Chat issue ===
  console.log("\n=== IM Channel Types ===");
  try {
    const channels = await prisma.$queryRawUnsafe("SELECT DISTINCT channel_type FROM im_channel_members");
    channels.forEach(c => console.log("  channel_type:", c.channel_type));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // Check the ensure-private route
  console.log("\n=== ensure-private route ===");
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  const ensurePrivate = imRoute.indexOf('ensure-private');
  if (ensurePrivate > 0) {
    console.log(imRoute.substring(ensurePrivate, ensurePrivate + 500));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
