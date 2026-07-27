/**
 * runtime.repository.ts — EnterpriseAgentInstance 运行时数据访问层
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-5: Repository 只负责数据访问，不负责业务组装。
 * DP-2: Instance 是 Runtime 实例，Profile 是业务身份。
 *
 * ⚠️ EnterpriseAgentInstance.employeeId → EnterpriseAgentProfile.id
 *    是手动关联（无 @relation），Repository 需要二次查询。
 *
 * 数据路径（已验证）：
 *   1. EnterpriseAgentInstance.findMany() — Runtime 实例列表
 *   2. EnterpriseAgentProfile.findMany() — 通过 employeeId 批量获取
 *
 * Repository 执行所有查询 + 内存组装。Mapper 只做字段映射。
 */

import { prisma } from '../../utils/index.js'

export interface RuntimeQueryOptions {
  tenantId?: string
  lifecycleState?: string
  skip?: number
  take?: number
}

export interface RuntimeRow {
  id: string
  tenantId: string
  employeeId: string
  agentId: string
  lifecycleState: string
  runtimeStatus: string
  lastActiveAt: Date | null
  lastRecoveredAt: Date | null
  totalTasks: number
  totalErrors: number
  createdAt: Date
  updatedAt: Date
  /** 手动关联结果：来自 Profile */
  profileName: string | null
  profileAgentType: string | null
  profileDescription: string | null
}

export const runtimeRepository = {
  /**
   * 查询所有 Agent Instance + Profile 信息
   *
   * 两次查询：
   *   1. EnterpriseAgentInstance.findMany() — 实例列表
   *   2. EnterpriseAgentProfile.findMany() — 通过 employeeId 批量获取
   */
  async findMany(options: RuntimeQueryOptions): Promise<{ rows: RuntimeRow[], total: number }> {
    const where: Record<string, string> = {}
    if (options.tenantId) where.tenantId = options.tenantId
    if (options.lifecycleState) where.lifecycleState = options.lifecycleState

    const skip = options.skip ?? 0
    const take = options.take ?? 100

    const [instances, total] = await Promise.all([
      prisma.enterpriseAgentInstance.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          employeeId: true,
          agentId: true,
          lifecycleState: true,
          runtimeStatus: true,
          lastActiveAt: true,
          lastRecoveredAt: true,
          totalTasks: true,
          totalErrors: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.enterpriseAgentInstance.count({ where }),
    ])

    // 手动关联：employeeId → EnterpriseAgentProfile
    const employeeIds = instances.map(i => i.employeeId)

    const profiles = employeeIds.length > 0
      ? await prisma.enterpriseAgentProfile.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true, agentType: true, description: true },
        })
      : []

    const profileMap = new Map(profiles.map(p => [p.id, p]))

    // 内存组装：Instance + Profile → RuntimeRow
    const rows: RuntimeRow[] = instances.map(inst => {
      const profile = profileMap.get(inst.employeeId)
      return {
        id: inst.id,
        tenantId: inst.tenantId,
        employeeId: inst.employeeId,
        agentId: inst.agentId,
        lifecycleState: inst.lifecycleState,
        runtimeStatus: inst.runtimeStatus,
        lastActiveAt: inst.lastActiveAt,
        lastRecoveredAt: inst.lastRecoveredAt,
        totalTasks: inst.totalTasks,
        totalErrors: inst.totalErrors,
        createdAt: inst.createdAt,
        updatedAt: inst.updatedAt,
        profileName: profile?.name ?? null,
        profileAgentType: profile?.agentType ?? null,
        profileDescription: profile?.description ?? null,
      }
    })

    return { rows, total }
  },

  /**
   * 按生命周期状态分组计数
   */
  async countByState(): Promise<Record<string, number>> {
    const groups = await prisma.enterpriseAgentInstance.groupBy({
      by: ['lifecycleState'],
      _count: { _all: true },
    })

    const result: Record<string, number> = {}
    for (const g of groups) {
      result[g.lifecycleState] = g._count._all
    }
    return result
  },
}
