/**
 * Capability Resolver — Sprint-11C.1 Task 05
 * Enterprise Capability Runtime Gate
 *
 * 职责:
 *   1. 查询员工拥有哪些能力
 *   2. 根据能力生成允许的工具列表
 *   3. 检查员工是否有权限执行特定能力
 *   4. 检查员工是否有权限使用特定工具
 *
 * 架构位置:
 *   EnterpriseAgentRuntime → CapabilityResolver (here) → executeViaGateway
 *
 * 不负责:
 *   ❌ Provider/Model 解析（那是 AgentModelBinding 的职责）
 *   ❌ Tool 平台管理（那是 Tool Registry 的职责）
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface ResolvedCapability {
  code: string
  name: string
  granted: boolean
  tools: string[]
  revokedAt?: string
}

export interface ResolvedCapabilitySet {
  employeeId: string
  capabilities: ResolvedCapability[]
  effectiveTools: string[]
  status: 'granted' | 'partial' | 'none'
}

export interface CapabilityGateResult {
  allowed: boolean
  reason?: string
  missingCapability?: string
  requiredCapability?: string
  currentCapabilities: string[]
}

// ─── Service ─────────────────────────────────────────────

export class CapabilityResolver {

  /**
   * 解析员工的所有已授权能力
   */
  async resolveCapabilities(employeeId: string): Promise<ResolvedCapabilitySet> {
    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: { employeeId },
      include: { capability: true },
    })

    const caps: ResolvedCapability[] = bindings.map(b => ({
      code: b.capabilityCode,
      name: b.capability?.name || b.capabilityCode,
      granted: b.status === 'active',
      tools: this.parseJSON<string[]>(b.toolAllowList, []),
      revokedAt: b.status !== 'active' ? (b as any).updatedAt?.toISOString() : undefined,
    }))

    // 合并所有工具列表
    const effectiveTools = Array.from(
      new Set(
        caps
          .filter(c => c.granted)
          .flatMap(c => c.tools)
      )
    )

    const activeCount = caps.filter(c => c.granted).length

    return {
      employeeId,
      capabilities: caps,
      effectiveTools,
      status: activeCount === 0 ? 'none' : activeCount < caps.length ? 'partial' : 'granted',
    }
  }

  /**
   * Capability Gate — 员工是否有权限执行某能力
   * 这是 Runtime 在分发任务前调用的检查点
   */
  async checkCapabilityGate(
    employeeId: string,
    requiredCapabilityCode: string,
  ): Promise<CapabilityGateResult> {
    const binding = await prisma.employeeCapabilityBinding.findFirst({
      where: {
        employeeId,
        capabilityCode: requiredCapabilityCode,
        status: 'active',
      },
    })

    // 获取当前所有能力（用于错误信息）
    const allBindings = await prisma.employeeCapabilityBinding.findMany({
      where: { employeeId, status: 'active' },
    })

    const currentCapabilities = allBindings.map(b => b.capabilityCode)

    if (binding) {
      return {
        allowed: true,
        currentCapabilities,
      }
    }

    return {
      allowed: false,
      reason: `CAPABILITY_NOT_GRANTED: Employee lacks '${requiredCapabilityCode}' capability`,
      missingCapability: requiredCapabilityCode,
      currentCapabilities,
    }
  }

  /**
   * 批量 Gate — 检查多个能力是否都授予
   */
  async checkCapabilityGates(
    employeeId: string,
    requiredCapabilityCodes: string[],
  ): Promise<CapabilityGateResult> {
    if (requiredCapabilityCodes.length === 0) {
      return { allowed: true, currentCapabilities: [] }
    }

    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: {
        employeeId,
        capabilityCode: { in: requiredCapabilityCodes },
        status: 'active',
      },
    })

    const grantedCodes = new Set(bindings.map(b => b.capabilityCode))
    const currentCapabilities = Array.from(grantedCodes)

    const missing = requiredCapabilityCodes.filter(c => !grantedCodes.has(c))

    if (missing.length === 0) {
      return { allowed: true, currentCapabilities }
    }

    return {
      allowed: false,
      reason: `CAPABILITY_NOT_GRANTED: Missing: ${missing.join(', ')}`,
      missingCapability: missing[0],
      requiredCapability: requiredCapabilityCodes.join(','),
      currentCapabilities,
    }
  }

  /**
   * 是否允许使用特定工具
   */
  async isToolAllowed(employeeId: string, toolName: string): Promise<boolean> {
    const bindings = await prisma.employeeCapabilityBinding.findMany({
      where: { employeeId, status: 'active' },
    })

    for (const b of bindings) {
      const tools = this.parseJSON<string[]>(b.toolAllowList, [])
      if (tools.includes(toolName)) return true
    }

    return false
  }

  private parseJSON<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    try { return JSON.parse(val) } catch { return fallback }
  }
}

// ─── Singleton ───────────────────────────────────────────

export const capabilityResolver = new CapabilityResolver()
