/**
 * Employee Capability Service — Sprint-11C.1
 * Enterprise Capability Authority
 *
 * 职责:
 *   1. EmployeeCapability CRUD（能力定义管理）
 *   2. EmployeeCapabilityBinding CRUD（能力授予管理）
 *   3. 批量绑定能力（从模板/AgentType）
 *   4. 查询员工已绑定的能力
 *
 * 不使用:
 *   ❌ CapabilityContract（那是平台层能力合同，不是员工能力）
 *   ❌ CapabilityGrant（那是套餐授权，不是员工绑定）
 *
 * 架构位置:
 *   Template → CapabilityBinding → EnterpriseAgentProfile
 *
 * Sprint-11C.3:
 *   Capability Entitlement — Gated by enterprise subscription plan.
 *   bindCapability() and batchBindCapabilities() now check:
 *   → Does the tenant's subscription plan include this capability?
 *   → If not → throw CAPABILITY_NOT_INCLUDED
 */
import { prisma } from '../../utils/index.js'
import type { CapabilityCatalogItemDTO } from './capability-catalog.mapper.js'
import { toCatalogItemDTO } from './capability-catalog.mapper.js'

// ─── Types ───────────────────────────────────────────────

export interface CapabilityDTO {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  requiredTools: string[]
  status: string
  createdAt: string
}

export interface CapabilityBindingDTO {
  id: string
  tenantId: string
  employeeId: string
  capabilityId: string
  capabilityCode: string
  capabilityName: string
  toolAllowList: string[]
  grantedBy: string
  grantedAt: string
  expiresAt: string | null
  status: string
}

export interface CapabilityCheckResult {
  granted: boolean
  binding: CapabilityBindingDTO | null
  missingCapabilities: string[]
}

export interface BatchBindResult {
  bound: number
  skipped: number
  errors: string[]
}

// ─── Service ─────────────────────────────────────────────

/**
 * Entitlement entry codes: [] means all capabilities are allowed
 */
const ALL_CAPABILITIES = Symbol('ALL_CAPABILITIES')

export class EntitlementGateError extends Error {
  public deniedCodes: string[]
  constructor(deniedCodes: string[]) {
    super(`CAPABILITY_NOT_INCLUDED: ${deniedCodes.join(', ')}`)
    this.name = 'EntitlementGateError'
    this.deniedCodes = deniedCodes
  }
}

export class EmployeeCapabilityService {

  // ═══════════════════════════════════════════════════════
  // Sprint-11C.3: Capability Entitlement Gate
  // ═══════════════════════════════════════════════════════

  /**
   * Check if the tenant's subscription plan includes the requested capabilities.
   * Empty capabilityCodes array = all capabilities allowed.
   *
   * @returns list of denied capability codes (empty = all allowed)
   * @throws EntitlementGateError if gate blocks (use safely with try/catch)
   */
  async entitlementGate(tenantId: string, capabilityCodes: string[]): Promise<{ allowed: boolean; denied: string[] }> {
    // 1. 通过 EnterpriseProfile 找到 organizationId
    const profile = await prisma.enterpriseProfile.findUnique({
      where: { organizationId: tenantId },
      select: { organizationId: true },
    })
    if (!profile) {
      return { allowed: false, denied: capabilityCodes }
    }

    // 2. 查找租户的 active subscription + entitlement
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: {
        organizationId: profile.organizationId,
        status: { in: ['active', 'trial'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!sub) {
      return { allowed: false, denied: capabilityCodes }
    }

    // 3. 获取 Entitlement
    const entitlement = await prisma.enterpriseEntitlement.findUnique({
      where: { subscriptionId: sub.id },
    })
    if (!entitlement) {
      return { allowed: false, denied: capabilityCodes }
    }

    // 4. 获取授权的能力代码列表
    const rawCodes = entitlement.capabilityCodes as string | null | undefined
    const entitledCodes: string[] = this.parseJSON<string[]>(
      rawCodes || '[]',
      []
    )

    // 3. 空数组 = 全部能力开放（Enterprise 级）
    const isAllAllowed = entitledCodes.length === 0
    if (isAllAllowed) {
      return { allowed: true, denied: [] }
    }

    // 4. 检查每个请求的能力是否被授权
    const entitledSet = new Set(entitledCodes)
    const denied = capabilityCodes.filter(code => !entitledSet.has(code))

    return {
      allowed: denied.length === 0,
      denied,
    }
  }

  /**
   * Strict entitlement gate — throws if any capability is not included
   */
  async entitlementGateStrict(tenantId: string, capabilityCodes: string[]): Promise<void> {
    const result = await this.entitlementGate(tenantId, capabilityCodes)
    if (!result.allowed) {
      throw new EntitlementGateError(result.denied)
    }
  }

  /**
   * Re-sync entitlement capability codes from the subscription's plan.
   * Called when subscription changes (upgrade/downgrade).
   */
  /**
   * Re-sync entitlement capability codes from the subscription's plan.
   * Supports both old flat array and new structured format.
   */
  async syncEntitlementFromPlan(subscriptionId: string): Promise<boolean> {
    const [sub, entitlement] = await Promise.all([
      prisma.enterpriseSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      }),
      prisma.enterpriseEntitlement.findUnique({
        where: { subscriptionId },
      }),
    ])
    if (!sub || !entitlement) return false

    // Sprint-14 Task 04K Step 2: 兼容解析新旧格式
    const parsed = this.parseCapabilityConfig(sub.plan.capabilityCodes)
    await prisma.enterpriseEntitlement.update({
      where: { subscriptionId },
      data: { capabilityCodes: parsed.capabilities },
    })
    return true
  }

