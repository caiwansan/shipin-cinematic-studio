/**
 * recruitment-director.routes.ts — AI Recruitment Director API
 * Sprint 10: 从"企业使用 AI 招聘员工"升级为"企业拥有一个可以自主工作的 AI 招聘团队"
 *
 * AI Recruitment Director 职责：
 * - 接收企业招聘目标（如"招聘3名Java工程师"）
 * - 拆解为子任务（优化JD → 搜索候选 → AI匹配 → 推荐面试）
 * - 调用相应 AI 员工执行
 * - 汇总结果给企业负责人
 *
 * 复用现有 Hermes 基础设施：
 * - EnterpriseAgentWorkforce: AI 员工生命周期
 * - EnterpriseRecruitAgent: JD 优化
 * - TalentSearchAgent: 人才搜索
 * - InterviewAgent: 面试计划
 * - ResumeParserAgent: 简历分析
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { EnterpriseRecruitAgent } from '../agents/job/enterprise-recruit-agent.js'
import { TalentSearchAgent } from '../agents/job/talent-search-agent.js'
import { InterviewAgent } from '../agents/job/interview-agent.js'
import { ResumeParserAgent } from '../agents/job/resume-parser-agent.js'
import { requireEnterpriseWorkspaceContext } from '../services/enterprise-context.service.js'

// ─── Agent 类型定义 ───
const DIRECTOR_AGENT_TYPES = {
  jd_optimizer: {
    code: 'jd_optimizer',
    name: 'JD 优化专家',
    description: '优化岗位描述，提高吸引力和市场竞争力',
  },
  talent_searcher: {
    code: 'talent_searcher',
    name: '人才猎聘顾问',
    description: '搜索和筛选候选人，生成人才推荐报告',
  },
  match_filter: {
    code: 'match_filter',
    name: 'AI 匹配分析师',
    description: '分析候选人与岗位的匹配度，生成匹配报告',
  },
  interview_planner: {
    code: 'interview_planner',
    name: '面试规划专家',
    description: '为推荐候选人创建面试计划和问题集',
  },
} as const

type DirectorAgentType = keyof typeof DIRECTOR_AGENT_TYPES

// ─── 招聘目标解析结果 ───
interface ParsedGoal {
  positionTitle: string
  headcount: number
  skills: string[]
  salaryRange?: string
  location?: string
  description?: string
}

// ─── 子任务定义 ───
interface SubTaskDefinition {
  agentType: DirectorAgentType
  taskName: string
  taskDescription: string
  sortOrder: number
}

// ─── 解析招聘目标 ───
function parseRecruitmentGoal(goal: string): ParsedGoal {
  // 提取人数
  const headcountMatch = goal.match(/(\d+)\s*名/) || goal.match(/(\d+)\s*人/)
  const headcount = headcountMatch ? parseInt(headcountMatch[1]) : 1

  // 提取岗位名称（简化版，实际可调用 LLM）
  let positionTitle = goal
    .replace(/招聘\s*/, '')
    .replace(/\d+\s*名\s*/, '')
    .replace(/\d+\s*人\s*/, '')
    .replace(/工程师$/, '工程师')
    .trim()

  // 如果解析失败，使用原始目标
  if (!positionTitle || positionTitle.length < 2) {
    positionTitle = goal
  }

  // 提取技能关键词
  const commonSkills = [
    'Java', 'Python', 'Go', 'Rust', 'C++', 'JavaScript', 'TypeScript',
    'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
    'AI', '机器学习', '深度学习', 'NLP', '大模型', 'LangChain',
    '数据分析', '产品', '运营', '市场', '销售',
  ]
  const skills = commonSkills.filter(skill =>
    goal.toLowerCase().includes(skill.toLowerCase())
  )

  // 提取薪资范围
  const salaryMatch = goal.match(/(\d+)[-~](\d+)\s*[kK]/) || goal.match(/(\d+)\s*[kK]/)
  const salaryRange = salaryMatch ? salaryMatch[0] : undefined

  // 提取城市
  const cities = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '苏州', '西安']
  const location = cities.find(city => goal.includes(city))

  return {
    positionTitle,
    headcount,
    skills,
    salaryRange,
    location,
    description: goal,
  }
}

