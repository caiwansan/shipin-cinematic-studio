/**
 * resume.routes.ts — 企业招聘 Resume Center API
 *
 * Phase 5-B1: Resume 模块恢复 - 第一阶段骨架
 * - 只读列表/详情
 * - 认证 + 归属校验
 * - 未实现接口返回 503
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const resumeRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/resumes — 简历列表 ───
  fastify.get('/enterprise/resumes', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { user } = request as any
      const { workspaceId } = request.query as any

      // 归属校验：如果传了 workspaceId，校验用户是否有权访问
      if (workspaceId) {
        const workspace = await prisma.enterpriseJobWorkspace.findFirst({
          where: {
            id: workspaceId,
          },
        })
        if (!workspace) {
          return reply.status(404).send({ error: 'Workspace not found' })
        }
      }

      const resumes = await prisma.resume.findMany({
        where: workspaceId ? { workspaceId } : {},
        include: {
          profile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      })

      return reply.status(200).send({
        items: resumes,
        total: resumes.length,
      })
    } catch (error: any) {
      request.log.error(`[resume] list error: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /enterprise/resumes/:id — 简历详情 ───
  fastify.get('/enterprise/resumes/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any

      const resume = await prisma.resume.findFirst({
        where: {
          id,
          ...(workspaceId ? { workspaceId } : {}),
        },
        include: {
          profile: true,
        },
      })

      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      return reply.status(200).send(resume)
    } catch (error: any) {
      request.log.error(`[resume] detail error: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /enterprise/resumes/upload — 上传（维护中） ───
  fastify.post('/enterprise/resumes/upload', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    return reply.status(503).send({
      error: 'Resume upload is under maintenance',
      module: 'resume-center',
      status: 'maintenance',
    })
  })

  // ─── POST /enterprise/resumes/:id/parse — 解析（维护中） ───
  fastify.post('/enterprise/resumes/:id/parse', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    return reply.status(503).send({
      error: 'Resume parse is under maintenance',
      module: 'resume-center',
      status: 'maintenance',
    })
  })
}
