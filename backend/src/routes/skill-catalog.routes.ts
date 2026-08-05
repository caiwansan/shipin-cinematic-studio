/**
 * S3.1 Skill Catalog API — 只读（list/detail/mapping）
 * 依据: KUNLUN-S3-SKILL-SYSTEM-DESIGN-GATE.md
 * 禁止: 执行/修改/权限绕过
 */
import type { FastifyInstance } from 'fastify'
import { listSkills, getSkill, verifyAgentDefinitionMapping } from '../ecosystem/skill-manifest-adapter.js'

export async function registerSkillCatalogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Skill 列表（只读）
  app.get('/skills', async (_request: any, reply: any) => {
    try {
      const skills = await listSkills()
      return reply.send({ code: 0, data: { skills } })
    } catch (e: any) {
      _request.log.error(e, 'skills list failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // Skill 详情（只读）
  app.get('/skills/:id', async (request: any, reply: any) => {
    try {
      const skill = await getSkill(request.params.id)
      if (!skill) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      return reply.send({ code: 0, data: skill })
    } catch (e: any) {
      request.log.error(e, 'skill detail failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // AgentDefinition 映射验证（只读，SG4）
  app.get('/skills/mapping/agent-definitions', async (_request: any, reply: any) => {
    try {
      const mapping = await verifyAgentDefinitionMapping()
      return reply.send({ code: 0, data: mapping })
    } catch (e: any) {
      _request.log.error(e, 'skill mapping failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
