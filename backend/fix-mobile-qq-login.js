const fs = require('fs');

const filePath = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Fix: Mobile QQ login doesn't check unionId (lines ~944-1044)
// The PC flow checks unionId at line 534, but mobile only checks openId

// Find the mobile user lookup section
const mobileSection = code.indexOf("const already = await prisma.user.findFirst");
if (mobileSection < 0) {
  console.log("ERROR: Mobile lookup pattern not found");
  process.exit(1);
}

// Show context
console.log("Found mobile lookup at:", mobileSection);
console.log("Context:", code.substring(mobileSection, mobileSection + 300));

// Replace the mobile lookup with unionId-aware lookup
const oldMobileLookup = `const already = await prisma.user.findFirst({ where: { OR: [{ qqOpenId }, { email: \`qq_\${qqOpenId}@aigc.fushtn.com\` }] } })`;
const newMobileLookup = `// Check unionId first (cross-platform identity like PC flow)
        let mobileUser = null;
        const qqUnionIdMobile = meData.unionid || '';
        if (qqUnionIdMobile) {
          const _ur = await prisma.\$queryRawUnsafe('SELECT id FROM "User" WHERE "qq_union_id"=\$1 LIMIT 1', qqUnionIdMobile);
          if (_ur && _ur[0] && _ur[0].id) mobileUser = await prisma.user.findUnique({ where: { id: _ur[0].id } });
        }
        if (!mobileUser) {
          const already = await prisma.user.findFirst({ where: { OR: [{ qqOpenId }, { email: \`qq_\${qqOpenId}@aigc.fushtn.com\` }] } });
          if (already) mobileUser = already;
        }
        const already = mobileUser;`;

if (code.includes(oldMobileLookup)) {
  code = code.replace(oldMobileLookup, newMobileLookup);
  console.log("Fixed mobile QQ login unionId lookup");
} else {
  console.log("Pattern not found, trying alternative...");
}

// Also fix mobile user creation to include unionId
const oldMobileCreate = `user = await prisma.user.create({
          email: \`qq_\${qqOpenId}@aigc.fushtn.com\`,
          username: nickname || \`qq_\${qqOpenId}\`,
          passwordHash: '',
          qqOpenId,
          avatarUrl: avatarUrl || '',`;

const newMobileCreate = `user = await prisma.user.create({
          email: \`qq_\${qqOpenId}@aigc.fushtn.com\`,
          username: nickname || \`qq_\${qqOpenId}\`,
          passwordHash: '',
          qqOpenId,
          ...(qqUnionIdMobile ? { qqUnionId: qqUnionIdMobile } : {}),
          avatarUrl: avatarUrl || '',`;

if (code.includes(oldMobileCreate)) {
  code = code.replace(oldMobileCreate, newMobileCreate);
  console.log("Fixed mobile user creation to include unionId");
} else {
  console.log("Mobile create pattern not found");
}

fs.writeFileSync(filePath, code);
console.log("File saved successfully");
