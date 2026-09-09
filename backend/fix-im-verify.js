const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // === 1. Fix IM messaging restriction ===
  console.log("=== Fixing IM messaging restriction ===");
  const imPath = '/root/shipin-cinematic-studio/backend/src/routes/im.ts';
  let imCode = fs.readFileSync(imPath, 'utf8');
  
  // Find and remove the 24-hour restriction
  const restriction = `if (sent >= 1) {
            return reply.status(400).send({ success: false, error: '对方尚未回复，24小时内只能发送1条消息' })
          }`;
  
  if (imCode.includes(restriction)) {
    imCode = imCode.replace(restriction, '// restriction removed: if (sent >= 1) { return reply.status(400).send({ success: false, error: "..." }) }');
    fs.writeFileSync(imPath, imCode);
    console.log("IM restriction removed");
  } else {
    console.log("Restriction pattern not found, trying alternative...");
    // Try broader pattern
    const idx = imCode.indexOf('对方尚未回复');
    if (idx > 0) {
      const before = imCode.substring(0, idx - 100);
      const after = imCode.substring(idx + 200);
      // Find the closing brace
      const closeBrace = after.indexOf('}') ;
      const newCode = before + '// 24-hour message restriction removed by audit fix\n' + after.substring(closeBrace + 1);
      fs.writeFileSync(imPath, newCode);
      console.log("IM restriction removed (alternative method)");
    }
  }
  
  // === 2. Verify Nanowwan wallet ===
  console.log("\n=== Verifying Nanowwan wallet ===");
  const nanwanId = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const wallet = await prisma.$queryRawUnsafe("SELECT uid, gongfen, chapiao FROM tea_wallet WHERE uid = $1", nanwanId);
  if (wallet.length > 0) {
    console.log("Wallet OK:");
    console.log("  uid:", wallet[0].uid);
    console.log("  gongfen:", wallet[0].gongfen);
    console.log("  chapiao:", wallet[0].chapiao);
  } else {
    console.log("Wallet NOT FOUND!");
  }
  
  // === 3. Verify admin password ===
  console.log("\n=== Verifying admin ===");
  const admin = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
  console.log("Admin exists:", !!admin);
  console.log("Password hash:", admin ? admin.passwordHash.substring(0, 30) + '...' : 'N/A');
  
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
