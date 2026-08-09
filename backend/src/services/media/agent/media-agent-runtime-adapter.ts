/**
 * media-agent-runtime-adapter.ts
 * 
 * Media Agent Runtime Adapter
 * ============================
 * 职责: Media Domain → Runtime Domain 转换层
 * 
 * 架构 (掌柜 2026-08-08 批准):
 *   Media Workspace
 *       ↓
 *   MediaAgentRuntimeAdapter (本文件)
 *       ↓
 *   EnterpriseAgentRuntimeService
 *       ↓
 *   Hermes Runtime
 *       ↓
 *   Worker Execution
 *       ↓
 *   AgentOutcome
 * 
 * 宪法纪律:
 *   - Adapter 不包含任何业务逻辑 (热点/内容/平台)
 *   - 只做 Media Domain → Runtime Domain 的翻译
 *   - 凭证永不离开 Credential Vault
 *   - 所有 AI 调用走 UserModelConfigV2 (BYOK)
 */

import { prisma } from '../../../utils/index.js'
import { hermesProfileService, type HermesBindingDTO } from '../../enterprise/hermes-profile.service.js'
import { enterpriseAgentRuntime, type ExecuteTaskResult } from '../../enterprise/enterprise-agent-runtime.service.js'
import { agentAuditService } from '../../enterprise/agent-audit.service.js'

// ─── Types ──────────────────────────────────────────────

/**
 * Media Agent Identity
 * 从 EnterpriseAgentProfile + HermesProfileBinding 聚合
 */
export interface MediaAgentIdentity {
  instanceId: string
  profileId: string
  tenantId: string
  organizationId: string | null
  name: string
  role: string
  agentType: string
  soulMdContent: string | null
  toolAllowList: string[]
  memoryNamespace: string
  hermesAgentId: string
  runtimeStatus: string
  lifecycleState: string
}

/**
 * 执行结果 (适配 Media Domain)
 */
export interface MediaExecutionResult {
  success: boolean
  agentId: string
  agentName: string
  taskId: string
  output: string
  durationMs: number
  tokenInput?: number
  tokenOutput?: number
  cost?: number
  error?: string
  outcomeId?: string
}

// ─── Media Agent Runtime Adapter ───────────────────────

export class MediaAgentRuntimeAdapter {

  /**
   * 创建 Media Agent Runtime Binding
   * 
   * 流程:
   *   1. 验证 MediaAgentInstance 存在
   *   2. 创建 HermesProfileBinding (身份绑定)
   *   3. 记录审计日志
   *   4. 返回绑定关系
   * 
   * 注意: 此方法不执行任何业务逻辑，仅建立 Runtime 通道
   */
  async createRuntimeBinding(params: {
    instanceId: string
    soulMdContent?: string
    toolAllowList?: string[]
  }): Promise<MediaAgentIdentity> {
    const { instanceId, soulMdContent, toolAllowList = [] } = params

    // 1. 加载 Media Agent Instance
    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      throw new Error(`MEDIA_AGENT_INSTANCE_NOT_FOUND: ${instanceId}`)
    }

