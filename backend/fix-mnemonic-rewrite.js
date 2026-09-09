const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Find the start of the mnemonic route
const routeStart = code.indexOf("fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {");
if (routeStart === -1) {
  console.log('Route start not found');
  process.exit(1);
}

// Find the end of the route (the closing })
let braceCount = 0;
let inString = false;
let stringChar = '';
let routeEnd = routeStart;

for (let i = routeStart; i < code.length; i++) {
  const ch = code[i];
  const prev = code[i-1] || '';
  
  if (!inString) {
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') {
      braceCount++;
    } else if (ch === '}') {
      braceCount--;
      if (braceCount === 0) {
        routeEnd = i + 1;
        while (code[routeEnd] === ' ') routeEnd++;
        break;
      }
    }
  } else {
    if (ch === stringChar && prev !== '\\') {
      inString = false;
    }
  }
}

const oldRoute = code.substring(routeStart, routeEnd);
console.log('Found route, length:', oldRoute.length);

// Build the new route with proper try-catch
const newRoute = `fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      const __rec: any = await prisma.$queryRawUnsafe(\`SELECT enc_key, mnemonic_hash, backup_at FROM user_asset_recovery WHERE user_id = $1\`, userId)
      if (__rec[0] && (__rec[0].enc_key || __rec[0].mnemonic_hash)) {
        return { success: true, data: { already: true, hasMnemonic: true, backupAt: __rec[0].backup_at || 0 } }
      }
      if (!WORDLIST.length) return { success: false, error: '词库加载失败' }
      const words: string[] = []
      for (let i = 0; i < 12; i++) words.push(WORDLIST[Math.floor(Math.random() * WORDLIST.length)])
      const mnemonic = words.join(' ')
      const key = deriveKey(mnemonic)
      const ts = Math.floor(Date.now() / 1000)
      await prisma.$queryRawUnsafe(
        \`INSERT INTO user_asset_recovery (user_id, mnemonic_hash, enc_key, updated_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET mnemonic_hash=$2, enc_key=$3, updated_at=$4\`,
        userId, h(mnemonic), key.toString('hex'), ts)
      return { success: true, data: { mnemonic, words, already: false } }
    } catch (e: any) {
      console.error('[mnemonic] error:', e.message)
      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  })`;

code = code.substring(0, routeStart) + newRoute + code.substring(routeEnd);
fs.writeFileSync(file, code);
console.log('Route rewritten successfully');
