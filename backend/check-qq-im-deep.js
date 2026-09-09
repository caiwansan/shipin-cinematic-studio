const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // === 1. QQ Login - check how mobile vs PC differ ===
  console.log("=== QQ Login Routes ===");
  
  // Check the QQ login route in detail
  const authRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/auth.ts', 'utf8');
  
  // Find QQ login handler
  const qqLoginIdx = authRoute.indexOf('qq/ensure-inviter');
  if (qqLoginIdx > 0) {
    console.log("QQ Login handler found at:", qqLoginIdx);
    console.log(authRoute.substring(qqLoginIdx, qqLoginIdx + 800));
  }
  
  // Check for mobile-specific QQ login
  console.log("\n=== Searching for mobile QQ login ===");
  const routesDir = '/root/shipin-cinematic-studio/backend/src/routes/';
  const files = fs.readdirSync(routesDir);
  files.filter(f => f.includes('qq') || f.includes('mobile')).forEach(f => console.log("  " + f));
  
  // Check the QQ SDK config
  console.log("\n=== QQ SDK Config ===");
  try {
    const qqConfig = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/config/qq.ts', 'utf8');
    console.log(qqConfig.substring(0, 500));
  } catch(e) { console.log("  No qq.ts config"); }
  
  // Check how qqOpenId is generated
  console.log("\n=== QQ OpenID generation ===");
  const qqAuthFiles = files.filter(f => f.includes('auth') || f.includes('qq'));
  qqAuthFiles.forEach(f => {
    const content = fs.readFileSync(routesDir + f, 'utf8');
    if (content.includes('qqOpenId') || content.includes('openId')) {
      const lines = content.split('\n').filter(l => l.includes('openId') || l.includes('unionId') || l.includes('qq_'));
      if (lines.length > 0) {
        console.log("  " + f + ":");
        lines.forEach(l => console.log("    " + l.trim()));
      }
    }
  });
  
  // === 2. IM Chat - check channel creation ===
  console.log("\n=== IM Channel Creation ===");
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  
  // Find ensure-private handler
  const ensurePrivateIdx = imRoute.indexOf('ensure-private');
  if (ensurePrivateIdx > 0) {
    console.log(imRoute.substring(ensurePrivateIdx, ensurePrivateIdx + 1000));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
