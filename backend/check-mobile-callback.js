const fs = require('fs');

const filePath = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
const code = fs.readFileSync(filePath, 'utf8');

// Find the mobile callback handler
const lines = code.split('\n');

// Find the section around line 944 (mobile login)
console.log("=== Mobile Login Section (lines 940-1050) ===");
for (let i = 940; i < 1050 && i < lines.length; i++) {
  console.log((i+1) + ": " + lines[i]);
}

// Check if mobile calls unionid=1
console.log("\n=== unionid parameter in API calls ===");
lines.forEach((l, i) => {
  if (l.includes('unionid') || l.includes('unionId') || l.includes('get_unionid')) {
    console.log((i+1) + ": " + l.trim());
  }
});
