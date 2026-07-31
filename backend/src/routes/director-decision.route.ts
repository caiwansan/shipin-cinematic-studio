/**
 * routes/director-decision.route.ts
 *
 * AI 导演决策路由
 *
 * POST  /api/director/assets/:assetId/decision
 *   基于质量观察报告生成导演建议
 *
 * POST  /api/director/decisions/:decisionId/confirm
 *   用户确认/拒绝导演建议 + 执行桥接（Task 02.3）
 *
 * GET   /api/director/assets/:assetId/decision
 *   查询决策历史
 *
 * 设计原则：
 *   ❌ Decision 不调用 Provider
 *   ❌ Decision 不修改 Asset
 *   ❌ 所有建议 requiresConfirmation=true
 *   ❌ 状态可追踪（pending → confirmed | rejected）
 *   ❌ 确认后执行必须经过 ExecutionAdapter → Task Runtime
 *   ❌ 越权确认 401/403
 */

import { FastifyInstance } from 'fastify'
import { observeAsset } from '../services/director/asset-quality-observer.service.js'
import { generateDecision } from '../services/director/director-decision-generator.service.js'
import {
  executeDecision,
  createDecisionTaskSubmitter,
} from '../services/director/decision-execution-adapter.service.js'
import type { DirectorDecisionContract } from '../types/director-decision-contract.js'
import { prisma } from '../utils/index.js'

