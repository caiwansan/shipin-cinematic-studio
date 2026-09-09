const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the getQQConfig function
const oldFunc = /async function getQQConfig\(platform\?: string\) \{[^}]+\}[^}]+\}[^}]+\}[^}]+\}/;
const newFunc = `async function getQQConfig(platform?: string) {
  try {
    if (platform === 'mobile') {
      const rows = await prisma.\$queryRawUnsafe(
        "SELECT config FROM payment_secret WHERE channel = \'qq_mobile\' AND enabled = true LIMIT 1"
      );
      if (rows.length > 0) {
        const cfg = JSON.parse(rows[0].config);
        if (cfg.appId) return { ...cfg, platform: 'mobile' };
      }
      return null;
    }
    const rows = await prisma.\$queryRawUnsafe(
      "SELECT config FROM payment_secret WHERE channel = \'qq_oauth\' AND enabled = true LIMIT 1"
    );
    if (rows.length > 0) {
      const cfg = JSON.parse(rows[0].config);
      if (cfg.appId) return { ...cfg, platform: 'web' };
    }
    return null;
  } catch (e) {
    console.error('[getQQConfig] Error:', e.message);
    return null;
  }
}`;

// Simple replacement: find the function and replace it
const startIdx = code.indexOf('async function getQQConfig');
const endIdx = code.indexOf('export default async function qqOAuthRoutes');
if (startIdx > 0 && endIdx > 0) {
  code = code.substring(0, startIdx) + newFunc + '\n\n' + code.substring(endIdx);
  fs.writeFileSync(file, code);
  console.log('Replaced getQQConfig function');
} else {
  console.log('Could not find function boundaries');
}
