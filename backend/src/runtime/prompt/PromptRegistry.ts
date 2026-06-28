/**
 * PromptRegistry.ts — 昆仑镜统一 Prompt 注册中心
 *
 * 宪法职责：
 * 1. 唯一入口：所有 LLM prompt 只能通过此 Registry 获取
 * 2. 强制收敛：屏蔽下游对 Prisma 的直接调用
 * 3. 来源标记：每个 prompt 可追溯来源（主系统/兼容层）
 * 4. 热更新：支持 TTL 缓存 + 手动失效
 *
 * 来源层次（优先级顺序）：
 *   PromptTemplate 表（主系统）
 *   ImagePromptTemplates 表（🚧 临时兼容层，标记 deprecated）
 *   fallback（❌ 禁止业务使用）
 *
 * @phase1-prompt-registry
 */

import { prisma } from '../../utils/index.js'

// ─── 类型定义 ───

export type PromptSource = 'PromptTemplate' | 'ImagePromptTemplate' | 'fallback'

export interface PromptRegistryEntry {
  name: string
  prompt: string
  source: PromptSource
  version?: string
  deprecated: boolean
  schema?: string       // output JSON schema（可选）
  extra?: Record<string, any>  // 附加字段（如 sections, compositionRules 等）
}

export interface PromptRegistryStats {
  totalEntries: number
  directPrismaCalls: number
  imageBridgeCalls: number
  deprecatedSources: { name: string; source: string }[]
  sourceBreakdown: Record<string, number>
}

// ─── 兼容桥接模式 ───
// 在 imagePromptTemplates 表完全迁移前为 true
const IMAGE_PROMPT_BRIDGE_MODE = true

// ─── 缓存 ───
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟
const promptCache = new Map<string, { entry: PromptRegistryEntry; timestamp: number }>()

// ─── 内部统计 ───
const _stats: PromptRegistryStats = {
  totalEntries: 0,
  directPrismaCalls: 0,
  imageBridgeCalls: 0,
  deprecatedSources: [],
  sourceBreakdown: {},
}

// ─── 命名空间映射桥接 ───
// imagePromptTemplates 的 (type, templateKey) → PromptRegistry name
const P_IMG_BRIDGE_MAP: Record<string, { type: string; templateKey: string }> = {
  'portrait/negativePrompt': { type: 'portrait', templateKey: 'negative_prompt' },
  'portrait/qcPrompt': { type: 'portrait', templateKey: 'qc_prompt' },
  'portrait/promptStructure': { type: 'portrait', templateKey: 'prompt_structure' },
  'portrait/qualityRules': { type: 'portrait', templateKey: 'quality_rules' },
  'portrait/compositionRules': { type: 'portrait', templateKey: 'composition_rules' },
}

// ─── Phase 4-A: Prompt Runtime 引用 ───
// 动态 import 避免循环依赖
let _router: any = null
let _logger: any = null
let _versionGraph: any = null
const ROUTING_ENABLED = true  // 可通过环境变量开关
const PROMPT_RUNTIME_OBSERVATION_MODE = true  // 观测模式：所有调用必须 traceable
const ROUTING_CONTEXT_FLAG = '__routing_resolved'  // 标记重复调用

async function getRouter() {
  if (!_router) _router = await import('./PromptRouter.js')
  return _router
}
async function getLogger() {
  if (!_logger) _logger = await import('./PromptRuntimeLogger.js')
  return _logger
}
async function getVersionGraph() {
  if (!_versionGraph) _versionGraph = await import('./PromptVersionGraph.js')
  return _versionGraph
}

// ─── 核心函数 ───

/**
 * 获取单个 prompt（包裹在 runAsRegistry 中，通过 PromptAccessGuard）
 * 查找顺序：PromptTemplate → ImagePromptTemplates(bridge) → error
 * 
 * Phase 4-A 改造：不再直接返回，而是经过 PromptRouter 版本解析，
 * 每次调用记录 RuntimeLogger
 */
