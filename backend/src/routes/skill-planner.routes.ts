/**
 * S3.4.2-A Skill Planner API（Cloud, 只生成草稿不执行）
 * POST /api/skills/plans/from-intent { employeeDefinitionId, intent, fallback?, context? }
 *  → { code, data: { ok, plan?, goal?, errors? } }
 * 执行仍走既有 POST /api/skills/plans/execute（无新增执行路径, PL3）
 */
import type { FastifyInstance } from 'fastify'
import { planFromIntent } from '../ecosystem/skill-planner.service.js'

export async function registerSkillPlannerRoutes(app: FastifyInstance) {
  app.post('/api/skills/plans/from-intent', async (request: any, reply: any) => {
    try {
      const body = request.body || {}
      if (!body.employeeDefinitionId || !body.intent) {
        return reply.code(400).send({ error: 'EMPLOYEE_AND_INTENT_REQUIRED' })
      }
      const result = await planFromIntent({
        employeeDefinitionId: body.employeeDefinitionId,
        intent: String(body.intent),
        fallback: body.fallback,
        context: body.context,
        tenantUserId: body.tenantUserId ?? undefined,
      })
      if (!result.ok) {
        return reply.send({ code: 0, data: { ok: false, goal: result.goal, errors: result.errors } })
      }
      return reply.send({ code: 0, data: { ok: true, plan: result.plan, goal: result.goal, errors: [] } })
    } catch (e: any) {
      request.log.error(e, 'plan from intent failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