// ─── 生成子任务列表 ───
function generateSubTasks(parsedGoal: ParsedGoal): SubTaskDefinition[] {
  const tasks: SubTaskDefinition[] = []

  // Task 1: JD 优化
  tasks.push({
    agentType: 'jd_optimizer',
    taskName: `优化 ${parsedGoal.positionTitle} 岗位描述`,
    taskDescription: `分析并优化 ${parsedGoal.positionTitle} 的岗位描述，提高市场竞争力`,
    sortOrder: 1,
  })

  // Task 2: 人才搜索
  tasks.push({
    agentType: 'talent_searcher',
    taskName: `搜索 ${parsedGoal.positionTitle} 候选人`,
    taskDescription: `根据岗位要求搜索和筛选候选人，推荐匹配度最高的人选`,
    sortOrder: 2,
  })

  // Task 3: AI 匹配
  tasks.push({
    agentType: 'match_filter',
    taskName: `AI 匹配分析`,
    taskDescription: `对候选人进行多维度匹配分析，生成匹配报告`,
    sortOrder: 3,
  })

  // Task 4: 面试计划
  tasks.push({
    agentType: 'interview_planner',
    taskName: `创建面试计划`,
    taskDescription: `为 TOP 推荐候选人创建面试方案和问题集`,
    sortOrder: 4,
  })

  return tasks
}

