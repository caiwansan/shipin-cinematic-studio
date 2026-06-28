import type { ApiResponse } from '../contracts/api/base.js';
import type { GlobalConfigResponse } from '../contracts/api/routes.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'
import { env } from '../config/env.js'

// ============ 供应商定义 ============

interface ProviderConfig {
  id: string                    // 供应商 ID（对应 ApiKey 表中的 provider）
  name: string                  // 显示名称
  envKeyPrefix: string          // env 变量的前缀（如 VOLCENGINE / ALIYUN）
  types: { type: string; label: string; defaultModel: string }[]
  // 获取该供应商模型列表的方式
  modelSource: 'volcengine-api' | 'aliyun-api' | 'preset'
  presetModels?: Record<string, string[]>
}

// 模型类型的统一映射
const MODEL_TYPES_META = [
  { type: 'llm', label: '语言模型' },
  { type: 'image', label: '图片模型' },
  { type: 'video', label: '视频模型' },
  { type: 'tts', label: '语音模型' },
]

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'volcengine',
    name: '火山引擎',
    envKeyPrefix: 'VOLCENGINE',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'doubao-seed-2-0-mini-260428' },
      { type: 'image', label: '图片模型', defaultModel: 'doubao-seedream-4-0-250828' },
      { type: 'video', label: '视频模型', defaultModel: 'doubao-seedance-1-5-pro-251215' },
      { type: 'tts', label: '语音模型', defaultModel: 'doubao-tts-1' },
    ],
    modelSource: 'volcengine-api',
  },
  {
    id: 'aliyun',
    name: '阿里百炼',
    envKeyPrefix: 'ALIYUN',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'qwen-plus' },
      { type: 'image', label: '图片模型', defaultModel: 'wanx2.1-t2i-turbo' },
      { type: 'video', label: '视频模型', defaultModel: 'wan2.7-t2v' },
      { type: 'tts', label: '语音模型', defaultModel: 'cosyvoice-v1' },
    ],
    modelSource: 'aliyun-api',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    envKeyPrefix: 'SILICONFLOW',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'Qwen/Qwen2.5-72B-Instruct' },
      { type: 'image', label: '图片模型', defaultModel: 'black-forest-labs/FLUX.1-dev' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-14B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Pro/Qwen2.5-72B-Instruct'],
      image: ['black-forest-labs/FLUX.1-dev', 'stabilityai/stable-diffusion-3.5-large'],
      video: [],
      tts: ['FunAudioLLM/CosyVoice2-0.5B', 'fishaudio/fish-speech-1.5'],
      voiceList: ['benjamin', 'charles', 'alex', 'david', 'anna', 'bella', 'claire', 'diana'],
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envKeyPrefix: 'DEEPSEEK',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'deepseek-chat' },
      { type: 'image', label: '图片模型', defaultModel: '' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['deepseek-chat', 'deepseek-reasoner'],
      image: [],
      video: [],
      tts: [],
    },
  },
  {
    id: 'google',
    name: 'Google Gemini',
    envKeyPrefix: 'GOOGLE',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'gemini-2.5-pro' },
      { type: 'image', label: '图片模型', defaultModel: 'gemini-2.5-pro' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-thinking-exp'],
      image: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
      video: [],
      tts: [],
    },
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    envKeyPrefix: 'ANTHROPIC',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'claude-sonnet-4-20250514' },
      { type: 'image', label: '图片模型', defaultModel: '' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['claude-sonnet-4-20250514', 'claude-sonnet-4', 'claude-3.7-sonnet', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus', 'claude-3-haiku'],
      image: [],
      video: [],
      tts: [],
    },
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    envKeyPrefix: 'XAI',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'grok-3' },
      { type: 'image', label: '图片模型', defaultModel: '' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['grok-3', 'grok-3-mini', 'grok-3-vision', 'grok-3-mini-vision', 'grok-2', 'grok-2-vision'],
      image: [],
      video: [],
      tts: [],
    },
  },
  {
    id: 'moonshot',
    name: '月之暗面 Moonshot',
    envKeyPrefix: 'MOONSHOT',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'kimi-k2' },
      { type: 'image', label: '图片模型', defaultModel: '' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['kimi-k2', 'kimi-k2-thinking', 'kimi-k2.5', 'kimi-k2.6', 'Moonshot-Kimi-K2-Instruct', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
      image: [],
      video: [],
      tts: [],
    },
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    envKeyPrefix: 'ZHIPU',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'glm-5' },
      { type: 'image', label: '图片模型', defaultModel: 'cogview-4' },
      { type: 'video', label: '视频模型', defaultModel: 'cogvideo' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['glm-5', 'glm-5.1', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4v-plus', 'glm-4v-flash'],
      image: ['cogview-4', 'cogview-3'],
      video: ['cogvideo'],
      tts: [],
    },
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    envKeyPrefix: 'OPENAI',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: 'gpt-4o' },
      { type: 'image', label: '图片模型', defaultModel: 'dall-e-3' },
      { type: 'video', label: '视频模型', defaultModel: 'sora' },
      { type: 'tts', label: '语音模型', defaultModel: 'tts-1' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4-turbo', 'gpt-4', 'o4-mini', 'o3-mini', 'o1', 'o1-mini', 'gpt-4o-realtime', 'gpt-4o-mini-realtime'],
      image: ['dall-e-3', 'dall-e-2'],
      video: ['sora'],
      tts: ['tts-1', 'tts-1-hd'],
    },
  },
  // 本地大模型：用户自定义 OpenAI 兼容接口
  {
    id: 'custom',
    name: '本地大模型 (OpenAI 兼容)',
    envKeyPrefix: 'CUSTOM',
    types: [
      { type: 'llm', label: '语言模型', defaultModel: '' },
      { type: 'image', label: '图片模型', defaultModel: '' },
      { type: 'video', label: '视频模型', defaultModel: '' },
      { type: 'tts', label: '语音模型', defaultModel: '' },
    ],
    modelSource: 'preset',
    presetModels: {
      llm: [],
      image: [],
      video: [],
      tts: [],
    },
  },
]

