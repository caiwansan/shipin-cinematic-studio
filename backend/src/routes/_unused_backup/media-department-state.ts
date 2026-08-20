/**
 * Media Department State API — BETA-06.9.5 SaaS Isolation (patched)
 * 
 * 用户进入 /media-department 后的单一状态入口。
 * BETA-06.9.5 修复：
 *   - 使用 Tenant Guard 注入的 orgId（governance_organization.id）
 *   - 禁止硬编码企业 ID
 *   - 无组织用户 → requiresOnboarding: true + 前端引导创建
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function registerMediaDepartmentStateRoutes(app: FastifyInstance) {
  // Tenant Guard 已在 index.ts 全局注册，自动注入 request.tenantContext

  app.get('/api/enterprise/media-department/state', async (request, reply) => {
    try {
      const ctx = (request as any).tenantContext

      // 无组织 → 新用户引导
      if (!ctx) {
        return reply.send({
          code: 0,
          data: {
            hasOrganization: false,
            requiresOnboarding: true,
            message: '欢迎进入 AI 新媒体运营部门，创建你的第一个企业空间',
          }
        })
      }

      const orgId = ctx.orgId  // governance_organization.id
      const orgName = ctx.orgName
      const role = ctx.role

      // 查询订阅（按 orgId 直接查，处理 string/UUID 两种 ID 体系）
      let sub: any = null
      try {
        const subs = await prisma.$queryRaw`
          SELECT es.id as sub_id, es.status as sub_status,
                 es.snapshot_name, es.snapshot_max_employees, es.snapshot_max_channels
          FROM enterprise_subscription es
          WHERE es.organization_id = ${orgId} AND es.status = 'active'
          ORDER BY es.created_at DESC
          LIMIT 1
        ` as any[]
        sub = subs?.[0]
      } catch (e) {
        // 旧体系 orgId 可能不在 enterprise_subscription 表中
        console.warn('[StateAPI] Subscription lookup failed for orgId:', orgId)
      }

      // AI 员工数量（按 orgId 隔离）
      const agentCounts = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM enterprise_agent_instance
        WHERE tenant_id = ${orgId}
      ` as any[]

      // 已连接平台（按 orgId 隔离）
      const platforms = await prisma.$queryRaw`
        SELECT platform, account_name, status FROM media_platform_account
        WHERE organization_id = ${orgId}
        AND status = 'active'
      ` as any[]

      return reply.send({
        code: 0,
        data: {
          hasOrganization: true,
          requiresOnboarding: false,
          organization: {
            id: orgId,
            name: orgName || '我的企业',
            role: role || 'OWNER',
          },
          subscription: sub ? {
            id: sub.sub_id,
            planName: sub.snapshot_name || '免费版',
            status: sub.sub_status || 'active',
            maxEmployees: sub.snapshot_max_employees || 3,
            maxChannels: sub.snapshot_max_channels || 5,
          } : {
            planName: '免费版',
            status: 'active',
            maxEmployees: 1,
            maxChannels: 2,
          },
          agents: {
            count: Number(agentCounts?.[0]?.count || 0),
            max: sub?.snapshot_max_employees || 1,
          },
          platforms: platforms.map((p: any) => ({
            platform: p.platform,
            accountName: p.account_name,
            status: p.status,
          })),
        }
      })
    } catch (e: any) {
      console.error('[StateAPI] Error:', e)
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })
}
