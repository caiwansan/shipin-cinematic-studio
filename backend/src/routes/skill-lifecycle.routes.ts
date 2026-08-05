/**
 * S3.2.1 Skill Lifecycle API — 只读（GET /api/skills/:id/lifecycle）
 * 依据: S3.2.1 掌柜批准 Task 02
 * 禁止: 执行/修改/权限绕过（Lifecycle != Permission, SL3；Lifecycle != Execution, SL4）
 */
import type { FastifyInstance } from 'fastify'
import { getSkillLifecycle } from '../ecosystem/skill-lifecycle-adapter.js'

export async function registerSkillLifecycleRoutes(app: FastifyInstance) {
  // Skill 生命周期视图（只读）
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
}
