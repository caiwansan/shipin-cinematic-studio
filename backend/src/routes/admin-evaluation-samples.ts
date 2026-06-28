/**
 * admin-evaluation-samples.ts — R1 Ground Truth Discovery
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║             🔒 保险丝 — 禁止扩展清单                        ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  ❌ Quality Scoring    — 不得添加 quality/score/average     ║
 * ║  ❌ AI Evaluation      — 不得调 LLM 评估样本               ║
 * ║  ❌ Auto Ranking       — 不得按 signal_strength 排序输出   ║
 * ║  ❌ Version Promotion  — 不得基于行为提升 Prompt 版本      ║
 * ║  ❌ RLHF Training      — 不得用信号做强化学习训练           ║
 * ║  ❌ Auto Optimization  — 不得根据样本自动调整系统           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 本层只做：采集事实（行为信号 + 用户反馈）
 * 不做任何：评估 / 排序 / 优化 / 打分
 *
 * @phase-r1
 */

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'

/**
 * 行为信号强度表
 */
const SIGNAL_STRENGTH: Record<string, number> = {
  download: 1.0,        // 强正反馈
  favorite: 0.9,        // 强正反馈
  continue: 0.5,        // 轻度正反馈
  regenerate: -0.4,     // 轻度负反馈
  regenerate_loop: -1.0, // 强负反馈（连续3次以上）
  edit: 0,              // 中性
  like: 0.6,            // 点赞
  dislike: -0.6,        // 点踩
}

/**
 * 信号强度等级描述
 */
const SIGNAL_LABELS: Record<string, string> = {
  download: 'Strong Positive — 生成后立即下载',
  favorite: 'Strong Positive — 生成后收藏',
  continue: 'Mild Positive — 直接使用进入下一步',
  regenerate: 'Mild Negative — 再次生成',
  regenerate_loop: 'Strong Negative — 连续三次重生成',
  edit: 'Neutral — 进入编辑器',
  like: 'Positive — 点赞',
  dislike: 'Negative — 不满意',
}

export default async function evaluationSamplesRoutes(app: FastifyInstance) {
  // ─── 记录行为信号（核心 API） ───
  app.post('/api/evaluation/record-action', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const body = req.body as {
      assetId: string
      assetType: string
      userAction: string
      projectId?: string
      userId?: string
      workflowId?: string
      promptName?: string
      promptVersion?: string
    }

    // 基础校验
    if (!body.assetId || !body.assetType || !body.userAction) {
      return reply.status(400).send({
        success: false,
        error: 'assetId, assetType, userAction are required',
      })
    }

    const signalStrength = SIGNAL_STRENGTH[body.userAction]
    if (signalStrength === undefined) {
      return reply.status(400).send({
        success: false,
        error: `Unknown userAction: ${body.userAction}. Allowed: ${Object.keys(SIGNAL_STRENGTH).join(', ')}`,
      })
    }

    try {
      const sample = await prisma.evaluationSample.create({
        data: {
          assetId: body.assetId,
          assetType: body.assetType,
          projectId: body.projectId,
          userId: body.userId,
          workflowId: body.workflowId,
          sessionId: req.headers['x-session-id'] as string || undefined,
          promptName: body.promptName,
          promptVersion: body.promptVersion,
          userAction: body.userAction,
          signalStrength,
        },
      })

      return reply.send({
        success: true,
        data: {
          id: sample.id,
          assetId: sample.assetId,
          userAction: sample.userAction,
          signalStrength: sample.signalStrength,
          label: SIGNAL_LABELS[body.userAction] || body.userAction,
        },
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: `Failed to record action: ${(err as Error).message}`,
      })
    }
  })

  // ─── 记录用户分数（R1 后期启用） ───
  app.post('/api/evaluation/record-score', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const body = req.body as {
      assetId: string
      assetType: string
      userScore: number
      projectId?: string
      userId?: string
    }

    if (!body.assetId || !body.assetType || body.userScore === undefined) {
      return reply.status(400).send({ success: false, error: 'assetId, assetType, userScore are required' })
    }

    if (body.userScore < 1 || body.userScore > 5) {
      return reply.status(400).send({ success: false, error: 'userScore must be 1-5' })
    }

    // 不单独创建记录——更新已有记录或创建新记录（userScore 字段）
    // 这里我们直接更新最新的一条该 asset 的记录，或创建新记录
    try {
      // 先尝试更新最近一条无分数的记录
      const existing = await prisma.evaluationSample.findFirst({
        where: { assetId: body.assetId, userScore: null },
        orderBy: { createdAt: 'desc' },
      })

      if (existing) {
        await prisma.evaluationSample.update({
          where: { id: existing.id },
          data: { userScore: body.userScore },
        })
        return reply.send({ success: true, data: { updated: existing.id, userScore: body.userScore } })
      }

      // 没有已有记录则创建新记录
      const sample = await prisma.evaluationSample.create({
        data: {
          assetId: body.assetId,
          assetType: body.assetType,
          projectId: body.projectId,
          userId: body.userId,
          userAction: 'score',
          signalStrength: 0,
          userScore: body.userScore,
        },
      })

      return reply.send({ success: true, data: { id: sample.id, userScore: sample.userScore } })
    } catch (err) {
      return reply.status(500).send({ success: false, error: `Failed to record score: ${(err as Error).message}` })
    }
  })

  // ─── 查询样本库统计（只读，仅供观测） ───
  app.get('/api/evaluation/samples/stats', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const total = await prisma.evaluationSample.count()
    const byType = await prisma.evaluationSample.groupBy({
      by: ['assetType'],
      _count: true,
    })
    const byAction = await prisma.evaluationSample.groupBy({
      by: ['userAction'],
      _count: true,
    })

    const positive = await prisma.evaluationSample.count({
      where: { signalStrength: { gt: 0 } },
    })
    const negative = await prisma.evaluationSample.count({
      where: { signalStrength: { lt: 0 } },
    })
    const neutral = await prisma.evaluationSample.count({
      where: { signalStrength: 0 },
    })

    return reply.send({
      success: true,
      data: {
        total,
        byType: byType.map(t => ({ type: t.assetType, count: t._count })),
        byAction: byAction.map(a => ({ action: a.userAction, count: a._count })),
        distribution: { positive, negative, neutral },
      },
    })
  })
}
