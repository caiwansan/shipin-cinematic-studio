/**
 * S3.2.1 + S3.2.2 Skill Lifecycle & Authorization API — 只读
 * - GET /api/skills/:id/lifecycle       生命周期视图（S3.2.1）
 * - GET /api/skills/:id/authorization   授权判定（S3.2.2, Agent/Org 上下文）
 * 禁止: 执行/修改/权限绕过（Lifecycle != Permission, SL3；Lifecycle != Execution, SL4）
 * 鉴权: handler 级 jwtVerify（无 hook，兼容 tsx 运行时的既有 skill 路由模式）
 */
import type { FastifyInstance } from 'fastify'
import { getSkillLifecycle } from '../ecosystem/skill-lifecycle-adapter.js'
import { authorizeSkill } from '../ecosystem/skill-authorization-adapter.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function registerSkillLifecycleRoutes(app: FastifyInstance) {
  // Skill 生命周期视图（只读，上下文无关）
  app.get('/api/skills/:id/lifecycle', async (request: any, reply: any) => {
    try {
      const lifecycle = await getSkillLifecycle(request.params.id)
      if (!lifecycle) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      return reply.send({ code: 0, data: lifecycle })
    } catch (e: any) {
      request.log.error(e, 'skill lifecycle failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // Skill 授权判定（只读，S3.2.2）
  // query: agentDefinitionId?（越权 Agent 判定, SA4）；org 由 JWT 解析（G8 隔离）
  app.get('/api/skills/:id/authorization', async (request: any, reply: any) => {
    try {
      let userId: string | null = null
      let organizationId: string | null = null
      try {
        await request.jwtVerify()
        userId = request.user?.id ?? null
      } catch {
        // 无 token: 上下文无关判定（org 级 License 检查退化为任意 org）
      }
      if (userId) {
        organizationId = await getOrganizationIdForUser(userId).catch(() => null)
      }
      const result = await authorizeSkill({
        skillId: request.params.id,
        agentDefinitionId: request.query?.agentDefinitionId ?? null,
        organizationId,
        userId,
      })
      if (!result) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      request.log.error(e, 'skill authorization failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
