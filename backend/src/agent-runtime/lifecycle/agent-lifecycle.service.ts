/**
 * agent-runtime/lifecycle/agent-lifecycle.service.ts
 * Agent Lifecycle — 状态机管理
 *
 * 状态流转:
 *   draft → active → paused → active → archived
 *
 * 禁止:
 *   archived → active (不可恢复)
 */

import type { PrismaClient } from '@prisma/client';
import { IAgentLifecycle } from '../interfaces/lifecycle.interface.js';
import { AgentStatus, AgentConfig, ValidationResult } from '../types/agent-runtime.types.js';

const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  draft: ['active'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
};

export class AgentLifecycleService implements IAgentLifecycle {
  constructor(private prisma: PrismaClient) {}

  async createAgent(
    organizationId: string,
    tenantId: string,
    config: AgentConfig
  ): Promise<{ id: string; status: AgentStatus }> {
    const agent = await (this.prisma as any).enterpriseAgentProfile.create({
      data: {
        organizationId,
        tenantId: tenantId || organizationId,
        name: config.name,
        role: config.role,
        agentType: config.agentType,
        description: config.description || null,
        goal: config.goal || null,
        avatarUrl: config.avatarUrl || null,
        knowledgeScope: JSON.stringify(config.knowledgeScope || []),
        capabilities: JSON.stringify(config.capabilities || []),
        escalationRules: config.escalationRules ? JSON.stringify(config.escalationRules) : null,
        kpiMetrics: JSON.stringify(config.kpiMetrics || {}),
        isDefault: config.isDefault ?? false,
        metadata: JSON.stringify(config.metadata || {}),
        status: 'draft',
        runtimeType: 'openclaw',
        runtimeStatus: 'draft',
        version: 1,
      },
      select: { id: true, status: true },
    });

    // 写入审计日志
    await this.recordAudit(agent.id, 'AGENT_CREATED', { organizationId, name: config.name });

    return { id: agent.id, status: agent.status as AgentStatus };
  }

