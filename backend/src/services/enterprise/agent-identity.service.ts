/**
 * Enterprise Agent Identity Service
 * Sprint 4.2.8 Step 5 — AI员工运行身份层
 *
 * 架构：
 *   Enterprise Agent Profile (DB记录)
 *          ↓ 1:1
 *   EnterpriseAgentInstance (运行时身份: agentId + namespace)
 *          ↓ 1:N
 *   EmployeeModelBinding (员工级模型绑定: BYOK)
 *
 * 核心职责：
 * - 创建 Agent Instance（生成 agentId、namespace）
 * - 管理运行时状态（active/paused/stopped）
 * - 员工级模型绑定（每个员工独立绑定企业 AIProviderConfig）
 * - 运行状态查询（tasks、errors、lastActive）
 */

import { prisma } from '../../utils/index.js'
import { agentRuntimeAdapter } from './agent-runtime.adapter.js'

export interface CreateAgentInstanceInput {
  tenantId: string
  employeeId: string
  agentId?: string
  namespace?: string
}

export interface ModelBindingInput {
  tenantId: string
  employeeId: string
  providerConfigId: string
  modelName?: string
  temperature?: number
  maxTokens?: number
}

export interface RecordTaskInput {
  agentInstanceId: string
  taskType: string
  inputSummary?: string
  outputSummary?: string
  status?: 'success' | 'failed' | 'running'
  tokenInput?: number
  tokenOutput?: number
  cost?: number
  durationMs?: number
}

export class AgentIdentityService {

  // ───────────────── Agent Instance ─────────────────

