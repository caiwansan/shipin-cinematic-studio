const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix Mixed Content: upgrade http:// to https:// in avatar URLs
  console.log("=== Fixing avatar URLs ===");
  
  // Count affected rows
  const count = await prisma.user.count({
    where: { avatarUrl: { startsWith: 'http://' } }
  });
  console.log("Users with http:// avatar URLs:", count);
  
  // Update them
  if (count > 0) {
    const result = await prisma.$executeRawUnsafe(
      'UPDATE "User" SET avatar_url = REPLACE(avatar_url, 'http://', 'https://') WHERE avatar_url LIKE 'http://%''
    );
    console.log("Updated", result, "avatar URLs to https://");
  }
  
  // Verify
  const remaining = await prisma.user.count({
    where: { avatarUrl: { startsWith: 'http://' } }
  });
  console.log("Remaining http:// avatars:", remaining);
  
  // Show some examples
  const samples = await prisma.user.findMany({
    where: { avatarUrl: { not: null, not: '' } },
    select: { id: true, avatarUrl: true },
    take: 5
  });
  console.log("\nSample avatars:");
  samples.forEach(s => console.log("  " + s.avatarUrl));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