// ─── 执行子任务 ───
async function executeSubTask(
  task: SubTaskDefinition,
  plan: any,
  workspaceId: string,
  enterpriseId: string,
  userId?: string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    switch (task.agentType) {
      case 'jd_optimizer': {
        const agent = new EnterpriseRecruitAgent()
        // Sprint-RECRUITMENT-REALITY-02 Task 03: LLM 真实生成
        const jdResult = await agent.generateJDWithLLM({
          companyName: plan.workspace?.name || '企业',
          position: plan.positionTitle,
          salaryRange: plan.salaryRange,
          location: plan.location,
        }, {
          userId: String(userId || ''),
          tenantId: String(enterpriseId),
        })
        return {
          success: true,
          result: {
            type: 'jd_optimization',
            qualityScore: jdResult.qualityScore,
            improvements: jdResult.improvements,
            optimizedTitle: jdResult.title,
            aiSource: jdResult.aiSource,
          },
        }
      }

      case 'talent_searcher': {
        // 从人才库搜索候选人
        const candidates = await prisma.candidateMatch.findMany({
          where: { workspaceId },
          take: 20,
        })

        if (candidates.length === 0) {
          return {
            success: true,
            result: {
              type: 'talent_search',
              message: '暂无候选人数据，建议先上传简历或开启人才扫描',
              candidatesFound: 0,
            },
          }
        }

        const agent = new TalentSearchAgent()
        const searchResult = agent.searchTalents(
          {
            workspaceId,
            enterpriseId,
            title: plan.positionTitle,
            skills: parseRecruitmentGoal(plan.goal).skills,
            salaryMin: plan.salaryRange ? parseInt(plan.salaryRange.match(/\d+/)?.[0] || '0') : undefined,
            salaryMax: plan.salaryRange ? parseInt(plan.salaryRange.match(/(\d+)\s*$/)?.[0] || '100') : undefined,
            limit: 10,
          },
          candidates.map((c: any) => ({
            id: c.id,
            name: c.candidateName,
            skills: c.skills || [],
            experience: c.experience || '',
            city: c.city || '',
            salaryMin: c.salaryMin || 0,
            salaryMax: c.salaryMax || 999,
            education: c.education || '',
            careerLevel: c.careerLevel || 'Middle',
          })),
        )

        return {
          success: true,
          result: {
            type: 'talent_search',
            candidatesFound: candidates.length,
            topMatches: searchResult.slice(0, 5).map((r: any) => ({
              name: r.name,
              matchScore: r.matchScore,
              recommendReason: r.recommendReason,
            })),
          },
        }
      }

      case 'match_filter': {
        // 获取已搜索的候选人进行匹配分析
        const candidates = await prisma.candidateMatch.findMany({
          where: { workspaceId },
          take: 10,
        })

        const agent = new EnterpriseRecruitAgent()
        const matchResults = agent.matchCandidates({
          jobId: plan.id,
          jobRequirements: [plan.description || ''],
          jobSkills: parseRecruitmentGoal(plan.goal).skills,
          jobSalary: plan.salaryRange || '15-25K',
          jobLocation: plan.location || '不限',
          candidates: candidates.map((c: any) => ({
            id: c.id,
            name: c.candidateName,
            skills: c.skills || [],
            experience: c.experience || '',
            city: c.city || '',
            salaryMin: c.salaryMin || 0,
            salaryMax: c.salaryMax || 999,
            education: c.education || '',
          })),
        })

        return {
          success: true,
          result: {
            type: 'match_analysis',
            analyzedCount: candidates.length,
            topMatches: matchResults.slice(0, 5).map((r: any) => ({
              name: r.name,
              matchScore: r.matchScore,
              reasons: r.reasons,
              risks: r.risks,
            })),
          },
        }
      }

      case 'interview_planner': {
        // 为 TOP 候选人创建面试计划
        const agent = new InterviewAgent()
        const interviewPlan = agent.generateInterviewPlan(
          {
            title: plan.positionTitle,
            skills: parseRecruitmentGoal(plan.goal).skills,
            salary: plan.salaryRange || '15-25K',
            location: plan.location || '不限',
            requirements: [plan.description || ''],
            level: 'mid',
          },
          {
            name: '候选人',
            skills: parseRecruitmentGoal(plan.goal).skills,
            experienceYears: 3,
            education: '本科',
            city: plan.location || '不限',
            careerGoal: '',
            projects: '',
          },
        )

        return {
          success: true,
          result: {
            type: 'interview_plan',
            totalQuestions: interviewPlan.totalQuestions,
            estimatedDuration: interviewPlan.estimatedDuration,
            focusAreas: interviewPlan.focusAreas,
            riskAreas: interviewPlan.riskAreas,
          },
        }
      }

      default:
        return { success: false, error: `Unknown agent type: ${task.agentType}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ─── 沉淀招聘知识 ───
async function extractHiringKnowledge(
  plan: any,
  results: any[],
  workspaceId: string,
  enterpriseId: string,
): Promise<void> {
  const knowledgeEntries = []

  // 从成功完成的任务中提取知识
  for (const result of results) {
    if (!result.result) continue

    if (result.result.type === 'match_analysis' && result.result.topMatches) {
      // 沉淀成功候选人画像
      knowledgeEntries.push({
        workspaceId,
        enterpriseId,
        knowledgeType: 'candidate_profile',
        title: `${plan.positionTitle} 候选人画像`,
        content: JSON.stringify({
          positionTitle: plan.positionTitle,
          topCandidates: result.result.topMatches,
          extractedAt: new Date().toISOString(),
        }),
        sourceType: 'recruitment_plan',
        sourceId: plan.id,
      })
    }

    if (result.result.type === 'interview_plan') {
      // 沉淀面试标准
      knowledgeEntries.push({
        workspaceId,
        enterpriseId,
        knowledgeType: 'interview_standard',
        title: `${plan.positionTitle} 面试标准`,
        content: JSON.stringify({
          positionTitle: plan.positionTitle,
          focusAreas: result.result.focusAreas,
          riskAreas: result.result.riskAreas,
          estimatedDuration: result.result.estimatedDuration,
        }),
        sourceType: 'recruitment_plan',
        sourceId: plan.id,
      })
    }
  }

  // 沉淀招聘偏好
  if (plan.salaryRange || plan.location) {
    knowledgeEntries.push({
      workspaceId,
      enterpriseId,
      knowledgeType: 'hiring_preference',
      title: `${plan.positionTitle} 招聘偏好`,
      content: JSON.stringify({
        positionTitle: plan.positionTitle,
        salaryRange: plan.salaryRange,
        location: plan.location,
        headcount: plan.headcount,
      }),
      sourceType: 'recruitment_plan',
      sourceId: plan.id,
    })
  }

  // 批量创建知识记录
  if (knowledgeEntries.length > 0) {
    await prisma.hiringKnowledge.createMany({
      data: knowledgeEntries,
    })
  }
}

// ─── 获取历史知识 ───
async function getHistoricalKnowledge(
  workspaceId: string,
  positionTitle: string,
): Promise<any[]> {
  return prisma.hiringKnowledge.findMany({
    where: {
      workspaceId,
      knowledgeType: { in: ['candidate_profile', 'interview_standard', 'hiring_preference'] },
      OR: [
        { title: { contains: positionTitle } },
        { content: { contains: positionTitle } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}

// ─── 路由注册 ───
export const recruitmentDirectorRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── POST /api/enterprise/recruitment-director/plan — 创建招聘计划 ───
  fastify.post('/api/enterprise/recruitment-director/plan', async (request, reply) => {
    try {
      const { workspaceId, goal, salaryRange, location } = request.body as {
        workspaceId: string
        goal: string
        salaryRange?: string
        location?: string
      }

      if (!workspaceId || !goal) {
        return reply.status(400).send({ error: 'workspaceId and goal are required' })
      }

      // Sprint 1B-5: Tenant boundary guard
      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      // 验证 workspace 存在
      const workspace = await prisma.enterpriseJobWorkspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, enterpriseId: true, name: true },
      })
      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace not found' })
      }

      // 解析招聘目标
      const parsedGoal = parseRecruitmentGoal(goal)
      const finalSalaryRange = salaryRange || parsedGoal.salaryRange
      const finalLocation = location || parsedGoal.location

      // 获取历史知识（如果有）
      const historicalKnowledge = await getHistoricalKnowledge(workspaceId, parsedGoal.positionTitle)

      // 生成子任务
      const subTasks = generateSubTasks(parsedGoal)

      // 创建计划
      const plan = await prisma.recruitmentPlan.create({
        data: {
          workspaceId,
          enterpriseId: workspace.enterpriseId,
          goal,
          positionTitle: parsedGoal.positionTitle,
          headcount: parsedGoal.headcount,
          salaryRange: finalSalaryRange,
          location: finalLocation,
          description: parsedGoal.description,
          status: 'planning',
          totalSubtasks: subTasks.length,
          completedSubtasks: 0,
          summary: historicalKnowledge.length > 0
            ? `基于 ${historicalKnowledge.length} 条历史招聘知识生成计划`
            : '新岗位招聘计划',
        },
      })

      // 创建子任务
      const taskRecords = await Promise.all(
        subTasks.map((task) =>
          prisma.recruitmentPlanTask.create({
            data: {
              planId: plan.id,
              agentType: task.agentType,
              taskName: task.taskName,
              taskDescription: task.taskDescription,
              sortOrder: task.sortOrder,
              status: 'pending',
            },
          }),
        ),
      )

      return reply.status(201).send({
        success: true,
        data: {
          id: plan.id,
          goal: plan.goal,
          positionTitle: plan.positionTitle,
          headcount: plan.headcount,
          salaryRange: plan.salaryRange,
          location: plan.location,
          status: plan.status,
          summary: plan.summary,
          totalSubtasks: plan.totalSubtasks,
          tasks: taskRecords.map((t) => ({
            id: t.id,
            agentType: t.agentType,
            taskName: t.taskName,
            status: t.status,
            sortOrder: t.sortOrder,
          })),
          historicalKnowledge: historicalKnowledge.length,
          createdAt: plan.createdAt,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] create-plan: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to create recruitment plan', detail: error.message })
    }
  })

  // ─── GET /api/enterprise/recruitment-director/plans — 查看招聘计划列表 ───
  fastify.get('/api/enterprise/recruitment-director/plans', async (request, reply) => {
    try {
      const { workspaceId, status, limit, offset } = request.query as {
        workspaceId?: string
        status?: string
        limit?: string
        offset?: string
      }

      // Sprint 1B-5: Tenant boundary guard
      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId && workspaceId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      const where: any = {}
      if (workspaceId) where.workspaceId = workspaceId
      if (status) where.status = status

      const [plans, total] = await Promise.all([
        prisma.recruitmentPlan.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit ? parseInt(limit) : 20,
          skip: offset ? parseInt(offset) : 0,
          include: {
            tasks: {
              select: {
                id: true,
                agentType: true,
                taskName: true,
                status: true,
                sortOrder: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        }),
        prisma.recruitmentPlan.count({ where }),
      ])

      return reply.send({
        success: true,
        data: {
          total,
          items: plans.map((p) => ({
            id: p.id,
            goal: p.goal,
            positionTitle: p.positionTitle,
            headcount: p.headcount,
            salaryRange: p.salaryRange,
            location: p.location,
            status: p.status,
            summary: p.summary,
            totalSubtasks: p.totalSubtasks,
            completedSubtasks: p.completedSubtasks,
            progress: p.totalSubtasks > 0
              ? Math.round((p.completedSubtasks / p.totalSubtasks) * 100)
              : 0,
            tasks: p.tasks,
            createdAt: p.createdAt,
            executedAt: p.executedAt,
            completedAt: p.completedAt,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] list-plans: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to list plans' })
    }
  })

  // ─── GET /api/enterprise/recruitment-director/plans/:id — 查看计划详情和进度 ───
  fastify.get('/api/enterprise/recruitment-director/plans/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      // Sprint 1B-5: Tenant boundary — 先查 plan 获取 workspaceId
      const plan = await prisma.recruitmentPlan.findUnique({
        where: { id },
        include: {
          tasks: {
            orderBy: { sortOrder: 'asc' },
          },
          workspace: {
            select: { id: true, name: true, enterpriseId: true },
          },
        },
      })

      if (!plan) {
        return reply.status(404).send({ error: 'Plan not found' })
      }

      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId && plan.workspaceId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, plan.workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      return reply.send({
        success: true,
        data: {
          id: plan.id,
          goal: plan.goal,
          positionTitle: plan.positionTitle,
          headcount: plan.headcount,
          salaryRange: plan.salaryRange,
          location: plan.location,
          description: plan.description,
          status: plan.status,
          summary: plan.summary,
          totalSubtasks: plan.totalSubtasks,
          completedSubtasks: plan.completedSubtasks,
          progress: plan.totalSubtasks > 0
            ? Math.round((plan.completedSubtasks / plan.totalSubtasks) * 100)
            : 0,
          recommendedCandidates: plan.recommendedCandidates,
          tasks: plan.tasks.map((t) => ({
            id: t.id,
            agentType: t.agentType,
            taskName: t.taskName,
            taskDescription: t.taskDescription,
            status: t.status,
            sortOrder: t.sortOrder,
            result: t.result,
            errorMessage: t.errorMessage,
            startedAt: t.startedAt,
            completedAt: t.completedAt,
          })),
          workspace: plan.workspace,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          executedAt: plan.executedAt,
          completedAt: plan.completedAt,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] get-plan: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to get plan details' })
    }
  })

  // ─── POST /api/enterprise/recruitment-director/plans/:id/execute — 执行计划 ───
  fastify.post('/api/enterprise/recruitment-director/plans/:id/execute', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const plan = await prisma.recruitmentPlan.findUnique({
        where: { id },
        include: { tasks: { orderBy: { sortOrder: 'asc' } }, workspace: true },
      })

      if (!plan) {
        return reply.status(404).send({ error: 'Plan not found' })
      }

      // Sprint 1B-5: Tenant boundary guard
      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId && plan.workspaceId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, plan.workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      if (plan.status === 'completed') {
        return reply.status(400).send({ error: 'Plan already completed' })
      }

      if (plan.status === 'executing') {
        return reply.status(400).send({ error: 'Plan is already executing' })
      }

      // 更新状态为执行中
      await prisma.recruitmentPlan.update({
        where: { id },
        data: { status: 'executing', executedAt: new Date() },
      })

      // 顺序执行子任务
      const results = []
      let allSuccess = true

      for (const task of plan.tasks) {
        // 更新任务状态为执行中
        await prisma.recruitmentPlanTask.update({
          where: { id: task.id },
          data: { status: 'running', startedAt: new Date() },
        })

        // 执行任务
        const result = await executeSubTask(
          {
            agentType: task.agentType as DirectorAgentType,
            taskName: task.taskName,
            taskDescription: task.taskDescription || '',
            sortOrder: task.sortOrder,
          },
          plan,
          plan.workspaceId,
          plan.enterpriseId,
          userId,
        )

        results.push({ taskId: task.id, ...result })

        // 更新任务结果
        await prisma.recruitmentPlanTask.update({
          where: { id: task.id },
          data: {
            status: result.success ? 'completed' : 'failed',
            result: result.result || null,
            errorMessage: result.error || null,
            completedAt: new Date(),
          },
        })

        if (!result.success) {
          allSuccess = false
        }
      }

      // 更新计划状态
      const finalStatus = allSuccess ? 'reviewing' : 'failed'
      await prisma.recruitmentPlan.update({
        where: { id },
        data: {
          status: finalStatus,
          completedSubtasks: plan.tasks.length,
          completedAt: new Date(),
        },
      })

      // 沉淀招聘知识
      await extractHiringKnowledge(plan, results, plan.workspaceId, plan.enterpriseId)

      return reply.send({
        success: true,
        data: {
          id: plan.id,
          status: finalStatus,
          message: allSuccess
            ? '招聘计划执行完成，请查看推荐结果'
            : '招聘计划执行完成，部分任务失败',
          results: results.map((r) => ({
            taskId: r.taskId,
            success: r.success,
            result: r.result,
            error: r.error,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] execute-plan: ${error.message}`)
      // 更新计划状态为失败
      await prisma.recruitmentPlan.update({
        where: { id: (request.params as any).id },
        data: { status: 'failed' },
      }).catch(() => {})
      return reply.status(500).send({ error: 'Failed to execute plan', detail: error.message })
    }
  })

  // ─── GET /api/enterprise/recruitment-director/knowledge — 获取招聘知识库 ───
  fastify.get('/api/enterprise/recruitment-director/knowledge', async (request, reply) => {
    try {
      const { workspaceId, knowledgeType, limit } = request.query as {
        workspaceId?: string
        knowledgeType?: string
        limit?: string
      }

      // Sprint 1B-5: Tenant boundary guard
      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId && workspaceId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      const where: any = {}
      if (workspaceId) where.workspaceId = workspaceId
      if (knowledgeType) where.knowledgeType = knowledgeType

      const knowledge = await prisma.hiringKnowledge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
      })

      // 按类型分组统计
      const stats = await prisma.hiringKnowledge.groupBy({
        by: ['knowledgeType'],
        where: workspaceId ? { workspaceId } : {},
        _count: { id: true },
      })

      return reply.send({
        success: true,
        data: {
          total: knowledge.length,
          stats: stats.map((s) => ({
            type: s.knowledgeType,
            count: s._count.id,
          })),
          items: knowledge.map((k) => ({
            id: k.id,
            knowledgeType: k.knowledgeType,
            title: k.title,
            content: k.content,
            sourceType: k.sourceType,
            createdAt: k.createdAt,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] get-knowledge: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to get knowledge' })
    }
  })

  // ─── POST /api/enterprise/recruitment-director/plans/:id/review — 人工审核 ───
  fastify.post('/api/enterprise/recruitment-director/plans/:id/review', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { action, feedback } = request.body as {
        action: 'approve' | 'reject' | 'retry'
        feedback?: string
      }

      const plan = await prisma.recruitmentPlan.findUnique({
        where: { id },
      })

      if (!plan) {
        return reply.status(404).send({ error: 'Plan not found' })
      }

      // Sprint 1B-5: Tenant boundary guard
      const userId = (request.user as any)?.id || (request as any)?.userId
      if (userId && plan.workspaceId) {
        const wsc = await requireEnterpriseWorkspaceContext(userId, plan.workspaceId)
        if (!wsc) return reply.status(403).send({ error: 'Forbidden: workspace access denied' })
      }

      if (plan.status !== 'reviewing' && plan.status !== 'failed') {
        return reply.status(400).send({ error: `Cannot review plan in ${plan.status} status` })
      }

      let newStatus: string
      switch (action) {
        case 'approve':
          newStatus = 'completed'
          break
        case 'reject':
          newStatus = 'completed'
          break
        case 'retry':
          newStatus = 'planning'
          // 重置任务状态
          await prisma.recruitmentPlanTask.updateMany({
            where: { planId: id },
            data: { status: 'pending', result: undefined, errorMessage: null, startedAt: null, completedAt: null },
          })
          break
        default:
          return reply.status(400).send({ error: 'Invalid action' })
      }

      const updated = await prisma.recruitmentPlan.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
          ...(feedback ? { summary: `${plan.summary || ''}\n\n[Review ${action}]: ${feedback}` } : {}),
        },
      })

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          message: `Plan ${action}ed successfully`,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-director] review-plan: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to review plan' })
    }
  })
}
