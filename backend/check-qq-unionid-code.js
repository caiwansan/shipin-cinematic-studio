const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // Check the PC QQ login flow to see how unionId is obtained
  console.log("=== PC QQ Login - unionId capture ===");
  const qqOauth = fs.readFileSync('/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts', 'utf8');
  
  // Find the PC callback section
  const pcCallback = qqOauth.indexOf("qq/callback");
  if (pcCallback > 0) {
    // Show the unionId capture code
    const unionIdSection = qqOauth.substring(pcCallback, pcCallback + 1000);
    console.log(unionIdSection);
  }
  
  // Check if mobile flow has the same unionId capture
  console.log("\n=== Mobile QQ Login - unionId capture ===");
  const mobileCallback = qqOauth.indexOf("qq/mobile");
  if (mobileCallback > 0) {
    const mobileSection = qqOauth.substring(mobileCallback, mobileCallback + 1000);
    console.log(mobileSection);
  }
  
  // Check the QQ API response for unionId
  console.log("\n=== QQ API get_user_info response ===");
  // The QQ API returns unionid only if apps are under same developer account
  // Check if the code requests unionId
  
  // Find the get_user_info call
  const userInfoCall = qqOauth.indexOf("get_user_info");
  if (userInfoCall > 0) {
    console.log(qqOauth.substring(userInfoCall - 100, userInfoCall + 300));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
