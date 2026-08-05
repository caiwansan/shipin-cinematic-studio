/**
 * S3.3.1 Skill Orchestrator API（Cloud Control Plane, 只编排不执行）
 * - GET  /api/skills/employees/:code/skills   员工 Skill Set 绑定视图（OC1）
 * - POST /api/skills/plans/execute             多 Skill 编排执行（生成→授权→Hermes→聚合→审计）
 * 原则:
 *  - Planner = Cloud 本层（OC-0.1）; SkillPlan = 纯内存运行时 DAG（OC-0.2, 不入库）
 *  - 每 Skill 独立授权（OC2/OC-0.3）; Hermes 原子执行（OC3）
 */
import type { FastifyInstance } from 'fastify'
import { getEmployeeSkillSet, executeSkillPlan } from '../ecosystem/skill-orchestrator.js'

export async function registerSkillOrchestratorRoutes(app: FastifyInstance) {
  // OC1: 多 Skill 绑定视图（只读）
  app.get('/api/skills/employees/:code/skills', async (request: any, reply: any) => {
    try {
      const view = await getEmployeeSkillSet(request.params.code)
      if (!view) return reply.code(404).send({ error: 'EMPLOYEE_NOT_FOUND' })
      return reply.send({ code: 0, data: view })
    } catch (e: any) {
      request.log.error(e, 'employee skill set failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // S3.3.1: 编排执行（SkillPlan 运行时对象, 请求内即弃）
  app.post('/api/skills/plans/execute', async (request: any, reply: any) => {
    try {
      const body = request.body || {}
      if (!Array.isArray(body.steps) || body.steps.length === 0) {
        return reply.code(400).send({ error: 'INVALID_PLAN', message: 'steps required' })
      }
      const result = await executeSkillPlan({
        employeeDefinitionId: body.employeeDefinitionId ?? null,
        steps: body.steps,
        fallback: body.fallback,
      })
      if (result.errors.length) {
        return reply.code(400).send({ error: 'INVALID_PLAN', errors: result.errors })
      }
      return reply.send({ code: 0, data: result.plan })
    } catch (e: any) {
      request.log.error(e, 'skill plan execute failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
