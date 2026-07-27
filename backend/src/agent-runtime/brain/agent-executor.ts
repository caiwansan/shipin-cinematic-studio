/**
 * agent-runtime/brain/agent-executor.ts
 * AgentExecutor — Agent Brain 的薄包装，适配 HermesAdapter 接口
 *
 * KM-AI-JOB-AGENT-02: 连接 HermesAdapter ↔ AgentOrchestrator
 * KM-AI-JOB-AGENT-02 Identity: resolveExecutionIdentity 实现
 *
 * 职责：
 *   1. 实现 HermesAdapter.AgentExecutor 接口
 *   2. 封装 AgentOrchestrator.executeTask()
 *   3. 解析 agentType → agentProfileId
 *   4. 解析执行身份（Execution Identity Resolution）
 */

import type { PrismaClient } from '@prisma/client';
import type { AgentExecutor } from '../../knowledge/orchestration/agent-orchestration.js';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator.service.js';
import { createAgentRuntimeModule } from '../runtime.module.js';

// ─── 执行身份模型 ────────────────────────────────────────────────

export type ActorType = 'USER' | 'AGENT' | 'SYSTEM'

export interface ExecutionIdentity {
  actorType: ActorType
  actorId: string        // 传入的原始 actorId
  ownerUserId: string    // 最终用于凭证解析的真实用户 ID
  tenantId: string       // 租户隔离 ID
  workspaceId?: string   // 可选工作空间 ID
  resolvedBy: string     // 记录解析路径（调试用）
}

// ─── AgentExecutor 实现 ──────────────────────────────────────────

export class AgentExecutorImpl implements AgentExecutor {
  private orchestrator: AgentOrchestrator
  private prisma: PrismaClient

  constructor(prisma: PrismaClient, orchestrator?: AgentOrchestrator) {
    this.prisma = prisma
    this.orchestrator = orchestrator || createDefaultOrchestrator(prisma)
  }

  async execute(
    agentId: string,
    message: string,
    context: {
      organizationId: string
      actorId: string
      permissionScope: string[]
      userId?: string       // 可选：真实登录用户传入
      workspaceId?: string  // 可选：工作空间上下文
    }
  ): Promise<{
    output: string
    tokensUsed: number
    provider: string
    model: string
    durationMs: number
    identity?: ExecutionIdentity
  }> {
    // KM-AI-JOB-AGENT-02 Identity: 解析执行身份
    const identity = await this.resolveExecutionIdentity(context)

    // 安全底线：禁止 system:hermes-adapter 进入 Gateway
    if (identity.ownerUserId.startsWith('system:')) {
      throw new Error(
        `ExecutionIdentity resolution failed: cannot resolve a valid ownerUserId for actorId="${context.actorId}", organizationId="${context.organizationId}". ` +
        `Refusing to execute with system identity.`
      )
    }

    const resolvedContext = {
      ...context,
      actorId: identity.ownerUserId,
    }

    const result = await this.orchestrator.executeTask(agentId, message, resolvedContext)

    if (result.status === 'failed' || !result.output) {
      throw new Error(result.error || 'Agent execution failed')
    }

    const output = result.output as any
    return {
      output: output.result || '',
      tokensUsed: output.tokensUsed || 0,
      provider: output.provider || 'unknown',
      model: output.model || 'unknown',
      durationMs: result.durationMs,
      identity,
    }
  }

