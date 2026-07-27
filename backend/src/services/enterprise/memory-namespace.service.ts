/**
 * Memory Namespace Service — KM-AI-JOB-AGENT-06 改造
 * AI Employee Memory Isolation Layer
 *
 * 目标: 确保企业A AI员工 不能读取 企业B AI员工 Memory
 * 架构: Namespace 路径隔离 + 校验层
 *
 * 命名规范:
 *   tenant/{tenantId}/agent/{agentInstanceId}/
 *   ├── memory/          # Agent Memory 路径
 *   ├── sessions/        # Session 路径
 *   └── context/         # 上下文缓存
 *
 * 改造要点:
 *   - 不再依赖 HermesProfileBinding 表
 *   - 直接从 EnterpriseAgentInstance 读取
 *   - namespace 加入 agentInstanceId 实现 Agent 级隔离
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface MemoryNamespace {
  tenantId: string
  agentInstanceId: string
  namespace: string
  memoryPath: string
  sessionPath: string
  contextPath: string
  isIsolated: boolean
}

export interface NamespaceValidation {
  valid: boolean
  reason?: string
  namespace: string
}

// ─── Service ─────────────────────────────────────────────

export class MemoryNamespaceService {

  /**
   * 获取 Agent Instance 的 Memory Namespace
   * 直接从 Instance 读取，不依赖 Binding 表
   */
  async getNamespace(agentInstanceId: string): Promise<MemoryNamespace | null> {
    const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
      where: { id: agentInstanceId },
      select: { id: true, tenantId: true },
    })
    if (!instance) return null

    const namespace = this.buildNamespace(instance.tenantId, agentInstanceId)

    return {
      tenantId: instance.tenantId,
      agentInstanceId,
      namespace: namespace.root,
      memoryPath: namespace.memoryPath,
      sessionPath: namespace.sessionPath,
      contextPath: namespace.contextPath,
      isIsolated: true,
    }
  }

  /**
   * 通过 tenantId 创建/获取 Namespace
   * 企业创建 AI 员工时调用
   */
  async createNamespace(tenantId: string, agentInstanceId: string): Promise<MemoryNamespace> {
    const namespace = this.buildNamespace(tenantId, agentInstanceId)

    return {
      tenantId,
      agentInstanceId,
      namespace: namespace.root,
      memoryPath: namespace.memoryPath,
      sessionPath: namespace.sessionPath,
      contextPath: namespace.contextPath,
      isIsolated: true,
    }
  }

  /**
   * 校验 Memory 访问是否合法
   * 防止跨租户、跨 Agent 访问
   */
  validateAccess(
    requestTenantId: string,
    requestAgentInstanceId: string,
    targetTenantId: string,
    targetAgentInstanceId: string,
  ): NamespaceValidation {
    // 跨租户 → 拒绝
    if (requestTenantId !== targetTenantId) {
      return {
        valid: false,
        reason: 'CROSS_TENANT_ACCESS_DENIED',
        namespace: this.buildNamespace(targetTenantId, targetAgentInstanceId).root,
      }
    }

    // 同一租户，同一 Agent → 允许
    if (requestAgentInstanceId === targetAgentInstanceId) {
      return {
        valid: true,
        namespace: this.buildNamespace(targetTenantId, targetAgentInstanceId).root,
      }
    }

    // 同一租户，不同 Agent → 隔离
    return {
      valid: false,
      reason: 'CROSS_AGENT_ACCESS_DENIED',
      namespace: this.buildNamespace(targetTenantId, targetAgentInstanceId).root,
    }
  }

  /**
   * 列出租户下所有 Namespaces
   */
  async listNamespaces(tenantId: string): Promise<MemoryNamespace[]> {
    const instances = await (prisma as any).enterpriseAgentInstance.findMany({
      where: { tenantId },
      select: { id: true },
    })

    return instances.map((inst: any) => {
      const ns = this.buildNamespace(tenantId, inst.id)
      return {
        tenantId,
        agentInstanceId: inst.id,
        namespace: ns.root,
        memoryPath: ns.memoryPath,
        sessionPath: ns.sessionPath,
        contextPath: ns.contextPath,
        isIsolated: true,
      }
    })
  }

  /**
   * 获取 Memory 目录路径（供外部存储使用）
   */
  getMemoryPath(tenantId: string, agentInstanceId: string): string {
    return `tenant/${tenantId}/agent/${agentInstanceId}/memory`
  }

  /**
   * 获取 Session 目录路径
   */
  getSessionPath(tenantId: string, agentInstanceId: string): string {
    return `tenant/${tenantId}/agent/${agentInstanceId}/sessions`
  }

  // ─── Private ───────────────────────────────────────────

  /**
   * 构建 Namespace 路径
   * 格式: tenant/{tenantId}/agent/{agentInstanceId}
   */
  private buildNamespace(
    tenantId: string,
    agentInstanceId: string,
  ): {
    root: string
    memoryPath: string
    sessionPath: string
    contextPath: string
  } {
    const root = `tenant/${tenantId}/agent/${agentInstanceId}`
    return {
      root,
      memoryPath: `${root}/memory`,
      sessionPath: `${root}/sessions`,
      contextPath: `${root}/context`,
    }
  }
}

export const memoryNamespaceService = new MemoryNamespaceService()
