/**
 * S3.4.1-BLOCKED Task 02 — Skill Asset Delivery API（D4: 每任务）
 * POST /api/skills/assets/deliver
 *   输入: { userId, taskId?, title?, profile, quality? }
 *   输出: { taskId, files, assets, userAssets }
 * 说明: 当前 userId 由 body 传入（内部演示阶段）; S3.4.2 起改为 JWT 解析
 */
import type { FastifyInstance } from 'fastify'
import { deliverSkillAssets } from '../ecosystem/skill-asset.service.js'

export async function registerSkillAssetsRoutes(app: FastifyInstance) {
  app.post('/api/skills/assets/deliver', async (request: any, reply: any) => {
    try {
      const body = request.body || {}
      if (!body.userId || !body.profile) {
        return reply.code(400).send({ error: 'USER_ID_AND_PROFILE_REQUIRED' })
      }
      const result = await deliverSkillAssets({
        userId: body.userId,
        taskId: body.taskId ?? undefined,
        title: body.title ?? undefined,
        profile: body.profile,
        quality: body.quality ?? undefined,
      })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      request.log.error(e, 'skill assets deliver failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