export default async function directorDecisionRoutes(app: FastifyInstance) {
  // ── POST /api/director/assets/:assetId/decision ──
  // 基于质量观察生成导演决策建议
  app.post('/api/director/assets/:assetId/decision', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { assetId } = req.params as { assetId: string }
    const userId = (req as any).user?.id || 'unknown'

    if (!assetId || assetId.length < 8) {
      return reply.status(400).send({
        success: false,
        error: '缺少有效的 assetId',
      })
    }

    try {
      // Step 1: 观察资产质量
      const report = await observeAsset(assetId)

      // Step 2: 生成导演决策
      const decision = await generateDecision(report, userId)

      // Step 3: 返回决策（不执行）
      return {
        success: true,
        decision: {
          id: decision.id,
          ownerId: decision.ownerId,
          assetId: decision.assetId,
          decisionType: decision.decisionType,
          reason: decision.reason,
          confidence: decision.confidence,
          suggestedAction: decision.suggestedAction,
          requiresConfirmation: decision.requiresConfirmation,
          status: decision.status,
          createdAt: decision.createdAt,
        },
      }
    } catch (err: any) {
      if (err.message === 'ASSET_NOT_FOUND' || err.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'ASSET_NOT_FOUND',
          message: `资产 ${assetId} 不存在`,
        })
      }
      if (err.message?.includes('Inconsistent column data') || err.message?.includes('invalid character')) {
        return reply.status(404).send({
          success: false,
          error: 'ASSET_NOT_FOUND',
          message: `资产 ID 格式无效: ${assetId}`,
        })
      }
      req.log.error(`[director-decision] decision failed for ${assetId}: ${err.message}`)
      return reply.status(500).send({
        success: false,
        error: 'DECISION_GENERATION_FAILED',
        message: err.message,
      })
    }
  })

  // ── POST /api/director/decisions/:decisionId/confirm ──
  // 用户确认/拒绝 → 权限检查 → 执行桥接 → Task Runtime
  app.post('/api/director/decisions/:decisionId/confirm', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { decisionId } = req.params as { decisionId: string }
    const body = req.body as { assetId: string; action: 'confirmed' | 'rejected'; note?: string }
    const userId = (req as any).user?.id || 'unknown'

    if (!decisionId || decisionId.length < 8) {
      return reply.status(400).send({
        success: false,
        error: '缺少有效的决策 ID',
      })
    }

    if (!body.assetId || body.assetId.length < 8) {
      return reply.status(400).send({
        success: false,
        error: '缺少 assetId',
      })
    }

    if (!body.action || !['confirmed', 'rejected'].includes(body.action)) {
      return reply.status(400).send({
        success: false,
        error: '无效的确认动作',
        message: 'action 必须为 confirmed 或 rejected',
      })
    }

    try {
      // ── Step 1: 从 TaskLog.metadata 查找决策 ──
      const logs = await prisma.taskLog.findMany({
        where: { taskId: body.assetId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      let foundContract: DirectorDecisionContract | null = null

      for (const log of logs) {
        const meta = log.metadata as any
        const raw = meta?.directorDecision
        if (raw?.id === decisionId) {
          // 从 metadata JSON 重建契约（JSON 可能缺少部分字段）
          foundContract = {
            id: raw.id,
            ownerId: raw.ownerId || '',
            assetId: raw.assetId || '',
            decisionType: raw.decisionType || 'regenerate',
            reason: raw.reason || '',
            confidence: raw.confidence || 50,
            suggestedAction: raw.suggestedAction || { description: '', affectedAssets: [] },
            requiresConfirmation: true as const,
            status: (raw.status as any) || 'pending',
            createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
          }
          break
        }
      }

      if (!foundContract) {
        return reply.status(404).send({
          success: false,
          error: 'DECISION_NOT_FOUND',
          message: `未找到决策 ${decisionId}（may be expired or never created）`,
        })
      }

      // ── Step 2: 权限检查（ownerId 匹配） ──
      if (foundContract.ownerId && foundContract.ownerId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'ACCESS_DENIED',
          message: '无权确认他人的导演建议',
        })
      }

      // ── Step 3: 用户拒绝 ──
      if (body.action === 'rejected') {
        await prisma.taskLog.create({
          data: {
            taskId: body.assetId,
            level: 'info',
            message: `用户❌拒绝导演建议 (decisionId: ${decisionId})`,
            metadata: {
              decisionAction: {
                decisionId,
                action: 'rejected',
                userId,
                note: body.note || '',
                timestamp: new Date().toISOString(),
              },
            },
          },
        })

        return {
          success: true,
          data: {
            decisionId,
            status: 'rejected',
            note: body.note || '',
            execution: { action: 'none' },
            message: '用户已拒绝该建议，不执行任何操作。',
          },
        }
      }

      // ── Step 4: 用户确认 → 执行 ──
      // 获取当前请求的 token 传给 submitter（ai-generate 需要 auth）
      const authHeader = req.headers.authorization || ''
      const token = authHeader.replace('Bearer ', '')
      const submitter = createDecisionTaskSubmitter('', token)
      const executionResult = await executeDecision(foundContract, userId, submitter)

      // 记录确认日志
      await prisma.taskLog.create({
        data: {
          taskId: body.assetId,
          level: 'info',
          message: `用户✅确认导演建议 → ${executionResult.action} (decisionId: ${decisionId})`,
          metadata: {
            decisionAction: {
              decisionId,
              action: 'confirmed',
              userId,
              note: body.note || '',
              timestamp: new Date().toISOString(),
              execution: executionResult.trace,
            },
          },
        },
      })

      return {
        success: executionResult.success,
        data: {
          decisionId,
          status: 'confirmed',
          note: body.note || '',
          execution: {
            action: executionResult.action,
            newTaskId: executionResult.newTaskId,
            decisionType: executionResult.decisionType,
          },
          message: buildConfirmMessage(executionResult),
        },
      }
    } catch (err: any) {
      req.log.error(`[director-decision] confirm failed for ${decisionId}: ${err.message}`)
      return reply.status(500).send({
        success: false,
        error: 'DECISION_CONFIRM_FAILED',
        message: err.message,
      })
    }
  })

  // ── GET /api/director/assets/:assetId/decision ──
  // 查询最近一次决策
  app.get('/api/director/assets/:assetId/decision', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { assetId } = req.params as { assetId: string }

    if (!assetId || assetId.length < 8) {
      return reply.status(400).send({
        success: false,
        error: '缺少有效的 assetId',
      })
    }

    try {
      const logs = await prisma.taskLog.findMany({
        where: { taskId: assetId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      // 从 metadata 中提取决策
      const decisions = logs
        .filter(log => {
          const meta = log.metadata as any
          return meta?.directorDecision?.id
        })
        .map(log => {
          const meta = log.metadata as any
          return {
            ...meta.directorDecision,
            loggedAt: log.createdAt,
          }
        })

      return {
        success: true,
        data: {
          assetId,
          totalDecisions: decisions.length,
          decisions,
        },
      }
    } catch (err: any) {
      req.log.error(`[director-decision] query failed for ${assetId}: ${err.message}`)
      return reply.status(500).send({
        success: false,
        error: 'DECISION_QUERY_FAILED',
        message: err.message,
      })
    }
  })
}

// ── 确认消息生成 ──

function buildConfirmMessage(result: {
  action: string
  decisionType: string
  newTaskId?: string
}): string {
  switch (result.action) {
    case 'none':
      return '当前资产质量达标，无需重新生成。'
    case 'queued':
      return `导演建议已执行：${result.decisionType} → 新任务已入队 (taskId: ${result.newTaskId})`
    case 'not_implemented':
      return 'replace_asset 类型暂不支持。'
    case 'failed':
      return '执行失败，请检查任务数据或稍后重试。'
    default:
      return `执行结果: ${result.action}`
  }
}