  /**
   * 为 AI 员工创建运行时身份
   * 如果已存在则返回已有实例（幂等）
   */
  async createOrCreateInstance(input: CreateAgentInstanceInput) {
    const existing = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId: input.employeeId },
    })
    if (existing) return existing

    const agentId = input.agentId || this.generateAgentId(input.tenantId, input.employeeId)
    const namespace = input.namespace || this.generateNamespace(input.tenantId, input.employeeId)

    const instance = await prisma.enterpriseAgentInstance.create({
      data: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        agentId,
        namespace,
        runtime: 'openclaw',
        runtimeStatus: 'active',
        totalTasks: 0,
        totalErrors: 0,
        metadata: '{}',
      },
    })

    // 同步注册到 Runtime Adapter
    await agentRuntimeAdapter.createAgent({
      agentId,
      tenantId: input.tenantId,
      namespace,
      role: input.employeeId,
    })

    return instance
  }

  /**
   * 获取 Agent 运行时状态
   */
  async getRuntimeStatus(agentInstanceId: string) {
    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: agentInstanceId },
    })
    if (!instance) return null

    return {
      id: instance.id,
      agentId: instance.agentId,
      runtime: instance.runtime,
      namespace: instance.namespace,
      status: instance.runtimeStatus,
      lastActiveAt: instance.lastActiveAt,
      totalTasks: instance.totalTasks,
      totalErrors: instance.totalErrors,
      updatedAt: instance.updatedAt,
    }
  }

  /**
   * 更新运行时状态
   */
  async updateRuntimeStatus(agentInstanceId: string, status: 'active' | 'paused' | 'stopped') {
    return await prisma.enterpriseAgentInstance.update({
      where: { id: agentInstanceId },
      data: { runtimeStatus: status },
    })
  }

  /**
   * 记录一次任务执行（写入 EnterpriseAgentTask + 更新 Instance 统计）
   */
  async recordTask(input: RecordTaskInput) {
    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: input.agentInstanceId },
    })
    const tenantId = instance?.tenantId || ''

    const task = await prisma.enterpriseAgentTask.create({
      data: {
        tenantId,
        agentInstanceId: input.agentInstanceId,
        taskType: input.taskType,
        inputSummary: input.inputSummary || null,
        outputSummary: input.outputSummary || null,
        status: input.status || 'completed',
        tokenInput: input.tokenInput || 0,
        tokenOutput: input.tokenOutput || 0,
        cost: input.cost || 0,
        durationMs: input.durationMs || 0,
        startedAt: new Date(),
        completedAt: input.status === 'running' ? null : new Date(),
      },
    })

    // 更新 Instance 统计
    await prisma.enterpriseAgentInstance.update({
      where: { id: input.agentInstanceId },
      data: {
        totalTasks: { increment: 1 },
        totalErrors: input.status === 'failed' ? { increment: 1 } : undefined,
        lastActiveAt: new Date(),
      },
    })

    return task
  }

  /**
   * 获取 Agent 任务时间线（最近 N 条）
   */
  async getTaskTimeline(agentInstanceId: string, limit: number = 20) {
    return await prisma.enterpriseAgentTask.findMany({
      where: { agentInstanceId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })
  }

  /**
   * 获取 Agent 完整详情（Agent 详情页用）
   */
  async getFullAgentDetail(employeeId: string) {
    const employee = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: employeeId },
    })
    if (!employee) return null

    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId },
    })

    const modelBindings = await prisma.employeeModelBinding.findMany({
      where: { employeeId, enabled: true },
    })

    const recentTasks = instance
      ? await prisma.enterpriseAgentTask.findMany({
          where: { agentInstanceId: instance.id },
          orderBy: { startedAt: 'desc' },
          take: 10,
        })
      : []

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        agentType: employee.agentType,
        description: employee.description,
        status: employee.status,
        goal: employee.goal,
        capabilities: JSON.parse(employee.capabilities || '[]'),
        tools: JSON.parse(employee.tools || '[]'),
        permissions: JSON.parse(employee.permissions || '[]'),
      },
      instance: instance
        ? {
            id: instance.id,
            agentId: instance.agentId,
            namespace: instance.namespace,
            runtime: instance.runtime,
            runtimeStatus: instance.runtimeStatus,
            lastActiveAt: instance.lastActiveAt,
            totalTasks: instance.totalTasks,
            totalErrors: instance.totalErrors,
          }
        : null,
      modelBindings: modelBindings.map((b) => ({
        id: b.id,
        providerConfigId: b.providerConfigId,
        modelName: b.modelName,
        temperature: b.temperature,
        maxTokens: b.maxTokens,
        enabled: b.enabled,
      })),
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        taskType: t.taskType,
        status: t.status,
        inputSummary: t.inputSummary,
        outputSummary: t.outputSummary,
        cost: t.cost,
        durationMs: t.durationMs,
        startedAt: t.startedAt,
      })),
      channelBindings: instance
        ? await (async () => {
            const bindings = await prisma.agentChannelBinding.findMany({
              where: { agentInstanceId: instance.id },
              orderBy: { createdAt: 'desc' },
            })
            const channelIds = bindings.map(b => b.channelAccountId)
            const channelAccounts = channelIds.length > 0
              ? await prisma.enterpriseChannelAccount.findMany({
                  where: { id: { in: channelIds } },
                  select: { id: true, channelName: true, channelType: true, connectionStatus: true },
                })
              : []
            const channelMap = new Map(channelAccounts.map(c => [c.id, c]))
            return bindings.map(b => ({
              id: b.id,
              channelAccountId: b.channelAccountId,
              channelName: channelMap.get(b.channelAccountId)?.channelName || '未知',
              channelType: channelMap.get(b.channelAccountId)?.channelType || 'unknown',
              connectionStatus: channelMap.get(b.channelAccountId)?.connectionStatus || 'unknown',
              permissions: b.permissions,
              status: b.status,
            }))
          })()
        : [],
    }
  }

  /**
   * 获取企业下所有 Agent Instance
   */
  async listByTenant(tenantId: string) {
    return await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * 通过 employeeId 获取实例
   */
  async getByEmployeeId(employeeId: string) {
    return await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId },
    })
  }

  // ───────────────── Employee Model Binding ─────────────────

  /**
   * 绑定员工模型（BYOK：必须使用企业自己的 AIProviderConfig）
   */
  async bindModel(input: ModelBindingInput) {
    const existing = await prisma.employeeModelBinding.findUnique({
      where: {
        employeeId_providerConfigId: {
          employeeId: input.employeeId,
          providerConfigId: input.providerConfigId,
        },
      },
    })

    if (existing) {
      // 更新已有绑定
      return await prisma.employeeModelBinding.update({
        where: { id: existing.id },
        data: {
          modelName: input.modelName || 'deepseek-chat',
          temperature: input.temperature ?? 0.7,
          maxTokens: input.maxTokens ?? 16384,
          enabled: true,
        },
      })
    }

    return await prisma.employeeModelBinding.create({
      data: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        providerConfigId: input.providerConfigId,
        modelName: input.modelName || 'deepseek-chat',
        temperature: input.temperature ?? 0.7,
        maxTokens: input.maxTokens ?? 16384,
        enabled: true,
      },
    })
  }

  /**
   * 获取员工的所有模型绑定
   */
  async getModelBindings(employeeId: string) {
    return await prisma.employeeModelBinding.findMany({
      where: { employeeId, enabled: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * 解绑模型
   */
  async unbindModel(bindingId: string) {
    return await prisma.employeeModelBinding.update({
      where: { id: bindingId },
      data: { enabled: false },
    })
  }

  /**
   * 获取员工当前有效模型绑定（优先级最高的一个）
   */
  async getActiveModelBinding(employeeId: string) {
    return await prisma.employeeModelBinding.findFirst({
      where: { employeeId, enabled: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  // ═══════════════════════════════════════════════
  // Sprint 4.3.1 P0-2: Model Binding Enable
  // ═══════════════════════════════════════════════

  /**
   * 设为默认模型（同员工其他绑定自动关闭）
   * 保证一个员工只有一个 enabled=true 的绑定
   */
  async enableModelBinding(bindingId: string, tenantId: string) {
    const binding = await prisma.employeeModelBinding.findUnique({
      where: { id: bindingId },
    })
    if (!binding || binding.tenantId !== tenantId) {
      throw new Error('绑定不存在或无权限')
    }

    // 关闭该员工所有其他绑定
    await prisma.employeeModelBinding.updateMany({
      where: { employeeId: binding.employeeId, id: { not: bindingId } },
      data: { enabled: false },
    })

    // 启用当前绑定
    return await prisma.employeeModelBinding.update({
      where: { id: bindingId },
      data: { enabled: true },
    })
  }

  // ═══════════════════════════════════════════════
  // Sprint 4.3.1 P0-1: Enterprise Activation Flow
  // ═══════════════════════════════════════════════

  /**
   * 获取企业激活状态
   * 检测：企业信息 → 模型配置 → AI员工 → 渠道绑定
   */
  async getActivationStatus(tenantId: string) {
    const [profile, providerCount, agentCount, channelCount] = await Promise.all([
      prisma.enterpriseProfile.findUnique({ where: { organizationId: tenantId } }),
      prisma.aIProviderConfig.count({ where: { organizationId: tenantId } }),
      prisma.enterpriseAgentProfile.count({ where: { tenantId } }),
      prisma.agentChannelBinding.count({ where: { tenantId } }),
    ])

    const steps = {
      profile: !!profile && !!profile.businessSummary,
      model: providerCount > 0,
      agent: agentCount > 0,
      channel: channelCount > 0,
    }

    const completedCount = Object.values(steps).filter(Boolean).length
    const totalSteps = 4
    const isComplete = completedCount === totalSteps
    const nextStep = !steps.profile ? 'profile'
      : !steps.model ? 'model'
      : !steps.agent ? 'agent'
      : !steps.channel ? 'channel'
      : 'done'

    return {
      tenantId,
      steps,
      completedCount,
      totalSteps,
      progress: Math.round((completedCount / totalSteps) * 100),
      isComplete,
      nextStep,
      stats: {
        providerCount,
        agentCount,
        channelCount,
      },
    }
  }

  /**
   * 完成一个激活步骤（前端调用，用于记录进度）
   */
  async completeActivationStep(tenantId: string, step: string) {
    // 实际进度由 getActivationStatus 实时计算
    // 此接口用于前端触发事件记录
    const status = await this.getActivationStatus(tenantId)
    return { ...status, lastCompletedStep: step }
  }

  // ═══════════════════════════════════════════════
  // Sprint 4.3.1 P0.5: Next Action Suggestions
  // ═══════════════════════════════════════════════

  /**
   * 获取 CEO 下一步行动建议
   * 基于当前企业状态智能推荐
   */
  async getNextActions(tenantId: string) {
    const actions: Array<{ type: 'urgent' | 'suggestion' | 'warning'; icon: string; title: string; description: string; action?: string }> = []

    const [agentCount, taskCount, signalCount, bindingCount, providerExpiry] = await Promise.all([
      prisma.enterpriseAgentInstance.count({ where: { tenantId, runtimeStatus: 'active' } }),
      prisma.enterpriseAgentTask.count({ where: { tenantId, startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.enterpriseAgentTask.count({ where: { tenantId, taskType: 'signal_detected', startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.agentChannelBinding.count({ where: { tenantId } }),
      prisma.employeeModelBinding.count({ where: { tenantId, enabled: true } }),
    ])

    // 无 AI 员工 → 最高优先
    if (agentCount === 0) {
      actions.push({
        type: 'urgent',
        icon: '🤖',
        title: '创建第一个 AI 员工',
        description: '你还没有 AI 员工，立即创建开始自动化工作',
        action: 'create_agent',
      })
    }

    // 有信号待跟进
    if (signalCount > 0) {
      actions.push({
        type: 'urgent',
        icon: '🔥',
        title: `${signalCount} 条客户线索待跟进`,
        description: 'AI 发现了新的销售机会，建议立即分配',
        action: 'view_signals',
      })
    }

    // 无渠道绑定
    if (bindingCount === 0 && agentCount > 0) {
      actions.push({
        type: 'warning',
        icon: '📡',
        title: '连接工作渠道',
        description: 'AI 员工需要渠道才能接收和回复消息',
        action: 'connect_channel',
      })
    }

    // 任务量低
    if (taskCount === 0 && agentCount > 0) {
      actions.push({
        type: 'suggestion',
        icon: '📊',
        title: '今日暂无任务',
        description: 'AI 员工已就绪，可以分配任务开始工作',
        action: 'assign_task',
      })
    }

    // 模型绑定检查
    if (providerExpiry === 0 && agentCount > 0) {
      actions.push({
        type: 'warning',
        icon: '🧠',
        title: '未配置模型绑定',
        description: 'AI 员工需要绑定模型才能执行任务',
        action: 'bind_model',
      })
    }

    // 默认建议
    if (actions.length === 0) {
      actions.push({
        type: 'suggestion',
        icon: '✅',
        title: 'AI 部门运行正常',
        description: `${agentCount} 个 AI 员工正在工作，今日已完成 ${taskCount} 个任务`,
        action: 'view_dashboard',
      })
    }

    return actions.slice(0, 5)
  }

  // ───────────────── Helpers ─────────────────

  /**
   * 生成 agentId: agent_<tenantId>_<employeeShort>
   * tenantId 全称保证跨企业唯一
   */
  private generateAgentId(tenantId: string, employeeId: string): string {
    const employeeShort = employeeId.slice(-8)
    return `agent_${tenantId}_${employeeShort}`
  }

  /**
   * 生成 namespace: tenant_<tenantId>
   * 跨企业绝对隔离
   */
  private generateNamespace(tenantId: string, employeeId: string): string {
    return `tenant_${tenantId}`
  }
}

export const agentIdentityService = new AgentIdentityService()
