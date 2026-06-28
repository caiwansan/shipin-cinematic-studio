/**
 * F4/F5 Multi-Tenant & Permission API
 *
 * Organization / Workspace CRUD + Permission Graph
 * 集成已有 User / Project 系统
 */

import { FastifyInstance } from 'fastify'
import { permissionGraphEngine } from '../services/permission-graph.engine.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { prisma } from '../utils/index.js'

export default async function tenantRoutes(fastify: FastifyInstance) {
  // ─── Org ───

  // 创建组织
  fastify.post('/api/v1/org', async (request, reply) => {
    try {
      const { name, userId } = request.body as any
      const org = await prisma.organization.create({
        data: { name },
      })
      // 创建者自动成为 owner
      await prisma.orgMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: 'owner',
        },
      })
      return RuntimeValidator.ok(org)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取用户所在组织列表
  fastify.get('/api/v1/orgs/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as any
      const graph = await permissionGraphEngine.getUserPermissionGraph(userId)
      return RuntimeValidator.ok(graph.organizations)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 加入组织
  fastify.post('/api/v1/org/:orgId/member', async (request, reply) => {
    try {
      const { orgId } = request.params as any
      const { userId, role } = request.body as any
      const member = await prisma.orgMember.create({
        data: { organizationId: orgId, userId, role: role || 'member' },
      })
      return RuntimeValidator.ok(member)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── Workspace ───

  // 创建工作区
  fastify.post('/api/v1/workspace', async (request, reply) => {
    try {
      const { organizationId, name } = request.body as any
      const ws = await prisma.workspace.create({
        data: { organizationId, name },
      })
      return RuntimeValidator.ok(ws)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取组织下的工作区
  fastify.get('/api/v1/workspaces/:orgId', async (request, reply) => {
    try {
      const { orgId } = request.params as any
      const workspaces = await prisma.workspace.findMany({
        where: { organizationId: orgId },
      })
      return RuntimeValidator.ok(workspaces)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 将项目移到工作区
  fastify.post('/api/v1/project/:projectId/assign-workspace', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const { workspaceId } = request.body as any
      await prisma.project.update({
        where: { id: projectId },
        data: { workspaceId } as any,
      })
      return RuntimeValidator.ok({ projectId, workspaceId })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── Permission Graph ───

  // 获取用户权限图
  fastify.get('/api/v1/permissions/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as any
      const graph = await permissionGraphEngine.getUserPermissionGraph(userId)
      return RuntimeValidator.ok(graph)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 权限检查
  fastify.post('/api/v1/permissions/check', async (request, reply) => {
    try {
      const { userId, resourceType, resourceId, requiredLevel } = request.body as any
      const allowed = await permissionGraphEngine.checkAccess({
        userId,
        resourceType: resourceType as any,
        resourceId,
        requiredLevel: requiredLevel as any,
      })
      return RuntimeValidator.ok({ allowed, userId, resourceType, resourceId })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