  async deployAgent(agentId: string): Promise<void> {
    // 生成 runtime_agent_id (格式: rt-{profileId})
    const runtimeAgentId = `rt-${agentId}`;

    // 获取 Agent Profile 信息
    const profile = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { tenantId: true, organizationId: true, agentType: true, capabilities: true, tools: true },
    });

    // 更新状态并注册 runtime
    await (this.prisma as any).enterpriseAgentProfile.update({
      where: { id: agentId },
      data: {
        status: 'active',
        runtimeStatus: 'active',
        runtimeAgentId,
        lastExecutionAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // ─── KM-AI-JOB-AGENT-06: 自动生成 HermesProfileBinding ───
    if (profile) {
      // 查找或创建 EnterpriseAgentInstance
      let instance = await (this.prisma as any).enterpriseAgentInstance.findUnique({
        where: { employeeId: agentId },
      })

      if (!instance) {
        // 自动创建 Instance（兼容已有数据）
        instance = await (this.prisma as any).enterpriseAgentInstance.create({
          data: {
            tenantId: profile.tenantId,
            employeeId: agentId,
            agentId: `agent_${profile.tenantId.slice(0, 8)}_${agentId.slice(0, 8)}`,
            runtime: 'openclaw',
            namespace: `tenant_${profile.tenantId}`,
            runtimeStatus: 'active',
            lifecycleState: 'ACTIVE',
          },
        })
      }

      // 生成 HermesProfileBinding
      const hermesAgentId = `hermes_${profile.tenantId.slice(0, 8)}_${instance.id.slice(0, 8)}`
      const memoryNamespace = `tenant/${profile.tenantId}/agent/${instance.id}`

      const existingBinding = await (this.prisma as any).hermesProfileBinding.findUnique({
        where: { agentInstanceId: instance.id },
      })

      if (!existingBinding) {
        // 生成默认 Tool Allow List
        const capabilities = this.parseJSON<string[]>(profile.capabilities, [])
        const tools = this.parseJSON<string[]>(profile.tools, [])
        const defaultTools = this.generateDefaultTools(profile.agentType, capabilities, tools)

        await (this.prisma as any).hermesProfileBinding.create({
          data: {
            tenantId: profile.tenantId,
            organizationId: profile.organizationId || null,
            agentInstanceId: instance.id,
            hermesAgentId,
            toolAllowList: JSON.stringify(defaultTools),
            memoryNamespace,
            identityProvider: 'hermes',
            status: 'active',
          },
        })
      }
    }

    await this.recordAudit(agentId, 'AGENT_DEPLOYED', { runtimeAgentId });
  }

  async pauseAgent(agentId: string): Promise<void> {
    await this.transition(agentId, 'paused');
    await this.recordAudit(agentId, 'AGENT_PAUSED', {});
  }

  async resumeAgent(agentId: string): Promise<void> {
    await this.transition(agentId, 'active');
    await this.recordAudit(agentId, 'AGENT_RESUMED', {});
  }

  async archiveAgent(agentId: string): Promise<void> {
    await this.transition(agentId, 'archived');
    await this.recordAudit(agentId, 'AGENT_ARCHIVED', {});
  }

  async getStatus(agentId: string): Promise<AgentStatus> {
    const agent = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { status: true },
    });
    return (agent?.status as AgentStatus) || 'draft';
  }

  async listAgents(organizationId: string): Promise<{ id: string; name: string; status: AgentStatus }[]> {
    const agents = await (this.prisma as any).enterpriseAgentProfile.findMany({
      where: { organizationId },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    return agents.map((a: any) => ({ ...a, status: a.status as AgentStatus }));
  }

  validateConfig(config: AgentConfig): ValidationResult {
    const errors: string[] = [];
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Agent name is required');
    }
    if (!config.role || config.role.trim().length === 0) {
      errors.push('Agent role is required');
    }
    if (!config.agentType || config.agentType.trim().length === 0) {
      errors.push('Agent type is required');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * 状态机核心
   */
  private async transition(agentId: string, targetStatus: AgentStatus): Promise<void> {
    const agent = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { id: true, status: true },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const currentStatus = agent.status as AgentStatus;
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new Error(
        `Invalid transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowedTargets.join(', ') || 'none'}`
      );
    }

    await (this.prisma as any).enterpriseAgentProfile.update({
      where: { id: agentId },
      data: {
        status: targetStatus,
        runtimeStatus: targetStatus,
        updatedAt: new Date(),
      },
    });
  }

  // ─── KM-AI-JOB-AGENT-06: Helpers ───────────────────────

  private parseJSON<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    if (typeof val === 'object') return val as T
    try { return JSON.parse(val) } catch { return fallback }
  }

  private generateDefaultTools(agentType: string, capabilities: string[], tools: string[]): string[] {
    const toolSet = new Set<string>()
    const defaults: Record<string, string[]> = {
      recruiter: ['candidate.search', 'candidate.read', 'candidate.message', 'interview.create', 'pipeline.read', 'pipeline.suggest'],
      career_advisor: ['recruitment.read.pipeline', 'recruitment.read.match', 'recruitment.generate.report', 'recruitment.create.task'],
      interview: ['interview.create', 'interview.read', 'interview.evaluate', 'interview.question'],
      interview_agent: ['interview.create', 'interview.read', 'interview.evaluate', 'interview.question'],
      resume_analyzer: ['resume.read', 'resume.parse', 'candidate.score'],
      talent_hunter: ['candidate.search', 'talent.search', 'candidate.message'],
      marketing: ['content.generate', 'social.publish', 'social.reply', 'candidate.collect'],
    }
    const d = defaults[agentType]
    if (d) d.forEach(t => toolSet.add(t))
    tools.forEach(t => toolSet.add(t.toLowerCase().replace(/\s+/g, '_')))
    return Array.from(toolSet)
  }

  /**
   * 审计日志
   */
  private async recordAudit(agentId: string, action: string, payload: Record<string, any>): Promise<void> {
    // 获取 agent 的 tenantId
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
