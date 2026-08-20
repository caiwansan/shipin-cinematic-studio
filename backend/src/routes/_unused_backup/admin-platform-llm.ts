/**
 * admin-platform-llm.ts — 平台 LLM Provider 管理（Life Assistant 控制面）
 *
 * Phase LA-1A: Control Plane Only (NO LLM EXECUTION)
 *
 * GET    /api/admin/platform/llm/providers       — 获取所有 provider
 * POST   /api/admin/platform/llm/providers       — 新增 provider
 * PUT    /api/admin/platform/llm/providers/:id   — 更新 provider
 * DELETE /api/admin/platform/llm/providers/:id   — 删除 provider
 * POST   /api/admin/platform/llm/providers/:id/toggle — 启用/禁用
 *
 * GET    /api/admin/platform/llm/config          — 获取路由配置
 * PUT    /api/admin/platform/llm/config          — 更新路由配置
 */

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { getRouteConfig, setRouteConfig } from '../utils/index.js'
import { encryptKey } from '../services/crypto.service.js'
import { decryptKey } from '../services/crypto.service.js'

const SCOPE = 'platform:life-assistant'

interface PlatformLLMProvider {
  id: string
  name: string
  type: 'openai' | 'deepseek' | 'custom'
  apiKeyEncrypted?: string
  baseUrl: string
  models: string[]
  status: 'active' | 'disabled'
  priority: number
  createdAt: string
}

interface RoutingConfig {
  defaultProvider: string | null
  routingMode: 'priority' | 'fixed'
  modelTierMapping: {
    fast: string[]
    balanced: string[]
    quality: string[]
  }
}

export default async function adminPlatformLLMRoutes(fastify: FastifyInstance) {
  // ======== Provider CRUD ========

  // GET: 获取所有 provider（API Key 脱敏）
  fastify.get('/api/admin/platform/llm/providers', { preHandler: [requireAdmin] }, async () => {
    const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
    const serialized = providers.map(p => ({
      ...p,
      apiKeyEncrypted: p.apiKeyEncrypted ? '••••' + p.apiKeyEncrypted.slice(-4) : '',
    }))
    return { success: true, data: serialized }
  })

  // POST: 新增 provider
  fastify.post('/api/admin/platform/llm/providers', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { name, type, apiKey, baseUrl, models, priority } = request.body as any
      if (!name || !type) {
        return reply.status(400).send({ success: false, error: 'name 和 type 为必填' })
      }

      const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
      const id = 'pllm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
      const encrypted = apiKey ? encryptKey(apiKey) : ''

      const newProvider: PlatformLLMProvider = {
        id,
        name,
        type,
        apiKeyEncrypted: encrypted,
        baseUrl: baseUrl || '',
        models: models || [],
        status: 'active',
        priority: priority ?? providers.length,
        createdAt: new Date().toISOString(),
      }

      providers.push(newProvider)
      await setRouteConfig(SCOPE, 'providers', providers)

      return { success: true, data: { ...newProvider, apiKeyEncrypted: encrypted ? '••••' + encrypted.slice(-4) : '' } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT: 更新 provider
  fastify.put('/api/admin/platform/llm/providers/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any
      const { name, type, apiKey, baseUrl, models, priority, status } = request.body as any

      const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
      const idx = providers.findIndex(p => p.id === id)
      if (idx === -1) return reply.status(404).send({ success: false, error: 'Provider 不存在' })

      if (name !== undefined) providers[idx].name = name
      if (type !== undefined) providers[idx].type = type
      if (apiKey) providers[idx].apiKeyEncrypted = encryptKey(apiKey)
      if (baseUrl !== undefined) providers[idx].baseUrl = baseUrl
      if (models !== undefined) providers[idx].models = models
      if (priority !== undefined) providers[idx].priority = priority
      if (status !== undefined) providers[idx].status = status

      await setRouteConfig(SCOPE, 'providers', providers)
      return { success: true, data: { ...providers[idx], apiKeyEncrypted: providers[idx].apiKeyEncrypted ? '••••' + providers[idx].apiKeyEncrypted!.slice(-4) : '' } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE: 删除 provider
  fastify.delete('/api/admin/platform/llm/providers/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any
      const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
      const idx = providers.findIndex(p => p.id === id)
      if (idx === -1) return reply.status(404).send({ success: false, error: 'Provider 不存在' })

      providers.splice(idx, 1)
      await setRouteConfig(SCOPE, 'providers', providers)
      return { success: true, data: { id } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST toggle: 启用/禁用
  fastify.post('/api/admin/platform/llm/providers/:id/toggle', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any
      const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
      const idx = providers.findIndex(p => p.id === id)
      if (idx === -1) return reply.status(404).send({ success: false, error: 'Provider 不存在' })

      providers[idx].status = providers[idx].status === 'active' ? 'disabled' : 'active'
      await setRouteConfig(SCOPE, 'providers', providers)
      return { success: true, data: { id, status: providers[idx].status } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ======== Routing Config ========

  // GET: 获取路由配置
  fastify.get('/api/admin/platform/llm/config', { preHandler: [requireAdmin] }, async () => {
    const config: RoutingConfig = await getRouteConfig(SCOPE, 'routing-config', {
      defaultProvider: null,
      routingMode: 'priority',
      modelTierMapping: { fast: [], balanced: [], quality: [] },
    })
    return { success: true, data: config }
  })

  // PUT: 更新路由配置
  fastify.put('/api/admin/platform/llm/config', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { defaultProvider, routingMode, modelTierMapping } = request.body as any
      const config: RoutingConfig = {
        defaultProvider: defaultProvider ?? null,
        routingMode: routingMode || 'priority',
        modelTierMapping: modelTierMapping || { fast: [], balanced: [], quality: [] },
      }
      await setRouteConfig(SCOPE, 'routing-config', config)
      return { success: true, data: config }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ======== Provider Selection (Shell - Control Plane Only) ========

  /**
   * ═══════════════════════════════════════════════════════════════
   * selectProvider 宪法（禁止违反）：
   *
   * 1. MUST NOT call any external API
   * 2. MUST NOT execute any LLM inference
   * 3. MUST NOT access any user data
   * 4. MUST NOT modify any system state
   * 5. ONLY return a configuration decision
   *
   * 控制面 ≠ 执行面。这个函数是"配电柜的面板指示器"，
   * 不是"发电机的点火钥匙"。
   *
   * Phase LA-1B 会新增 LLM Execution 层，但绝对不会修改此函数。
   * ═══════════════════════════════════════════════════════════════
   */
  fastify.get('/api/admin/platform/llm/select', async (request: any) => {
    const { intent } = request.query as any
    const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
    const config: RoutingConfig = await getRouteConfig(SCOPE, 'routing-config', {
      defaultProvider: null,
      routingMode: 'priority',
      modelTierMapping: { fast: [], balanced: [], quality: [] },
    })

    // 配置驱动选择：按 priority 排序选第一个 active 的
    const active = providers.filter(p => p.status === 'active').sort((a, b) => a.priority - b.priority)
    const selected = active[0] || null

    return {
      success: true,
      data: {
        intent: intent || null,
        selectedProvider: selected ? { id: selected.id, name: selected.name, type: selected.type } : null,
        availableCount: active.length,
        routingMode: config.routingMode,
        // NO LLM CALL — 仅返回配置
      }
    }
  })
}
