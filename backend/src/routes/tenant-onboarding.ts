/**
 * routes/tenant-onboarding.ts — BETA-06.9.5 Tenant Onboarding
 * 
 * 创建企业空间，建立 User → GovUser → Tenant → GovOrganization 链路。
 * 这是新用户的入口，必须先创建企业才能使用新媒体运营功能。
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function registerTenantOnboardingRoutes(app: FastifyInstance) {
  
  // POST /api/enterprise/onboarding/create-organization
  // 为新用户创建企业空间
  app.post('/api/enterprise/onboarding/create-organization', async (request, reply) => {
    try {
      let userId: string | undefined
      let email: string | undefined

      // 先尝试 Tenant Guard 注入的上下文
      const ctx = (request as any).tenantContext
      if (ctx) {
        userId = ctx.userId
        email = ctx.email
      }

      // 回退到 JWT 验证
      if (!userId) {
        try {
          const payload = await (request as any).jwtVerify() as any
          userId = payload.id
          email = payload.email
        } catch {
          return reply.status(401).send({ code: 401, message: 'Unauthorized' })
        }
      }

      if (!userId || !email) {
        return reply.status(401).send({ code: 401, message: 'Invalid token' })
      }

      const { name, industry, description } = request.body as any

      if (!name || name.trim().length < 2) {
        return reply.status(400).send({ code: 400, message: '企业名称至少需要2个字符' })
      }

      // 检查用户是否已有组织
      const existingGovUser = await prisma.govUser.findFirst({
        where: { email },
        select: { tenantId: true },
      })

      if (existingGovUser?.tenantId) {
        const existingOrg = await prisma.govOrganization.findFirst({
          where: { tenantId: existingGovUser.tenantId },
          select: { id: true, name: true },
        })
        if (existingOrg) {
          // 更新已有组织名称（如果之前是自动生成的）
          if (existingOrg.name !== name) {
            await prisma.govOrganization.update({
              where: { id: existingOrg.id },
              data: { name },
            })
          }
          return reply.send({
            code: 0,
            data: {
              organization: { id: existingOrg.id, name, isNew: false },
              message: '企业信息已更新',
            },
          })
        }
      }

      // 创建新组织
      // Step 1: 创建 Tenant
      const tenant = await prisma.tenant.create({
        data: { name, type: 'enterprise' },
      })

      // Step 2: 创建 Governance Organization
      const org = await prisma.govOrganization.create({
        data: {
          name,
          tenantId: tenant.id,
          type: 'enterprise',
          departmentRole: 'ai_department',
          status: 'active',
          metadata: JSON.stringify({
            industry: industry || '',
            description: description || '',
            initialized: true,
            initializedAt: new Date().toISOString(),
          }),
        },
      })

      // Step 3: 创建/更新 GovUser 关联
      if (existingGovUser) {
        await prisma.govUser.update({
          where: { id: existingGovUser.id },
          data: { tenantId: tenant.id },
        })
      } else {
        await prisma.govUser.create({
          data: {
            email,
            tenantId: tenant.id,
            username: email.split('@')[0],
            status: 'active',
            govRole: 'owner',
          },
        })
      }

      return reply.send({
        code: 0,
        data: {
          organization: { id: org.id, name, isNew: true },
          message: '企业创建成功',
        },
      })
    } catch (err: any) {
      console.error('[Onboarding] Error:', err)
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })
}