async function getPromptRaw(name: string): Promise<PromptRegistryEntry> {
  _stats.directPrismaCalls++

  // 在 PromptAccessGuard 的 `runAsRegistry` 上下文中执行 DB 查询
  const { runAsRegistry } = await import('./PromptAccessGuard.js')

  const doQuery = async () => {
    // 1. 主系统：PromptTemplate
    const pt = await prisma.promptTemplate.findUnique({ where: { name } })
    if (pt?.content && typeof pt.content === 'object') {
      const content = pt.content as Record<string, any>
      const prompt = content.prompt || content.text || ''
      if (prompt) {
        const entry: PromptRegistryEntry = {
          name,
          prompt,
          source: 'PromptTemplate',
          deprecated: false,
          schema: content.output_schema || content.outputSchema || undefined,
          extra: content,
        }
        _stats.sourceBreakdown['PromptTemplate'] = (_stats.sourceBreakdown['PromptTemplate'] || 0) + 1
        return entry
      }
    }

    // 2. 兼容桥接层：ImagePromptTemplates
    if (IMAGE_PROMPT_BRIDGE_MODE && P_IMG_BRIDGE_MAP[name]) {
      const { type, templateKey } = P_IMG_BRIDGE_MAP[name]
      const imgTpl = await prisma.imagePromptTemplates.findUnique({
        where: { type_templateKey: { type, templateKey } },
      })
      if (imgTpl?.content) {
        _stats.imageBridgeCalls++
        const entry: PromptRegistryEntry = {
          name,
          prompt: imgTpl.content,
          source: 'ImagePromptTemplate',
          deprecated: true,
        }
        _stats.deprecatedSources.push({ name, source: 'ImagePromptTemplate' })
        _stats.sourceBreakdown['ImagePromptTemplate'] = (_stats.sourceBreakdown['ImagePromptTemplate'] || 0) + 1
        console.warn(`[PromptRegistry] ⚠️ DEPRECATED SOURCE: "${name}" → ImagePromptTemplate table`)
        return entry
      }
    }

    // 3. 不存在 → 抛错（不允许业务 fallback）
    throw new Error(`[PromptRegistry] "${name}" 在 PromptTemplate/ImagePromptTemplates 中均不存在`)
  }

  return runAsRegistry(doQuery)
}

/**
 * 获取 prompt（带缓存 + Phase 4-A 路由 + 日志）
 * 
 * routing 只做一次（通过 __routing_resolved 标记避免重复调用
 * 在 getPromptRaw 内部递归时重复路由）
 */
export async function getPrompt(name: string, context?: Record<string, any>): Promise<string> {
  const startTime = Date.now()
  let routingVersion = 'v1'
  let routingMode: string = 'stable'
  let success = true

  try {
    // Phase 4-A: 如果启用 routing 且不是内部重试，先解析版本
    if (ROUTING_ENABLED && !context?.[ROUTING_CONTEXT_FLAG]) {
      const router = await getRouter()
      const routing = await router.resolvePromptVersion(name, context)
      routingVersion = routing.version
      routingMode = routing.routingMode

      // 如果路由指向非 v1 版本，尝试读取 variant content
      if (routingVersion !== 'v1') {
        const vg = await getVersionGraph()
        const node = await vg.getVersion(name, routingVersion)
        if (node?.content) {
          const entry: PromptRegistryEntry = {
            name,
            prompt: node.content.prompt || node.content.text || '',
            source: 'PromptTemplate',
            deprecated: false,
            extra: node.content,
          }
          promptCache.set(name, { entry, timestamp: Date.now() })
          _stats.totalEntries++
          const result = applyContext(entry, context)
          // 异步记录日志（不等待）
          logPromptCallAsync({ name, version: routingVersion, routingMode, startTime, success: true, response: result, context })
          return result
        }
      }
    }

    // 原始逻辑：从 PromptTemplate 读取
    const cached = promptCache.get(name)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      _stats.totalEntries++
      const result = applyContext(cached.entry, context)
      logPromptCallAsync({ name, version: routingVersion, routingMode, startTime, success: true, response: result, context })
      return result
    }

    const entry = await getPromptRaw(name)
    promptCache.set(name, { entry, timestamp: Date.now() })
    _stats.totalEntries++

    const result = applyContext(entry, context)
    logPromptCallAsync({ name, version: routingVersion, routingMode, startTime, success: true, response: result, context })
    return result
  } catch (err) {
    success = false
    logPromptCallAsync({ name, version: routingVersion, routingMode, startTime, success: false, response: '', context })
    throw err
  }
}

