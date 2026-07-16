/**
 * Enterprise Foundation Layer — 企业数字部门底座 API
 * 
 * Sprint 4.2.7: 补齐产品底座 - 企业资料 + AI模型 + Onboarding
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { enterpriseProfileService } from '../services/enterprise/organization/enterprise-profile.service.js'
import { aiProviderConfigService } from '../services/enterprise/organization/ai-provider-config.service.js'
import { testProviderConnection } from '../services/enterprise/organization/ai-provider-config.service.js'

export async function enterpriseFoundationRoutes(app: FastifyInstance) {
  // ─── Enterprise Profile ─────────────────────────────────

  // Get enterprise profile with stats
  app.get('/api/enterprise-foundation/:orgId/profile', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const profile = await enterpriseProfileService.getWithStats(orgId)
      return { success: true, data: profile }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Update enterprise profile
  app.put('/api/enterprise-foundation/:orgId/profile', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const profile = await enterpriseProfileService.upsert({ organizationId: orgId, ...req.body as any })
      return { success: true, data: profile }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Get onboarding readiness
  app.get('/api/enterprise-foundation/:orgId/onboarding', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const readiness = await enterpriseProfileService.getReadiness(orgId)
      return { success: true, data: readiness }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Advance onboarding step
  app.post('/api/enterprise-foundation/:orgId/onboarding/advance', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const { step } = req.body as { step: number }
      const profile = await enterpriseProfileService.advanceOnboarding(orgId, step)
      return { success: true, data: profile }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── AI Provider Config ─────────────────────────────────

  // List AI providers
  app.get('/api/enterprise-foundation/:orgId/ai-providers', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const providers = await aiProviderConfigService.listForOrganization(orgId)
      return { success: true, data: providers }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Add AI provider
  app.post('/api/enterprise-foundation/:orgId/ai-providers', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const config = await aiProviderConfigService.create({ organizationId: orgId, ...req.body as any })
      return { success: true, data: config }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Toggle provider
  app.patch('/api/enterprise-foundation/:orgId/ai-providers/:providerId/toggle', async (req, reply) => {
    try {
      const { providerId } = req.params as { providerId: string }
      const result = await aiProviderConfigService.toggleEnabled(providerId)
      return { success: true, data: result }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Remove provider
  app.delete('/api/enterprise-foundation/:orgId/ai-providers/:providerId', async (req, reply) => {
    try {
      const { providerId } = req.params as { providerId: string }
      await aiProviderConfigService.remove(providerId)
      return { success: true }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Get supported model providers (static list)
  app.get('/api/enterprise-foundation/ai-providers/supported', async (_req, reply) => {
    try {
      const providers = aiProviderConfigService.getSupportedProviders()
      return { success: true, data: providers }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Test AI provider connection (BYOK verification)
  app.post('/api/enterprise-foundation/:orgId/ai-providers/:providerId/test', async (req, reply) => {
    try {
      const { providerId } = req.params as { providerId: string }
      const config = await prisma.aIProviderConfig.findUnique({ where: { id: providerId } })
      if (!config) {
        return reply.status(404).send({ success: false, message: '配置不存在' })
      }

      // Decrypt API key
      const decryptedKey = aiProviderConfigService.decryptKey(config.encryptedApiKey)

      // Dispatch test by provider
      const result = await testProviderConnection(config.provider, decryptedKey, config.baseUrl, config.model)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message })
    }
  })
}