import type { ApiResponse } from '../contracts/api/base.js';
import type { GlobalConfigResponse } from '../contracts/api/routes.js';
import { FastifyInstance } from 'fastify'
import { prisma, getRouteConfig, getRouteConfigGroup } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { env } from '../config/env.js'

// ============ 供应商定义（从 RouteConfig 表读取，有 fallback） ============

interface ProviderConfig {
  id: string                    // 供应商 ID（对应 ApiKey 表中的 provider）
  name: string                  // 显示名称
  envKeyPrefix: string          // env 变量的前缀（如 VOLCENGINE / ALIYUN）
  types: { type: string; label: string; defaultModel: string }[]
  // 获取该供应商模型列表的方式
  modelSource: 'volcengine-api' | 'aliyun-api' | 'preset'
  presetModels?: Record<string, string[]>
}

// 运行时缓存 — 避免每个请求都查 DB
let _cachedProviders: ProviderConfig[] | null = null
let _cachedAliyunModels: { type: string; id: string }[] | null = null
let _cachedIconRules: Record<string, any> | null = null
let _cachedModelTypesMeta: { type: string; label: string }[] | null = null
let _cachedDomainMap: Record<string, string> | null = null

async function loadProviders(): Promise<ProviderConfig[]> {
  if (_cachedProviders) return _cachedProviders
  const dbVal = await getRouteConfig('route:admin-global-config', 'providers', [])
  _cachedProviders = dbVal as ProviderConfig[]
  return _cachedProviders
}

async function loadModelTypesMeta(): Promise<{ type: string; label: string }[]> {
  if (_cachedModelTypesMeta) return _cachedModelTypesMeta
  const dbVal = await getRouteConfig('route:admin-global-config', 'model_types_meta', [
    { type: 'llm', label: '语言模型' },
    { type: 'image', label: '图片模型' },
    { type: 'video', label: '视频模型' },
    { type: 'tts', label: '语音模型' },
  ])
  _cachedModelTypesMeta = dbVal
  return _cachedModelTypesMeta
}

async function loadAliyunPresetModels(): Promise<{ type: string; id: string }[]> {
  if (_cachedAliyunModels) return _cachedAliyunModels
  const dbVal = await getRouteConfig('route:admin-global-config', 'aliyun_preset_models', [])
  _cachedAliyunModels = dbVal
  return _cachedAliyunModels
}

async function loadIconRules(): Promise<Record<string, any>> {
  if (_cachedIconRules) return _cachedIconRules
  const dbVal = await getRouteConfig('route:admin-global-config', 'model_icon_rules', {
    video: { 'doubao-seedance': '🎬', 'kling': '🐉', 'sora': '🌊', 'minimax': '🤖', 'runway': '🛤️', 'pixverse': '✨', 'default': '🎥' },
    image: { 'doubao-seedream': '🌱', 'flux': '⚡', 'sdxl': '🎨', 'jimeng': '🎭', 'tongyi-wanxiang': '🌌', 'wujing': '🎯', 'stable-diffusion': '🖌️', 'wan': '🖼️', 'default': '🖼️' },
    default: { 'tts': '🔊', 'default': '🧠' },
  })
  _cachedIconRules = dbVal
  return _cachedIconRules
}

async function loadDomainMap(): Promise<Record<string, string>> {
  if (_cachedDomainMap) return _cachedDomainMap
  const dbVal = await getRouteConfig('route:admin-global-config', 'volcengine_domain_map', {
    'LLM': 'llm', 'VLM': 'llm', 'ImageGeneration': 'image', 'VideoGeneration': 'video',
    'TTS': 'tts', 'AudioGeneration': 'tts', 'Embedding': 'llm', 'Router': 'llm', '3DGeneration': 'llm',
  })
  _cachedDomainMap = dbVal
  return _cachedDomainMap
}

// 模型类型的统一映射
const MODEL_TYPES_META: { type: string; label: string }[] = [] // 将被路由替代

// PROVIDERS 在 load 时填充，作为模块级变量保持兼容
let PROVIDERS: ProviderConfig[] = []

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

