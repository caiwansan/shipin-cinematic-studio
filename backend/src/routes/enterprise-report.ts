/**
 * enterprise-report.routes.ts — 招聘报告聚合 API
 * Sprint 7B: AI 招聘报告 MVP
 *
 * 聚合企业招聘数据，生成招聘总结报告。
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'

export async function enterpriseReportRoutes(fastify: FastifyInstance) {
  // ─── JWT Auth ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── GET /api/enterprise/reports/summary — 招聘总结报告 ───
  fastify.get('/api/enterprise/reports/summary', async (request, reply) => {
    try {
      const userId = (request.user as any)?.id || (request.user as any)?.userId
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(404).send({ error: '企业身份未找到' })
      }

      // 获取或创建 workspace
      let workspace = await prisma.enterpriseJobWorkspace.findFirst({
        where: { enterpriseId },
      })
      if (!workspace) {
        workspace = await prisma.enterpriseJobWorkspace.create({
          data: { enterpriseId, name: '招聘工作台', plan: 'basic' },
        })
      }

      // 1. 岗位统计
      const postings = await prisma.jobPosting.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      })

      const totalJobs = postings.length
      const activeJobs = postings.filter(j => j.status === 'published' || j.status === 'active').length
      const draftJobs = postings.filter(j => j.status === 'draft').length

      // 2. 候选人统计
      const matches = await prisma.candidateMatch.findMany({
        where: { workspaceId: workspace.id },
        select: {
          id: true,
          candidateId: true,
          matchScore: true,
          status: true,
          createdAt: true,
          jobId: true,
        },
      })

      const totalCandidates = matches.length
      const highMatch = matches.filter(m => (m.matchScore || 0) >= 80).length
      const mediumMatch = matches.filter(m => (m.matchScore || 0) >= 60 && (m.matchScore || 0) < 80).length
      const lowMatch = matches.filter(m => (m.matchScore || 0) < 60).length
      const invitedCount = matches.filter(m => m.status === 'contacted' || m.status === 'interview').length
      const hiredCount = matches.filter(m => m.status === 'hired').length

      // 3. 面试统计
      const interviewMatches = await prisma.candidateMatch.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true },
      })
      const matchIds = interviewMatches.map(m => m.id)
      const interviews = matchIds.length > 0
        ? await prisma.interviewRecord.findMany({
            where: { matchId: { in: matchIds } },
            select: { id: true, status: true, createdAt: true },
          })
        : []

      const totalInterviews = interviews.length

      // 4. 各岗位候选人分布
      const jobDistribution = postings.map(j => {
        const jobMatches = matches.filter(m => m.jobId === j.id)
        return {
          jobTitle: j.title,
          status: j.status,
          candidateCount: jobMatches.length,
          topScore: jobMatches.length > 0 ? Math.max(...jobMatches.map(m => m.matchScore || 0)) : 0,
        }
      }).filter(j => j.candidateCount > 0)
        .sort((a, b) => b.candidateCount - a.candidateCount)

      // 5. 招聘洞察
      const insights: string[] = []

      if (totalJobs > 0 && totalCandidates > 0) {
        const avgCandidatesPerJob = (totalCandidates / totalJobs).toFixed(1)
        insights.push(`平均每个岗位有 ${avgCandidatesPerJob} 位候选人`)
      }

      if (highMatch > 0) {
        insights.push(`高匹配候选人（80分以上）占比 ${Math.round((highMatch / totalCandidates) * 100)}%`)
      }

      if (invitedCount > 0) {
        insights.push(`已邀请面试 ${invitedCount} 人，录用 ${hiredCount} 人`)
      }

      // 找到最大人才来源岗位
      if (jobDistribution.length > 0) {
        insights.push(`最大人才来源岗位：${jobDistribution[0].jobTitle}（${jobDistribution[0].candidateCount} 位候选人）`)
      }

      const conversionRate = totalCandidates > 0 ? Math.round((invitedCount / totalCandidates) * 100) : 0
      insights.push(`候选人转化率：${conversionRate}%（候选人 → 面试邀请）`)

      if (postings.length === 0) {
        insights.push('尚未创建招聘岗位，建议先创建一个职位')
      } else if (matches.length === 0) {
        insights.push('已创建岗位但暂无匹配候选人，可以尝试调整岗位要求或手动搜索')
      }

      return {
        success: true,
        report: {
          generatedAt: new Date().toISOString(),
          period: 'all',
          summary: {
            totalJobs,
            activeJobs,
            draftJobs,
            totalCandidates,
            highMatch,
            mediumMatch,
            lowMatch,
            invitedCount,
            hiredCount,
            totalInterviews,
          },
          jobDistribution,
          insights,
        },
      }
    } catch (error: any) {
      request.log.error(`[enterprise-report] summary: ${error.message}`)
      return reply.status(500).send({ error: '生成报告失败', detail: error.message })
    }
  })
}

export default enterpriseReportRoutes
