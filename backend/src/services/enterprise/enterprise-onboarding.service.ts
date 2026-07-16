/**
 * Enterprise AI Workforce — Enterprise Onboarding Service
 * 企业注册初始化向导
 */
import { prisma } from '../../utils/index.js'
import { enterpriseAgentService } from './enterprise-agent.service.js'

export interface OnboardingInput {
  userId: string
  name: string
  industry?: string
  metadata?: Record<string, any>
}

export class EnterpriseOnboardingService {
  /**
   * Step 1: 创建企业租户
   */
  async createTenant(input: OnboardingInput) {
    return await prisma.tenant.create({
      // governance_tenant
      data: {
        name: input.name,
        type: 'enterprise',
        status: 'active',
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
      },
    } as any)
  }

  /**
   * Step 2: 创建 AI 组织
   */
  async createOrg(tenantId: string, name: string) {
    return await prisma.govOrganization.create({
      data: {
        tenantId,
        name: name + ' AI部门',
        type: 'enterprise',
        departmentRole: 'ai_department',
        parentId: null,
        status: 'active',
      },
    })
  }

  /**
   * Step 3: 创建默认 AI 员工
   */
  async createDefaultAgents(tenantId: string, orgId: string) {
    return await enterpriseAgentService.createDefaultDepartment(tenantId, orgId)
  }

  /**
   * Step 4: 设置默认 Quota
   */
  async setupQuota(tenantId: string) {
    return await prisma.quota.create({
      data: {
        tenantId,
        dailyTokens: 100000,
        monthlyTokens: 3000000,
        imageCredits: 100,
        videoMinutes: 60,
        speechMinutes: 60,
        concurrentJobs: 5,
        workflowRuns: 100,
        agentSessions: 50,
        storage: 1024,
        workspaceCount: 1,
      },
    })
  }

  /**
   * Step 5: 设置默认 Role
   */
  async setupRoles(tenantId: string) {
    const roles = [
      { code: 'enterprise_owner', name: '企业主', capabilities: '["*"]' },
      { code: 'enterprise_admin', name: '企业管理员', capabilities: '["agent.*","model.*","billing.read"]' },
      { code: 'enterprise_member', name: '企业成员', capabilities: '["agent.use","model.read"]' },
    ]
    const created = []
    for (const r of roles) {
      const role = await prisma.role.create({
        data: { tenantId, ...r },
      })
      created.push(role)
    }
    return created
  }

  /**
   * 完整初始化流程
   */
  async initializeEnterprise(input: OnboardingInput) {
    const tenant = await this.createTenant(input)
    const org = await this.createOrg(tenant.id, input.name)
    const quota = await this.setupQuota(tenant.id)
    const roles = await this.setupRoles(tenant.id)
    const agents = await this.createDefaultAgents(tenant.id, org.id)

    // Phase 2.5: 为5个AI员工创建默认日程和目标
    const { agentScheduleService } = await import('./agent-schedule.service.js')
    try {
      await agentScheduleService.createDefaultSchedules(tenant.id, agents)
      console.log(`[Onboarding] 已创建 ${agents.length} 个AI员工的定时任务`)
    } catch (e: any) {
      console.warn('[Onboarding] 创建定时任务失败:', e.message)
    }

    return {
      tenant,
      organization: org,
      quota,
      roles,
      agents,
      status: 'initialized',
    }
  }

  /**
   * 获取初始化状态
   */
  async getOnboardingStatus(tenantId: string) {
    const [tenant, orgs, agents, quota] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }).catch(() => null),
      prisma.govOrganization.count({ where: { tenantId } }),
      prisma.enterpriseAgentProfile.count({ where: { tenantId, status: 'active' } }),
      prisma.quota.findUnique({ where: { tenantId } }),
    ])
    return {
      tenant: !!tenant,
      organizations: orgs,
      agents,
      hasQuota: !!quota,
      isComplete: !!tenant && orgs > 0 && agents >= 5 && !!quota,
    }
  }
}

export const enterpriseOnboarding = new EnterpriseOnboardingService()
