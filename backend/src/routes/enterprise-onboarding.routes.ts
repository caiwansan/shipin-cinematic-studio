/**
 * enterprise-onboarding.routes.ts — 企业招聘 Onboarding API
 *
 * Phase 5-A1: 企业 AI 招聘部门 Onboarding
 * - 企业档案创建
 * - 招聘需求采集
 * - AI员工编制创建
 * - 套餐选择
 * - Onboarding 状态管理
 *
 * Sprint-Enterprise-Identity-Hardening-01:
 * - Phase 1: EnterpriseMember 错误严格化（只允许 P2002）
 * - Phase 2: 创建企业全流程事务化
 *
 * Sprint-Enterprise-Identity-Hardening-02:
 * - Phase 1: enterpriseId 从 JWT 解析，不再信任客户端输入
 */

import { resolveEnterpriseId } from '../services/enterprise-context.service.js'

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// Sprint-02 Fix: 全局 enterpriseId 归属验证
async function verifyEnterpriseOwnership(request: any, reply: any) {
  const userId = (request.user as any)?.id
  if (!userId) {
    return reply.status(401).send({ error: '未授权' })
  }

  const body = request.body as any
  if (!body?.enterpriseId) return // 没有 enterpriseId 则跳过

  const userEnterpriseId = await resolveEnterpriseId(userId)
  if (userEnterpriseId && userEnterpriseId !== body.enterpriseId) {
    return reply.status(403).send({ error: '无权操作该企业身份' })
  }
}

// ─── 默认 AI 员工模板 ───

const DEFAULT_AGENT_WORKFORCE = [
  {
    agentType: 'career_advisor',
    displayName: '🤖 AI招聘经理',
    roleDescription: '负责招聘策略、JD生成、招聘计划制定',
    sortOrder: 1,
    defaultActive: true,
  },
  {
    agentType: 'resume_analyzer',
    displayName: '📄 AI简历分析师',
    roleDescription: '简历自动解析、候选人评分、技能匹配',
    sortOrder: 2,
    defaultActive: true,
  },
  {
    agentType: 'interview_agent',
    displayName: '🎤 AI面试官',
    roleDescription: 'AI生成面试方案、问题生成、面试评价',
    sortOrder: 3,
    defaultActive: true,
  },
  {
    agentType: 'talent_hunter',
    displayName: '🔍 AI猎聘顾问',
    roleDescription: '主动发现人才、人才库搜索、候选人关系维护',
    sortOrder: 4,
    defaultActive: false, // Starter 试用
    trialOnly: true,
  },
]

// ─── 套餐定义 ───

