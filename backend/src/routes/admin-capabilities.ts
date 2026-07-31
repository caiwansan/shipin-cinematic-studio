/**
 * routes/admin-capabilities.ts — Capability Commerce Authority
 *
 * Sprint-11C.5: 平台管理员管理 AI 员工能力商品资产
 *
 * 边界:
 *   - 管理 EmployeeCapability 定义（能力商品目录）
 *   - 禁用能力 = 运行时阻断（通过 entitlementGate 实现）
 *   - 禁止物理删除（能力是商业资产）
 *
 * 不在此文件:
 *   ❌ 企业管理员绑定（在 enterprise-capability.routes.ts）
 *   ❌ 套餐管理（在 admin-commerce.ts）
 *   ❌ 员工管理（在 enterprise-agents routes）
 *   ❌ 支付集成（Sprint-12）
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { employeeCapabilityService } from '../services/enterprise/employee-capability.service.js'

// ─── 允许的状态值 ─────────────────────────────────────
const ALLOWED_STATUSES = ['ACTIVE', 'DEPRECATED', 'DISABLED'] as const
type CapabilityStatus = typeof ALLOWED_STATUSES[number]

function isValidStatus(s: string): s is CapabilityStatus {
  return ALLOWED_STATUSES.includes(s.toUpperCase() as any)
}

// ─── 商业信息增强 ─────────────────────────────────────
async function enrichWithCommercial(cap: any) {
  const [bindingCount, plans] = await Promise.all([
    // 绑定此能力的活跃员工数
    prisma.employeeCapabilityBinding.count({
      where: { capabilityCode: cap.code, status: 'active' },
    }),
    // 包含此能力的套餐
    prisma.enterprisePlan.findMany({
      where: {
        enabled: true,
        // capabilityCodes JSON 数组中包含此 code
      },
      select: { id: true, name: true, displayName: true, capabilityCodes: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  // 兼容解析新旧格式的 capabilityCodes
  function extractCapCodes(raw: unknown): string[] {
    if (!raw) return []
    // 新格式: { employees, capabilities }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const caps = (raw as any).capabilities
      return Array.isArray(caps) ? caps : []
    }
    // 旧格式: [...]
    if (Array.isArray(raw)) return raw
    return []
  }

  // 由于 capabilityCodes 是 JSON 数组，我们在内存中过滤
  const matchingPlans = plans.filter(p => {
    const codes: string[] = extractCapCodes(p.capabilityCodes)
    // 空数组 = 全部能力开放（Enterprise 级）
    return codes.length === 0 || codes.includes(cap.code)
  }).map(p => ({ id: p.id, name: p.name, displayName: p.displayName }))

  return {
    ...cap,
    usedByAgents: bindingCount,
    plans: matchingPlans,
  }
}

// ─── 路由 ──────────────────────────────────────────────
export default async function adminCapabilityRoutes(fastify: FastifyInstance) {

  // ═══════════════════════════════════════════════════════
  // GET /api/admin/commerce/capabilities
  // 能力列表（含商业信息）
  // ═══════════════════════════════════════════════════════
  fastify.get('/capabilities', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as { category?: string; status?: string }

    const where: any = {}
    if (query.category) where.category = query.category
    if (query.status) {
      where.status = query.status.toUpperCase()
    }

    const caps = await prisma.employeeCapability.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    })

    const enriched = await Promise.all(caps.map(c => enrichWithCommercial({
    id: c.id,
    code: c.code,
    name: c.name,
    category: c.category,
    description: c.description,
    requiredTools: safeParseJSON<string[]>(c.requiredTools, []),
    status: c.status,
    schemaVersion: c.schemaVersion,
    createdAt: c.createdAt?.toISOString() || null,
    updatedAt: c.updatedAt?.toISOString() || null,
  })))

    return { success: true, data: enriched }
  })

  // ═══════════════════════════════════════════════════════
  // GET /api/admin/commerce/capabilities/:id
  // 单个能力详情（含商业信息 + 已绑定企业概览）
  // ═══════════════════════════════════════════════════════
  fastify.get('/capabilities/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const cap = await prisma.employeeCapability.findFirst({
      where: {
        OR: [
          { id },
          { code: id },
        ],
      },
    })
    if (!cap) {
      return reply.status(404).send({ success: false, message: '能力不存在' })
    }

    // 基础商业信息
    const enriched = await enrichWithCommercial({
      id: cap.id,
      code: cap.code,
      name: cap.name,
      category: cap.category,
      description: cap.description,
      requiredTools: safeParseJSON<string[]>(cap.requiredTools, []),
      status: cap.status,
      createdAt: cap.createdAt?.toISOString() || null,
      updatedAt: cap.updatedAt?.toISOString() || null,
    })

    // 额外：绑定此能力的企业概览（top 10）
    const bindings = await prisma.employeeCapabilityBinding.groupBy({
      by: ['tenantId'],
      where: { capabilityCode: cap.code, status: 'active' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    const tenantIds = bindings.map(b => b.tenantId)
    const profiles = tenantIds.length > 0
      ? await prisma.enterpriseProfile.findMany({
          where: { organizationId: { in: tenantIds } },
          select: { organizationId: true, companyName: true },
        })
      : []
    const profileMap = new Map(profiles.map(p => [p.organizationId, p.companyName]))

    const tenantSummary = bindings.map(b => ({
      tenantId: b.tenantId,
      companyName: profileMap.get(b.tenantId) || '未知企业',
      agentCount: b._count.id,
    }))

    return {
      success: true,
      data: {
        ...enriched,
        tenants: tenantSummary,
      },
    }
  })

  // ═══════════════════════════════════════════════════════
  // POST /api/admin/commerce/capabilities
  // 创建能力定义
  // ═══════════════════════════════════════════════════════
  fastify.post('/capabilities', { preHandler: [requireAdmin] }, async (request, reply) => {
    const b = request.body as any

    if (!b.code || !b.name || !b.category) {
      return reply.status(400).send({
        success: false,
        message: '必填字段缺失：code, name, category',
      })
    }

    // code 格式校验：只允许小写字母、数字、下划线
    if (!/^[a-z][a-z0-9_]*$/.test(b.code)) {
      return reply.status(400).send({
        success: false,
        message: 'code 必须以小写字母开头，仅允许小写字母、数字和下划线',
      })
    }

    // 唯一性检查
    const existing = await employeeCapabilityService.getCapability(b.code)
    if (existing) {
      return reply.status(409).send({
        success: false,
        message: `能力 code 已存在: ${b.code}`,
      })
    }

    const cap = await employeeCapabilityService.createCapability({
      code: b.code,
      name: b.name,
      category: b.category,
      description: b.description,
      requiredTools: b.requiredTools,
    })

    return { success: true, data: cap }
  })

  // ═══════════════════════════════════════════════════════
  // PUT /api/admin/commerce/capabilities/:id
  // 更新能力定义（含状态变更）
  // ═══════════════════════════════════════════════════════
  fastify.put('/capabilities/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const b = request.body as any

    // 检查能力存在
    const cap = await employeeCapabilityService.getCapability(id)
    if (!cap) {
      return reply.status(404).send({ success: false, message: '能力不存在' })
    }

    // 构建更新字段
    const updateData: any = {}

    if (b.name !== undefined) {
      if (typeof b.name !== 'string' || b.name.trim().length === 0) {
        return reply.status(400).send({ success: false, message: 'name 不能为空' })
      }
      updateData.name = b.name.trim()
    }

    if (b.category !== undefined) {
      if (typeof b.category !== 'string' || b.category.trim().length === 0) {
        return reply.status(400).send({ success: false, message: 'category 不能为空' })
      }
      updateData.category = b.category.trim()
    }

    if (b.description !== undefined) {
      updateData.description = b.description
    }

    if (b.requiredTools !== undefined) {
      if (!Array.isArray(b.requiredTools)) {
        return reply.status(400).send({ success: false, message: 'requiredTools 必须为数组' })
      }
      updateData.requiredTools = b.requiredTools
    }

    if (b.status !== undefined) {
      const s = String(b.status).toUpperCase()
      if (!isValidStatus(s)) {
        return reply.status(400).send({
          success: false,
          message: `无效状态值: ${b.status}，允许: ${ALLOWED_STATUSES.join(', ')}`,
        })
      }
      updateData.status = s
    }

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ success: false, message: '未提供任何更新字段' })
    }

    const updated = await employeeCapabilityService.updateCapability(cap.id, updateData)
    if (!updated) {
      return reply.status(500).send({ success: false, message: '更新失败' })
    }

    // 如果能力被禁用（DISABLED），记录一条审计日志（console）
    if (updateData.status === 'DISABLED') {
      console.warn(`[AdminCapability] DISABLED: ${cap.code} ("${cap.name}") by platform admin`)
    }

    return { success: true, data: updated }
  })

  // ═══════════════════════════════════════════════════════
  // GET /api/admin/commerce/capabilities/categories
  // 能力分类列表
  // ═══════════════════════════════════════════════════════
  fastify.get('/capabilities/categories', { preHandler: [requireAdmin] }, async () => {
    const categories = await employeeCapabilityService.getCategories()
    return { success: true, data: categories }
  })
}

// ─── Helpers ────────────────────────────────────────────
function safeParseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}
