/**
 * provider-registry.service.ts — Provider Runtime 数据层
 *
 * ═══════════════════════════════════════════════════════════════
 * 昆仑镜 Provider Runtime 收敛工程的数据访问层
 *
 * 铁律（Runtime Decision Authority）:
 *   1. model_route_config 是唯一的模型路由决策源（DB truth）
 *   2. legacy route_config 只作为降级回退（fallback only）
 *   3. shim 层仅用于紧急降级（emergency fallback only）
 *   4. 双写 ≠ 双真相源：写入时 DB 先写，legacy 后写（兼容层）
 * ═══════════════════════════════════════════════════════════════
 *
 * API 分层:
 *   readProvider() / readModelRoute() — 从 DB 读取，走缓存
 *   readModelRouteWithFallback() — DB → legacy → shim 三级降级
 *   upsertProvider() / upsertModelRoute() — 写入（双写）
 *   loadAllProviders() — 全量加载（用于 Provider Registry 初始化）
 *   loadHandlersForProvider() — 加载指定 provider 的 handler 列表
 */

import { prisma } from '../utils/index.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface ProviderRegistryRow {
  id: string
  type: string
  name: string
  label: string | null
  baseUrl: string
  authConfig: Record<string, unknown>
  isActive: boolean
  metadata: Record<string, unknown>
}

export interface ModelRouteConfigRow {
  id: string
  modelName: string
  providerName: string
  capabilities: string[]
  priority: number
  fallback: string[]
  limits: Record<string, unknown>
  isActive: boolean
  provider?: ProviderRegistryRow
}

export interface HandlerRegistryRow {
  id: string
  providerName: string
  taskType: string
  handlerName: string
  handlerConfig: Record<string, unknown>
  isActive: boolean
}

export interface ResolvedModelRoute {
  modelName: string
  providerName: string
  provider: ProviderRegistryRow
  capabilities: string[]
  priority: number
  fallback: string[]
  limits: Record<string, unknown>
  source: 'db' | 'legacy' | 'shim'
  warning?: string
}

// ─── 简易内存缓存 ──────────────────────────────────────────────

const providerCache = new Map<string, ProviderRegistryRow>()
const modelRouteCache = new Map<string, ModelRouteConfigRow>()
const handlersCache = new Map<string, HandlerRegistryRow[]>()
let cacheEpoch = 0

function bumpCache(): void {
  cacheEpoch++
  providerCache.clear()
  modelRouteCache.clear()
  handlersCache.clear()
}

// ═══════════════════════════════════════════════════════════════
// Provider Registry — 读取
// ═══════════════════════════════════════════════════════════════

/** 根据 name 读取一个 provider（唯一） */
export async function readProvider(name: string): Promise<ProviderRegistryRow | null> {
  const cached = providerCache.get(name)
  if (cached) return cached

  const row = await prisma.providerRegistry.findUnique({ where: { name } })
  if (!row) return null

  const result: ProviderRegistryRow = {
    id: row.id,
    type: row.type,
    name: row.name,
    label: row.label,
    baseUrl: row.baseUrl,
    authConfig: (row.authConfig as Record<string, unknown>) || {},
    isActive: row.isActive,
    metadata: (row.metadata as Record<string, unknown>) || {},
  }
  providerCache.set(name, result)
  return result
}

/** 列出所有活跃 provider */
export async function listActiveProviders(): Promise<ProviderRegistryRow[]> {
  const rows = await prisma.providerRegistry.findMany({ where: { isActive: true } })
  return rows.map((r) => {
    const result: ProviderRegistryRow = {
      id: r.id,
      type: r.type,
      name: r.name,
      label: r.label,
      baseUrl: r.baseUrl,
      authConfig: (r.authConfig as Record<string, unknown>) || {},
      isActive: r.isActive,
      metadata: (r.metadata as Record<string, unknown>) || {},
    }
    providerCache.set(r.name, result)
    return result
  })
}

// ═══════════════════════════════════════════════════════════════
// Model Route Config — 读取
// ═══════════════════════════════════════════════════════════════

