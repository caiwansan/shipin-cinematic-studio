/**
 * Plan & Subscription API — BETA-06.7.2 P0-2
 * 
 * 套餐管理：前端从数据库读取，不再写死
 * 管理员可修改套餐参数
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function registerPlanRoutes(app: FastifyInstance) {
  // ─── 公开：获取可用套餐列表 ───
  app.get('/api/plans', async (request, reply) => {
    try {
      const plans = await prisma.$queryRaw`
        SELECT id, name, display_name, description, price, yearly_price,
               max_employees, max_channels, max_members, features, agent_bundle, sort_order
        FROM enterprise_plan
        WHERE enabled = true
        ORDER BY sort_order ASC, price ASC
      ` as any[]

      return reply.send({
        code: 0,
        data: plans.map((p: any) => ({
          id: p.id,
          name: p.name,
          displayName: p.display_name,
          description: p.description,
          priceMonthly: p.price,
          priceYearly: p.yearly_price,
          maxEmployees: p.max_employees,
          maxChannels: p.max_channels,
          maxMembers: p.max_members,
          features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features || [],
          agentBundle: typeof p.agent_bundle === 'string' ? JSON.parse(p.agent_bundle) : p.agent_bundle || [],
          sortOrder: p.sort_order,
        })),
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── 管理员：获取所有套餐（含禁用的） ───
  app.get('/api/admin/plans', async (request, reply) => {
    try {
      // 此处可加 admin 权限校验
      const plans = await prisma.$queryRaw`
        SELECT id, name, display_name, description, price, yearly_price,
               max_employees, max_channels, max_members, features, sort_order, enabled
        FROM enterprise_plan
        ORDER BY sort_order ASC, price ASC
      ` as any[]

      return reply.send({ code: 0, data: plans })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── 管理员：创建/更新套餐 ───
  app.post('/api/admin/plans', async (request, reply) => {
    try {
      const { id, name, displayName, description, price, yearlyPrice, maxEmployees, maxChannels, maxMembers, features, enabled, sortOrder } = request.body as any

      if (!name || !displayName) {
        return reply.status(400).send({ code: 400, message: 'name and displayName required' })
      }

      if (id) {
        // 更新
        await prisma.$queryRaw`
          UPDATE enterprise_plan SET
            name = ${name},
            display_name = ${displayName},
            description = ${description || ''},
            price = ${price || 0},
            yearly_price = ${yearlyPrice || 0},
            max_employees = ${maxEmployees || 2},
            max_channels = ${maxChannels || 1},
            max_members = ${maxMembers || 5},
            features = ${JSON.stringify(features || [])},
            sort_order = ${sortOrder || 0},
            enabled = ${enabled !== false},
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `
        return reply.send({ code: 0, data: { id, updated: true } })
      } else {
        // 创建
        const newId = crypto.randomUUID()
        await prisma.$queryRaw`
          INSERT INTO enterprise_plan (id, name, display_name, description, price, yearly_price, max_employees, max_channels, max_members, features, sort_order, enabled)
          VALUES (${newId}, ${name}, ${displayName}, ${description || ''}, ${price || 0}, ${yearlyPrice || 0}, ${maxEmployees || 2}, ${maxChannels || 1}, ${maxMembers || 5}, ${JSON.stringify(features || [])}, ${sortOrder || 0}, ${enabled !== false})
        `
        return reply.send({ code: 0, data: { id: newId, created: true } })
      }
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── 管理员：删除套餐 ───
  app.delete('/api/admin/plans/:id', async (request, reply) => {
    try {
      const { id } = request.params as any
      await prisma.$queryRaw`DELETE FROM enterprise_plan WHERE id = ${id}::uuid`
      return reply.send({ code: 0, data: { deleted: true } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })
}