  /**
   * 解析执行身份（Execution Identity Resolution）
   *
   * 优先级链：
   *   1. request.user.id     — 真实登录用户传入
   *   2. agent owner         — Agent Profile 的创建者/所有者
   *   3. workspace owner     — 工作空间所有者
   *   4. organization owner  — 组织所有者
   *   5. 拒绝执行            — 不允许 system: 前缀进入 Gateway
   */
  private async resolveExecutionIdentity(context: {
    organizationId: string
    actorId: string
    permissionScope: string[]
    userId?: string
    workspaceId?: string
  }): Promise<ExecutionIdentity> {
    const p = this.prisma as any

    // ── 优先级 1: request.userId ──────────────────────────────
    // 真实登录用户直接传入，最可信
    if (context.userId && !context.userId.startsWith('system:')) {
      return {
        actorType: 'USER',
        actorId: context.actorId,
        ownerUserId: context.userId,
        tenantId: context.organizationId,
        workspaceId: context.workspaceId,
        resolvedBy: 'request.userId',
      }
    }

    // 如果 actorId 本身就是真实用户（UUID 格式，非 system: 前缀）
    if (!context.actorId.startsWith('system:') && context.actorId.includes('-')) {
      return {
        actorType: 'USER',
        actorId: context.actorId,
        ownerUserId: context.actorId,
        tenantId: context.organizationId,
        workspaceId: context.workspaceId,
        resolvedBy: 'actorId-is-uuid',
      }
    }

    // ── 优先级 2: agent owner ────────────────────────────────
    // actorId 可能是 agentId 或 agentInstanceId，查找其所有者
    if (context.actorId.startsWith('agent_') || context.actorId.startsWith('instance_')) {
      // 尝试从 Agent Instance 查找
      const instance = await p.enterpriseAgentInstance.findFirst({
        where: { OR: [{ id: context.actorId }, { agentId: context.actorId }] },
        select: { tenantId: true, employeeId: true },
      })
      if (instance) {
        // employeeId 可能是 agent profile ID，需要找到关联用户
        // 先用 tenantId 找组织所有者
        const org = await p.organization.findFirst({
          where: { id: instance.tenantId },
          select: { ownerId: true },
        })
        if (org?.ownerId) {
          return {
            actorType: 'AGENT',
            actorId: context.actorId,
            ownerUserId: org.ownerId,
            tenantId: instance.tenantId,
            resolvedBy: 'agent.instance→organization.owner',
          }
        }
      }
    }

    // ── 优先级 3: workspace owner ────────────────────────────
    if (context.workspaceId) {
      const workspace = await p.workspace.findUnique({
        where: { id: context.workspaceId },
        select: { ownerId: true, organizationId: true },
      }).catch(() => null)
      if (workspace?.ownerId) {
        return {
          actorType: 'USER',
          actorId: context.actorId,
          ownerUserId: workspace.ownerId,
          tenantId: context.organizationId,
          workspaceId: context.workspaceId,
          resolvedBy: 'workspace.owner',
        }
      }
    }

    // ── 优先级 4: organization owner ─────────────────────────
    const org = await p.organization.findFirst({
      where: { id: context.organizationId },
      select: { ownerId: true },
    })
    if (org?.ownerId) {
      return {
        actorType: 'USER',
        actorId: context.actorId,
        ownerUserId: org.ownerId,
        tenantId: context.organizationId,
        resolvedBy: 'organization.owner',
      }
    }

    // ── 优先级 5: 拒绝执行 ───────────────────────────────────
    // 找不到真实用户，不允许 system: 进入 Gateway
    return {
      actorType: 'SYSTEM',
      actorId: context.actorId,
      ownerUserId: context.actorId,  // 保持原始值，上层 execute() 会拦截
      tenantId: context.organizationId,
      resolvedBy: 'unresolved-refused',
    }
  }

  async resolveAgentId(agentType: string, organizationId: string): Promise<string | null> {
    // 从 EnterpriseAgentProfile 查找匹配 agentType 的记录
    const agent = await (this.orchestrator as any).prisma.enterpriseAgentProfile.findFirst({
      where: {
        agentType,
        ...(organizationId ? { tenantId: organizationId } : {}),
      },
      orderBy: { isDefault: 'desc' },  // 优先返回默认 Agent
      select: { id: true },
    })

    // 如果按 orgId 没找到，尝试全局查找
    if (!agent && organizationId) {
      const globalAgent = await (this.orchestrator as any).prisma.enterpriseAgentProfile.findFirst({
        where: { agentType },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
      })
      return globalAgent?.id || null
    }

    return agent?.id || null
  }
}

/**
 * 创建默认的 AgentOrchestrator 实例
 */
function createDefaultOrchestrator(prisma: PrismaClient): AgentOrchestrator {
  const module = createAgentRuntimeModule(prisma)
  return module.orchestrator
}