// 阿里百炼已知的活跃模型列表（因为阿里百炼没有公开的模型列表 API）
const ALIYUN_PRESET_MODELS: { type: string; id: string }[] = [
  // LLM - 通义千问系列
  { type: 'llm', id: 'qwen-turbo' },
  { type: 'llm', id: 'qwen-plus' },
  { type: 'llm', id: 'qwen-max' },
  { type: 'llm', id: 'qwen-flash' },
  { type: 'llm', id: 'qwen3-max' },
  { type: 'llm', id: 'qwen3-coder-plus' },
  { type: 'llm', id: 'qwen3-coder-flash' },
  { type: 'llm', id: 'qwen3.5-plus' },
  { type: 'llm', id: 'qwen3.5-flash' },
  { type: 'llm', id: 'qwen3.6-plus' },
  { type: 'llm', id: 'qwen3.6-flash' },
  { type: 'llm', id: 'qwen3.6-max-preview' },
  { type: 'llm', id: 'qwen3-30b-a3b' },
  { type: 'llm', id: 'qwen3-32b' },
  { type: 'llm', id: 'qwen3-14b' },
  { type: 'llm', id: 'qwen3-8b' },
  { type: 'llm', id: 'qwen3-235b-a22b' },
  { type: 'llm', id: 'qwen3-vl-plus' },
  { type: 'llm', id: 'qwen3-vl-flash' },
  { type: 'llm', id: 'qwen3-vl-32b-instruct' },
  { type: 'llm', id: 'qwen3-vl-32b-thinking' },
  { type: 'llm', id: 'qwen3-vl-30b-a3b-instruct' },
  { type: 'llm', id: 'qwen3-vl-30b-a3b-thinking' },
  { type: 'llm', id: 'qwen3-vl-235b-a22b-instruct' },
  { type: 'llm', id: 'qwen3-vl-235b-a22b-thinking' },
  { type: 'llm', id: 'qwen3-omni-30b-a3b-captioner' },
  { type: 'llm', id: 'qwen-vl-max' },
  { type: 'llm', id: 'qwen-vl-plus' },
  { type: 'llm', id: 'qwen-omni-turbo' },
  { type: 'llm', id: 'deepseek-v3.2' },
  { type: 'llm', id: 'deepseek-v4-flash' },
  { type: 'llm', id: 'deepseek-v4-pro' },
  // 图片 - 通义万相 + qwen-image
  { type: 'image', id: 'wanx2.1-t2i-turbo' },
  { type: 'image', id: 'wanx2.1-t2i-plus' },
  { type: 'image', id: 'wanx2.0-t2i-turbo' },
  { type: 'image', id: 'wan2.6-t2i' },
  { type: 'image', id: 'wan2.2-t2i-plus' },
  { type: 'image', id: 'wan2.2-t2i-flash' },
  { type: 'image', id: 'qwen-image' },
  { type: 'image', id: 'qwen-image-plus' },
  { type: 'image', id: 'qwen-image-max' },
  { type: 'image', id: 'qwen-image-2.0' },
  { type: 'image', id: 'qwen-image-2.0-pro' },
  // 视频 - 万相系列 + HappyHorse
  { type: 'video', id: 'wan2.7-t2v' },
  { type: 'video', id: 'wan2.7-videoedit' },
  { type: 'video', id: 'wan2.6-t2v' },
  { type: 'video', id: 'wan2.5-t2v-preview' },
  { type: 'video', id: 'wan2.1-t2v-turbo' },
  { type: 'video', id: 'wan2.1-i2v-turbo' },
  { type: 'video', id: 'happyhorse-1.0-t2v' },
  // TTS - CosyVoice 系列 + qwen3-tts
  { type: 'tts', id: 'cosyvoice-v3.5-plus' },
  { type: 'tts', id: 'cosyvoice-v3.5-flash' },
  { type: 'tts', id: 'cosyvoice-v3-plus' },
  { type: 'tts', id: 'cosyvoice-v3-flash' },
  { type: 'tts', id: 'cosyvoice-v2' },
  { type: 'tts', id: 'cosyvoice-v1' },
  { type: 'tts', id: 'cosyvoice-clone-v1' },
  { type: 'tts', id: 'qwen3-tts-flash' },
  { type: 'tts', id: 'qwen3-tts-instruct-flash' },
  { type: 'tts', id: 'qwen-tts' },
  { type: 'tts', id: 'qwen-tts-realtime' },
]

