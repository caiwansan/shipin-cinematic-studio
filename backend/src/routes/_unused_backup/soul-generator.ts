/**
 * SOUL.md Generator Routes — ER-04-TASK-02
 * AI Employee Persona Template API
 *
 * POST /api/enterprise/soul-generator/generate  → 生成 SOUL.md
 * GET  /api/enterprise/soul-generator/:agentId   → 获取 SOUL.md
 * POST /api/enterprise/soul-generator/preview    → 预览 (不保存)
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { soulGeneratorService } from '../services/enterprise/soul-generator.service.js'
import { hermesProfileService } from '../services/enterprise/hermes-profile.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function soulGeneratorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/soul-generator/generate
   * 生成 SOUL.md 并保存到 Binding
   */
  app.post('/generate', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, agentType } = body

      let soul
      if (agentId) {
        soul = await soulGeneratorService.generateSoul(orgId, agentId)
      } else if (agentType) {
        soul = await soulGeneratorService.generateSoulByType(orgId, agentType)
      } else {
        soul = await soulGeneratorService.generateSoul(orgId)
      }

      // 保存到 Binding
      await hermesProfileService.updateSoulContent(orgId, soul.raw)

      return reply.send({ code: 0, data: soul })
    } catch (error: any) {
      if (error.message === 'AGENT_NOT_FOUND') {
        return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' })
      }
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/soul-generator/:agentId
   * 获取已保存的 SOUL.md
   */
  app.get('/:agentId', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const binding = await hermesProfileService.getBindingByOrg(orgId)
      if (!binding?.soulMdContent) {
        return reply.status(404).send({ code: 404, message: 'SOUL_NOT_FOUND' })
      }

      return reply.send({
        code: 0,
        data: {
          agentId: request.params,
          soulMdContent: binding.soulMdContent,
          hermesProfileId: binding.hermesProfileId,
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/soul-generator/preview
   * 预览 SOUL.md (不保存)
   */
  app.post('/preview', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, agentType } = body

      let soul
      if (agentId) {
        soul = await soulGeneratorService.generateSoul(orgId, agentId)
      } else if (agentType) {
        soul = await soulGeneratorService.generateSoulByType(orgId, agentType)
      } else {
        soul = await soulGeneratorService.generateSoul(orgId)
      }

      return reply.send({ code: 0, data: soul })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