// ─── 异步日志（不阻塞返回） ───
function logPromptCallAsync(params: {
  name: string
  version: string
  routingMode: string
  startTime: number
  success: boolean
  response: string
  context?: Record<string, any>
}): void {
  const latencyMs = Date.now() - params.startTime
  getLogger().then(logger => {
    logger.logPromptCall({
      promptName: params.name,
      version: params.version,
      routingMode: params.routingMode,
      contextHash: logger.hashContext(params.context),
      latencyMs,
      success: params.success,
      responseChars: params.response.length,
    })
  }).catch(() => {})  // 日志失败不抛
}

/**
 * 批量获取 prompt
 */
export async function getPromptBatch(names: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  for (const name of names) {
    try {
      results[name] = await getPrompt(name)
    } catch (err: any) {
      console.error(`[PromptRegistry] Batch get "${name}" failed: ${err.message}`)
    }
  }
  return results
}

/**
 * 获取完整注册信息（含 source、deprecated 等 + Phase 4-A 路由 + 日志）
 */
export async function getPromptEntry(name: string, context?: Record<string, any>): Promise<PromptRegistryEntry> {
  const startTime = Date.now()

  try {
    const cached = promptCache.get(name)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      _stats.totalEntries++
      return applyContextToEntry(cached.entry, context)
    }

    const entry = await getPromptRaw(name)
    promptCache.set(name, { entry, timestamp: Date.now() })
    _stats.totalEntries++

    // 记录日志
    const latencyMs = Date.now() - startTime
    const logger = await getLogger()
    logger.logPromptCall({
      promptName: name,
      version: 'v1',
      routingMode: 'stable',
      contextHash: logger.hashContext(context),
      latencyMs,
      success: true,
      responseChars: entry.prompt.length,
    }).catch(() => {})

    return applyContextToEntry(entry, context)
  } catch (err) {
    const latencyMs = Date.now() - startTime
    const logger = await getLogger()
    logger.logPromptCall({
      promptName: name,
      version: 'v1',
      routingMode: 'stable',
      contextHash: logger.hashContext(context),
      latencyMs,
      success: false,
      responseChars: 0,
    }).catch(() => {})
    throw err
  }
}

/**
 * 获取 prompt 来源信息
 */
export async function getPromptSource(name: string): Promise<PromptSource> {
  const cached = promptCache.get(name)
  if (cached) return cached.entry.source
  const entry = await getPromptRaw(name)
  return entry.source
}

/**
 * 清除缓存（单条）
 */
export function invalidateCache(name: string): void {
  promptCache.delete(name)
}

/**
 * 清除全部缓存
 */
export function clearCache(): void {
  promptCache.clear()
}

/**
 * 获取当前统计
 */
export function getStats(): PromptRegistryStats {
  return { ..._stats, deprecatedSources: [..._stats.deprecatedSources] }
}

/**
 * 重置统计
 */
export function resetStats(): void {
  _stats.totalEntries = 0
  _stats.directPrismaCalls = 0
  _stats.imageBridgeCalls = 0
  _stats.deprecatedSources = []
  _stats.sourceBreakdown = {}
}

// ─── 内部帮助函数 ───

/**
 * 将结构化 context 注入到 prompt（取代 string replace hack）
 *
 * 支持两种模式：
 * 1. {{ placeholder }} — 大括号模板替换
 * 2. structured injection — 在 prompt 尾部追加 JSON context block
 */
function applyContext(entry: PromptRegistryEntry, context?: Record<string, any>): string {
  if (!context || Object.keys(context).length === 0) return entry.prompt

  let result = entry.prompt

  // 模式1: 占位符替换
  for (const [key, val] of Object.entries(context)) {
    result = result.replaceAll(`{{${key}}}`, val != null ? String(val) : '')
    result = result.replaceAll(`{${key}}`, val != null ? String(val) : '')
  }

  return result
}

function applyContextToEntry(entry: PromptRegistryEntry, context?: Record<string, any>): PromptRegistryEntry {
  return {
    ...entry,
    prompt: applyContext(entry, context),
  }
}
