/**
 * 一次性脚本：为百万字测试账号配置智谱 BYOK
 * key 从环境变量 ZHIPU_API_KEY 读取，加密后入库，不落明文文件
 */
import { PrismaClient } from '@prisma/client'
import { encryptKey, decryptKey } from '../src/services/crypto.service.js'

const prisma = new PrismaClient()

async function main() {
  const key = process.env.ZHIPU_API_KEY
  if (!key) throw new Error('缺少 ZHIPU_API_KEY 环境变量')

  // 测试账号：reality@test.com（百万字测试专用）
  const user = await prisma.user.findUnique({ where: { email: 'reality@test.com' } })
  if (!user) throw new Error('测试账号不存在')

  const encrypted = encryptKey(key)

  await prisma.userModelConfigV2.upsert({
    where: { userId: user.id },
    update: {
      llmProvider: 'zhipu',
      llmModel: 'glm-4-flash',
      llmApiKey: encrypted,
      llmBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      llmEnabled: true,
    },
    create: {
      userId: user.id,
      llmProvider: 'zhipu',
      llmModel: 'glm-4-flash',
      llmApiKey: encrypted,
      llmBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      llmEnabled: true,
    },
  })

  // 验证：解密回读一致
  const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId: user.id } })
  const decrypted = decryptKey(v2!.llmApiKey!)
  const ok = decrypted === key
  console.log(`✅ 智谱 Key 已加密入库: user=${user.email} provider=zhipu model=glm-4-flash`)
  console.log(`✅ 解密回读验证: ${ok ? '一致' : '不一致！'}`)
  console.log(`   DB 存储（密文）: ${v2!.llmApiKey!.slice(0, 16)}...`)
  if (!ok) process.exit(1)
}

main().finally(() => prisma.$disconnect())
