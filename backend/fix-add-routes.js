const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// The file currently ends with `});` but needs the missing routes and closing brace
// Remove the trailing `);` and add the missing routes + closing

// Find the end of the mnemonic route (the `);` at the end)
const mnemonicEnd = code.lastIndexOf(');');
if (mnemonicEnd === -1) {
  console.log('Could not find mnemonic route end');
  process.exit(1);
}

// Keep everything before the `);`
code = code.substring(0, mnemonicEnd);

// Add the missing routes and closing
const missingRoutes = `

  // POST /api/tea/storage/mnemonic/reset — 重置助记词
  fastify.post('/api/tea/storage/mnemonic/reset', auth, async (request: any) => {
    const userId = request.user.id
    await prisma.$queryRawUnsafe(\`UPDATE user_asset_recovery SET mnemonic_hash='', enc_key='', backup_data='', backup_at=0, updated_at=$1 WHERE user_id=$2\`,
      Math.floor(Date.now() / 1000), userId)
    return { success: true, data: { message: '已重置，请重新生成助记词并抄好' } }
  })

  // POST /api/tea/storage/backup — 备份当前数据（加密快照）
  fastify.post('/api/tea/storage/backup', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    const rec = await getRec(userId)
    if (!rec?.ek) return reply.status(400).send({ success: false, error: '请先生成助记词（数据备份需助记词加密）' })
    const obj = await buildBackupObject(userId)
    const enc = encrypt(JSON.stringify(obj), Buffer.from(rec.ek, 'hex'))
    const ts = Math.floor(Date.now() / 1000)
    await prisma.$queryRawUnsafe(
      \`INSERT INTO user_asset_recovery (user_id, backup_data, backup_at, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET backup_data=$2, backup_at=$3, updated_at=$4\`,
      userId, enc, ts, ts)
    return { success: true, data: { message: '备份完成（加密快照已存云端）' } }
  })

  // GET /api/tea/storage/backups — 备份概览
  fastify.get('/api/tea/storage/backups', auth, async (request: any) => {
    const userId = request.user.id
    const rec = await getRec(userId)
    if (!rec?.bd) return { success: true, data: { backups: [] } }
    return {
      success: true, data: {
        backups: [{ file: 'snapshot-' + Number(rec.ba) + '.json', backupAt: new Date(Number(rec.ba) * 1000).toISOString(), encrypted: true, size: rec.bd.length }],
      },
    }
  })

  // POST /api/tea/storage/restore — 输入助记词找回恢复
  fastify.post('/api/tea/storage/restore', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    const { mnemonic } = (request.body as any) || {}
    if (!mnemonic || !String(mnemonic).trim()) return reply.status(400).send({ success: false, error: '请输入助记词' })
    const rec = await getRec(userId)
    if (!rec?.mh || h(String(mnemonic).trim().toLowerCase()) !== rec.mh) {
      return reply.status(403).send({ success: false, error: '助记词校验失败（请检查拼写）' })
    }
    if (!rec.bd) return { success: true, data: { restored: true, data: null, message: '助记词正确，暂无备份数据' } }
    try {
      const json = JSON.parse(decrypt(rec.bd, Buffer.from(rec.ek, 'hex')))
      return { success: true, data: { restored: true, data: json, message: '备份已恢复' } }
    } catch (e) {
      return reply.status(500).send({ success: false, error: '备份解密失败（密钥不匹配）' })
    }
  })
});
`;

code += missingRoutes;

fs.writeFileSync(file, code);
console.log('Added missing routes and closing brace');
