/**
 * Employee Capability Routes — Sprint-11C.1
 * Enterprise Capability Management API
 *
 * 企业管理员：
 *   GET    /enterprise/capabilities — 获取所有能力定义列表
 *   GET    /enterprise/capabilities/categories — 获取能力分类列表
 *   POST   /enterprise/capabilities — 创建能力定义（管理员）
 *   PUT    /enterprise/capabilities/:id — 更新能力定义
 *
 * 员工能力授予：
 *   GET    /enterprise/agents/:agentId/capabilities — 获取员工已绑定的能力
 *   POST   /enterprise/agents/:agentId/capabilities/bind — 为员工绑定能力
 *   POST   /enterprise/agents/:agentId/capabilities/revoke — 撤销员工的能力
 *   GET    /enterprise/agents/:agentId/capabilities/gate — 检查是否有权限执行某能力
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { employeeCapabilityService } from '../services/enterprise/employee-capability.service.js'

export const enterpriseCapabilityRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }
  })

  // ═══════════════════════════════════════════════════════
  // 能力定义
  // ═══════════════════════════════════════════════════════

  /**
   * GET /api/enterprise/capabilities
   * 获取能力商品目录
   *
   * 支持按套餐过滤：
   *   GET /api/enterprise/capabilities
   *   GET /api/enterprise/capabilities?plan=trial
   *   GET /api/enterprise/capabilities?plan=professional
   *   GET /api/enterprise/capabilities?plan=enterprise
   *
   * 返回 CapabilityCatalogItemDTO，不泄漏内部字段。
   */
  fastify.get('/capabilities', async (request) => {
    const query = request.query as { plan?: string }
    const caps = await employeeCapabilityService.listCatalogItems(query.plan)
    return { code: 0, data: caps }
  })

  /**
   * GET /api/enterprise/capabilities/categories
   * 获取能力分类列表
   */
  fastify.get('/capabilities/categories', async () => {
    const categories = await employeeCapabilityService.getCategories()
    return { code: 0, data: categories }
  })

  /**
   * GET /api/enterprise/capabilities/:code
   * 获取单个能力定义
   */
  fastify.get('/capabilities/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const cap = await employeeCapabilityService.getCapability(code)
    if (!cap) {
      return reply.status(404).send({ code: 404, message: 'CAPABILITY_NOT_FOUND' })
    }
    return { code: 0, data: cap }
  })

  /**
   * POST /api/enterprise/capabilities
   * 创建能力定义（管理员）
   */
  fastify.post('/capabilities', async (request, reply) => {
    const body = request.body as {
      code: string
      name: string
      category: string
      description?: string
      requiredTools?: string[]
    }

    if (!body.code || !body.name || !body.category) {
      return reply.status(400).send({ code: 400, message: 'MISSING_REQUIRED_FIELDS: code, name, category required' })
    }

    // 检查 code 是否已存在
    const existing = await employeeCapabilityService.getCapability(body.code)
    if (existing) {
      return reply.status(409).send({ code: 409, message: `CAPABILITY_CODE_EXISTS: ${body.code}` })
    }

    const cap = await employeeCapabilityService.createCapability(body)
    return { code: 0, data: cap }
  })

  /**
   * PUT /api/enterprise/capabilities/:id
   * 更新能力定义
   */
  fastify.put('/capabilities/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      description?: string
      requiredTools?: string[]
      status?: string
    }

    const cap = await employeeCapabilityService.updateCapability(id, body)
    if (!cap) {
      return reply.status(404).send({ code: 404, message: 'CAPABILITY_NOT_FOUND' })
    }
    return { code: 0, data: cap }
  })

  // ═══════════════════════════════════════════════════════
  // 员工能力绑定
  // ═══════════════════════════════════════════════════════

  /**
   * GET /api/enterprise/agents/:agentId/capabilities
   * 获取员工已绑定的能力
   */
  fastify.get('/agents/:agentId/capabilities', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const bindings = await employeeCapabilityService.listEmployeeCapabilities(agentId)
    return { code: 0, data: bindings }
  })

  /**
   * POST /api/enterprise/agents/:agentId/capabilities/bind
   * 为员工绑定能力
   */
  fastify.post('/agents/:agentId/capabilities/bind', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    // Resolve tenant authority from EnterpriseAgentProfile → organizationId
    const agent = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { organizationId: true },
    })
    if (!agent) {
      return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' })
    }
    const tenantId = agent.organizationId

    const body = request.body as {
      capabilities: string[]  // capabilityCodes
      grantedBy?: string
    }

    if (!body.capabilities || body.capabilities.length === 0) {
      return reply.status(400).send({ code: 400, message: 'capabilities array required' })
    }

    const result = await employeeCapabilityService.batchBindCapabilities({
      tenantId,
      employeeId: agentId,
      capabilityCodes: body.capabilities,
      grantedBy: body.grantedBy || 'admin',
    })

    return {
      code: 0,
      data: {
        bound: result.bound,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    }
  })

  /**
   * POST /api/enterprise/agents/:agentId/capabilities/revoke
   * 撤销员工的能力
   */
  fastify.post('/agents/:agentId/capabilities/revoke', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const body = request.body as { capabilityCode: string }

    if (!body.capabilityCode) {
      return reply.status(400).send({ code: 400, message: 'capabilityCode required' })
    }

    const revoked = await employeeCapabilityService.revokeCapability(agentId, body.capabilityCode)
    if (!revoked) {
      return reply.status(404).send({ code: 404, message: 'BINDING_NOT_FOUND' })
    }

    return { code: 0, message: 'Capability revoked' }
  })
}
