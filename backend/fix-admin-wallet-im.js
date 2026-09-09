const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const bcrypt = require('bcryptjs');

async function main() {
  // === 1. Fix IM messaging restriction ===
  console.log("=== Checking IM send restriction ===");
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  
  // Find the restriction code
  const restrictionIdx = imRoute.indexOf('对方尚未回复');
  if (restrictionIdx > 0) {
    console.log("Found restriction at index:", restrictionIdx);
    console.log("Context:", imRoute.substring(restrictionIdx - 200, restrictionIdx + 200));
  }
  
  // === 2. Admin password reset ===
  console.log("\n=== Resetting admin password ===");
  const newPassword = 'Admin@2026';
  const hashed = await bcrypt.hash(newPassword, 12);
  
  // Update AdminUser table
  const adminResult = await prisma.adminUser.updateMany({
    where: { username: 'admin' },
    data: { passwordHash: hashed }
  });
  console.log("AdminUser updated:", adminResult.count);
  
  // Also update User table admin
  const userResult = await prisma.user.updateMany({
    where: { email: 'admin@scs.com' },
    data: { passwordHash: hashed }
  });
  console.log("User admin updated:", userResult.count);
  
  // === 3. Create wallet for Nanowwan ===
  console.log("\n=== Creating Nanowwan wallet ===");
  const nanwanId = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  
  // Check if wallet exists
  const existing = await prisma.$queryRawUnsafe("SELECT * FROM tea_wallet WHERE uid = $1", nanwanId);
  console.log("Existing wallet:", existing.length);
  
  if (existing.length === 0) {
    // Create wallet with 10亿 chapiao and 10亿 gongfen
    await prisma.$executeRawUnsafe(
      "INSERT INTO tea_wallet (uid, gongfen, chapiao, updated_at) VALUES ($1, $2, $3, $4)",
      nanwanId, 1000000000, 1000000000, Date.now()
    );
    console.log("Wallet created with 10亿 gongfen and 10亿 chapiao");
  } else {
    // Update existing wallet
    await prisma.$executeRawUnsafe(
      "UPDATE tea_wallet SET gongfen = $1, chapiao = $2, updated_at = $3 WHERE uid = $4",
      1000000000, 1000000000, Date.now(), nanwanId
    );
    console.log("Wallet updated to 10亿 gongfen and 10亿 chapiao");
  }
  
  // Verify
  const verify = await prisma.$queryRawUnsafe("SELECT * FROM tea_wallet WHERE uid = $1", nanwanId);
  console.log("Verified wallet:", JSON.stringify(verify[0], null, 2));
  
  console.log("\n=== DONE ===");
  console.log("Admin password:", newPassword);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
