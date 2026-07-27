/**
 * Career Agent Service — KM-AI-JOB-AGENT-08
 * 个人 AI 职业助理创建/部署服务
 *
 * 核心命题：一个普通用户是否可以拥有自己的 AI 员工？
 *
 * 架构（复用企业端已验证的路径）：
 *   1. 创建 EnterpriseAgentProfile（agentType: career_advisor）
 *   2. 部署 → 自动创建 EnterpriseAgentInstance + HermesProfileBinding
 *   3. Memory namespace: tenant/{userId}/agent/career-assistant
 *   4. Tool allow list: 6个求职工具
 *
 * 与企业端的区别：
 *   - userId 作为 tenantId（个人用户）
 *   - organizationId = userId（个人租户）
 *   - 工具集为求职工具（非招聘工具）
 */

import type { PrismaClient } from '@prisma/client'
import { AgentLifecycleService } from '../../../agent-runtime/lifecycle/agent-lifecycle.service'
import { MemoryNamespaceService } from '../memory-namespace.service'
import { getUserLLMConfig } from '../../../services/hdz/llm.client.js'

/**
 * 检查用户是否配置了 BYOK（个人 LLM API Key）
 */
export async function checkUserBYOK(userId: string): Promise<boolean> {
  const cfg = await getUserLLMConfig(userId)
  return !!cfg
}

export interface CreateCareerAgentRequest {
  userId: string
  userName?: string
  goal?: string       // 职业目标
  resumeId?: string   // 关联简历ID
}

export interface CareerAgentInfo {
  profileId: string
  instanceId: string
  bindingId: string
  hermesAgentId: string
  memoryNamespace: string
  agentName: string
  status: 'active' | 'paused' | 'draft'
  tools: string[]
}

export class CareerAgentService {
  private lifecycle: AgentLifecycleService
  private memoryService: MemoryNamespaceService

  // 求职管家默认工具列表
  private static readonly CAREER_TOOLS = [
    'resume_analyze',
    'job_search',
    'job_match',
    'career_plan',
    'interview_prepare',
    'salary_analysis',
  ]

  // 求职管家默认能力
  private static readonly CAREER_CAPABILITIES = [
    '简历分析',
    '岗位搜索',
    '岗位匹配',
    '职业规划',
    '面试准备',
    '薪资分析',
  ]

  constructor(private prisma: PrismaClient) {
    this.lifecycle = new AgentLifecycleService(prisma)
    this.memoryService = new MemoryNamespaceService()
  }

  /**
   * 创建并部署个人 AI 职业助理
   */
  async createAndDeploy(req: CreateCareerAgentRequest): Promise<CareerAgentInfo> {
    const p = this.prisma as any
    const userId = req.userId

    // ─── Step 0: 检查是否已存在 ─────────────────────────
    const existing = await this.getCareerAgent(userId)
    if (existing) {
      return existing
    }

    // ─── Step 1: 创建 EnterpriseAgentProfile ────────────
    const agentName = `${req.userName || '用户'}的AI职业助理`

    const profile = await p.enterpriseAgentProfile.create({
      data: {
        organizationId: userId,   // 个人租户
        tenantId: userId,          // userId 作为 tenantId
        name: agentName,
        role: 'career_assistant',
        agentType: 'career_advisor',
        description: req.goal || '帮助个人用户进行求职规划、简历分析、岗位匹配、面试准备',
        goal: req.goal || '帮助用户找到理想工作',
        knowledgeScope: JSON.stringify(['求职', '简历', '面试', '薪资', '职业规划']),
        capabilities: JSON.stringify(CareerAgentService.CAREER_CAPABILITIES),
        tools: JSON.stringify(CareerAgentService.CAREER_TOOLS),
        isDefault: false,
        metadata: JSON.stringify({
          source: 'career_agent',
          userId: userId,
          resumeId: req.resumeId || null,
          createdAt: new Date().toISOString(),
        }),
        status: 'draft',
        runtimeType: 'enterprise',
        runtimeStatus: 'draft',
      },
    })

    // ─── Step 2: 创建 EnterpriseAgentInstance ───────────
    const instance = await p.enterpriseAgentInstance.create({
      data: {
        tenantId: userId,
        employeeId: profile.id,
        agentId: `agent_career_${userId.slice(0, 8)}_${profile.id.slice(0, 8)}`,
        runtime: 'enterprise',
        namespace: `tenant_${userId}`,
        runtimeStatus: 'active',
        lifecycleState: 'ACTIVE',
      },
    })

    // ─── Step 3: 创建 HermesProfileBinding ──────────────
    const hermesAgentId = `hermes_${userId.slice(0, 8)}_${instance.id.slice(0, 8)}`
    const memoryNamespace = `tenant/${userId}/agent/${instance.id}`

    const binding = await p.hermesProfileBinding.create({
      data: {
        tenantId: userId,
        organizationId: userId,
        agentInstanceId: instance.id,
        hermesAgentId,
        toolAllowList: JSON.stringify(CareerAgentService.CAREER_TOOLS),
        memoryNamespace,
        identityProvider: 'hermes',
        status: 'active',
      },
    })

    // ─── Step 4: 更新 Profile 状态为 active ─────────────
    await p.enterpriseAgentProfile.update({
      where: { id: profile.id },
      data: {
        status: 'active',
        runtimeStatus: 'active',
        runtimeAgentId: `rt-${profile.id}`,
        lastExecutionAt: new Date(),
      },
    })

    return {
      profileId: profile.id,
      instanceId: instance.id,
      bindingId: binding.id,
      hermesAgentId,
      memoryNamespace,
      agentName,
      status: 'active',
      tools: CareerAgentService.CAREER_TOOLS,
    }
  }

