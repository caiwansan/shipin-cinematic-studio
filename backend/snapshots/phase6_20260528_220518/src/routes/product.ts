/**
 * G1/G4 Onboarding + Pricing API
 *
 * 用户引导流程 + 定价积分系统
 * 集成已有 member.ts 和 User.memberTier
 */

import { FastifyInstance } from 'fastify'
import { templateRegistry } from '../services/template-registry.js'
import { jobUXLayer } from '../services/job-ux-layer.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { prisma } from '../utils/index.js'

const PLANS = [
  { id: 'free', name: '免费版', dailyLimit: 1, watermark: true, maxDuration: 15, concurrentJobs: 1, price: 0 },
  { id: 'pro', name: '专业版', dailyLimit: 20, watermark: false, maxDuration: 60, concurrentJobs: 3, price: 9900 },
  { id: 'studio', name: '工作室版', dailyLimit: 100, watermark: false, maxDuration: 180, concurrentJobs: 10, price: 29900 },
  { id: 'enterprise', name: '企业版', dailyLimit: 9999, watermark: false, maxDuration: 600, concurrentJobs: 50, price: 99900 },
]

export default async function productRoutes(fastify: FastifyInstance) {
  // G4: 定价计划
  fastify.get('/api/v1/product/plans', async (_request, reply) => {
    return RuntimeValidator.ok(PLANS)
  })

  // G4: 用户当前配额
  fastify.get('/api/v1/product/quota/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as any
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { memberTier: true, coins: true },
      })
      if (!user) return RuntimeValidator.fail({ code: 'USER_NOT_FOUND', message: '用户不存在' })

      const plan = PLANS.find(p => p.id === user.memberTier) || PLANS[0]

      // 今日已用（从 InvocationLog 统计）
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayUsage = await prisma.invocationLog.count({
        where: {
          userId,
          createdAt: { gte: todayStart },
          operationType: { startsWith: 'ai:' },
          status: { not: 'failed' },
        },
      })

      return RuntimeValidator.ok({
        tier: user.memberTier,
        dailyLimit: plan.dailyLimit,
        todayUsed: todayUsage,
        dailyRemaining: Math.max(0, plan.dailyLimit - todayUsage),
        coins: user.coins,
        watermark: plan.watermark,
        maxDuration: plan.maxDuration,
        concurrentJobs: plan.concurrentJobs,
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // G1: 用户引导流程——推荐模板
  fastify.get('/api/v1/product/onboarding/templates', async (_request, reply) => {
    const templates = templateRegistry.list()
    return RuntimeValidator.ok(templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      estimatedDuration: t.estimatedDuration,
      requiredFields: t.requiredFields,
      minPlan: t.minPlan,
    })))
  })

  // G3: 任务体验——获取 UI 友好状态
  fastify.get('/api/v1/product/job/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params as any
      const jobUI = await jobUXLayer.getJobUI(jobId)
      if (!jobUI) {
        return RuntimeValidator.fail({ code: 'JOB_NOT_FOUND', message: '任务不存在' })
      }
      return RuntimeValidator.ok(jobUI)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // G2: 模板——获取填充后的 prompt
  fastify.post('/api/v1/product/template/fill', async (request, reply) => {
    try {
      const { templateId, fields } = request.body as any
      const filled = templateRegistry.fillPrompt(templateId, fields)
      return RuntimeValidator.ok({ prompt: filled })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // G2: 模板列表
  fastify.get('/api/v1/product/templates', async (_request, reply) => {
    return RuntimeValidator.ok(templateRegistry.list())
  })
}
