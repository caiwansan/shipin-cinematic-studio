import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const dashboardRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/dashboard — 工作台仪表盘 ───
  fastify.get('/enterprise/dashboard', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { workspaceId } = request.query as any

      // 聚合统计
      const [resumeCount, pipelineCount, interviewCount, jobCount, candidateCount] = await Promise.all([
        prisma.resume.count({ where: workspaceId ? { workspaceId } : {} }),
        prisma.recruitmentPipeline.count({ where: workspaceId ? { workspaceId } : {} }),
        prisma.interviewSession.count({ where: workspaceId ? { workspaceId } : {} }),
        prisma.jobPosting.count({ where: workspaceId ? { workspaceId } : {} }),
        prisma.jobCandidate.count({ where: workspaceId ? { workspaceId } : {} }),
      ])

      // 最近活动
      const recentResumes = await prisma.resume.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, candidateName: true, status: true, createdAt: true },
      })

      const recentPipelines = await prisma.recruitmentPipeline.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, candidateName: true, stage: true, updatedAt: true },
      })

      const recentInterviews = await prisma.interviewSession.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, candidateName: true, status: true, updatedAt: true },
      })

      return reply.status(200).send({
        stats: { resumeCount, pipelineCount, interviewCount, jobCount, candidateCount },
        recent: { resumes: recentResumes, pipelines: recentPipelines, interviews: recentInterviews },
      })
    } catch (error: any) {
      request.log.error(`[dashboard] error: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /enterprise/dashboard/report — 招聘报告（维护中） ───
  fastify.get('/enterprise/dashboard/report', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'dashboard', status: 'maintenance' })
  })
}
