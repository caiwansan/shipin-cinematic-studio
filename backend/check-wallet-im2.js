const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // 1. Prisma model name for tea_wallet
  console.log("=== Prisma TeaWallet model ===");
  const schema = fs.readFileSync('/root/shipin-cinematic-studio/backend/prisma/schema.prisma', 'utf8');
  const teaMatch = schema.match(/model TeaWallet[\s\S]*?\n\}/);
  if (teaMatch) console.log(teaMatch[0]);
  
  // 2. Check Nanowwan wallet directly
  console.log("\n=== Nanowwan tea_wallet (direct SQL) ===");
  const nanwanId = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  try {
    const wallets = await prisma.$queryRawUnsafe("SELECT * FROM tea_wallet WHERE uid = $1", nanwanId);
    console.log("  Wallets:", wallets.length);
    wallets.forEach(w => console.log("  " + JSON.stringify(w)));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 3. Check all wallets sample
  console.log("\n=== Sample tea_wallets ===");
  try {
    const samples = await prisma.$queryRawUnsafe("SELECT * FROM tea_wallet LIMIT 5");
    samples.forEach(w => console.log("  " + JSON.stringify(w)));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 4. IM messaging routes
  console.log("\n=== IM message routes ===");
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  const lines = imRoute.split('\n');
  
  // Find all route definitions
  const routes = lines.filter(l => l.includes('fastify.get') || l.includes('fastify.post'));
  routes.forEach(l => console.log("  " + l.trim()));
  
  // Find message-related code
  console.log("\n=== Message send code ===");
  const msgLines = lines.filter(l => l.toLowerCase().includes('send') || l.toLowerCase().includes('message') || l.toLowerCase().includes('chat'));
  msgLines.forEach(l => console.log("  " + l.trim()));
  
  // Check for permission blocks
  console.log("\n=== Permission/ban checks ===");
  const banLines = lines.filter(l => l.includes('ban') || l.includes('block') || l.includes('restrict') || l.includes('forbid'));
  banLines.forEach(l => console.log("  " + l.trim()));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
