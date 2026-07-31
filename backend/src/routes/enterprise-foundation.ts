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
import { getEnterpriseContext } from '../repositories/recruitment/enterprise-member.repository.js'

export async function enterpriseFoundationRoutes(app: FastifyInstance) {

  // GET /api/enterprise/foundation/workspace — 获取当前用户企业的招聘 workspaceId
  app.get('/enterprise/foundation/workspace', async (request, reply) => {
    try {
      const userId = (request.user as any)?.id
      if (!userId) {
        return reply.status(401).send({ success: false, error: '未授权' })
      }
      const context = await getEnterpriseContext(userId)
      if (!context) {
        return reply.status(200).send({ success: true, data: { workspaceId: null } })
      }
      const workspace = await prisma.enterpriseJobWorkspace.findFirst({
        where: { enterpriseId: context.enterpriseId },
      })
      return reply.send({ success: true, data: { workspaceId: workspace?.id || null } })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })
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
  // ⚠️ DEPRECATED（SPRINT-KMKI-AUDIT-02）：AIProviderConfig 表违反 KMKI AI Runtime Principle（双轨断裂）
  // 唯一权威：/api/enterprise/model-config（OrgModelConfig + ProviderCredential，企业 BYOK）
  // 写操作全部拒绝（防止死表继续写入）；读操作仅兼容存量

  // List AI providers
  app.get('/api/enterprise-foundation/:orgId/ai-providers', async (req, reply) => {
    try {
      const { orgId } = req.params as { orgId: string }
      const providers = await aiProviderConfigService.listForOrganization(orgId)
      return { success: true, data: providers, deprecated: true, hint: '请使用 /api/enterprise/model-config' }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Add AI provider — DEPRECATED: 拒绝写入（旧前端会得到明确指引）
  app.post('/api/enterprise-foundation/:orgId/ai-providers', async (_req, reply) => {
    return reply.status(410).send({
      success: false,
      error: '该接口已停用（KMKI AI Runtime Principle：平台不托管企业 Key）。请改用 PUT /api/enterprise/model-config 保存企业模型设置。',
      deprecated: true,
    })
  })

  // Toggle provider — DEPRECATED: 拒绝
  app.patch('/api/enterprise-foundation/:orgId/ai-providers/:providerId/toggle', async (_req, reply) => {
    return reply.status(410).send({ success: false, error: '该接口已停用，请使用 /api/enterprise/model-config', deprecated: true })
  })

  // Remove provider — DEPRECATED: 拒绝
  app.delete('/api/enterprise-foundation/:orgId/ai-providers/:providerId', async (_req, reply) => {
    return reply.status(410).send({ success: false, error: '该接口已停用，请使用 DELETE /api/enterprise/model-config/:provider', deprecated: true })
  })

  // Get supported model providers (static list, 平台层 Provider Registry 信息)
  app.get('/api/enterprise-foundation/ai-providers/supported', async (_req, reply) => {
    try {
      const providers = aiProviderConfigService.getSupportedProviders()
      return { success: true, data: providers }
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Test AI provider connection — DEPRECATED: 拒绝（改用 /api/enterprise/model-config/test）
  app.post('/api/enterprise-foundation/:orgId/ai-providers/:providerId/test', async (_req, reply) => {
    return reply.status(410).send({ success: false, error: '该接口已停用，请使用 POST /api/enterprise/model-config/test', deprecated: true })
  })
}