/**
 * S3.1 Skill Catalog API - read-only (list/detail/mapping)
 * Based on: KUNLUN-S3-SKILL-SYSTEM-DESIGN-GATE.md
 * No execution / mutation / permission bypass
 */
import type { FastifyInstance } from 'fastify'
import { listSkills, getSkill, verifyAgentDefinitionMapping } from '../ecosystem/skill-manifest-adapter.js'

export async function registerSkillCatalogRoutes(app: FastifyInstance) {
  // Skill list (read-only)
  app.get('/api/skills', async (_request: any, reply: any) => {
    try {
      const skills = await listSkills()
      return reply.send({ code: 0, data: { skills } })
    } catch (e: any) {
      _request.log.error(e, 'skills list failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // Skill detail (read-only)
  app.get('/api/skills/:id', async (request: any, reply: any) => {
    try {
      const skill = await getSkill(request.params.id)
      if (!skill) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      return reply.send({ code: 0, data: skill })
    } catch (e: any) {
      request.log.error(e, 'skill detail failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // AgentDefinition mapping (read-only)
  app.get('/api/skills/mapping/agent-definitions', async (_request: any, reply: any) => {
    try {
      const mapping = await verifyAgentDefinitionMapping()
      return reply.send({ code: 0, data: mapping })
    } catch (e: any) {
      _request.log.error(e, 'skill mapping failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
