const fs = require('fs');

const filePath = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Find the mobile user creation section and add unionId
// Look for the mobile create pattern
const mobileCreateIdx = code.indexOf('user = await prisma.user.create({', 2000); // Start after PC section
console.log("Mobile create index:", mobileCreateIdx);

if (mobileCreateIdx > 0) {
  // Show context
  console.log("Context:", code.substring(mobileCreateIdx, mobileCreateIdx + 400));
  
  // Find the qqOpenId line in mobile creation and add unionId after it
  const mobileSection = code.substring(mobileCreateIdx, mobileCreateIdx + 500);
  
  // Pattern: look for qqOpenId in the mobile create section
  if (mobileSection.includes('qqOpenId,')) {
    // Find exact position in full code
    const openIdIdx = code.indexOf('qqOpenId,', mobileCreateIdx);
    const nextNewline = code.indexOf('\n', openIdIdx);
    const line = code.substring(openIdIdx, nextNewline);
    
    // Check if next line already has unionId
    const nextLine = code.substring(nextNewline + 1, nextNewline + 100);
    
    if (!nextLine.includes('qqUnionId')) {
      // Add unionId after qqOpenId line
      const insertPos = nextNewline + 1;
      code = code.substring(0, insertPos) + '          ...(qqUnionIdMobile ? { qqUnionId: qqUnionIdMobile } : {}),\n' + code.substring(insertPos);
      console.log("Added unionId to mobile user creation");
    }
  }
}

// Also fix the IM chat issue - check if there are other restrictions
const imPath = '/root/shipin-cinematic-studio/backend/src/routes/im.ts';
let imCode = fs.readFileSync(imPath, 'utf8');

// Check for any other messaging restrictions
const restrictionPatterns = [
  '对方尚未回复',
  '24小时',
  '只能发送',
  'restriction',
  'block',
  'forbid'
];

console.log("\n=== Checking IM for restrictions ===");
restrictionPatterns.forEach(p => {
  if (imCode.includes(p)) {
    const idx = imCode.indexOf(p);
    console.log("Found '" + p + "' at " + idx + ": " + imCode.substring(Math.max(0, idx-50), idx+50));
  }
});

fs.writeFileSync(filePath, code);
console.log("\nQQ OAuth file saved");
