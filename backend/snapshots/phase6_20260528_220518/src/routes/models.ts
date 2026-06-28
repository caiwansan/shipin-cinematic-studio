import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// 模型展示名称映射（中文友好）
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // 图片模型
  'doubao-seedream-4-0-250828': 'Seedream 4.0',
  'doubao-seedream-4-5-251128': 'Seedream 4.5',
  'flux-schnell': 'Flux Schnell',
  'flux-pro': 'Flux Pro',
  'sdxl': 'SDXL',
  'jimeng-midjourney': '即梦 Midjourney',
  'tongyi-wanxiang': '通义万相',
  'wujing-dall-e-4': 'DALL·E 4',
  'stable-diffusion-3-5': 'Stable Diffusion 3.5',
  // 视频模型
  'doubao-seedance-2-0-260128': 'Seedance 2.0',
  'doubao-seedance-1-5-pro-251215': 'Seedance 1.5 Pro',
  'kling-2-0': 'Kling 2.0',
  'kling-1-6': 'Kling 1.6',
  'sora': 'OpenAI Sora',
  'minimax-video': 'Minimax 视频',
  'runway-gen-4': 'Runway Gen-4',
  'pixverse': 'PixVerse',
  // LLM 模型
  'doubao-seed-2-0-mini-260428': 'Seed 2.0 Mini',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'gemini-2-5-pro': 'Gemini 2.5 Pro',
  'gemini-2-0-flash': 'Gemini 2.0 Flash',
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
  'qwen-max': '通义千问 Max',
  'ernie-4-5': '文心一言 4.5',
  'moonshot-kimi': 'Moonshot Kimi',
}

// 各分类下的推荐模型
const RECOMMENDED_MODELS: Record<string, string[]> = {
  image: ['doubao-seedream-4-0-250828', 'doubao-seedream-4-5-251128', 'flux-pro', 'stable-diffusion-3-5'],
  video: ['doubao-seedance-2-0-260128', 'kling-2-0', 'runway-gen-4'],
  llm: ['gpt-4o', 'doubao-seed-2-0-mini-260428', 'claude-3-5-sonnet', 'deepseek-chat'],
}

// API key 检查：provider → env var name
const PROVIDER_KEY_MAP: Record<string, string> = {
  volcengine: 'VOLCENGINE_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  replicate: 'REPLICATE_API_KEY',
  jimeng: 'JIMENG_API_KEY',
  aliyun: 'ALIYUN_API_KEY',
  google: 'GOOGLE_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  baidu: 'BAIDU_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  kling: 'KLING_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  runway: 'RUNWAY_API_KEY',
  pixverse: 'PIXVERSE_API_KEY',
}

function checkKeyAvailable(provider: string): boolean {
  const envVar = PROVIDER_KEY_MAP[provider]
  if (!envVar) return false
  const val = process.env[envVar]
  return !!val && val.length > 0
}

export default async function modelRoutes(fastify: FastifyInstance) {
  // GET /api/v1/models/available — 获取所有可用模型（无需认证）
  fastify.get('/api/v1/models/available', async (request, reply) => {
    try {
      const models = await prisma.aiModel.findMany({
        orderBy: [{ modelType: 'asc' }, { name: 'asc' }],
      })

      const result = models.map((m) => {
        const available = checkKeyAvailable(m.provider)
        const type = m.modelType
        const recommended = RECOMMENDED_MODELS[type]
          ? RECOMMENDED_MODELS[type].includes(m.name)
          : false

        return {
          id: m.name,
          name: MODEL_DISPLAY_NAMES[m.name] || m.name,
          type: m.modelType,
          provider: m.provider,
          available,
          recommended,
        }
      })

      return { models: result }
    } catch (err) {
      console.error('[models] Error fetching available models:', err)
      return reply.status(500).send({ error: '获取模型列表失败' })
    }
  })
}
