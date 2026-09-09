const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // === 1. Fix QQ Login - use qqUnionId as primary identifier ===
  console.log("=== QQ Login Fix ===");
  
  // Check the current QQ login flow
  const qqOauth = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts', 'utf8');
  
  // The issue: qqUnionId is null for most users because the QQ API response
  // doesn't include union_id by default - it needs to be explicitly requested
  // Also, mobile and PC use different appIds, generating different openIds
  
  // Fix: Update the QQ login to prioritize unionId lookup
  // First, let's check if we can add unionId to existing users
  
  // Get QQ config
  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'qq_oauth' } });
  console.log("QQ OAuth config:", secret ? "EXISTS" : "NOT FOUND");
  if (secret) {
    const config = JSON.parse(secret.config);
    console.log("  appId:", config.appId);
    console.log("  scope:", config.scope);
  }
  
  // Check mobile QQ config
  const mobileSecret = await prisma.paymentSecret.findUnique({ where: { channel: 'qq_mobile' } });
  console.log("QQ Mobile config:", mobileSecret ? "EXISTS" : "NOT FOUND");
  if (mobileSecret) {
    const config = JSON.parse(mobileSecret.config);
    console.log("  appId:", config.appId);
  }
  
  // === 2. Fix IM Chat - check channel creation ===
  console.log("\n=== IM Chat Fix ===");
  
  // Check the ensure-private route
  const imRoute = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/im.ts', 'utf8');
  
  // Find the ensure-private handler and check for issues
  const ensurePrivateIdx = imRoute.indexOf('ensure-private');
  if (ensurePrivateIdx > 0) {
    const snippet = imRoute.substring(ensurePrivateIdx, ensurePrivateIdx + 1500);
    console.log("ensure-private handler:");
    console.log(snippet);
  }
  
  // Check if there are any errors in the channel creation
  console.log("\n=== Checking WuKongIM API ===");
  // Extract the wkApi function
  const wkApiMatch = imRoute.match(/async function wkApi[\s\S]*?\n}/);
  if (wkApiMatch) {
    console.log("wkApi function:");
    console.log(wkApiMatch[0].substring(0, 500));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
