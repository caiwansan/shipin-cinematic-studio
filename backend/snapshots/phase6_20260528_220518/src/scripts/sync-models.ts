/**
 * 从环境变量和 Provider Registry 同步大模型到数据库
 */
import crypto from 'crypto'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const ENCRYPTION_KEY = process.env.CRYPTO_ENCRYPTION_KEY || 'default-dev-key-32chars!!'

function encrypt(text: string): string {
  if (!text) return ''
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// 定义所有已知模型
const knownModels = [
  // DeepSeek
  { name: 'deepseek-chat', provider: 'deepseek', modelType: 'text', endpointUrl: 'https://api.deepseek.com/v1/chat/completions', apiKeyRef: 'DEEPSEEK_API_KEY', qualityScore: 0.95, concurrencyMax: 10 },
  { name: 'deepseek-reasoner', provider: 'deepseek', modelType: 'text', endpointUrl: 'https://api.deepseek.com/v1/chat/completions', apiKeyRef: 'DEEPSEEK_API_KEY', qualityScore: 0.98, concurrencyMax: 5 },
  
  // 火山引擎 豆包
  { name: 'doubao-seed-2-0-mini-260428', provider: 'volcengine', modelType: 'text', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.92, concurrencyMax: 10 },
  { name: 'doubao-seedance-1-0-pro-fast-251015', provider: 'volcengine', modelType: 'video', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.85, concurrencyMax: 2 },
  { name: 'doubao-seedream-4-0-250828', provider: 'volcengine', modelType: 'image', endpointUrl: 'https://ark.cn-beijing.volces.com/api/v3/completions', apiKeyRef: 'VOLCENGINE_API_KEY', qualityScore: 0.88, concurrencyMax: 3 },

  // Kimi
  { name: 'kimi-k1.5', provider: 'kimi', modelType: 'text', endpointUrl: 'https://api.moonshot.cn/v1/chat/completions', apiKeyRef: 'KIMI_API_KEY', qualityScore: 0.9, concurrencyMax: 5 },
  { name: 'moonshot-v1-8k', provider: 'kimi', modelType: 'text', endpointUrl: 'https://api.moonshot.cn/v1/chat/completions', apiKeyRef: 'KIMI_API_KEY', qualityScore: 0.85, concurrencyMax: 10 },
  { name: 'moonshot-v1-32k', provider: 'kimi', modelType: 'text', endpointUrl: 'https://api.moonshot.cn/v1/chat/completions', apiKeyRef: 'KIMI_API_KEY', qualityScore: 0.87, concurrencyMax: 8 },
  { name: 'moonshot-v1-128k', provider: 'kimi', modelType: 'text', endpointUrl: 'https://api.moonshot.cn/v1/chat/completions', apiKeyRef: 'KIMI_API_KEY', qualityScore: 0.88, concurrencyMax: 5 },

  // 硅基流动
  { name: 'Qwen/Qwen2.5-72B-Instruct', provider: 'siliconflow', modelType: 'text', endpointUrl: 'https://api.siliconflow.cn/v1/chat/completions', apiKeyRef: 'SILICONFLOW_API_KEY', qualityScore: 0.88, concurrencyMax: 10 },
  { name: 'deepseek-ai/DeepSeek-V3', provider: 'siliconflow', modelType: 'text', endpointUrl: 'https://api.siliconflow.cn/v1/chat/completions', apiKeyRef: 'SILICONFLOW_API_KEY', qualityScore: 0.9, concurrencyMax: 10 },
  { name: 'THUDM/glm-4-9b-chat', provider: 'siliconflow', modelType: 'text', endpointUrl: 'https://api.siliconflow.cn/v1/chat/completions', apiKeyRef: 'SILICONFLOW_API_KEY', qualityScore: 0.78, concurrencyMax: 10 },

  // 阿里百炼
  { name: 'qwen-plus', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.9, concurrencyMax: 10 },
  { name: 'qwen-max', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.95, concurrencyMax: 5 },
  { name: 'qwen-turbo', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.82, concurrencyMax: 15 },
  { name: 'qwen-long', provider: 'bailian', modelType: 'text', endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKeyRef: 'ALIYUN_API_KEY', qualityScore: 0.8, concurrencyMax: 10 },
]

async function main() {
  console.log('🔄 开始同步大模型到数据库...\n')

  await prisma.aiModel.deleteMany({})
  console.log('🧹 已清除旧数据\n')

  let created = 0
  for (const m of knownModels) {
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
      created++
    } catch (e) {
      console.log(`  ❌ ${m.provider}/${m.name}: ${e.message}`)
    }
  }

  // 同步 API Key
  console.log('\n📦 同步 API Key...')
  const keyMappings = [
    { provider: 'deepseek', keyName: 'DeepSeek API Key', envVar: 'DEEPSEEK_API_KEY' },
    { provider: 'volcengine', keyName: '火山引擎 API Key', envVar: 'VOLCENGINE_API_KEY' },
    { provider: 'kimi', keyName: 'Kimi API Key', envVar: 'KIMI_API_KEY' },
    { provider: 'siliconflow', keyName: '硅基流动 API Key', envVar: 'SILICONFLOW_API_KEY' },
    { provider: 'bailian', keyName: '阿里百炼 API Key', envVar: 'ALIYUN_API_KEY' },
  ]

  for (const km of keyMappings) {
    const rawKey = process.env[km.envVar]
    if (rawKey) {
      const encrypted = encrypt(rawKey)
      await prisma.apiKey.upsert({
        where: { provider: km.provider },
        update: { keyName: km.keyName, keyValue: encrypted },
        create: { provider: km.provider, keyName: km.keyName, keyValue: encrypted },
      })
      console.log(`  🔑 ${km.provider}: API Key 已同步`)
    } else {
      console.log(`  ⚠️  ${km.provider}: 无 Key，跳过`)
    }
  }

  const total = await prisma.aiModel.count()
  const keyCount = await prisma.apiKey.count()
  console.log(`\n✅ 完成！${created} 个模型，${keyCount} 个 API Key`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
