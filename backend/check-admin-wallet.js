const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Admin user check
  console.log("=== Admin Users ===");
  const admins = await prisma.user.findMany({
    where: { 
      OR: [
        { email: { contains: 'admin' } },
        { username: { contains: 'admin' } }
      ]
    },
    select: { id: true, email: true, username: true, memberTier: true, passwordHash: true }
  });
  admins.forEach(a => console.log("  " + JSON.stringify({id: a.id, email: a.email, username: a.username, tier: a.memberTier, hasPassword: !!a.passwordHash})));
  
  // Check AdminUser table
  console.log("\n=== AdminUser table ===");
  try {
    const adminRows = await prisma.adminUser.findMany({ take: 5 });
    adminRows.forEach(a => console.log("  " + JSON.stringify(a)));
  } catch(e) { console.log("  AdminUser:", e.message.split("\n")[0]); }
  
  // 2. Nanowwan user
  console.log("\n=== Searching for Nanowwan ===");
  const nanwan = await prisma.user.findFirst({
    where: { OR: [
      { username: { contains: 'nanwan' } },
      { nickname: { contains: 'nanwan' } },
      { email: { contains: 'nanwan' } }
    ]},
    include: { membership: true }
  });
  if (nanwan) {
    console.log("  Found:", nanwan.id, nanwan.email, nanwan.username);
    console.log("  Wallet:", nanwan.walletBalance, "GoldCoins:", nanwan.goldCoins);
    console.log("  Membership:", JSON.stringify(nanwan.membership));
  } else {
    console.log("  Not found by nanowan, checking all users...");
    const all = await prisma.user.findMany({ select: { id: true, email: true, username: true }, take: 15 });
    all.forEach(u => console.log("  " + u.email + " | " + u.username));
  }
  
  // 3. Wallet tables
  console.log("\n=== Wallet system tables ===");
  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%wallet%' OR tablename LIKE '%token%' OR tablename LIKE '%point%' OR tablename LIKE '%tea%')");
  tables.forEach(t => console.log("  " + t.tablename));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
