/**
 * seed-aliyun-models.ts — 向 ModelProvider 表插入阿里百炼系列模型
 * 先查是否已存在，不存在才插入
 *
 * 用法: npx tsx prisma/seed-aliyun-models.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ALIYUN_MODELS = [
  {
    provider: 'aliyun_llm',
    label: '阿里百炼·千问',
    modelType: 'llm',
    modelName: 'qwen3.6-max-preview',
    apiKeyEnv: 'ALIYUN_API_KEY',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    isActive: true,
    sortOrder: 10,
  },
  {
    provider: 'aliyun_image',
    label: '阿里百炼·万相',
    modelType: 'image',
    modelName: 'wan2.7-image-pro',
    apiKeyEnv: 'ALIYUN_API_KEY',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    isActive: true,
    sortOrder: 10,
  },
  {
    provider: 'aliyun_video',
    label: '阿里百炼·万相视频',
    modelType: 'video',
    modelName: 'wan2.7-t2v',
    apiKeyEnv: 'ALIYUN_API_KEY',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    isActive: true,
    sortOrder: 10,
  },
  {
    provider: 'aliyun_tts',
    label: '阿里百炼·CosyVoice',
    modelType: 'tts',
    modelName: 'cosyvoice-v3.5-plus',
    apiKeyEnv: 'ALIYUN_API_KEY',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/tts/audio',
    isActive: true,
    sortOrder: 10,
  },
]

async function main() {
  let inserted = 0
  let skipped = 0

  for (const model of ALIYUN_MODELS) {
    const existing = await prisma.modelProvider.findUnique({
      where: { provider: model.provider },
    })

    if (existing) {
      console.log(`⏭️  [${model.provider}] 已存在，跳过`)
      skipped++
      continue
    }

    await prisma.modelProvider.create({ data: model })
    console.log(`✅  [${model.provider}] ${model.label} - ${model.modelName} 已插入`)
    inserted++
  }

  console.log(`\n📊 完成: 插入 ${inserted}, 跳过 ${skipped}`)
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
