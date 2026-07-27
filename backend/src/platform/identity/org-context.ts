/**
 * OrgContext — 统一组织上下文
 * P0-3-05 Phase B: 建立全局 OrgContext 替换所有 user.id fallback
 */
export interface OrgContext {
  /** 当前操作用户 ID */
  userId: string;
  /** 当前操作用户 email */
  email?: string;
  /** 组织 ID（Enterprise 资源隔离主键） */
  organizationId: string;
  /** Governance Tenant ID（可选） */
  tenantId?: string;
  /** 用户在组织中的角色 */
  role?: string;
}

/**
 * 信任链：
 * JWT → getOrganizationIdForUser() → OrgContext
 * 
 * 禁止：
 * - 从 body.organizationId 信任用户输入
 * - 使用 user.id 作为组织 ID 回退
 */
export function createOrgContext(
  userId: string,
  organizationId: string,
  email?: string,
  role?: string,
): OrgContext {
  return { userId, organizationId, email, role };
}