/** 精确匹配模型路由 */
export async function readModelRoute(modelName: string): Promise<ModelRouteConfigRow | null> {
  const cached = modelRouteCache.get(modelName)
  if (cached) return cached

  const row = await prisma.modelRouteConfig.findUnique({
    where: { modelName },
  })
  if (!row) return null

  // 手动加载 provider
  const providerRow = row.providerName
    ? await prisma.providerRegistry.findUnique({ where: { name: row.providerName } })
    : null

  const result: ModelRouteConfigRow = {
    id: row.id,
    modelName: row.modelName,
    providerName: row.providerName,
    capabilities: (row.capabilities as string[]) || [],
    priority: row.priority,
    fallback: (row.fallback as string[]) || [],
    limits: (row.limits as Record<string, unknown>) || {},
    isActive: row.isActive,
    provider: providerRow
      ? {
          id: providerRow.id,
          type: providerRow.type,
          name: providerRow.name,
          label: providerRow.label,
          baseUrl: providerRow.baseUrl,
          authConfig: (providerRow.authConfig as Record<string, unknown>) || {},
          isActive: providerRow.isActive,
          metadata: (providerRow.metadata as Record<string, unknown>) || {},
        }
      : undefined,
  }
  modelRouteCache.set(modelName, result)
  return result
}

/** 通配符匹配（根据模型名前缀查找权重最高的活跃路由） */
export async function matchModelRoute(modelName: string): Promise<ModelRouteConfigRow | null> {
  // 先精确匹配
  const exact = await readModelRoute(modelName)
  if (exact) return exact

  // 通配符匹配：按 priority 降序取第一个匹配的
  const allRows = await prisma.modelRouteConfig.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  })

  for (const row of allRows) {
    if (matchesWildcard(row.modelName, modelName)) {
      // 手动加载 provider
      const providerRow = row.providerName
        ? await prisma.providerRegistry.findUnique({ where: { name: row.providerName } })
        : null
      return {
        id: row.id,
        modelName: row.modelName,
        providerName: row.providerName,
        capabilities: (row.capabilities as string[]) || [],
        priority: row.priority,
        fallback: (row.fallback as string[]) || [],
        limits: (row.limits as Record<string, unknown>) || {},
        isActive: row.isActive,
        provider: providerRow
          ? {
              id: providerRow.id,
              type: providerRow.type,
              name: providerRow.name,
              label: providerRow.label,
              baseUrl: providerRow.baseUrl,
              authConfig: (providerRow.authConfig as Record<string, unknown>) || {},
              isActive: providerRow.isActive,
              metadata: (providerRow.metadata as Record<string, unknown>) || {},
            }
          : undefined,
      }
    }
  }

  return null
}

/**
 * 三级降级读取：DB truth → legacy route_config → shim emergency
 * 这是所有路由决策的唯��入口
 */
export async function resolveModelRoute(modelName: string): Promise<ResolvedModelRoute> {
  // Level 1: DB truth
  const dbRoute = await matchModelRoute(modelName)
  if (dbRoute && dbRoute.provider) {
    return {
      modelName: dbRoute.modelName,
      providerName: dbRoute.provider.name,
      provider: dbRoute.provider,
      capabilities: dbRoute.capabilities,
      priority: dbRoute.priority ?? 0,
      fallback: dbRoute.fallback,
      limits: dbRoute.limits,
      source: 'db',
    }
  }

  // Level 2: legacy route_config fallback
  const legacyRoute = await resolveLegacyModelRoute(modelName)
  if (legacyRoute) {
    return {
      ...legacyRoute,
      source: 'legacy',
      warning: '路由来自 legacy route_config，请迁移到 model_route_config',
    }
  }

  // Level 3: shim emergency fallback
  const shimRoute = legacyShim(modelName)
  if (shimRoute) {
    return {
      ...shimRoute,
      source: 'shim',
      warning: '紧急降级：模型路由未在 DB 中配置，请添加路由规则',
    }
  }

  throw new Error(`[RuntimeDecisionAuthority] 无法路由模型 "${modelName}": 无可用 provider`)
}

// ═══════════════════════════════════════════════════════════════
// Provider Handler 注册表
// ═══════════════════════════════════════════════════════════════

/** 加载指定 provider 的所有 handler */
export async function loadHandlersForProvider(providerName: string): Promise<HandlerRegistryRow[]> {
  const cached = handlersCache.get(providerName)
  if (cached) return cached

  const rows = await prisma.providerHandlerRegistry.findMany({
    where: { providerName, isActive: true },
  })

  const result: HandlerRegistryRow[] = rows.map((r) => ({
    id: r.id,
    providerName: r.providerName,
    taskType: r.taskType,
    handlerName: r.handlerName,
    handlerConfig: (r.handlerConfig as Record<string, unknown>) || {},
    isActive: r.isActive,
  }))

  handlersCache.set(providerName, result)
  return result
}

