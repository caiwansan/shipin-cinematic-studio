const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the mnemonic route with a fixed version
const oldRoute = `fastify.post('/api/tea/storage/mnemonic', auth, async (request: any) => {
    const userId = request.user.id
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
    return { success: true, data: { mnemonic, words } }
  })`;

const newRoute = `fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      // 幂等：已存在则绝不覆盖/不回显明文
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

if (code.includes(oldRoute)) {
  code = code.replace(oldRoute, newRoute);
  fs.writeFileSync(file, code);
  console.log('Fixed mnemonic route');
} else {
  console.log('Old route not found');
}
