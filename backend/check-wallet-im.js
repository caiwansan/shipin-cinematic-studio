const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. tea_wallet table structure
  console.log("=== tea_wallet columns ===");
  try {
    const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tea_wallet' ORDER BY ordinal_position");
    cols.forEach(c => console.log("  " + c.column_name + " (" + c.data_type + ")"));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 2. Nanowwan's wallet
  console.log("\n=== Nanowwan tea_wallet ===");
  const nanwan = await prisma.user.findFirst({
    where: { username: "南波万" }
  });
  if (nanwan) {
    console.log("  User ID:", nanwan.id);
    const wallet = await prisma.teaWallet.findFirst({
      where: { userId: nanwan.id }
    });
    console.log("  Wallet:", JSON.stringify(wallet, null, 2));
    
    // Check all wallets to understand structure
    const allWallets = await prisma.teaWallet.findMany({ take: 3 });
    console.log("\n  Sample wallets:");
    allWallets.forEach(w => console.log("    " + JSON.stringify(w)));
  }
  
  // 3. tea_admin table
  console.log("\n=== tea_admin ===");
  try {
    const teaAdmins = await prisma.teaAdmin.findMany({ take: 5 });
    teaAdmins.forEach(a => console.log("  " + JSON.stringify(a)));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 4. IM messaging issue - check im.ts routes
  console.log("\n=== IM message routes ===");
  const fs = require('fs');
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  
  // Find message sending routes
  const msgRoutes = imRoute.split('\n').filter(l => l.includes('message') || l.includes('send') || l.includes('chat'));
  msgRoutes.forEach(l => console.log("  " + l.trim()));
  
  // Check for any permission checks that might block messaging
  const permissionChecks = imRoute.split('\n').filter(l => l.includes('permission') || l.includes('block') || l.includes('forbid') || l.includes('ban') || l.includes('restrict'));
  console.log("\n=== Permission checks in im.ts ===");
  permissionChecks.forEach(l => console.log("  " + l.trim()));
  
  // Check tea_ban table
  console.log("\n=== tea_ban ===");
  try {
    const bans = await prisma.teaBan.findMany({ take: 5 });
    bans.forEach(b => console.log("  " + JSON.stringify(b)));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
