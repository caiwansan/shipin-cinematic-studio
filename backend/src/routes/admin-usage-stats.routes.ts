/**
 * routes/admin-usage-stats.routes.ts — Sprint-ADMIN-IA-REALITY-03 T02
 *
 * 平台级模型调用统计（usage_logs 聚合）
 *   - GET /api/admin/usage/stats           总览：调用次数 / token / 成本 / 时间趋势
 *   - GET /api/admin/usage/stats/by-model  按模型聚合
 *   - GET /api/admin/usage/stats/by-workspace 按业务/租户聚合
 *   - GET /api/admin/usage/stats/by-agent  按 Agent 聚合（taskType 近似）
 *
 * 回答掌柜问题：短剧消耗多少模型成本？招聘 Agent 成本多少？哪个 Agent 最赚钱？
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminUsageStatsRoutes(fastify: FastifyInstance) {
  // ── 总览 ──
  fastify.get('/api/admin/usage/stats', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as { days?: string }
    const days = Math.min(parseInt(query.days || '30', 10) || 30, 365)
    const since = new Date(Date.now() - days * 86400_000)

    const logs = await prisma.usageLog.findMany({
      where: { createdAt: { gte: since } },
      select: { cost: true, tokens: true, taskType: true, provider: true, isPlatform: true, createdAt: true },
    })

    // token 解析（tokens 字段可能是 JSON 字符串 {prompt_tokens, completion_tokens} 或数字）
    const parseTokens = (t: string | null): number => {
      if (!t) return 0
      const n = Number(t)
      if (!Number.isNaN(n)) return n
      try {
        const j = JSON.parse(t)
        return (j.total_tokens || j.totalTokens || j.prompt_tokens || j.completion_tokens || 0) as number
      } catch { return 0 }
    }

    const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0)
    const totalTokens = logs.reduce((s, l) => s + parseTokens(l.tokens), 0)
    const platformCost = logs.filter(l => l.isPlatform).reduce((s, l) => s + (l.cost || 0), 0)
    const userCost = totalCost - platformCost

    // 按日趋势
    const byDay = new Map<string, { calls: number; cost: number; tokens: number }>()
    for (const l of logs) {
      const day = l.createdAt.toISOString().slice(0, 10)
      const cur = byDay.get(day) || { calls: 0, cost: 0, tokens: 0 }
      cur.calls += 1
      cur.cost += l.cost || 0
      cur.tokens += parseTokens(l.tokens)
      byDay.set(day, cur)
    }
    const trend = [...byDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date))

    return {
      success: true,
      data: {
        range: { days, since: since.toISOString() },
        summary: {
          totalCalls: logs.length,
          totalCost: Math.round(totalCost * 10000) / 10000,
          totalTokens,
          platformCost: Math.round(platformCost * 10000) / 10000,
          userCost: Math.round(userCost * 10000) / 10000,
          platformCalls: logs.filter(l => l.isPlatform).length,
          userCalls: logs.filter(l => !l.isPlatform).length,
        },
        trend,
      },
    }
  })

  // ── 按模型/Provider 聚合 ──
  fastify.get('/api/admin/usage/stats/by-model', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as { days?: string }
    const days = Math.min(parseInt(query.days || '30', 10) || 30, 365)
    const since = new Date(Date.now() - days * 86400_000)

    const grouped = await prisma.usageLog.groupBy({
      by: ['provider', 'taskType'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { cost: true },
    })

    const modelDetail = await prisma.usageLog.findMany({
      where: { createdAt: { gte: since } },
      select: { provider: true, taskType: true, tokens: true, cost: true },
    })
    const parseTokens = (t: string | null): number => {
      if (!t) return 0
      const n = Number(t)
      if (!Number.isNaN(n)) return n
      try { const j = JSON.parse(t); return (j.total_tokens || j.totalTokens || 0) as number } catch { return 0 }
    }

    const rows = grouped.map(g => {
      const detail = modelDetail.filter(m => m.provider === g.provider && m.taskType === g.taskType)
      const tokens = detail.reduce((s, m) => s + parseTokens(m.tokens), 0)
      return {
        provider: g.provider,
        taskType: g.taskType,
        calls: g._count.id,
        cost: Math.round((g._sum.cost || 0) * 10000) / 10000,
        tokens,
      }
    }).sort((a, b) => b.cost - a.cost)

    return { success: true, data: rows }
  })

  // ── 按业务/租户聚合 ──
  fastify.get('/api/admin/usage/stats/by-workspace', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as { days?: string }
    const days = Math.min(parseInt(query.days || '30', 10) || 30, 365)
    const since = new Date(Date.now() - days * 86400_000)

    const grouped = await prisma.usageLog.groupBy({
      by: ['tenantId', 'taskType'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { cost: true },
    })

    // tenantId → 企业名
    const tenantIds = [...new Set(grouped.map(g => g.tenantId).filter(Boolean))] as string[]
    const tenants = tenantIds.length
      ? await prisma.organization.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
      : []
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]))

    const rows = grouped.map(g => ({
      tenantId: g.tenantId || 'platform',
      tenantName: (g.tenantId && tenantMap.get(g.tenantId)) || (g.tenantId ? '未知企业' : '平台（无租户）'),
      taskType: g.taskType,
      calls: g._count.id,
      cost: Math.round((g._sum.cost || 0) * 10000) / 10000,
    })).sort((a, b) => b.cost - a.cost)

    return { success: true, data: rows }
  })

  // ── 按 Agent 聚合（taskType 近似）──
  fastify.get('/api/admin/usage/stats/by-agent', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as { days?: string }
    const days = Math.min(parseInt(query.days || '30', 10) || 30, 365)
    const since = new Date(Date.now() - days * 86400_000)

    const grouped = await prisma.usageLog.groupBy({
      by: ['taskType'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { cost: true },
    })

    const rows = grouped.map(g => ({
      agent: g.taskType,
      calls: g._count.id,
      cost: Math.round((g._sum.cost || 0) * 10000) / 10000,
    })).sort((a, b) => b.cost - a.cost)

    return { success: true, data: rows }
  })
}
