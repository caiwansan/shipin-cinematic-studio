const fs = require('fs');

const filePath = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
const code = fs.readFileSync(filePath, 'utf8');
const lines = code.split('\n');

// Show the native mobile flow (lines 1180-1300)
console.log("=== Native Mobile Flow (lines 1180-1300) ===");
for (let i = 1180; i < 1300 && i < lines.length; i++) {
  console.log((i+1) + ": " + lines[i]);
}