    // 2. 加载 Profile (通过 employeeId → profile)
    const profile = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: instance.employeeId },
    })
    if (!profile) {
      throw new Error(`MEDIA_AGENT_PROFILE_NOT_FOUND: ${instanceId}`)
    }

    // 2. 检查是否已有 Hermes Binding
    const existingBinding = await hermesProfileService.getBindingByInstance(instanceId)
    if (existingBinding) {
      return this.toMediaAgentIdentity(existingBinding, instance, profile)
    }

    // 3. 生成 SOUL (默认: 从 profile 推断)
    const soul = soulMdContent || this.inferSoulFromProfile(profile)

    // 4. 生成默认 Tool Allow List (Capability IDs)
    const tools = toolAllowList.length > 0
      ? toolAllowList
      : this.inferToolsFromAgentType(profile.agentType)

    // 5. 创建 Hermes Profile Binding
    // MemoryAccessGate 检查 namespace 前缀: tenant_{organizationId.slice(0,8)}
    // 必须使用 organizationId 生成 namespace，否则跨租户访问被拒绝
    const orgId = instance.organizationId || profile.organizationId
    const nsPrefix = orgId ? orgId.slice(0, 8) : instance.tenantId.slice(0, 8)
    const memoryNamespace = `tenant_${nsPrefix}/agent/${instanceId}`

    const binding = await hermesProfileService.createBinding({
      tenantId: instance.tenantId,
      organizationId: orgId || undefined,
      agentInstanceId: instanceId,
      soulMdContent: soul,
      toolAllowList: tools,
      identityProvider: 'hermes',
      memoryNamespace,
    })

    // 6. 更新 Instance runtime 信息
    await prisma.enterpriseAgentInstance.update({
      where: { id: instanceId },
      data: {
        runtimeStatus: 'active',
        lifecycleState: 'ACTIVE',
        lastActiveAt: new Date(),
      },
    })

    // 7. 记录审计
    await agentAuditService.log({
      tenantId: instance.tenantId,
      agentId: profile.id,
      action: 'media_agent.runtime_binding_created',
      resource: 'hermes_profile_binding',
      resourceId: binding.id,
      inputSummary: `Created Hermes binding for Media Agent: ${profile.name}`,
      outputSummary: `hermesAgentId=${binding.hermesAgentId}, namespace=${binding.memoryNamespace}`,
    })

    return this.toMediaAgentIdentity(binding, instance, profile)
  }

  /**
   * 执行 Media Agent 任务
   * 
   * 入口: Scheduler 或手动触发
   * 出口: EnterpriseAgentRuntimeService.executeTask()
   * 
   * Adapter 职责:
   *   - 验证 Media Agent 身份
   *   - 转换为 Runtime 域参数
   *   - 委托 executeTask()
   *   - 翻译结果回 Media 域
   * 
   * 不包含: 热点分析/内容生成/平台操作 等业务逻辑
   */
  async executeMediaAgentTask(params: {
    instanceId: string
    taskType: string
    instruction: string
    taskId?: string
    userId?: string
  }): Promise<MediaExecutionResult> {
    const { instanceId, taskType, instruction, taskId, userId } = params

    const startTime = Date.now()

    try {
      // 1. 加载身份
      const identity = await this.loadMediaAgentIdentity(instanceId)
      if (!identity) {
        return this.errorResult(instanceId, '未知', taskId || '', 'MEDIA_AGENT_NOT_FOUND', startTime)
      }

      // 2. 检查 Runtime 状态
      if (identity.runtimeStatus !== 'active') {
        return this.errorResult(
          instanceId, identity.name, taskId || '',
          `RUNTIME_NOT_ACTIVE: status=${identity.runtimeStatus}`,
          startTime
        )
      }

      // 3. 委托 EnterpriseAgentRuntimeService.executeTask()
      //    这是真正的 Hermes Runtime 入口
      const result: ExecuteTaskResult = await enterpriseAgentRuntime.executeTask({
        taskId: taskId || `media_task_${Date.now()}`,
        profileId: identity.profileId,
        tenantId: identity.tenantId,
        organizationId: identity.organizationId || undefined,
        userId: userId || 'system:scheduler',
        taskType,
        instruction,
      })

      // 4. 翻译结果
      return {
        success: result.success,
        agentId: identity.hermesAgentId,
        agentName: identity.name,
        taskId: result.taskId,
        output: result.output,
        durationMs: result.durationMs,
        tokenInput: result.tokenInput,
        tokenOutput: result.tokenOutput,
        cost: result.cost,
        error: result.error,
        outcomeId: result.outcomeId,
      }

    } catch (error: any) {
      return this.errorResult(
        instanceId, '未知', taskId || '',
        error.message || 'UNKNOWN_ERROR',
        startTime
      )
    }
  }

  /**
   * 获取 Media Agent Runtime 状态
   */
  async getExecutionStatus(instanceId: string): Promise<{
    runtimeStatus: string
    lifecycleState: string
    lastActiveAt: Date | null
    totalTasks: number
    totalErrors: number
    bindingExists: boolean
  } | null> {
    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) return null

    const binding = await hermesProfileService.getBindingByInstance(instanceId)

    return {
      runtimeStatus: instance.runtimeStatus,
      lifecycleState: instance.lifecycleState,
      lastActiveAt: instance.lastActiveAt,
      totalTasks: instance.totalTasks,
      totalErrors: instance.totalErrors,
      bindingExists: !!binding,
    }
  }

  /**
   * 加载完整的 Media Agent Identity
   * 聚合: EnterpriseAgentInstance + EnterpriseAgentProfile + HermesProfileBinding
   */
  async loadMediaAgentIdentity(instanceId: string): Promise<MediaAgentIdentity | null> {
    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) return null

    const binding = await hermesProfileService.getBindingByInstance(instanceId)
    const profile = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: instance.employeeId },
    })

    if (binding) {
      return this.toMediaAgentIdentity(binding, instance, profile)
    }

    // 无 Binding 时返回基础身份
    return {
      instanceId: instance.id,
      profileId: instance.employeeId,
      tenantId: instance.tenantId,
      organizationId: instance.organizationId,
      name: profile?.name || 'Unknown',
      role: profile?.role || 'Unknown',
      agentType: profile?.agentType || 'unknown',
      soulMdContent: null,
      toolAllowList: [],
      memoryNamespace: '',
      hermesAgentId: '',
      runtimeStatus: instance.runtimeStatus,
      lifecycleState: instance.lifecycleState,
    }
  }

  // ─── Private Helpers ─────────────────────────────────

  /**
   * 从 Profile 推断 SOUL.md
   * 不引入业务逻辑，仅基于 agentType 选择系统提示
   */
  private inferSoulFromProfile(profile: any): string {
    const agentType = profile.agentType || 'default'
    return `你是 ${profile.name || 'AI 员工'}，昆仑镜新媒体运营团队的${profile.role || '成员'}。

你的使命：${profile.goal || '帮助企业高效运营新媒体账号'}

你的原则：
- 数据驱动：用数据说话，不凭感觉
- 风险意识：发现异常第一时间报告
- 诚实：数据不足时说「数据不足」，不编造
- 节省老板时间：老板看报告就能决策，不需要自己分析`
  }

  /**
   * 从 agentType 推断默认工具权限
   * 仅映射 Capability ID，不涉及具体实现
   */
  private inferToolsFromAgentType(agentType: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      media_director: ['media.trend.analysis', 'media.competitor.monitor', 'media.report.generate', 'media.data.read'],
      content_creator: ['media.content.generate', 'media.content.schedule', 'media.content.analyze'],
      growth_specialist: ['media.comment.monitor', 'media.message.reply', 'media.customer.profile'],
      data_analyst: ['media.data.read', 'media.report.generate'],
    }
    return capabilityMap[agentType] || ['media.data.read']
  }

  /**
   * 聚合 Binding + Instance + Profile → MediaAgentIdentity
   */
  private toMediaAgentIdentity(
    binding: HermesBindingDTO,
    instance: any,
    profile: any
  ): MediaAgentIdentity {
    return {
      instanceId: instance.id,
      profileId: instance.employeeId,
      tenantId: binding.tenantId,
      organizationId: binding.organizationId,
      name: profile?.name || 'Unknown',
      role: profile?.role || 'Unknown',
      agentType: profile?.agentType || 'unknown',
      soulMdContent: binding.soulMdContent,
      toolAllowList: binding.toolAllowList,
      memoryNamespace: binding.memoryNamespace,
      hermesAgentId: binding.hermesAgentId,
      runtimeStatus: instance.runtimeStatus,
      lifecycleState: instance.lifecycleState,
    }
  }

  /**
   * 构造错误结果
   */
  private errorResult(
    instanceId: string,
    agentName: string,
    taskId: string,
    error: string,
    startTime: number
  ): MediaExecutionResult {
    return {
      success: false,
      agentId: instanceId,
      agentName,
      taskId,
      output: '',
      durationMs: Date.now() - startTime,
      error,
    }
  }
}

// ─── Singleton ──────────────────────────────────────────

export const mediaAgentRuntimeAdapter = new MediaAgentRuntimeAdapter()
