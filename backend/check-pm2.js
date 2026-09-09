const { execSync } = require('child_process');
for (let i = 0; i <= 5; i++) {
  try {
    const out = execSync('grep -i "IM\|message\|error" /root/.pm2/logs/api-server-' + i + '-out.log 2>/dev/null | tail -5', { encoding: 'utf8' });
    if (out.trim()) console.log('=== api-server-' + i + ' ===\n' + out);
  } catch(e) {}
}