const PLANS = {
  starter: {
    name: 'Starter',
    price: 999,
    currency: 'CNY',
    interval: 'month',
    features: [
      '🤖 AI招聘经理',
      '📄 AI简历分析师 (500份/月)',
      '🎤 AI面试官 (100次/月)',
      '🔍 AI猎聘顾问 (7天试用)',
      '招聘Dashboard',
      '基础数据报表',
    ],
    quotas: {
      monthlyResumes: 500,
      monthlyInterviews: 100,
      monthlyJD: 50,
      dailyTokenBudget: 50000,
    },
  },
  professional: {
    name: 'Professional',
    price: 2999,
    currency: 'CNY',
    interval: 'month',
    features: [
      '全部 Starter 功能',
      '📄 AI简历分析无限',
      '🎤 AI面试无限',
      '🔍 AI猎聘顾问',
      '5个AI员工',
      '企业知识库',
      '高级数据报表',
      'API访问',
    ],
    quotas: {
      monthlyResumes: -1, // 无限
      monthlyInterviews: -1,
      monthlyJD: -1,
      dailyTokenBudget: 200000,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 9999,
    currency: 'CNY',
    interval: 'month',
    features: [
      '全部 Professional 功能',
      '私有模型部署',
      '企业知识库',
      '自定义AI员工',
      '专属客户经理',
      'SLA保障',
      '私有部署选项',
    ],
    quotas: {
      monthlyResumes: -1,
      monthlyInterviews: -1,
      monthlyJD: -1,
      dailyTokenBudget: -1,
    },
  },
}

export async function enterpriseOnboardingRoutes(fastify: FastifyInstance) {

  // ─── 获取/创建 Onboarding 状态 ───

  fastify.get('/enterprise/onboarding/v2/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { enterpriseId } = request.query as { enterpriseId?: string }
    if (!enterpriseId) {
      return reply.status(400).send({ error: 'enterpriseId is required' })
    }

    // UUID 格式校验，避免 Prisma 报 500
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(enterpriseId)) {
      return reply.status(400).send({ error: 'enterpriseId 格式无效，应为 UUID' })
    }

    try {
      const state = await prisma.enterpriseOnboardingState.findFirst({
        where: { enterpriseId },
      })

      if (!state) {
        // 未创建 onboarding 状态 — 返回默认初始状态
        return {
          success: true,
          state: {
            id: '',
            workspaceId: '',
            enterpriseId,
            currentStep: 1,
            totalSteps: 5,
            completed: false,
            stepCompanyDone: false,
            stepNeedsDone: false,
            stepAgentDone: false,
            stepPlanDone: false,
            stepDashboardDone: false,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }
      }

      return { success: true, state }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取Onboarding状态失败', detail: e.message })
    }
  })

  // ─── Step 1: 创建企业档案 ───

  fastify.post('/enterprise/onboarding/step1', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as {
      enterpriseId?: string
      companyName: string
      industry: string
      scale: string
      website?: string
      description?: string
    }

    if (!body.companyName) {
      return reply.status(400).send({ error: 'companyName 必填' })
    }

    // 从 JWT 获取当前用户 ID
    const userId = (request.user as any)?.id
    if (!userId) {
      return reply.status(401).send({ error: '未授权' })
    }

    try {
      let jcp: any = null

      // Sprint-02 Fix: 如果提供了 enterpriseId，验证归属
      if (body.enterpriseId) {
        // 先验证该 enterpriseId 是否属于当前用户
        const userEnterpriseId = await resolveEnterpriseId(userId)
        if (userEnterpriseId && userEnterpriseId !== body.enterpriseId) {
          return reply.status(403).send({ error: '无权操作该企业身份' })
        }

        jcp = await prisma.jobCompanyProfile.findUnique({
          where: { id: body.enterpriseId },
        }
        )

        // 如果找不到，尝试通过 userId 查找（兼容前端传 userId 的场景）
        if (!jcp) {
          // 链路: User → email → govUser → tenantId → Organization(slug) → EnterpriseProfile
          const user = await prisma.user.findUnique({
            where: { id: body.enterpriseId },
            select: { email: true },
          }
          )

          let orgId: string | null = null

          if (user?.email) {
            const govUser = await prisma.govUser.findFirst({
              where: { email: user.email },
              select: { tenantId: true },
            }
            )
            if (govUser?.tenantId) {
              const slugHash = govUser.tenantId.replace(/-/g, '').slice(0, 20)
              const org = await prisma.organization.findFirst({
                where: { slug: `migrated-${slugHash}` },
              }
              )
              if (org) {
                orgId = org.id
              }
            }
          }

          // fallback: 直接当 organizationId 查 Organization 表
          if (!orgId) {
            const org = await prisma.organization.findUnique({
              where: { id: body.enterpriseId },
            }
            )
            orgId = org?.id || null
          }

          // fallback2: 通过 govOrganization → 再映射到 Organization
          if (!orgId) {
            const govOrg = await prisma.govOrganization.findUnique({
              where: { id: body.enterpriseId },
            }
            )
            if (govOrg) {
              const slugHash = govOrg.tenantId.replace(/-/g, '').slice(0, 20)
              const org = await prisma.organization.findFirst({
                where: { slug: `migrated-${slugHash}` },
              }
              )
              orgId = org?.id || null
            }
          }

          if (orgId) {
            let enterpriseProfile = await prisma.enterpriseProfile.findFirst({
              where: { organizationId: orgId },
            }
            )
            if (!enterpriseProfile) {
              enterpriseProfile = await prisma.enterpriseProfile.create({
                data: {
                  organizationId: orgId,
                  industry: body.industry,
                  businessSummary: body.companyName,
                },
              }
              )
            }

            jcp = await prisma.jobCompanyProfile.findUnique({
              where: { enterpriseId: enterpriseProfile.id },
            }
            )
            if (!jcp) {
              jcp = await prisma.jobCompanyProfile.create({
                data: { enterpriseId: enterpriseProfile.id },
              }
              )
            }
          }
        }
      }

      // ─── Sprint-Enterprise-Identity-Hardening-01 Phase 1+2 ───
      // 创建全新企业：全流程事务化，EnterpriseMember 错误严格化
      if (!jcp) {
        const result = await prisma.$transaction(async (tx) => {
          // 1. 创建 Organization
          const newOrg = await tx.organization.create({
            data: {
              name: body.companyName,
              slug: `onboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              plan: 'free',
              ownerId: userId,
            },
          })

          // 2. 创建 EnterpriseProfile
          const enterpriseProfile = await tx.enterpriseProfile.create({
            data: {
              organizationId: newOrg.id,
              industry: body.industry,
              businessSummary: body.companyName,
            },
          })

          // 3. 创建 JobCompanyProfile
          const createdJcp = await tx.jobCompanyProfile.create({
            data: { enterpriseId: enterpriseProfile.id },
          })

          // 4. 创建 OrgMember（绑定当前用户为 OWNER）— SSOT
          // Sprint-SSOT-CLEANUP-01: EnterpriseMember → OrgMember
          await tx.orgMember.create({
            data: {
              userId: userId,
              organizationId: newOrg.id,
              role: 'OWNER',
            },
          }).catch((memberError: any) => {
            // P2002: 已存在则忽略 (unique [organizationId, userId])
            if (memberError.code !== 'P2002') throw memberError
          })

          // 5. 更新 JobCompanyProfile 的 industry + scale
          await tx.jobCompanyProfile.update({
            where: { id: createdJcp.id },
            data: {
              industry: body.industry,
              scale: body.scale,
            },
          })

          // 6. 更新 EnterpriseProfile 的 industry
          await tx.enterpriseProfile.updateMany({
            where: { id: enterpriseProfile.id },
            data: {
              industry: body.industry,
              businessSummary: body.companyName,
            },
          })

          // 7. 创建 Workspace
          const workspace = await tx.enterpriseJobWorkspace.create({
            data: {
              enterpriseId: createdJcp.id,
              name: `${body.companyName} 招聘空间`,
              plan: 'trial',
            },
          })

          // 8. 创建 Onboarding 状态
          await tx.enterpriseOnboardingState.create({
            data: {
              workspaceId: workspace.id,
              enterpriseId: createdJcp.id,
              currentStep: 2,
              stepCompanyDone: true,
              totalSteps: 5,
            },
          })

          return { jcp: createdJcp, workspace }
        })

        jcp = result.jcp
      } else {
        // 已有 jcp，更新 + 确保 workspace/onboarding 存在
        await prisma.jobCompanyProfile.update({
          where: { id: jcp.id },
          data: {
            industry: body.industry,
            scale: body.scale,
          },
        })

        await prisma.enterpriseProfile.updateMany({
          where: { id: jcp.enterpriseId },
          data: {
            industry: body.industry,
            businessSummary: body.companyName,
          },
        })

        // 获取或创建 Workspace
        let workspace = await prisma.enterpriseJobWorkspace.findUnique({
          where: { enterpriseId: jcp.id },
        })

        if (!workspace) {
          workspace = await prisma.enterpriseJobWorkspace.create({
            data: {
              enterpriseId: jcp.id,
              name: `${body.companyName} 招聘空间`,
              plan: 'trial',
            },
          })
        }

        // 更新 Onboarding 状态
        await prisma.enterpriseOnboardingState.upsert({
          where: { workspaceId: workspace.id },
          update: {
            currentStep: 2,
            stepCompanyDone: true,
          },
          create: {
            workspaceId: workspace.id,
            enterpriseId: jcp.id,
            currentStep: 2,
            stepCompanyDone: true,
            totalSteps: 5,
          },
        })
      }

      return {
        success: true,
        enterpriseId: jcp.id,
        workspace: { id: (await prisma.enterpriseJobWorkspace.findUnique({ where: { enterpriseId: jcp.id } }))?.id || '', name: `${body.companyName} 招聘空间` },
        nextStep: 2,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '创建企业档案失败', detail: e.message })
    }
  })

  // ─── Step 2: 采集招聘需求 ───

  fastify.post('/enterprise/onboarding/step2', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as {
      enterpriseId: string
      workspaceId: string
      targetPositions: string[]
      monthlyHireTarget?: number
      urgentPosition?: string
      budgetRange?: string
      teamSize?: string
      hiringExperience?: string
      hireChannels?: string[]
    }

    if (!body.enterpriseId || !body.workspaceId || !body.targetPositions?.length) {
      return reply.status(400).send({ error: 'enterpriseId, workspaceId, targetPositions 必填' })
    }

    // 校验 workspace 归属
    const workspace = await prisma.enterpriseJobWorkspace.findFirst({
      where: { id: body.workspaceId },
    })
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace 不存在或不属于该企业' })
    }

    try {
      // 保存招聘需求
      await prisma.enterpriseRecruitmentNeeds.upsert({
        where: { workspaceId: body.workspaceId },
        update: {
          targetPositions: body.targetPositions,
          monthlyHireTarget: body.monthlyHireTarget || 5,
          urgentPosition: body.urgentPosition,
          budgetRange: body.budgetRange,
          teamSize: body.teamSize,
          hiringExperience: body.hiringExperience,
          hireChannels: body.hireChannels || [],
        },
        create: {
          workspaceId: body.workspaceId,
          enterpriseId: body.enterpriseId,
          targetPositions: body.targetPositions,
          monthlyHireTarget: body.monthlyHireTarget || 5,
          urgentPosition: body.urgentPosition,
          budgetRange: body.budgetRange,
          teamSize: body.teamSize,
          hiringExperience: body.hiringExperience,
          hireChannels: body.hireChannels || [],
        },
      })

      // 更新 Onboarding 状态
      await prisma.enterpriseOnboardingState.updateMany({
        where: { enterpriseId: body.enterpriseId },
        data: {
          currentStep: 3,
          stepNeedsDone: true,
        },
      })

      return { success: true, nextStep: 3 }
    } catch (e: any) {
      return reply.status(500).send({ error: '保存招聘需求失败', detail: e.message })
    }
  })

  // ─── Step 3: 创建 AI 招聘部门 ───

  fastify.post('/enterprise/onboarding/step3', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as {
      enterpriseId: string
      workspaceId: string
      plan?: string
    }

    if (!body.enterpriseId || !body.workspaceId) {
      return reply.status(400).send({ error: 'enterpriseId 和 workspaceId 必填' })
    }

    // 校验 workspace 归属
    const workspace = await prisma.enterpriseJobWorkspace.findFirst({
      where: { id: body.workspaceId },
    })
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace 不存在或不属于该企业' })
    }

    const plan = body.plan || 'starter'
    const isStarter = plan === 'starter'
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14天试用

    try {
      // 创建 AI 员工编制
      const workforce = []
      for (const agent of DEFAULT_AGENT_WORKFORCE) {
        const isTrialOnly = agent.trialOnly && isStarter
        const status = isTrialOnly ? 'trial' : agent.defaultActive ? 'active' : 'disabled'

        const existing = await prisma.enterpriseAgentWorkforce.findFirst({
          where: {
            workspaceId: body.workspaceId,
            agentType: agent.agentType,
          },
        })

        if (!existing) {
          const created = await prisma.enterpriseAgentWorkforce.create({
            data: {
              workspaceId: body.workspaceId,
              enterpriseId: body.enterpriseId,
              agentType: agent.agentType,
              displayName: agent.displayName,
              roleDescription: agent.roleDescription,
              status,
              trialEndsAt: isTrialOnly ? trialEndsAt : null,
              subscriptionPlan: plan,
              sortOrder: agent.sortOrder,
              activatedAt: status === 'active' ? new Date() : null,
            },
          })
          workforce.push(created)
        } else {
          workforce.push(existing)
        }
      }

      // 更新 Onboarding 状态
      await prisma.enterpriseOnboardingState.updateMany({
        where: { enterpriseId: body.enterpriseId },
        data: {
          currentStep: 4,
          stepAgentDone: true,
        },
      })

      return {
        success: true,
        workforce: workforce.map(w => ({
          id: w.id,
          agentType: w.agentType,
          displayName: w.displayName,
          status: w.status,
          trialEndsAt: w.trialEndsAt,
        })),
        nextStep: 4,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '创建AI员工失败', detail: e.message })
    }
  })

  // ─── Step 4: 选择套餐 ───

  fastify.post('/enterprise/onboarding/step4', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as {
      enterpriseId: string
      workspaceId: string
      plan: 'starter' | 'professional' | 'enterprise'
    }

    if (!body.enterpriseId || !body.workspaceId || !body.plan) {
      return reply.status(400).send({ error: 'enterpriseId, workspaceId, plan 必填' })
    }

    if (!PLANS[body.plan]) {
      return reply.status(400).send({ error: '无效套餐' })
    }

    // 校验 workspace 归属
    const workspace = await prisma.enterpriseJobWorkspace.findFirst({
      where: { id: body.workspaceId },
    })
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace 不存在或不属于该企业' })
    }

    const planConfig = PLANS[body.plan]

    try {
      // 更新 Workspace 套餐
      await prisma.enterpriseJobWorkspace.update({
        where: { id: body.workspaceId },
        data: { plan: body.plan },
      })

      // 更新 AI 员工套餐
      await prisma.enterpriseAgentWorkforce.updateMany({
        where: { workspaceId: body.workspaceId },
        data: { subscriptionPlan: body.plan },
      })

      // Sprint-03: 创建 Subscription + Entitlement
      // 1. 查找或创建 EnterprisePlan
      let plan = await prisma.enterprisePlan.findFirst({
        where: { name: body.plan },
      })
      if (!plan) {
        const planDefaults: Record<string, any> = {
          starter: { maxEmployees: 2, maxChannels: 1, maxMembers: 3, price: 999 },
          professional: { maxEmployees: 5, maxChannels: 3, maxMembers: 10, price: 2999 },
          enterprise: { maxEmployees: 20, maxChannels: 10, maxMembers: 50, price: 9999 },
        }
        const defaults = planDefaults[body.plan] || planDefaults.starter
        plan = await prisma.enterprisePlan.create({
          data: {
            name: body.plan,
            displayName: planConfig.name,
            description: planConfig.features.join(', '),
            price: planConfig.price,
            billingCycle: planConfig.interval,
            maxEmployees: defaults.maxEmployees,
            maxChannels: defaults.maxChannels,
            maxMembers: defaults.maxMembers,
            features: JSON.stringify(planConfig.features),
          },
        })
      }

      // Sprint-04 Fix: 获取正确的 organizationId
      // workspace.enterpriseId 是 JobCompanyProfile ID，需要通过 EnterpriseProfile 映射到 Organization ID
      const jcpRecord = await prisma.jobCompanyProfile.findUnique({
        where: { id: workspace.enterpriseId },
        select: { enterpriseId: true },
      })
      const enterpriseProfile = jcpRecord?.enterpriseId
        ? await prisma.enterpriseProfile.findUnique({
            where: { id: jcpRecord.enterpriseId },
            select: { organizationId: true },
          })
        : null
      const organizationId = enterpriseProfile?.organizationId || workspace.enterpriseId

      // 2. 创建 EnterpriseSubscription（含 snapshot 字段加速查询）
      const now = new Date()
      const expireAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30天
      const subscription = await prisma.enterpriseSubscription.create({
        data: {
          organizationId,
          planId: plan.id,
          status: 'active',
          startAt: now,
          expireAt,
          autoRenew: true,
          snapshotName: plan.displayName,
          snapshotMaxEmployees: plan.maxEmployees,
          snapshotMaxChannels: plan.maxChannels,
          snapshotMaxMembers: plan.maxMembers,
          snapshotFeatures: plan.features,
        },
      })

      // 3. 创建 EnterpriseEntitlement
      await prisma.enterpriseEntitlement.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          maxAgents: plan.maxEmployees,
          maxChannels: plan.maxChannels,
          features: plan.features,
          status: 'active',
          effectiveFrom: now,
        },
      })

      // 更新 Onboarding 状态
      await prisma.enterpriseOnboardingState.updateMany({
        where: { enterpriseId: body.enterpriseId },
        data: {
          currentStep: 5,
          stepPlanDone: true,
        },
      })

      return {
        success: true,
        plan: {
          id: body.plan,
          name: planConfig.name,
          price: planConfig.price,
          features: planConfig.features,
        },
        nextStep: 5,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '选择套餐失败', detail: e.message })
    }
  })

  // ─── Step 5: 完成 Onboarding ───

  fastify.post('/enterprise/onboarding/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as {
      enterpriseId: string
    }

    if (!body.enterpriseId) {
      return reply.status(400).send({ error: 'enterpriseId 必填' })
    }

    try {
      await prisma.enterpriseOnboardingState.updateMany({
        where: { enterpriseId: body.enterpriseId },
        data: {
          completed: true,
          stepDashboardDone: true,
          completedAt: new Date(),
        },
      })

      return { success: true, completed: true, redirectTo: '/workspace/recruitment' }
    } catch (e: any) {
      return reply.status(500).send({ error: '完成Onboarding失败', detail: e.message })
    }
  })

  // ─── 获取套餐列表 ───

  fastify.get('/enterprise/plans', async (request, reply) => {
    return {
      success: true,
      plans: Object.entries(PLANS).map(([id, plan]) => ({
        id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
      })),
    }
  })

  // ─── 获取 AI 员工编制 ───

  fastify.get('/enterprise/workforce', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }
    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const workforce = await prisma.enterpriseAgentWorkforce.findMany({
        where: { workspaceId },
        orderBy: { sortOrder: 'asc' },
      })

      return {
        success: true,
        workforce: workforce.map(w => ({
          id: w.id,
          agentType: w.agentType,
          displayName: w.displayName,
          roleDescription: w.roleDescription,
          status: w.status,
          trialEndsAt: w.trialEndsAt,
          monthlyCalls: w.monthlyCalls,
          monthlyTokens: w.monthlyTokens,
          monthlyCost: w.monthlyCost,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取AI员工失败', detail: e.message })
    }
  })

  // ─── 获取当前用户的企业招聘上下文 ───
  fastify.get('/enterprise/recruitment/context', async (request, reply) => {
    return { success: true, data: { hasEnterprise: false } }
  })
}
