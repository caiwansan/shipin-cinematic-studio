/**
 * 更新阿里百炼最新图片/视频模型（v3）
 * - 万相 2.7（文生图+图生图/编辑）
 * - 万相 2.5-i2i（图生图专用）
 * - happyhorse 系列（文生视频、图生视频）
 * - qwen-image 千问系列（图生图编辑）
 * - 通义万相视频理解
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const newModels = [
  // ── 阿里百炼 图片模型 ──
  // wan2.7-image-pro: 文生图+图生图（编辑/多图参考），最高 4096x4096（文生图）/ 2048x2048（编辑）
  { name: 'wan2.7-image-pro', provider: 'bailian', modelType: 'image',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.95, concurrencyMax: 2, params: { supportsI2I: true } },
  // wan2.7-image: wan2.7的快速版，最高2K
  { name: 'wan2.7-image', provider: 'bailian', modelType: 'image',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.90, concurrencyMax: 3, params: { supportsI2I: true } },
  // wan2.5-i2i-preview: 专用图生图模型（编辑模式）
  { name: 'wan2.5-i2i-preview', provider: 'bailian', modelType: 'image',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.88, concurrencyMax: 3, params: { i2iOnly: true } },
  // qwen-image-2.0-pro: 文生图+图生图编辑，支持负向提示词
  { name: 'qwen-image-2.0-pro', provider: 'bailian', modelType: 'image',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.92, concurrencyMax: 3, params: { supportsI2I: true, maxOutput: 6 } },
  // z-image-turbo: 快速低成本文生图
  { name: 'z-image-turbo', provider: 'bailian', modelType: 'image',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.82, concurrencyMax: 5, params: {} },

  // ── 阿里百炼 视频生成模型 ──
  // happyhorse-1.0-i2v: 图生视频（分镜图 → 动态视频）
  { name: 'happyhorse-1.0-i2v', provider: 'bailian', modelType: 'video',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/video/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.90, concurrencyMax: 1, params: { i2v: true } },
  // happyhorse-1.0-t2v: 文生视频
  { name: 'happyhorse-1.0-t2v', provider: 'bailian', modelType: 'video',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/video/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.88, concurrencyMax: 1, params: { t2v: true } },
  // happyhorse-1.0-r2v: 参考视频生成
  { name: 'happyhorse-1.0-r2v', provider: 'bailian', modelType: 'video',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/video/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.88, concurrencyMax: 1, params: { r2v: true } },
  // happyhorse-1.0-video-edit: 视频编辑
  { name: 'happyhorse-1.0-video-edit', provider: 'bailian', modelType: 'video',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/video/generations',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.85, concurrencyMax: 1, params: { edit: true } },

  // ── 阿里百炼 最新文本模型 ──
  { name: 'qwen3.6-max-preview', provider: 'bailian', modelType: 'text',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.98, concurrencyMax: 5 },
  { name: 'qwen3.6-plus', provider: 'bailian', modelType: 'text',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.96, concurrencyMax: 8 },
  { name: 'qwen3.6-flash', provider: 'bailian', modelType: 'text',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.85, concurrencyMax: 15 },
  // DeepSeek 通过百炼接入（三方模型）
  { name: 'deepseek-v4-pro', provider: 'bailian', modelType: 'text',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.97, concurrencyMax: 5 },
  { name: 'deepseek-v4-flash', provider: 'bailian', modelType: 'text',
    endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.92, concurrencyMax: 10 },
]

async function main() {
  console.log('🔄 更新阿里百炼最新模型（v3）...\n')

  let added = 0
  let skipped = 0

  for (const m of newModels) {
    const existing = await prisma.aiModel.findUnique({ where: { name: m.name } })
    if (existing) {
      console.log(`  ⏭️  已存在: ${m.provider}/${m.name}`)
      skipped++
      continue
    }

    try {
      await prisma.aiModel.create({
        data: {
          name: m.name,
          provider: m.provider,
          modelType: m.modelType,
          status: 'active',
          endpointUrl: m.endpointUrl,
          apiKeyRef: m.apiKeyRef,
          costPerRequest: 0,
          costPerToken: 0,
          qualityScore: m.qualityScore,
          avgLatency: 0,
          concurrencyMax: m.concurrencyMax,
          currentLoad: 0,
          params: m.params || {},
        },
      })
      console.log(`  ✅ ${m.provider}/${m.name} (${m.modelType})`)
      added++
    } catch (e) {
      console.log(`  ❌ ${m.provider}/${m.name}: ${e.message}`)
      skipped++
    }
  }

  const bailian = await prisma.aiModel.count({ where: { provider: 'bailian' } })
  const total = await prisma.aiModel.count()
  const byType = await prisma.aiModel.groupBy({
    by: ['modelType', 'provider'],
    _count: true,
  })

  console.log(`\n📊 统计：`)
  console.log(`  阿里百炼: ${bailian} 个模型`)
  console.log(`  总计: ${total} 个模型`)
  console.log(`\n  按类型/供应商：`)
  for (const row of byType) {
    console.log(`    ${row.provider}/${row.modelType}: ${row._count}`)
  }

  console.log(`\n✅ 新增 ${added} 个，跳过 ${skipped} 个`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