  /**
   * 获取用户的 AI 职业助理信息
   */
  async getCareerAgent(userId: string): Promise<CareerAgentInfo | null> {
    const p = this.prisma as any

    // 通过 metadata 中的 userId 查找
    const profiles = await p.enterpriseAgentProfile.findMany({
      where: {
        tenantId: userId,
        agentType: 'career_advisor',
        metadata: { contains: '"source":"career_agent"' },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    if (profiles.length === 0) return null

    const profile = profiles[0]

    // 查找 Instance
    const instance = await p.enterpriseAgentInstance.findUnique({
      where: { employeeId: profile.id },
    })

    if (!instance) return null

    // 查找 Binding
    const binding = await p.hermesProfileBinding.findUnique({
      where: { agentInstanceId: instance.id },
    })

    const tools = binding?.toolAllowList
      ? JSON.parse(binding.toolAllowList)
      : CareerAgentService.CAREER_TOOLS

    return {
      profileId: profile.id,
      instanceId: instance.id,
      bindingId: binding?.id || '',
      hermesAgentId: binding?.hermesAgentId || '',
      memoryNamespace: binding?.memoryNamespace || `tenant/${userId}/agent/${instance.id}`,
      agentName: profile.name,
      status: profile.status,
      tools,
    }
  }

  /**
   * 检查用户是否已有 AI 职业助理
   */
  async hasCareerAgent(userId: string): Promise<boolean> {
    const agent = await this.getCareerAgent(userId)
    return !!agent
  }

  /**
   * 暂停 AI 职业助理
   */
  async pauseCareerAgent(userId: string): Promise<boolean> {
    const agent = await this.getCareerAgent(userId)
    if (!agent) return false
    await this.lifecycle.pauseAgent(agent.profileId)
    return true
  }

  /**
   * 恢复 AI 职业助理
   */
  async resumeCareerAgent(userId: string): Promise<boolean> {
    const agent = await this.getCareerAgent(userId)
    if (!agent) return false
    await this.lifecycle.resumeAgent(agent.profileId)
    return true
  }

  /**
   * 获取 Agent 的 Runtime Context（供 WorkflowExecutor 使用）
   */
  async getRuntimeContext(userId: string): Promise<{
    agentId: string
    agentInstanceId: string
    memoryNamespace: string
    hermesAgentId: string
    tenantId: string
  } | null> {
    const agent = await this.getCareerAgent(userId)
    if (!agent) return null

    return {
      agentId: agent.profileId,
      agentInstanceId: agent.instanceId,
      memoryNamespace: agent.memoryNamespace,
      hermesAgentId: agent.hermesAgentId,
      tenantId: userId,
    }
  }
}
