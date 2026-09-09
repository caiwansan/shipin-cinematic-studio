const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Fixing avatar URLs ===");
  
  // Count affected rows
  const count = await prisma.user.count({
    where: { avatarUrl: { startsWith: 'http://' } }
  });
  console.log("Users with http:// avatar URLs:", count);
  
  // Update them using simple executeRawUnsafe
  if (count > 0) {
    await prisma.$executeRawUnsafe("UPDATE \"User\" SET avatar_url = REPLACE(avatar_url, 'http://', 'https://') WHERE avatar_url LIKE 'http://%'");
    console.log("Updated avatar URLs to https://");
  }
  
  // Verify
  const remaining = await prisma.user.count({
    where: { avatarUrl: { startsWith: 'http://' } }
  });
  console.log("Remaining http:// avatars:", remaining);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