// ============ 工具函数 ============

function getGlobalModelKey(providerId: string, type: string): string {
  return `global_model_${providerId}_${type}`
}

/** 从 ApiKey 表加载某个供应商的保存配置 */
async function loadSavedConfigs(providerId: string): Promise<Map<string, string>> {
  const prefix = `global_model_${providerId}_`
  const rows = await prisma.apiKey.findMany({
    where: { provider: { startsWith: prefix } },
  })
  return new Map(rows.map((r) => [r.provider.replace(prefix, ''), r.keyValue]))
}

/** 按模型ID模式匹配分配图标 */
function assignModelIcon(id: string, type: string): string {
  if (type === 'video') {
    if (id.startsWith('doubao-seedance')) return '🎬'
    if (id.startsWith('kling')) return '🐉'
    if (id.startsWith('sora')) return '🌊'
    if (id.startsWith('minimax')) return '🤖'
    if (id.startsWith('runway')) return '🛤️'
    if (id.startsWith('pixverse')) return '✨'
    return '🎥'
  }
  if (type === 'image') {
    if (id.startsWith('doubao-seedream')) return '🌱'
    if (id.startsWith('flux')) return '⚡'
    if (id.startsWith('sdxl')) return '🎨'
    if (id.startsWith('jimeng')) return '🎭'
    if (id.startsWith('tongyi-wanxiang')) return '🌌'
    if (id.startsWith('wujing')) return '🎯'
    if (id.startsWith('stable-diffusion')) return '🖌️'
    if (id.startsWith('wan')) return '🖼️'
    return '🖼️'
  }
  return type === 'tts' ? '🔊' : '🧠'
}

