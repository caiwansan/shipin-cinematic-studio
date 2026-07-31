/**
 * enterprise-agent-activity.ts — AI 员工工作日志 API
 * Sprint-08: Carol 工作日志与成果展示
 *
 * 聚合 EnterpriseAgentTask、CandidateMatch、InterviewRecord 数据，
 * 无需新增数据库表。返回 AI 员工的工作时间线活动记录。
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export default async function enterpriseAgentActivityRoutes(fastify: FastifyInstance) {

  // ─── JWT Auth ───
  fastify.addHook('preHandler', fastify.authenticate)

  // ─── GET /api/enterprise/agent-activity — AI 员工活动时间线 ───
  fastify.get('/api/enterprise/agent-activity', async (request, reply) => {
    try {
      const user = request.user as any
      const userId = user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) {
        return reply.status(404).send({ error: '企业身份未找到' })
      }

      const query = request.query as {
        agentId?: string
        days?: string
        page?: string
        pageSize?: string
      }

      const days = parseInt(query.days || '7', 10)
      const page = parseInt(query.page || '1', 10)
      const pageSize = Math.min(parseInt(query.pageSize || '20', 10), 50)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // ─── 1. 获取 Agent 实例 & Profile 映射 ───
      const instances = await prisma.enterpriseAgentInstance.findMany({
        where: { tenantId: orgId },
        select: { id: true, employeeId: true },
      })

      const profiles = await prisma.enterpriseAgentProfile.findMany({
        where: { tenantId: orgId },
        select: { id: true, name: true, role: true, agentType: true },
      })

      const profileMap = new Map<string, { name: string; role: string; agentType: string }>()
      profiles.forEach(p => profileMap.set(p.id, { name: p.name, role: p.role, agentType: p.agentType }))

      const instanceToProfile = new Map<string, { name: string; role: string; agentType: string }>()
      instances.forEach(inst => {
        const prof = profileMap.get(inst.employeeId)
        if (prof) {
          instanceToProfile.set(inst.id, prof)
        }
      })

      // Helper: get agent name by instance ID
      function getAgentName(instanceId: string): string {
        return instanceToProfile.get(instanceId)?.name || 'AI 员工'
      }

      // ─── 2. 查询 Task 记录 ───
      const tasks = await prisma.enterpriseAgentTask.findMany({
        where: {
          tenantId: orgId,
          startedAt: { gte: since },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })

      // ─── 3. 构建活动列表 ───
      const actionLabels: Record<string, string> = {
        jd_generation: '完成岗位分析',
        job_optimization: '优化岗位要求',
        candidate_search: '搜索候选人',
        candidate_analysis: '分析候选人',
        interview_questions: '生成面试题',
        interview_evaluation: '面试评估',
        ranking: '候选人排名',
        matching: '智能匹配',
        resume_screening: '简历筛选',
        report: '生成招聘报告',
      }

      const activities: Array<{
        time: string
        agent: string
        action: string
        detail: string
        result: string
        type: string
      }> = []

      for (const task of tasks) {
        const agentName = getAgentName(task.agentInstanceId)
        const action = actionLabels[task.taskType] || task.taskType
        const time = formatTime(task.startedAt)

        let detail = task.inputSummary || ''
        if (detail.length > 80) detail = detail.substring(0, 80) + '...'

        let result = task.outputSummary || ''
        if (result.length > 80) result = result.substring(0, 80) + '...'

        activities.push({
          time,
          agent: agentName,
          action,
          detail,
          result,
          type: task.taskType,
        })
      }

      // ─── 4. 从 CandidateMatch 补充匹配活动 ───
      const recentMatches = await prisma.candidateMatch.findMany({
        where: {
          workspace: { enterpriseId: orgId },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          job: { select: { title: true } },
        },
      })

      for (const match of recentMatches) {
        const time = formatTime(match.createdAt)
        const jobTitle = match.job?.title || '未知岗位'
        const score = match.matchScore || 0

        activities.push({
          time,
          agent: 'Carol',
          action: score >= 80 ? '发现高匹配候选人' : '分析候选人',
          detail: `岗位：${jobTitle}`,
          result: score >= 80
            ? `匹配度 ${score}%，建议面试`
            : `匹配度 ${score}%，已进入人才库`,
          type: 'matching',
        })
      }

      // ─── 5. 按时间排序（最新的在前） ───
      activities.sort((a, b) => {
        // Parse time strings for comparison
        const aTime = parseTimeStr(a.time)
        const bTime = parseTimeStr(b.time)
        return bTime.getTime() - aTime.getTime()
      })

      // ─── 6. 今日统计 ───
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const todayTasks = await prisma.enterpriseAgentTask.count({
        where: {
          tenantId: orgId,
          startedAt: { gte: todayStart },
        },
      })

      const totalCandidates = (await prisma.candidateMatch.findMany({
        where: {
          workspace: { enterpriseId: orgId },
        },
        select: { id: true, matchScore: true },
      }))

      const highMatch = totalCandidates.filter(m => (m.matchScore || 0) >= 80).length

      const stats = {
        todayTasks,
        totalCandidates: totalCandidates.length,
        highMatch,
        reportsGenerated: tasks.filter(t => t.taskType === 'report').length,
      }

      return reply.send({
        success: true,
        activities: activities.slice(0, pageSize),
        stats,
        pagination: {
          page,
          pageSize,
          total: activities.length,
        },
      })
    } catch (error: any) {
      request.log.error(`[agent-activity] ${error.message}`)
      return reply.status(500).send({ error: '获取活动记录失败', detail: error.message })
    }
  })
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function parseTimeStr(time: string): Date {
  // Simple time string like "09:30" — assume today
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