/** 全量加载 handler（用于初始化 middleware） */
export async function loadAllHandlers(): Promise<HandlerRegistryRow[]> {
  const rows = await prisma.providerHandlerRegistry.findMany({
    where: { isActive: true },
  })
  return rows.map((r) => ({
    id: r.id,
    providerName: r.providerName,
    taskType: r.taskType,
    handlerName: r.handlerName,
    handlerConfig: (r.handlerConfig as Record<string, unknown>) || {},
    isActive: r.isActive,
  }))
}

// ═══════════════════════════════════════════════════════════════
// 写入（双写：DB 先写，legacy route_config 后写）
// ═══════════════════════════════════════════════════════════════

/** 创建或更新 provider（双写兼容） */
export async function upsertProvider(data: {
  name: string
  type?: string
  label?: string
  baseUrl: string
  authConfig?: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<ProviderRegistryRow> {
  const row = await prisma.providerRegistry.upsert({
    where: { name: data.name },
    update: {
      type: data.type ?? undefined,
      label: data.label ?? undefined,
      baseUrl: data.baseUrl,
      authConfig: data.authConfig !== undefined ? JSON.parse(JSON.stringify(data.authConfig)) : undefined,
      metadata: data.metadata !== undefined ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
    },
    create: {
      id: crypto.randomUUID(),
      name: data.name,
      type: data.type || 'openai-compatible',
      label: data.label || data.name,
      baseUrl: data.baseUrl,
      authConfig: data.authConfig ? JSON.parse(JSON.stringify(data.authConfig)) : {},
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : {},
    },
  })

  // 同步写入 legacy route_config（双写兼容）
  await syncProviderToLegacy(row)

  bumpCache()
  providerCache.delete(data.name)
  return (await readProvider(data.name))!
}

/** 创建或更新模型路由（双写兼容） */
export async function upsertModelRoute(data: {
  modelName: string
  providerName: string
  capabilities?: string[]
  priority?: number
  fallback?: string[]
  limits?: Record<string, unknown>
}): Promise<ModelRouteConfigRow> {
  const row = await prisma.modelRouteConfig.upsert({
    where: { modelName: data.modelName },
    update: {
      providerName: data.providerName,
      capabilities: data.capabilities !== undefined ? JSON.parse(JSON.stringify(data.capabilities)) : undefined,
      priority: data.priority ?? undefined,
      fallback: data.fallback !== undefined ? JSON.parse(JSON.stringify(data.fallback)) : undefined,
      limits: data.limits !== undefined ? JSON.parse(JSON.stringify(data.limits)) : undefined,
    },
    create: {
      id: crypto.randomUUID(),
      modelName: data.modelName,
      providerName: data.providerName,
      capabilities: data.capabilities || ['chat'],
      priority: data.priority || 0,
      fallback: data.fallback || [],
      limits: (data.limits as any) || {},
    },
  })

  bumpCache()
  return (await readModelRoute(data.modelName))!
}

// ═══════════════════════════════════════════════════════════════
// Legacy Fallback — route_config 兼容读取
// ═══════════════════════════════════════════════════════════════

async function resolveLegacyModelRoute(modelName: string): Promise<ResolvedModelRoute | null> {
  try {
    // 从 volcengine_fallback_models 尝试匹配
    const fallbackRow = await prisma.routeConfig.findFirst({
      where: { scope: 'route:admin-global-config', key: 'volcengine_fallback_models', isActive: true },
    })
    const fallbackModels = fallbackRow?.value as any[] | undefined
    if (Array.isArray(fallbackModels) && fallbackModels.length > 0) {
      const matched = fallbackModels.find((m: any) => {
        if (!m?.id) return false
        return matchesWildcard(m.id, modelName) || m.id === modelName
      })
      if (matched) {
        // legacy 模式下没有 provider 细粒度信息，返回一个简化的结果
        const knownProviders: Record<string, string> = {
          openai: 'openai',
          gpt: 'openai',
          deepseek: 'deepseek',
          doubao: 'volcengine',
          bailian: 'bailian',
          kling: 'kling',
          runway: 'runway',
          siliconflow: 'siliconflow',
          vllm: 'vllm-local',
          local: 'localai',
        }

        const guessProvider = (name: string): string => {
          for (const [key, prov] of Object.entries(knownProviders)) {
            if (name.startsWith(key)) return prov
          }
          return 'custom'
        }

        const providerName = guessProvider(modelName)
        return {
          modelName: matched.id,
          providerName: providerName,
          provider: {
            id: providerName,
            type: 'openai-compatible',
            name: providerName,
            label: providerName,
            baseUrl: '',
            authConfig: {},
            isActive: true,
            metadata: {},
          },
          capabilities: [matched.type || 'llm'],
          fallback: [],
          limits: {},
          priority: 0,
          source: 'legacy',
        }
      }
    }
  } catch (e) {
    // legacy 读取失败不报错，继续走 shim
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// Shim — 紧急降级层
// ═══════════════════════════════════════════════════════════════

function legacyShim(modelName: string): ResolvedModelRoute | null {
  // 基于模型名前缀猜测 provider
  const guessMap: Array<[RegExp, string, string[]]> = [
    [/^gpt/, 'openai', ['chat', 'vision']],
    [/^o1/, 'openai', ['chat']],
    [/^deepseek/, 'deepseek', ['chat']],
    [/^doubao/, 'volcengine', ['chat', 'vision']],
    [/^qwen/, 'bailian', ['chat', 'vision']],
    [/^kling/, 'kling', ['video']],
    [/^runway/, 'runway', ['video']],
    [/^vllm/, 'vllm-local', ['chat']],
    [/^local/, 'localai', ['chat', 'image']],
  ]

  for (const [regex, providerName, capabilities] of guessMap) {
    if (regex.test(modelName)) {
      return {
        modelName,
        providerName: providerName,
        provider: {
          id: providerName,
          type: 'openai-compatible',
          name: providerName,
          label: providerName,
          baseUrl: '',
          authConfig: {},
          isActive: true,
          metadata: {},
        },
        capabilities,
        fallback: [],
        limits: {},
        priority: 0,
        source: 'shim',
      }
    }
  }

  // 默认返回 custom
  return {
    modelName,
    providerName: 'custom',
    provider: {
      id: 'custom',
      type: 'custom',
      name: 'custom',
      label: '自定义',
      baseUrl: '',
      authConfig: {},
      isActive: true,
      metadata: {},
    },
    capabilities: ['llm'],
    fallback: [],
    limits: {},
    priority: 0,
    source: 'shim',
  }
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/** 通配符匹配（支持 * 后缀通配如 "doubao-*"） */
function matchesWildcard(pattern: string, target: string): boolean {
  if (pattern === target) return true
  if (pattern.endsWith('*')) {
    return target.startsWith(pattern.slice(0, -1))
  }
  return false
}

/** 同步写入 legacy route_config（双写兼容） */
async function syncProviderToLegacy(provider: any): Promise<void> {
  try {
    const row = await prisma.routeConfig.findFirst({
      where: { scope: 'route:admin-global-config', key: 'provider_registry_sync', isActive: true },
    })
    const existing = row?.value as any[] | undefined
    const list = Array.isArray(existing) ? [...existing] : []
    const idx = list.findIndex((e: any) => e.name === provider.name)
    const entry = {
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      label: provider.label,
    }
    if (idx >= 0) {
      list[idx] = entry
    } else {
      list.push(entry)
    }
    // 直接写入 route_config（用同一 prisma 实例，避免循环 import 问题）
    await prisma.$executeRaw`UPDATE route_config SET value = ${JSON.stringify(list)}::jsonb, "updatedAt" = NOW() WHERE key = 'provider_registry_sync' AND scope = 'route:admin-global-config'`
  } catch (e) {
    // 双写失败不影响主流程
    console.warn('[ProviderRegistry] ⚠️ 同步 legacy route_config 失败:', (e as Error).message)
  }
}

// ═══════════════════════════════════════════════════════════════
// Seed 初始化（首次部署时执行）
// ═══════════════════════════════════════════════════════════════

export async function seedProviderRegistry(): Promise<void> {
  const count = await prisma.providerRegistry.count()
  if (count > 0) {
    console.log('[ProviderRegistry] ⏭️ provider_registry 已有数据，跳过 seed')
    return
  }

  console.log('[ProviderRegistry] 🌱 初始化 provider_registry + model_route_config seed 数据')

  // ── provider_registry ──
  const providers = [
    { name: 'openai', type: 'openai-compatible', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
    { name: 'deepseek', type: 'openai-compatible', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
    { name: 'volcengine', type: 'openai-compatible', label: '火山引擎豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
    { name: 'bailian', type: 'openai-compatible', label: '阿里百炼通义', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { name: 'siliconflow', type: 'openai-compatible', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1' },
    { name: 'kling', type: 'custom', label: '快手可灵', baseUrl: 'https://api.klingai.com' },
    { name: 'runway', type: 'custom', label: 'Runway Gen-4', baseUrl: 'https://api.runwayml.com/v1' },
    { name: 'vllm-local', type: 'openai-compatible', label: '本地 vLLM', baseUrl: 'http://localhost:8000/v1' },
    { name: 'localai', type: 'openai-compatible', label: '本地 LocalAI', baseUrl: 'http://localhost:8080/v1' },
    { name: 'custom', type: 'custom', label: '自定义 OpenAI 兼容', baseUrl: '' },
  ]

  for (const p of providers) {
    await prisma.providerRegistry.create({
      data: {
        id: crypto.randomUUID(),
        name: p.name,
        type: p.type,
        label: p.label,
        baseUrl: p.baseUrl,
        authConfig: p.name === 'openai'
          ? { useEnvKey: true, envKeyName: 'OPENAI_API_KEY' }
          : p.name === 'volcengine'
            ? { useEnvKey: true, envKeyName: 'VOLCENGINE_API_KEY' }
            : p.name === 'deepseek'
              ? { useEnvKey: true, envKeyName: 'DEEPSEEK_API_KEY' }
              : p.name === 'bailian'
                ? { useEnvKey: true, envKeyName: 'ALIYUN_API_KEY' }
                : { useEnvKey: false },
        metadata: {
          icon: p.name === 'openai' ? '🤖' : p.name === 'volcengine' ? '🎬' : p.name === 'deepseek' ? '🧠' : '🔌',
        },
      },
    })
  }

  // 重建 provider name → id 映射
  const providerMap = new Map<string, string>()
  const allProviders = await prisma.providerRegistry.findMany()
  for (const p of allProviders) {
    providerMap.set(p.name, p.id)
  }

  // ── model_route_config ──
  const routes = [
    // LLM
    { modelName: 'gpt-4o', provider: 'openai', capabilities: ['chat', 'vision'], priority: 10, fallback: ['deepseek'] },
    { modelName: 'gpt-4o-mini', provider: 'openai', capabilities: ['chat', 'vision'], priority: 9, fallback: ['deepseek'] },
    { modelName: 'deepseek-v4-flash', provider: 'deepseek', capabilities: ['chat'], priority: 10, fallback: ['openai'] },
    { modelName: 'deepseek-v4-pro', provider: 'deepseek', capabilities: ['chat'], priority: 10, fallback: ['openai'] },
    { modelName: 'doubao-seed-*', provider: 'volcengine', capabilities: ['chat'], priority: 10, fallback: ['deepseek', 'openai'] },
    { modelName: 'doubao-1.5-*', provider: 'volcengine', capabilities: ['chat'], priority: 8, fallback: ['deepseek'] },
    { modelName: 'doubao-vl-*', provider: 'volcengine', capabilities: ['chat', 'vision'], priority: 10, fallback: ['bailian'] },
    { modelName: 'qwen-*', provider: 'bailian', capabilities: ['chat', 'vision'], priority: 8, fallback: ['volcengine'] },
    { modelName: 'deepseek-*', provider: 'deepseek', capabilities: ['chat'], priority: 9, fallback: ['openai'] },
    { modelName: 'o1-*', provider: 'openai', capabilities: ['chat'], priority: 6 },
    // Image
    { modelName: 'doubao-seedream-*', provider: 'volcengine', capabilities: ['image'], priority: 10, fallback: ['openai'] },
    { modelName: 'dall-e-*', provider: 'openai', capabilities: ['image'], priority: 9 },
    { modelName: 'qwen-vl-*', provider: 'bailian', capabilities: ['image'], priority: 8 },
    { modelName: 'wan-*', provider: 'bailian', capabilities: ['image'], priority: 7 },
    { modelName: 'local-*', provider: 'localai', capabilities: ['image'], priority: 5 },
    // Video
    { modelName: 'doubao-seedance-*', provider: 'volcengine', capabilities: ['video'], priority: 10, fallback: ['kling'] },
    { modelName: 'kling-*', provider: 'kling', capabilities: ['video'], priority: 9 },
    { modelName: 'runway-*', provider: 'runway', capabilities: ['video'], priority: 8 },
    // TTS
    { modelName: 'doubao-tts-*', provider: 'volcengine', capabilities: ['tts'], priority: 10 },
    { modelName: 'cosyvoice-*', provider: 'bailian', capabilities: ['tts'], priority: 9 },
    { modelName: 'siliconflow-*', provider: 'siliconflow', capabilities: ['tts'], priority: 8 },
    // vLLM / 本地模型 catch-all
    { modelName: 'vllm-*', provider: 'vllm-local', capabilities: ['chat', 'image'], priority: 5 },
    { modelName: 'custom-*', provider: 'custom', capabilities: ['chat', 'image', 'video'], priority: 1 },
  ]

  for (const r of routes) {
    const provName = r.provider
    if (!providerMap.has(provName)) {
      console.warn(`[ProviderRegistry] ⚠️ seed 跳过 ${r.modelName}: provider ${r.provider} 未找到`)
      continue
    }
    await prisma.modelRouteConfig.create({
      data: {
        id: crypto.randomUUID(),
        modelName: r.modelName,
        providerName: provName,
        capabilities: JSON.parse(JSON.stringify(r.capabilities)),
        priority: r.priority,
        fallback: r.fallback ? JSON.parse(JSON.stringify(r.fallback)) : [],
        limits: {},
      },
    })
  }

  // ── provider_handler_registry ──
  // 映射每个 provider 支持的 taskType → handler
  const handlerMap: Array<{ provider: string; taskType: string; handlerName: string }> = [
    { provider: 'openai', taskType: 'llm', handlerName: 'openai-llm' },
    { provider: 'openai', taskType: 'image', handlerName: 'dalle-image' },
    { provider: 'deepseek', taskType: 'llm', handlerName: 'deepseek-llm' },
    { provider: 'volcengine', taskType: 'llm', handlerName: 'volcengine-llm' },
    { provider: 'volcengine', taskType: 'image', handlerName: 'seedream-image' },
    { provider: 'volcengine', taskType: 'video', handlerName: 'volcengine-video' },
    { provider: 'volcengine', taskType: 'tts', handlerName: 'volcengine-tts' },
    { provider: 'bailian', taskType: 'llm', handlerName: 'aliyun-llm' },
    { provider: 'bailian', taskType: 'image', handlerName: 'qwen-image' },
    { provider: 'bailian', taskType: 'video', handlerName: 'aliyun-video' },
    { provider: 'bailian', taskType: 'tts', handlerName: 'aliyun-tts' },
    { provider: 'siliconflow', taskType: 'llm', handlerName: 'siliconflow-llm' },
    { provider: 'siliconflow', taskType: 'image', handlerName: 'siliconflow-image' },
    { provider: 'siliconflow', taskType: 'tts', handlerName: 'siliconflow-tts' },
    { provider: 'kling', taskType: 'video', handlerName: 'kling-video' },
    { provider: 'runway', taskType: 'video', handlerName: 'runway-video' },
    { provider: 'vllm-local', taskType: 'llm', handlerName: 'openai-llm' },
    { provider: 'localai', taskType: 'llm', handlerName: 'openai-llm' },
    { provider: 'custom', taskType: 'llm', handlerName: 'openai-llm' },
    { provider: 'custom', taskType: 'image', handlerName: 'openai-image' },
    { provider: 'custom', taskType: 'video', handlerName: 'openai-video' },
  ]

  for (const h of handlerMap) {
    if (!providerMap.has(h.provider)) continue
    await prisma.providerHandlerRegistry.create({
      data: {
        id: crypto.randomUUID(),
        providerName: h.provider,
        taskType: h.taskType,
        handlerName: h.handlerName,
        handlerConfig: {},
      },
    })
  }

  console.log(`[ProviderRegistry] ✅ seed 完成: ${providers.length} providers, ${routes.length} routes, ${handlerMap.length} handlers`)
}