  // ═══════════════════════════════════════════════════════
  // EmployeeCapability CRUD
  // ═══════════════════════════════════════════════════════

  /**
   * 获取所有 active 能力定义
   */
  /**
   * 获取能力商品目录（对外产品层）
   *
   * 支持按套餐代码过滤：
   *   plan='trial' → 仅返回 trial 套餐包含的能力
   *   plan 为空     → 返回全部 active 能力
   *
   * 返回 CapabilityCatalogItemDTO，不泄漏内部字段。
   */
  async listCatalogItems(plan?: string): Promise<CapabilityCatalogItemDTO[]> {
    let allowedCodes: string[] | undefined

    if (plan) {
      // 查找套餐定义
      const planRecord = await prisma.enterprisePlan.findUnique({
        where: { name: plan },
        select: { capabilityCodes: true },
      })
      if (!planRecord) {
        // 套餐不存在 → 返回空列表
        return []
      }

      // Sprint-14 Task 04K Step 2: 兼容解析新旧格式
      const planCodes: string[] = this.parseCapabilityConfig(planRecord.capabilityCodes).capabilities

      // [] = 全部能力开放（Enterprise 级）
      if (planCodes.length === 0) {
        allowedCodes = undefined // 不限制
      } else {
        allowedCodes = planCodes
      }
    }

    const where: any = { status: 'active' }
    if (allowedCodes) {
      where.code = { in: allowedCodes }
    }

    const caps = await prisma.employeeCapability.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    })
    return caps.map(cap => toCatalogItemDTO(cap))
  }

  async listCapabilities(category?: string): Promise<CapabilityDTO[]> {
    const where: any = { status: 'active' }
    if (category) where.category = category

    const caps = await prisma.employeeCapability.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    })
    return caps.map(cap => this.toCapabilityDTO(cap))
  }

  /**
   * 获取单个能力定义
   */
  async getCapability(idOrCode: string): Promise<CapabilityDTO | null> {
    const cap = await prisma.employeeCapability.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { code: idOrCode },
        ],
      },
    })
    if (!cap) return null
    return this.toCapabilityDTO(cap)
  }

  /**
   * 创建能力定义（管理员）
   */
  async createCapability(data: {
    code: string
    name: string
    category: string
    description?: string
    requiredTools?: string[]
  }): Promise<CapabilityDTO> {
    const cap = await prisma.employeeCapability.create({
      data: {
        code: data.code,
        name: data.name,
        category: data.category,
        description: data.description || null,
        requiredTools: JSON.stringify(data.requiredTools || []),
        status: 'active',
        schemaVersion: 1,
        metadata: '{}',
      },
    })
    return this.toCapabilityDTO(cap)
  }

  /**
   * 更新能力定义
   */
  async updateCapability(id: string, data: {
    name?: string
    description?: string
    requiredTools?: string[]
    status?: string
  }): Promise<CapabilityDTO | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.requiredTools !== undefined) updateData.requiredTools = JSON.stringify(data.requiredTools)
    if (data.status !== undefined) updateData.status = data.status

    const cap = await prisma.employeeCapability.update({
      where: { id },
      data: updateData,
    })
    return this.toCapabilityDTO(cap)
  }

  // ═══════════════════════════════════════════════════════
  // EmployeeCapabilityBinding — 能力授予
  // ═══════════════════════════════════════════════════════

  /**
   * 为员工绑定一个能力
   * 工具列表从 EmployeeCapability.requiredTools 继承
   *
   * Sprint-11C.3: 绑定前检查 Entitlement Gate
   * 如果企业套餐不包含该能力 → throw CAPABILITY_NOT_INCLUDED
   */
  async bindCapability(params: {
    tenantId: string
    employeeId: string
    capabilityCode: string
    grantedBy?: string
    toolAllowList?: string[]
    skipEntitlementCheck?: boolean  // 内部调用跳过，管理接口保留
  }): Promise<CapabilityBindingDTO | null> {
    // 0. Sprint-11C.3: Entitlement Gate
    if (!params.skipEntitlementCheck) {
      await this.entitlementGateStrict(params.tenantId, [params.capabilityCode])
    }

    // 1. 查找能力定义
    const cap = await prisma.employeeCapability.findUnique({
      where: { code: params.capabilityCode },
    })
    if (!cap || cap.status !== 'active') return null

    // 2. 检查是否已绑定
    const existing = await prisma.employeeCapabilityBinding.findFirst({
      where: {
        employeeId: params.employeeId,
        capabilityId: cap.id,
      },
    })

    if (existing) {
      // 已绑定则更新状态
      const updated = await prisma.employeeCapabilityBinding.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          toolAllowList: params.toolAllowList
            ? JSON.stringify(params.toolAllowList)
            : cap.requiredTools,
          grantedBy: params.grantedBy || existing.grantedBy,
        },
        include: { capability: true },
      })
      return this.toBindingDTO(updated)
    }

    // 3. 创建新绑定
    const toolList = params.toolAllowList
      ? JSON.stringify(params.toolAllowList)
      : cap.requiredTools

    const binding = await prisma.employeeCapabilityBinding.create({
      data: {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        capabilityId: cap.id,
        capabilityCode: cap.code,
        toolAllowList: toolList,
        grantedBy: params.grantedBy || 'template',
        status: 'active',
      },
      include: { capability: true },
    })
    return this.toBindingDTO(binding)
  }

  /**
   * 批量绑定能力（从模板或AgentType创建时使用）
   * 跳过已绑定的能力
   *
   * Sprint-11C.3: 绑定前执行 Entitlement Gate — 如果套餐不包含则批量拒绝
   */
  async batchBindCapabilities(params: {
    tenantId: string
    employeeId: string
    capabilityCodes: string[]
    grantedBy?: string
    skipEntitlementCheck?: boolean
  }): Promise<BatchBindResult> {
    const result: BatchBindResult = { bound: 0, skipped: 0, errors: [] }

    // Sprint-11C.3: 批量 Entitlement Gate — 一次性拒绝所有未授权能力
    if (!params.skipEntitlementCheck && params.capabilityCodes.length > 0) {
      const gateResult = await this.entitlementGate(params.tenantId, params.capabilityCodes)
      if (!gateResult.allowed) {
        for (const code of gateResult.denied) {
          result.errors.push(`CAPABILITY_NOT_INCLUDED: ${code} — 当前套餐不包含此能力`)
          result.skipped++
        }
        // 只绑定被允许的能力
        const allowedCodes = params.capabilityCodes.filter(c => !gateResult.denied.includes(c))
        if (allowedCodes.length === 0) return result
        params.capabilityCodes = allowedCodes
      }
    }

    for (const code of params.capabilityCodes) {
      try {
        const binding = await this.bindCapability({
          tenantId: params.tenantId,
          employeeId: params.employeeId,
          capabilityCode: code,
          grantedBy: params.grantedBy || 'template',
          skipEntitlementCheck: true,  // 已在上面检查过，避免重复
        })

        if (binding) {
          result.bound++
        } else {
          result.skipped++
          result.errors.push(`Capability not found or inactive: ${code}`)
        }
      } catch (err: any) {
        result.errors.push(`Failed to bind ${code}: ${err.message}`)
        result.skipped++
      }
    }

    return result
  }

  /**
   * 撤销员工的能力绑定
   */
  async revokeCapability(employeeId: string, capabilityCode: string): Promise<boolean> {
    const binding = await prisma.employeeCapabilityBinding.findFirst({
      where: {
        employeeId,
        capabilityCode,
        status: 'active',
      },
    })
    if (!binding) return false

    await prisma.employeeCapabilityBinding.update({
      where: { id: binding.id },
      data: { status: 'revoked' },
    })
    return true
  }

  /**
   * 查询员工的所有已绑定能力
   */
  async listEmployeeCapabilities(employeeId: string): Promise<CapabilityBindingDTO[]> {
    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: {
        employeeId,
        status: 'active',
      },
      include: { capability: true },
      orderBy: { grantedAt: 'desc' },
    })
    return bindings.map(b => this.toBindingDTO(b))
  }

  /**
   * 查询员工是否拥有某能力
   */
  async hasCapability(employeeId: string, capabilityCode: string): Promise<boolean> {
    const count = await prisma.employeeCapabilityBinding.count({
      where: {
        employeeId,
        capabilityCode,
        status: 'active',
      },
    })
    return count > 0
  }

  /**
   * 检查员工拥有哪些能力（批量）
   */
  async checkCapabilities(employeeId: string, requiredCodes: string[]): Promise<CapabilityCheckResult> {
    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: {
        employeeId,
        capabilityCode: { in: requiredCodes },
        status: 'active',
      },
      include: { capability: true },
    })

    const grantedCodes = new Set(bindings.map(b => b.capabilityCode))
    const missing = requiredCodes.filter(c => !grantedCodes.has(c))

    return {
      granted: missing.length === 0,
      binding: bindings.length > 0 ? this.toBindingDTO(bindings[0]) : null,
      missingCapabilities: missing,
    }
  }

  /**
   * 获取员工被授予的所有工具列表（合并所有绑定能力的工具）
   */
  async getEffectiveTools(employeeId: string): Promise<string[]> {
    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: { employeeId, status: 'active' },
    })

    const toolSet = new Set<string>()

    for (const b of bindings) {
      const tools = JSON.parse(b.toolAllowList || '[]') as string[]
      tools.forEach(t => toolSet.add(t))
    }

    return Array.from(toolSet)
  }

  // ═══════════════════════════════════════════════════════
  // 能力分类查询
  // ═══════════════════════════════════════════════════════

  /**
   * 获取所有能力分类
   */
  async getCategories(): Promise<string[]> {
    const results = await prisma.employeeCapability.findMany({
      where: { status: 'active' },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })
    return results.map(r => r.category)
  }

  // ═══════════════════════════════════════════════════════
  // DTO 转换
  // ═══════════════════════════════════════════════════════

  private toCapabilityDTO(cap: any): CapabilityDTO {
    return {
      id: cap.id,
      code: cap.code,
      name: cap.name,
      category: cap.category,
      description: cap.description,
      requiredTools: this.parseJSON<string[]>(cap.requiredTools, []),
      status: cap.status,
      createdAt: cap.createdAt?.toISOString() || new Date().toISOString(),
    }
  }

  private toBindingDTO(binding: any): CapabilityBindingDTO {
    return {
      id: binding.id,
      tenantId: binding.tenantId,
      employeeId: binding.employeeId,
      capabilityId: binding.capabilityId,
      capabilityCode: binding.capabilityCode,
      capabilityName: binding.capability?.name || binding.capabilityCode,
      toolAllowList: this.parseJSON<string[]>(binding.toolAllowList, []),
      grantedBy: binding.grantedBy,
      grantedAt: binding.grantedAt?.toISOString() || new Date().toISOString(),
      expiresAt: binding.expiresAt?.toISOString() || null,
      status: binding.status,
    }
  }

  private parseJSON<T>(val: any, fallback: T): T {
    if (!val) return fallback
    try { return JSON.parse(val) } catch { return fallback }
  }

  /**
   * Sprint-14 Task 04K Step 2: 兼容解析 capabilityCodes 新旧格式
   * 旧格式: ["resume_analysis", "candidate_scoring"]
   * 新格式: { employees: [{ role, displayName }], capabilities: ["..."] }
   */
  private parseCapabilityConfig(raw: unknown): { employees: Array<{ role: string; displayName: string }>; capabilities: string[] } {
    if (!raw) {
      return { employees: [], capabilities: [] }
    }

    // JSON 字符串 → 解析
    let parsed = raw
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw) } catch { return { employees: [], capabilities: [] } }
    }

    // 新格式: 对象
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      return {
        employees: Array.isArray(obj.employees) ? obj.employees as Array<{ role: string; displayName: string }> : [],
        capabilities: Array.isArray(obj.capabilities) ? obj.capabilities as string[] : [],
      }
    }

    // 旧格式: 数组
    if (Array.isArray(parsed)) {
      return { employees: [], capabilities: parsed as string[] }
    }

    return { employees: [], capabilities: [] }
  }
}

// ─── Singleton ───────────────────────────────────────────

export const employeeCapabilityService = new EmployeeCapabilityService()
