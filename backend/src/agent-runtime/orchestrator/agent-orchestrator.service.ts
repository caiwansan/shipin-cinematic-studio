/**
 * agent-runtime/orchestrator/agent-orchestrator.service.ts
 * Agent Orchestrator — 协调者（薄层）
 *
 * 职责：协调 Lifecycle / Context / Brain，不直接操作数据库
 */

import type { PrismaClient } from '@prisma/client';
import { IAgentLifecycle } from '../interfaces/lifecycle.interface.js';
import { IRuntimeContextService } from '../interfaces/runtime-context.interface.js';
import { IAgentBrain } from '../brain/agent-brain.interface.js';
import { AgentConfig, AgentStatus, TaskResult } from '../types/agent-runtime.types.js';

export class AgentOrchestrator {
  constructor(
    private lifecycle: IAgentLifecycle,
    private contextService: IRuntimeContextService,
    private brain: IAgentBrain,
    private prisma: PrismaClient,
  ) {}

  /**
   * 创建 Agent
   */
  async createAgent(
    config: AgentConfig,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<{ id: string; status: AgentStatus }> {
    if (!this.contextService.hasPermission(
      this.contextService.createContext(context),
      'agent:create'
    )) {
      throw new Error('Permission denied: agent:create');
    }

    const validation = this.lifecycle.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    return this.lifecycle.createAgent(context.organizationId, context.organizationId, config);
  }

  /**
   * 部署 Agent
   */
  async deployAgent(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<void> {
    await this.validateAgentAccess(agentId, context, 'agent:deploy');
    await this.lifecycle.deployAgent(agentId);
  }

  /**
   * 暂停 Agent
   */
  async pauseAgent(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<void> {
    await this.validateAgentAccess(agentId, context, 'agent:pause');
    await this.lifecycle.pauseAgent(agentId);
  }

  /**
   * 恢复 Agent
   */
  async resumeAgent(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<void> {
    await this.validateAgentAccess(agentId, context, 'agent:resume');
    await this.lifecycle.resumeAgent(agentId);
  }

  /**
   * 归档 Agent
   */
  async archiveAgent(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<void> {
    await this.validateAgentAccess(agentId, context, 'agent:archive');
    await this.lifecycle.archiveAgent(agentId);
  }

  /**
   * 获取 Agent 状态
   */
  async getStatus(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<AgentStatus> {
    await this.validateAgentAccess(agentId, context, 'agent:read');
    return this.lifecycle.getStatus(agentId);
  }

  /**
   * 列出 Agent
   */
  async listAgents(
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<{ id: string; name: string; status: AgentStatus }[]> {
    if (!this.contextService.hasPermission(
      this.contextService.createContext(context),
      'agent:read'
    )) {
      throw new Error('Permission denied: agent:read');
    }
    return this.lifecycle.listAgents(context.organizationId);
  }

  /**
   * 执行任务 — Sprint 2.2.2 新增
   */
  async executeTask(
    agentId: string,
    task: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] }
  ): Promise<TaskResult> {
    const startTime = Date.now();

    // 1. 权限验证
    await this.validateAgentAccess(agentId, context, 'agent:execute');

    // 2. 检查 Agent 状态
    const status = await this.lifecycle.getStatus(agentId);
    if (status !== 'active') {
      throw new Error(`Agent is not active: ${status}`);
    }

    // 3. 构建 Runtime Context
    const runtimeCtx = this.contextService.createContext({
      ...context,
      agentId,
    });

    try {
      // 4. 调用 Brain 推理
      const result = await this.brain.reason(
        { input: task },
        runtimeCtx
      );

      // 5. 写入审计
      await this.recordAudit(agentId, 'TASK_COMPLETED', {
        task,
        tokensUsed: result.tokensUsed,
        provider: result.provider,
        model: result.model,
      });

      return {
        taskId: `task_${Date.now()}`,
        status: 'success',
        output: {
          result: result.output,
          tokensUsed: result.tokensUsed,
          provider: result.provider,
          model: result.model,
        },
        durationMs: result.durationMs,
      };
    } catch (error: any) {
      // 写入失败审计
      await this.recordAudit(agentId, 'TASK_FAILED', {
        task,
        error: error.message,
      });

      return {
        taskId: `task_${Date.now()}`,
        status: 'failed',
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 私有：验证 Agent 访问权限
   */
  private async validateAgentAccess(
    agentId: string,
    context: { organizationId: string; actorId: string; permissionScope: string[] },
    permission: string
  ): Promise<void> {
    const ctx = this.contextService.createContext({ ...context, agentId });

    if (!this.contextService.hasPermission(ctx, permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }

    const hasAccess = await this.contextService.validateAccess(ctx, agentId);
    if (!hasAccess) {
      throw new Error('Access denied: cross-tenant access blocked');
    }
  }

  /**
   * 私有：审计日志
   */
  private async recordAudit(agentId: string, action: string, payload: Record<string, any>): Promise<void> {
    const agent = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { tenantId: true },
    });

    await (this.prisma as any).agentAuditTrail.create({
      data: {
        agentId: agent ? agentId : null,
        tenantId: agent?.tenantId || '',
        action,
        metadata: JSON.stringify(payload),
        createdAt: new Date(),
      },
    });
  }
}