/** 按模型ID模式匹配分配图标（从 RouteConfig 读取规则，有 fallback） */
async function assignModelIcon(id: string, type: string): Promise<string> {
  const rules = await loadIconRules()
  // 根据 type 找对应的字典
  const typeRules = type === 'video' ? rules.video
    : type === 'image' ? rules.image
    : rules.default || rules[type]
  if (!typeRules || typeof typeRules !== 'object') return '🧠'

  // 遍历规则（默认值兜底）
  for (const [prefix, icon] of Object.entries(typeRules)) {
    if (prefix === 'default') continue
    if (id.startsWith(prefix)) return icon as string
  }
  return (typeRules as any)['default'] || '🧠'
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

  const domainMap = await loadDomainMap()

  const active: { type: string; id: string; name: string; icon: string }[] = []
  for (const m of volcModels) {
    if (m.status && m.status !== 'Active') continue
    const type = domainMap[m.domain] || ''
    if (!type) continue
    active.push({
      type,
      id: m.id,
      name: m.name || m.id,
      icon: await assignModelIcon(m.id, type),
    })
  }

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
          const result: { id: string; type: string; name: string; icon: string }[] = []
          for (const [type, models] of Object.entries(dp.models)) {
            if (Array.isArray(models)) {
              for (const m of models) {
                const name = m.name || m.model || m.id
                if (name) result.push({ id: name, type, name, icon: '' })
              }
            }
          }
          if (result.length > 0) return result
        }
      }
    } catch {}
    // 最终回退：从 RouteConfig 读取 hardcode 已知模型
    const fallbackModels = await getRouteConfig('route:admin-global-config', 'volcengine_fallback_models', [])
    if ((fallbackModels as any[]).length > 0) return fallbackModels as any[]
    return []
  }

  if (provider.modelSource === 'aliyun-api') {
    // 先尝试读 ModelProvider 表同步后的模型列表
    try {
      const mp = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun' } })
      if (mp?.defaultParams && typeof mp.defaultParams === 'object') {
        const dp = mp.defaultParams as Record<string, any>
        if (dp.models) {
          const result: { id: string; type: string; name: string; icon: string }[] = []
          for (const [type, models] of Object.entries(dp.models)) {
            if (Array.isArray(models)) {
              for (const m of models) {
                const name = m.name || m.model || m.id
                if (name) {
                  result.push({ id: name, type, name, icon: '' })
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
    const aliyunPreset = await loadAliyunPresetModels()
    const result: { id: string; type: string; name: string; icon: string }[] = []
    for (const m of aliyunPreset) {
      result.push({ id: m.id, type: m.type, name: m.id, icon: await assignModelIcon(m.id, m.type) })
    }
    return result
  }

  // preset 模型：从 provider 配置中读取
  if (provider.modelSource === 'preset' && provider.presetModels) {
    const result: { id: string; type: string; name: string; icon: string }[] = []
    for (const [type, models] of Object.entries(provider.presetModels)) {
      for (const model of models) {
        if (model) result.push({ id: model, type, name: model, icon: await assignModelIcon(model, type) })
      }
    }
    return result
  }

  return []
}

// 为模型列表补充 icon
async function attachModelIcons(models: any[]): Promise<any[]> {
  const result: any[] = []
  for (const m of models) {
    result.push({ ...m, icon: m.icon || await assignModelIcon(m.id, m.type) })
  }
  return result
}


// ============ 路由 ============

export default async function adminGlobalConfigRoutes(fastify: FastifyInstance) {
  // 辅助函数：从 RouteConfig 加载PROVIDERS并缓存到模块级
  async function getProviders(): Promise<ProviderConfig[]> {
    if (PROVIDERS.length === 0) {
      PROVIDERS = await loadProviders()
    }
    return PROVIDERS
  }

  // GET /api/admin/global-models — 获取所有供应商的全局模型配置
  fastify.get('/api/admin/global-models', { preHandler: [requireAdmin] }, async (request, reply) => {
    const providers = await getProviders()
    // 读取启用的供应商列表
    const defaultEnabled = await getRouteConfig('route:admin-global-config', 'default_enabled_providers', 'volcengine')
    const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
    const enabledSet = new Set((enabledRow?.keyValue || defaultEnabled).split(','))

    const result: any[] = []

    for (const provider of providers) {
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
        models: await attachModelIcons(modelList),
      })
    }

    return { success: true, providers: result } satisfies GlobalConfigResponse;
  })

  // PUT /api/admin/global-models — 保存全局模型配置
  fastify.put('/api/admin/global-models', { preHandler: [requireAdmin] }, async (request, reply) => {
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

    const providers = await getProviders()
    const provider = providers.find((p) => p.id === providerId)
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

  // PUT /api/admin/global-models/toggle — 启用/禁用供应商
  fastify.put('/api/admin/global-models/toggle', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // PUT /api/admin/global-models/save-models — 保存供应商的完整模型列表
  fastify.put('/api/admin/global-models/save-models', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // PUT /api/admin/global-models/sync-aliyun — 同步阿里百炼模型列表
  fastify.put('/api/admin/global-models/sync-aliyun', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // GET /api/admin/global-models/sync-aliyun-models — 兼容前端旧按钮（GET 请求）
  fastify.get('/api/admin/global-models/sync-aliyun-models', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // ===== 全局每日免费配额设置 =====
  // GET /api/admin/global-config/daily-free-quota — 读取每日免费配额
  fastify.get('/api/admin/global-config/daily-free-quota', { preHandler: [requireAdmin] }, async () => {
    const quota = await getRouteConfig('system:global', 'daily_free_ai_quota', 30)
    return { success: true, data: { quota } }
  })

  // PUT /api/admin/global-config/daily-free-quota — 设置每日免费配额
  fastify.put('/api/admin/global-config/daily-free-quota', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    const quota = parseInt(body.quota, 10)
    if (isNaN(quota) || quota < 0) {
      return reply.status(400).send({ success: false, error: '配额必须是非负整数' })
    }
    // -1 表示无限制
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: 'system:global', key: 'daily_free_ai_quota' } },
      update: { value: quota, isActive: true },
      create: { scope: 'system:global', key: 'daily_free_ai_quota', value: quota, isActive: true, label: '免费用户每日AI优化次数' },
    })
    return { success: true, data: { quota } }
  })

  // ─── Sprint-07A.2-AI-02: 业务 AI 模型配置（按 businessType 隔离） ───

  // GET /api/admin/global-config/business-type/:type — 读取业务 AI 配置
  fastify.get('/api/admin/global-config/business-type/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const allowedTypes = ['hdz', 'career_advisor', 'ppt', 'music', 'novel']
    if (!allowedTypes.includes(type)) {
      return reply.status(400).send({ success: false, error: '无效的业务类型' })
    }
    const provider = await getRouteConfig(`route:admin-global-config:${type}`, 'llm_provider', 'deepseek')
    const model = await getRouteConfig(`route:admin-global-config:${type}`, 'llm_model', '')
    // 检查 API Key 是否存在（不返回实际 Key）
    const apiKeyRow = await prisma.apiKey.findUnique({ where: { provider: `business_type_${type}` } })
    const hasApiKey = !!apiKeyRow?.keyValue
    return { success: true, config: { provider, model, hasApiKey } }
  })

  // PUT /api/admin/global-config/business-type/:type — 保存业务 AI 配置
  fastify.put('/api/admin/global-config/business-type/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const allowedTypes = ['hdz', 'career_advisor', 'ppt', 'music', 'novel']
    if (!allowedTypes.includes(type)) {
      return reply.status(400).send({ success: false, error: '无效的业务类型' })
    }
    const body = request.body as any
    const provider = body.provider || 'deepseek'
    const model = body.model || ''
    const apiKey = body.apiKey || ''
    const baseUrl = body.baseUrl || ''

    // 保存 Provider 和 Model
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: `route:admin-global-config:${type}`, key: 'llm_provider' } },
      update: { value: provider, isActive: true },
      create: { scope: `route:admin-global-config:${type}`, key: 'llm_provider', value: provider, isActive: true, label: `${type}业务LLM供应商` },
    })
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: `route:admin-global-config:${type}`, key: 'llm_model' } },
      update: { value: model, isActive: true },
      create: { scope: `route:admin-global-config:${type}`, key: 'llm_model', value: model, isActive: true, label: `${type}业务LLM模型` },
    })

    // 保存 Base URL（可选）
    if (baseUrl) {
      await prisma.routeConfig.upsert({
        where: { scope_key: { scope: `route:admin-global-config:${type}`, key: 'llm_base_url' } },
        update: { value: baseUrl, isActive: true },
        create: { scope: `route:admin-global-config:${type}`, key: 'llm_base_url', value: baseUrl, isActive: true, label: `${type}业务LLM Base URL` },
      })
    }

    // 保存 API Key（如果提供了）
    if (apiKey) {
      await prisma.apiKey.upsert({
        where: { provider: `business_type_${type}` },
        update: { keyValue: apiKey, keyName: `${type} Business AI Key` },
        create: { provider: `business_type_${type}`, keyValue: apiKey, keyName: `${type} Business AI Key` },
      })
    }

    // 检查 API Key 是否存在
    const apiKeyRow = await prisma.apiKey.findUnique({ where: { provider: `business_type_${type}` } })
    const hasApiKey = !!apiKeyRow?.keyValue

    return { success: true, config: { provider, model, hasApiKey } }
  })

  // GET /api/public/global-models — 公开接口，用户端获取所有供应商和模型列表（无需鉴权）
  fastify.get('/api/public/global-models', async (request, reply) => {
    const providers = await getProviders()
    const defaultEnabled = await getRouteConfig('route:admin-global-config', 'default_enabled_providers', 'volcengine')
    const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
    const enabledSet = new Set((enabledRow?.keyValue || defaultEnabled).split(','))

    const result: any[] = []

    for (const provider of providers) {
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
        models: await attachModelIcons(modelList),
      })
    }

    return { success: true, providers: result } satisfies GlobalConfigResponse;
  })
}