/** 从火山引擎 API 拉取活跃模型列表 */
async function fetchVolcengineModels(): Promise<{ type: string; id: string; name: string; icon: string }[]> {
  const volcKey = process.env.VOLCENGINE_API_KEY || env.VOLCENGINE_API_KEY
  if (!volcKey) throw new Error('VOLCENGINE_API_KEY not configured')

  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/models', {
    headers: { Authorization: `Bearer ${volcKey}` },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`volcengine api returned ${res.status}`)

  const data: any = await res.json()
  const volcModels = (data.data || []) as any[]

  const DOMAIN_MAP: Record<string, string> = {
    LLM: 'llm',
    VLM: 'llm',
    ImageGeneration: 'image',
    VideoGeneration: 'video',
    TTS: 'tts',
    AudioGeneration: 'tts',
    Embedding: 'llm',
    Router: 'llm',
    '3DGeneration': 'llm',
  }

  const active = volcModels
    .filter((m: any) => !m.status || m.status === 'Active')
    .map((m: any) => ({
      type: DOMAIN_MAP[m.domain] || '',
      id: m.id,
      name: m.name || m.id,
      icon: assignModelIcon(m.id, DOMAIN_MAP[m.domain] || ''),
    }))
    .filter((m) => m.type !== '')

  // 去重
  const seen = new Set<string>()
  return active.filter((m) => {
    const key = `${m.type}:${m.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 获取模型列表（含去重、写入数据库） */
async function getModelsForProvider(providerId: string): Promise<{ id: string; type: string; name: string; icon: string }[]> {
  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!provider) return []

  if (provider.modelSource === 'volcengine-api') {
    try {
      return await fetchVolcengineModels()
    } catch (e) {
      console.warn(`[global-models] 火山引擎模型同步失败: ${(e as Error).message}，回退到数据库`)
    }
    // 回退：尝试读 ModelProvider 表
    try {
      const mp = await prisma.modelProvider.findUnique({ where: { provider: 'volcengine' } })
      if (mp?.defaultParams && typeof mp.defaultParams === 'object') {
        const dp = mp.defaultParams as Record<string, any>
        if (dp.models) {
          const result: { id: string; type: string; name: string; label: string }[] = []
          for (const [type, models] of Object.entries(dp.models)) {
            if (Array.isArray(models)) {
              for (const m of models) {
                const name = m.name || m.model || m.id
                if (name) result.push({ id: name, type, name, label: m.label || m.name || name })
              }
            }
          }
          if (result.length > 0) return result
        }
      }
    } catch {}
    // 最终回退：hardcode 已知模型
    return [
      // LLM - 最新豆包 Seed 系列
      { type: 'llm', id: 'doubao-seed-2-0-mini-260428', name: 'Doubao Seed 2.0 Mini' },
      { type: 'llm', id: 'doubao-seed-2-0-plus-260428', name: 'Doubao Seed 2.0 Plus' },
      { type: 'llm', id: 'doubao-1-5-pro-256k-250115', name: 'Doubao 1.5 Pro 256K' },
      { type: 'llm', id: 'doubao-1-5-lite-32k-250115', name: 'Doubao 1.5 Lite 32K' },
      { type: 'llm', id: 'doubao-vl-pro-256k-250115', name: 'Doubao VL Pro 256K' },
      { type: 'llm', id: 'doubao-vl-lite-32k-250115', name: 'Doubao VL Lite 32K' },
      { type: 'llm', id: 'deepseek-r1-250120', name: 'DeepSeek R1' },
      { type: 'llm', id: 'deepseek-v3-241226', name: 'DeepSeek V3' },
      { type: 'llm', id: 'o1-mini-250120', name: 'O1 Mini' },
      // Image
      { type: 'image', id: 'doubao-seedream-5-0-260501', name: 'Doubao Seedream 5.0' },
      { type: 'image', id: 'doubao-seedream-4-5-251128', name: 'Doubao Seedream 4.5' },
      { type: 'image', id: 'doubao-seedream-4-0-250828', name: 'Doubao Seedream 4.0' },
      { type: 'image', id: 'doubao-seedream-2-0-250217', name: 'Doubao Seedream 2.0' },
      // Video
      { type: 'video', id: 'doubao-seedance-2-0-pro-260510', name: 'Doubao Seedance 2.0 Pro' },
      { type: 'video', id: 'doubao-seedance-1-5-pro-251215', name: 'Doubao Seedance 1.5 Pro' },
      { type: 'video', id: 'doubao-seedance-1-0-pro-fast-251015', name: 'Doubao Seedance 1.0 Pro Fast' },
      // TTS
      { type: 'tts', id: 'doubao-tts-1', name: 'Doubao TTS' },
    ]
  }

  if (provider.modelSource === 'aliyun-api') {
    // 先尝试读 ModelProvider 表同步后的模型列表
    try {
      const mp = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun' } })
      if (mp?.defaultParams && typeof mp.defaultParams === 'object') {
        const dp = mp.defaultParams as Record<string, any>
        if (dp.models) {
          const result: { id: string; type: string; name: string; label: string }[] = []
          for (const [type, models] of Object.entries(dp.models)) {
            if (Array.isArray(models)) {
              for (const m of models) {
                const name = m.name || m.model || m.id
                if (name) {
                  result.push({ id: name, type, name, label: m.label || m.name || name })
                }
              }
            }
          }
          if (result.length > 0) return result
        }
      }
    } catch (e) {
      console.warn(`[global-models] 读 ModelProvider 表失败，回退到预设: ${(e as Error).message}`)
    }
    // 回退：没有同步数据时用预设列表
    return ALIYUN_PRESET_MODELS.map((m) => ({ id: m.id, type: m.type, name: m.id, icon: assignModelIcon(m.id, m.type) }))
  }

  // preset 模型：从 provider 配置中读取
  if (provider.modelSource === 'preset' && provider.presetModels) {
    const result: { id: string; type: string; name: string }[] = []
    for (const [type, models] of Object.entries(provider.presetModels)) {
      for (const model of models) {
        if (model) result.push({ id: model, type, name: model, icon: assignModelIcon(model, type) })
      }
    }
    return result
  }

  return []
}

// 为模型列表补充 icon
function attachModelIcons(models: any[]): any[] {
  return models.map(m => ({ ...m, icon: m.icon || assignModelIcon(m.id, m.type) }))
}


// ============ 路由 ============

export default async function adminGlobalConfigRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin/global-models — 获取所有供应商的全局模型配置
  fastify.get('/api/v1/admin/global-models', async (request, reply) => {
    // 读取启用的供应商列表
    const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
    const enabledSet = new Set((enabledRow?.keyValue || 'volcengine').split(','))

    const result: any[] = []

    for (const provider of PROVIDERS) {
      const savedMap = await loadSavedConfigs(provider.id)
      const configs = provider.types.map((t) => {
        const saved = savedMap.get(t.type)
        const envVal = process.env[`${provider.envKeyPrefix}_${t.type.toUpperCase()}_MODEL`] || ''
        return {
          type: t.type,
          label: t.label,
          model: saved || envVal || t.defaultModel,
          source: saved ? 'database' : (envVal ? 'env' : 'default'),
        }
      })

      const modelList = await getModelsForProvider(provider.id)

      result.push({
        provider: provider.id,
        providerName: provider.name,
        enabled: enabledSet.has(provider.id),
        configs,
        models: attachModelIcons(modelList),
      })
    }

    return { success: true, providers: result } satisfies GlobalConfigResponse;
  })

  // PUT /api/v1/admin/global-models — 保存全局模型配置
  fastify.put('/api/v1/admin/global-models', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const body = request.body as Record<string, any>
    const { provider: providerId, type, model } = body

    console.log(`[global-models] save: provider=${providerId}, type=${type}, model=${JSON.stringify(model)}`)

    if (!providerId || !type) {
      return reply.status(400).send({ error: `缺少 provider 或 type (got: provider=${providerId}, type=${type})` })
    }

    // model 为空字符串时跳过（前端下发时会带未选中的空白项）
    if (!model || model === '') {
      return { success: true, skipped: true } satisfies GlobalConfigResponse;
    }

    const provider = PROVIDERS.find((p) => p.id === providerId)
    if (!provider) return reply.status(400).send({ error: `未知供应商: ${providerId}` })

    const key = getGlobalModelKey(providerId, type)
    await prisma.apiKey.upsert({
      where: { provider: key },
      update: { keyValue: model, keyName: `${providerId} ${type} model` },
      create: { provider: key, keyName: `${providerId} ${type} model`, keyValue: model },
    })

    // 回写到 process.env（格式：ALIYUN_LLM_MODEL 等）
    const envKey = `${provider.envKeyPrefix}_${type.toUpperCase()}_MODEL`
    process.env[envKey] = model

    return { success: true } satisfies GlobalConfigResponse;
  })

  // PUT /api/v1/admin/global-models/toggle — 启用/禁用供应商
  fastify.put('/api/v1/admin/global-models/toggle', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { provider, enabled } = request.body as { provider: string; enabled: boolean }

    // 读取当前启用列表
    const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
    let enabledList = new Set((enabledRow?.keyValue || 'volcengine').split(','))

    if (enabled) {
      enabledList.add(provider)
    } else {
      enabledList.delete(provider)
    }

    await prisma.apiKey.upsert({
      where: { provider: 'global_model_enabled_providers' },
      update: { keyValue: Array.from(enabledList).join(',') },
      create: { provider: 'global_model_enabled_providers', keyName: 'global_model_enabled_providers', keyValue: Array.from(enabledList).join(',') },
    })

    return { success: true, enabledProviders: Array.from(enabledList) } satisfies GlobalConfigResponse;
  })

  // PUT /api/v1/admin/global-models/save-models — 保存供应商的完整模型列表
  fastify.put('/api/v1/admin/global-models/save-models', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { provider: providerId, models } = request.body as { provider: string; models: any }
    if (!providerId || !models) {
      return reply.status(400).send({ error: '缺少 provider 或 models' })
    }

    // 更新 ModelProvider 表的 defaultParams.models
    const prov = await prisma.modelProvider.findUnique({ where: { provider: providerId } })
    if (!prov) return reply.status(404).send({ error: `供应商 ${providerId} 不存在` })

    const dp = (prov.defaultParams as any) || {}
    dp.models = models
    await prisma.modelProvider.update({
      where: { provider: providerId },
      data: { defaultParams: dp },
    })

    return { success: true } satisfies GlobalConfigResponse;
  })

  // PUT /api/v1/admin/global-models/sync-aliyun — 同步阿里百炼模型列表
  fastify.put('/api/v1/admin/global-models/sync-aliyun', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    try {
      const prov = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun' } })
      if (!prov) return reply.status(404).send({ success: false, error: '阿里百炼 provider 不存在' })

      // 用系统阿里百炼 Key 同步（从环境变量读取）
      const apiKey = process.env.ALIYUN_API_KEY || env.ALIYUN_API_KEY
      if (!apiKey) return reply.status(400).send({ success: false, error: '系统未配置阿里百炼 API Key，请在 .env 中设置 ALIYUN_API_KEY' })

      const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/models?page_size=200', {
        headers: { Authorization: 'Bearer ' + apiKey },
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) {
        return reply.status(502).send({ success: false, error: '阿里百炼 API 返回 ' + resp.status })
      }

      const data = await resp.json()
      if (!data?.output?.models) {
        return reply.status(502).send({ success: false, error: '阿里百炼返回格式异常' })
      }

      const allModels = data.output.models
      // 分类
      const classify = (m: any) => {
        const model = m.model || ''
        if (model.includes('image') || model.includes('t2i') || (model.includes('wan') && (model.includes('image') || model.includes('anima')))) return 'image'
        if (model.includes('video') || (model.includes('wan') && !model.includes('image') && !model.includes('t2i') && !model.includes('s2v') && !model.includes('detect'))) return 'video'
        if (model.includes('cosyvoice') || model.includes('sambert') || model.includes('tts')) return 'tts'
        if (!['embedding','rerank','paraformer','speech','retrieval','bge-','classification','segmentation','detection'].some(k => model.includes(k))) return 'llm'
        return null
      }

      const models: Record<string, any[]> = { llm: [], image: [], video: [], tts: [] }
      allModels.forEach((m: any) => {
        const type = classify(m)
        if (type && models[type]) {
          models[type].push({ name: m.model, label: m.name || m.model, isActive: true })
        }
      })

      // 去重
      for (const type of ['llm', 'image', 'video', 'tts'] as const) {
        const seen = new Set<string>()
        const arr = models[type] || [];
        models[type] = arr.filter((m: any) => {
          if (seen.has(m.name)) return false
          seen.add(m.name)
          return true
        })
      }

      // 存入 ModelProvider 表
      const dp = (prov.defaultParams as any) || {}
      dp.models = models
      await prisma.modelProvider.update({
        where: { provider: 'aliyun' },
        data: { defaultParams: dp },
      })

      return {
        success: true,
        data: {
          total: allModels.length,
          llm: models.llm.length,
          image: models.image.length,
          video: models.video.length,
          tts: models.tts.length,
        }
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || '同步失败' })
    }
  })

  // GET /api/v1/admin/global-models/sync-aliyun-models — 兼容前端旧按钮（GET 请求）
  fastify.get('/api/v1/admin/global-models/sync-aliyun-models', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    try {
      const prov = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun' } })
      if (!prov) return reply.status(404).send({ success: false, error: '阿里百炼 provider 不存在' })

      const apiKey = process.env.ALIYUN_API_KEY || env.ALIYUN_API_KEY
      if (!apiKey) return reply.status(400).send({ success: false, error: '系统未配置阿里百炼 API Key，请在 .env 中设置 ALIYUN_API_KEY' })

      const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/models?page_size=200', {
        headers: { Authorization: 'Bearer ' + apiKey },
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) {
        return reply.status(502).send({ success: false, error: '阿里百炼 API 返回 ' + resp.status })
      }

      const data = await resp.json()
      if (!data?.output?.models) {
        return reply.status(502).send({ success: false, error: '阿里百炼返回格式异常' })
      }

      const allModels = data.output.models
      const classify = (m: any) => {
        const model = m.model || ''
        if (model.includes('image') || model.includes('t2i') || (model.includes('wan') && (model.includes('image') || model.includes('anima')))) return 'image'
        if (model.includes('video') || (model.includes('wan') && !model.includes('image') && !model.includes('t2i') && !model.includes('s2v') && !model.includes('detect'))) return 'video'
        if (model.includes('cosyvoice') || model.includes('sambert') || model.includes('tts')) return 'tts'
        if (!['embedding','rerank','paraformer','speech','retrieval','bge-','classification','segmentation','detection'].some(k => model.includes(k))) return 'llm'
        return null
      }

      const models: Record<string, any[]> = { llm: [], image: [], video: [], tts: [] }
      allModels.forEach((m: any) => {
        const type = classify(m)
        if (type && models[type]) {
          models[type].push({ name: m.model, label: m.name || m.model, isActive: true, model: m.model })
        }
      })

      for (const type of ['llm', 'image', 'video', 'tts'] as const) {
        const seen = new Set<string>()
        const arr = models[type] || [];
        models[type] = arr.filter((m: any) => {
          if (seen.has(m.name)) return false
          seen.add(m.name)
          return true
        })
      }

      const dp = (prov.defaultParams as any) || {}
      dp.models = models
      await prisma.modelProvider.update({
        where: { provider: 'aliyun' },
        data: { defaultParams: dp },
      })

      return {
        success: true,
        data: {
          total: allModels.length,
          llm: models.llm,
          image: models.image,
          video: models.video,
          tts: models.tts,
        }
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || '同步失败' })
    }
  })

  // GET /api/public/global-models — 公开接口，用户端获取所有供应商和模型列表（无需鉴权）
  fastify.get('/api/public/global-models', async (request, reply) => {
    const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
    const enabledSet = new Set((enabledRow?.keyValue || 'volcengine').split(','))

    const result: any[] = []

    for (const provider of PROVIDERS) {
      const savedMap = await loadSavedConfigs(provider.id)
      const configs = provider.types.map((t) => {
        const saved = savedMap.get(t.type)
        const envVal = process.env[`${provider.envKeyPrefix}_${t.type.toUpperCase()}_MODEL`] || ''
        return {
          type: t.type,
          label: t.label,
          model: saved || envVal || t.defaultModel,
          source: saved ? 'database' : (envVal ? 'env' : 'default'),
        }
      })

      const modelList = await getModelsForProvider(provider.id)

      result.push({
        provider: provider.id,
        providerName: provider.name,
        enabled: enabledSet.has(provider.id),
        configs,
        models: attachModelIcons(modelList),
      })
    }

    return { success: true, providers: result } satisfies GlobalConfigResponse;
  })
}
