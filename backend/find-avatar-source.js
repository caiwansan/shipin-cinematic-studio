const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const { execSync } = require('child_process');

async function main() {
  // === Find QQ avatar URL source ===
  // The avatar URL with http://thirdqq.qlogo.cn comes from the User.avatarUrl field
  // Check the User model in Prisma schema
  const schema = fs.readFileSync('/root/shipin-cinematic-studio/backend/prisma/schema.prisma', 'utf8');
  const userMatch = schema.match(/model User \{([\s\S]*?)\n\}/);
  if (userMatch) {
    // Find avatarUrl field
    const lines = userMatch[0].split('\n');
    lines.forEach(l => {
      if (l.toLowerCase().includes('avatar')) console.log("User model: " + l.trim());
    });
  }
  
  // Check what the API returns for avatar
  try {
    const user = await prisma.user.findFirst({ 
      where: { id: 'ff750ab7-2311-4391-a640-dc0601ddc490' },
      select: { id: true, avatarUrl: true, avatar: true }
    });
    console.log("\nUser avatar fields:", JSON.stringify(user, null, 2));
  } catch(e) { console.log("User query error:", e.message); }
  
  // Check the im.ts route for avatar handling
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  const avatarLines = imRoute.split('\n').filter(l => l.includes('avatar') || l.includes('Avatar'));
  console.log("\n=== avatar references in im.ts ===");
  avatarLines.forEach(l => console.log("  " + l.trim()));
  
  // Check user-assets.ts
  try {
    const userAssets = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/user-assets.ts', 'utf8');
    const avatarLines2 = userAssets.split('\n').filter(l => l.includes('avatar') || l.includes('Avatar'));
    console.log("\n=== avatar references in user-assets.ts ===");
    avatarLines2.forEach(l => console.log("  " + l.trim()));
  } catch(e) { console.log("user-assets.ts not found"); }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
