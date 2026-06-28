/**
 * 更新百炼和火山引擎的大模型品种
 * - 阿里百炼：加入 qwen-max-latest / qwq-plus / qwen-vl-max / qwen-vl-plus / qwen2.5-vl-72b / qwen-turbo-latest / qwen-coder-plus
 * - 火山引擎：加入 doubao-pro / doubao-1.5-pro / doubao-vision-pro / doubao-seed-2.0 / doubao-seed-1.5
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const newModels = [
  // ── 阿里百炼（DashScope）最新模型 ──
  { name: 'qwen-max-latest', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.97, concurrencyMax: 5 },
  { name: 'qwq-plus', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.95, concurrencyMax: 5 },
  { name: 'qwen-vl-max', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.92, concurrencyMax: 5 },
  { name: 'qwen-vl-plus', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.88, concurrencyMax: 8 },
  { name: 'qwen2.5-vl-72b', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.92, concurrencyMax: 5 },
  { name: 'qwen-turbo-latest', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.82, concurrencyMax: 15 },
  { name: 'qwen-coder-plus', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.93, concurrencyMax: 8 },
  { name: 'qwen2.5-vl-7b', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.82, concurrencyMax: 10 },
  { name: 'wanx2.1-t2i-plus', provider: 'bailian', modelType: 'image', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.88, concurrencyMax: 2 },

  // ── 火山引擎 豆包最新模型 ──
  { name: 'doubao-1-5-pro-256k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.96, concurrencyMax: 5 },
  { name: 'doubao-1-5-pro-32k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.95, concurrencyMax: 8 },
  { name: 'doubao-1-5-lite-32k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.85, concurrencyMax: 15 },
  { name: 'doubao-pro-32k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.93, concurrencyMax: 8 },
  { name: 'doubao-pro-128k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.93, concurrencyMax: 5 },
  { name: 'doubao-vision-pro-32k', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.91, concurrencyMax: 5 },
  { name: 'doubao-seed-2-0', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.98, concurrencyMax: 5 },
  { name: 'doubao-seed-1-5', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.94, concurrencyMax: 8 },
  { name: 'doubao-seedance-2-0', provider: 'volcengine', modelType: 'video', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.9, concurrencyMax: 2 },
  { name: 'doubao-seedream-2-0', provider: 'volcengine', modelType: 'image', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.92, concurrencyMax: 3 },
]

async function main() {
  console.log('🔄 更新百炼和火山的大模型品种...\n')

  let added = 0
  let skipped = 0

  for (const m of newModels) {
    // 检查是否已存在
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
          params: {},
        },
      })
      console.log(`  ✅ ${m.provider}/${m.name} (${m.modelType})`)
      added++
    } catch (e) {
      console.log(`  ❌ ${m.provider}/${m.name}: ${e.message}`)
      skipped++
    }
  }

  // 统计
  const bailian = await prisma.aiModel.count({ where: { provider: 'bailian' } })
  const volcengine = await prisma.aiModel.count({ where: { provider: 'volcengine' } })
  const total = await prisma.aiModel.count()

  console.log(`\n📊 统计：`)
  console.log(`  阿里百炼: ${bailian} 个模型`)
  console.log(`  火山引擎: ${volcengine} 个模型`)
  console.log(`  总计: ${total} 个模型`)
  console.log(`\n✅ 新增 ${added} 个，跳过 ${skipped} 个`)
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
