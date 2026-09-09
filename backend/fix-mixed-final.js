const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const { execSync } = require('child_process');

async function main() {
  // Fix 1: Find QQ avatar HTTP URLs in frontend
  const frontendDir = '/www/wwwroot/aigc.fushtn.com';
  try {
    const avatarFiles = execSync(
      'grep -rl "avatar\|qlogo\|thirdqq" ' + frontendDir + '/_nuxt/*.js 2>/dev/null | head -10'
    ).toString().trim().split('\n').filter(Boolean);
    console.log("Avatar files found:", avatarFiles.length);
    avatarFiles.forEach(f => console.log("  " + f));
  } catch(e) { console.log("Frontend search:", e.message); }
  
  // Fix 2: Fix identity/key 404 - return 200 with null instead of 404
  const routePath = '/root/shipin-cinematic-studio/backend/src/routes/identity.routes.ts';
  let identityRoute = fs.readFileSync(routePath, 'utf8');
  
  const oldPattern = "if (!rows?.[0]?.enc_key) return reply.status(404).send({ success: false, error: '无托管密钥' })";
  const newPattern = "if (!rows?.[0]?.enc_key) return { success: true, data: { encKey: null } }";
  
  if (identityRoute.includes(oldPattern)) {
    identityRoute = identityRoute.replace(oldPattern, newPattern);
    fs.writeFileSync(routePath, identityRoute);
    console.log("Fixed identity/key route: 404 -> 200 with null");
  } else {
    console.log("Identity route pattern not found");
    // Show surrounding context
    const idx = identityRoute.indexOf('enc_key');
    if (idx > 0) {
      console.log("Context:", identityRoute.substring(idx-50, idx+100));
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
