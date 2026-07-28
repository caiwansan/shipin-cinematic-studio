/**
 * Career Agent Service — KM-AI-JOB-AGENT-08
 * 个人 AI 职业助理创建/部署服务
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 3 (2026-07-28):
 * 修复 identity 回退：先查 OrgMember 获取组织ID，再创建资源。
 * 无组织用户仍使用 userId 作为 tenant（个人租户模式）。
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
   * 解析用户的组织 ID — 优先 OrgMember，fallback 到 userId
   * Sprint-Enterprise-Identity-Hardening-01 Phase 3:
   * 替代硬编码 organizationId: userId 模式
   */
  private async resolveOrg(userId: string): Promise<{ orgId: string; tenantId: string; source: string }> {
    // 1. Try OrgMember → organization
    const member = await this.prisma.orgMember.findFirst({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    })

    if (member) {
      return {
        orgId: member.organizationId,
        tenantId: member.organizationId, // 企业用户用组织ID作为tenant
        source: 'org_member',
      }
    }

    // 2. Fallback: personal tenant mode (userId as orgId)
    return {
      orgId: userId,
      tenantId: userId,
      source: 'personal_tenant',
    }
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

    // ─── Resolve identity: OrgMember → fallback personal tenant ──
    const { orgId, tenantId, source } = await this.resolveOrg(userId)
    console.log(`[CareerAgent] resolveOrg userId=${userId.slice(0,8)} → org=${orgId.slice(0,8)} source=${source}`)

    // ─── Step 1: 创建 EnterpriseAgentProfile ────────────
    const agentName = `${req.userName || '用户'}的AI职业助理`

    const profile = await p.enterpriseAgentProfile.create({
      data: {
        organizationId: orgId,    // resolved org ID
        tenantId: orgId,          // resolved tenant ID
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
          identitySource: source,
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
        tenantId: tenantId,
        employeeId: profile.id,
        agentId: `agent_career_${userId.slice(0, 8)}_${profile.id.slice(0, 8)}`,
        runtime: 'enterprise',
        namespace: `tenant_${tenantId.slice(0, 8)}`,
        runtimeStatus: 'active',
        lifecycleState: 'ACTIVE',
      },
    })

    // ─── Step 3: 创建 HermesProfileBinding ──────────────
    const hermesAgentId = `hermes_${userId.slice(0, 8)}_${instance.id.slice(0, 8)}`
    const memoryNamespace = `tenant/${tenantId}/agent/${instance.id}`

    const binding = await p.hermesProfileBinding.create({
      data: {
        tenantId: tenantId,
        organizationId: orgId,
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

    // Resolve org for lookup
    const { tenantId } = await this.resolveOrg(userId)

    // 通过 metadata 中的 userId 查找（跨 tenant 搜索）
    const profiles = await p.enterpriseAgentProfile.findMany({
      where: {
        tenantId: tenantId,
        agentType: 'career_advisor',
        metadata: { contains: '"source":"career_agent"' },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    // Fallback: also search by userId in metadata for backward compat
    const allProfiles = profiles.length > 0 ? profiles
      : await p.enterpriseAgentProfile.findMany({
          where: {
            agentType: 'career_advisor',
            metadata: { contains: `"userId":"${userId}"` },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })

    if (allProfiles.length === 0) return null

    const profile = allProfiles[0]

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

    const effectiveTenant = binding?.tenantId || profile.tenantId || userId

    return {
      profileId: profile.id,
      instanceId: instance.id,
      bindingId: binding?.id || '',
      hermesAgentId: binding?.hermesAgentId || '',
      memoryNamespace: binding?.memoryNamespace || `tenant/${effectiveTenant}/agent/${instance.id}`,
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

    const { tenantId } = await this.resolveOrg(userId)

    return {
      agentId: agent.profileId,
      agentInstanceId: agent.instanceId,
      memoryNamespace: agent.memoryNamespace,
      hermesAgentId: agent.hermesAgentId,
      tenantId,
    }
  }
}
