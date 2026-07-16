/**
 * Enterprise Reality Layer — Demo Boundary v1.1
 *
 * 统一管理 Demo/Production 边界。
 * Reality First Rule: 生产环境 Enterprise 页面只能展示当前 Tenant 数据。
 * Demo 数据仅存在于 /demo 路由或 intro 介绍页。
 *
 * 禁止在其他文件中硬编码 DEMO_TENANT_ID。
 */
export const DEMO_TENANT_ID = '4ecfe9d8-6fc7-4909-bee4-af9a07ce05a9'

export const DEMO_TENANT_NAME = 'Tesla 演示企业'

/**
 * 判断一个 Tenant 是否为 Demo 租户
 */
export function isDemoTenant(tenantId: string | undefined | null): boolean {
  if (!tenantId) return false
  return tenantId === DEMO_TENANT_ID
}

/**
 * 判断当前用户是否为生产环境用户（非 Demo）
 */
export function isProductionTenant(tenantId: string | undefined | null): boolean {
  if (!tenantId) return false
  return tenantId !== DEMO_TENANT_ID
}

/**
 * Prisma Where 子句：过滤掉 Demo 租户数据
 * 用于所有 Enterprise API 查询
 *
 * 用法：
 *   prisma.enterpriseContentPublish.findMany({
 *     where: { ...demoFilter(user.tenantId), status: 'published' }
 *   })
 */
export function demoFilter(tenantId: string | undefined | null) {
  if (!tenantId) {
    // 无 tenantId 时，排除 Demo 数据
    return { tenantId: { not: DEMO_TENANT_ID } }
  }
  if (isDemoTenant(tenantId)) {
    // Demo 租户：只能看自己
    return { tenantId }
  }
  // 生产租户：看自己，排除 Demo
  return { tenantId, NOT: { tenantId: DEMO_TENANT_ID } }
}

/**
 * Prisma Where 子句：仅返回当前租户数据（严格隔离）
 * 用于 CEO Dashboard / Leads / ROI 等核心页面
 */
export function tenantOnly(tenantId: string | undefined | null): { tenantId: string } | { tenantId: { not: string } } {
  if (!tenantId) {
    return { tenantId: { not: DEMO_TENANT_ID } }
  }
  return { tenantId }
}

/**
 * 验证 tenantId 是否有效（非空、非 Demo 占用）
 */
export function isValidProductionTenant(tenantId: string | undefined | null): tenantId is string {
  return !!tenantId && tenantId !== DEMO_TENANT_ID
}

// ═══════════════════════════════════════════════════════════════
// AC4.3 — Data Source Labeling
// ═══════════════════════════════════════════════════════════════

/**
 * 数据来源标识
 * 所有 Enterprise API 响应必须标注数据来源
 */
export type DataSource = 'production' | 'demo' | 'mixed'

/**
 * 为 API 响应添加数据来源标识
 */
export function withDataSource<T extends Record<string, any>>(
  data: T,
  tenantId: string | undefined | null
): T & { dataSource: DataSource } {
  return {
    ...data,
    dataSource: isDemoTenant(tenantId) ? 'demo' : 'production',
  }
}

/**
 * 混合数据场景（同时包含生产+Demo数据）
 * 仅用于对比分析页面
 */
export function withMixedDataSource<T extends Record<string, any>>(data: T): T & { dataSource: DataSource } {
  return {
    ...data,
    dataSource: 'mixed',
  }
}

// ═══════════════════════════════════════════════════════════════
// AC4.1 — Tenant Ownership Guard
// ═══════════════════════════════════════════════════════════════

/**
 * 验证请求 tenantId 是否属于当前用户
 * 在 enterprise route 的 preHandler 中调用
 *
 * 安全规则：
 * 1. URL tenantId 必须与 JWT tenantId 一致
 * 2. 防止水平越权（User A 访问 User B 的数据）
 */
export function validateTenantOwnership(
  requestTenantId: string | undefined,
  userTenantId: string | undefined | null,
  userId: string | undefined
): { valid: boolean; resolvedTenantId: string; reason?: string } {
  // 从 JWT 解析的 tenantId
  const resolved = userTenantId || userId || ''

  // 如果请求未指定 tenantId，使用 JWT 中的
  if (!requestTenantId) {
    return { valid: true, resolvedTenantId: resolved }
  }

  // Demo 用户只能访问 Demo 数据
  if (isDemoTenant(resolved) && requestTenantId !== DEMO_TENANT_ID) {
    return { valid: false, resolvedTenantId: DEMO_TENANT_ID, reason: 'Demo tenant can only access demo data' }
  }

  // 生产用户：URL tenantId 必须 === JWT tenantId
  if (requestTenantId !== resolved) {
    return { valid: false, resolvedTenantId: resolved, reason: 'Tenant ownership mismatch' }
  }

  return { valid: true, resolvedTenantId: resolved }
}

// ═══════════════════════════════════════════════════════════════
// AC4.4 — Empty State Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * 判断一个租户是否为"新租户"（没有任何企业数据）
 */
export async function isNewTenant(tenantId: string, prismaClient: any): Promise<boolean> {
  if (isDemoTenant(tenantId)) return false

  const [agentCount, contentCount, leadCount] = await Promise.all([
    prismaClient.enterpriseAgentProfile.count({ where: { tenantId } }),
    prismaClient.enterpriseContentPublish.count({ where: { tenantId } }),
    prismaClient.enterpriseLeadIntelligence.count({ where: { tenantId } }),
  ])

  return agentCount === 0 && contentCount === 0 && leadCount === 0
}

/**
 * 新租户的默认空状态数据
 * 前端据此显示引导页面，而非 Tesla 数据
 */
export function getEmptyStateData(tenantId: string) {
  return {
    isNewTenant: true,
    welcomeMessage: '您的AI部门已启动！',
    nextSteps: [
      '配置您的AI团队成员',
      '连接企业渠道账号',
      '导入产品知识资料',
    ],
    demoAvailable: true,
    demoPath: '/enterprise/intro#demo',
  }
}
