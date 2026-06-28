// ============================================================
// jobs/fix-cos-encryption.ts
//
// FIX — COS Key Encryption Migration
//
// 诊断结果：storage_configs 中的 secretKey 的 auth tag 长度为 64 hex
// （32 bytes），而当前 crypto.service.ts 的 AES-256-GCM 只生成 32 hex
// （16 bytes）。这表明此值根本不是当前加密系统生成的——可能是：
//   1. 旧版 Python 脚本写入的（不再在代码库中）
//   2. 或其他环境写入的
//
// 修复策略：
//   旧密钥已丢失且格式不兼容 → 无法解密
//   必须重新输入真实的 secretKey
//
// 使用方式：
//   npx tsx src/jobs/fix-cos-encryption.ts --rekey <raw-secret-key>
//   或通过管理后台 API 重新提交
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const rekeyIndex = args.indexOf('--rekey')
  const rawKey = rekeyIndex >= 0 ? args[rekeyIndex + 1] : null

  console.log('='.repeat(60))
  console.log('[FIX] 🔧 COS Key Encryption Diagnostic')
  console.log('='.repeat(60))

  const configs = await prisma.storageConfig.findMany()
  console.log(`[FIX] 发现 ${configs.length} 个存储配置\n`)

  for (const config of configs) {
    const sk = config.secretKey
    const parts = sk.split(':')
    const tagHexLen = parts.length >= 2 ? parts[1].length : 0

    console.log(`  Config: ${config.name} (${config.type})`)
    console.log(`    Bucket: ${config.bucket}`)
    console.log(`    Region: ${config.region}`)
    console.log(`    Auth tag length: ${tagHexLen} hex chars = ${tagHexLen / 2} bytes`)
    console.log(`    Current system requires: 32 hex chars (16 bytes)`)
    console.log(`    Match: ${tagHexLen === 32 ? '✅ YES' : '❌ NO — format mismatch'}`)

    if (tagHexLen === 32) {
      try {
        const { decryptKey } = await import('../services/crypto.service.js')
        const raw = decryptKey(sk)
        console.log(`    ✅ Decryptable (key=${raw.substring(0, 6)}...)`)
      } catch (e: any) {
        console.log(`    ❌ Decrypt failed: ${e.message}`)
        console.log(`    🔧 Current ENCRYPTION_KEY does not match encryption key`)
      }
    }

    if (rekeyIndex >= 0 && rawKey) {
      console.log(`\n  🔄 Re-keying with provided secretKey...`)
      const { encryptKey } = await import('../services/crypto.service.js')
      const newEncrypted = encryptKey(rawKey)
      await prisma.storageConfig.update({
        where: { id: config.id },
        data: { secretKey: newEncrypted },
      })
      console.log(`    ✅ Updated: ${newEncrypted.substring(0, 30)}...`)
    }

    console.log('')
  }

  if (!rawKey) {
    console.log('='.repeat(60))
    console.log('[FIX] 📋 诊断完成。如需修复：')
    console.log('  选项 A: 通过管理后台 API 重新提交')
    console.log('    POST /api/admin/storage-config')
    console.log('    body: { id, name, type, endpoint, accessKey, secretKey: "<真实密钥>", bucket }')
    console.log('')
    console.log('  选项 B: 用命令行重设')
    console.log('    npx tsx src/jobs/fix-cos-encryption.ts --rekey "<真实secretKey>"')
    console.log('')
    console.log('  ⚠️  注意: 选项 B 会保留现有配置，只替换 secretKey 字段')
  }
  console.log('='.repeat(60))
}

main()
  .catch((e) => console.error('[FIX] 执行失败:', e))
  .finally(() => prisma.$disconnect())
