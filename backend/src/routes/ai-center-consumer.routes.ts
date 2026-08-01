/**
 * routes/ai-center-consumer.routes.ts — AI-CENTER-03 模型消费决策中心
 *
 * 掌柜指令（2026-08-01 修正版）：AI中心 = 全球 AI 模型消费决策中心
 *   用户来 AI中心只解决三件事：哪个 AI 适合我？多少钱？我的钱还剩多少？
 *
 * 本路由 = 纯计算 + BYOK 即时查询，红线：
 *   ❌ 不用 AI  ❌ 不消耗 Token  ❌ 不保存用户 API Key（余额查询即时请求，不落库不打日志）
 *   ✅ 性价比 = 能力综合×60% + 价格优势分×40%（纯计算）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const DIMS = ['cost', 'speed', 'quality', 'chinese', 'coding', 'reasoning'] as const

function abilityAvg(caps: Record<string, number> | null): number {
  if (!caps || typeof caps !== 'object') return 0
  const vals = DIMS.map((d) => Number(caps[d]) || 0)
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default async function aiCenterConsumerRoutes(app: FastifyInstance) {
  // ─── 性价比排行榜：能力×60% + 价格×40%（纯计算，无 AI） ───
  app.get('/api/ai/center/rankings', async () => {
    const providers = await prisma.aiProviderDirectory.findMany({
      where: { status: 'active' },
      select: { code: true, name: true, logo: true, category: true, capabilityScore: true, costScore: true, pricingInfo: true },
    })
    const ranked = providers
      .map((p) => {
        const ability = abilityAvg(p.capabilityScore as Record<string, number> | null)
        const cost = p.costScore ?? 50
        const valueScore = Math.round((ability * 0.6 + cost * 0.4) * 10) / 10
        const pricing = (p.pricingInfo as { inputPrice?: number; outputPrice?: number; currency?: string } | null) || null
        return {
          code: p.code,
          name: p.name,
          logo: p.logo,
          category: p.category,
          ability,
          costScore: cost,
          valueScore,
          pricing,
        }
      })
      .filter((p) => p.ability > 0)
      .sort((a, b) => b.valueScore - a.valueScore)
      .map((p, i) => ({ ...p, rank: i + 1, medal: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null }))
    return { code: 0, data: { formula: '性价比 = 能力综合×60% + 价格优势×40%（纯计算，无 AI 参与）', ranked } }
  })

  // ─── 我的AI余额：BYOK 即时查询官方余额接口（Key 不落库、不打日志） ───
  app.post('/api/ai/center/balance-query', async (req, reply) => {
    const { provider, apiKey } = (req.body || {}) as { provider?: string; apiKey?: string }
    if (!provider || !apiKey) return reply.status(400).send({ code: 1, error: '缺少 provider 或 apiKey' })
    if (apiKey.length > 200) return reply.status(400).send({ code: 1, error: 'apiKey 格式异常' })

    const p = await prisma.aiProviderDirectory.findUnique({ where: { code: provider } })
    if (!p) return reply.status(404).send({ code: 1, error: '未知厂商' })

    const url = p.officialBalanceApi
    if (!url) {
      return {
        code: 0,
        data: { supported: false, providerName: p.name, reason: '该厂商暂未开放官方余额查询接口（可在官方控制台查看）' },
      }
    }

    // 即时请求官方余额接口（BYOK：仅内存使用，不落库不打日志）
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal })
      if (!res.ok) {
        return reply.status(502).send({ code: 1, error: `官方接口返回 ${res.status}（Key 可能无效或过期）` })
      }
      const json = await res.json()
      let balance: number | null = null
      let used: number | null = null
      let currency = 'CNY'

      if (provider === 'deepseek') {
        const info = json?.balance_infos?.[0]
        balance = info ? Number(info.total_balance) : null
        currency = info?.currency || 'CNY'
      } else if (provider === 'moonshot') {
        balance = json?.data?.available_balance != null ? Number(json.data.available_balance) : null
        used = json?.data?.used_balance != null ? Number(json.data.used_balance) : null
      } else if (provider === 'openai') {
        balance = json?.total_available != null ? Number(json.total_available) : null
        used = json?.total_used != null ? Number(json.total_used) : null
        currency = 'USD'
      } else {
        return { code: 0, data: { supported: false, providerName: p.name, reason: '该厂商余额接口格式暂未适配' } }
      }

      return {
        code: 0,
        data: {
          supported: true,
          providerName: p.name,
          currency,
          balance: balance != null ? Math.round(balance * 100) / 100 : null,
          used: used != null ? Math.round(used * 100) / 100 : null,
          fetchedAt: new Date().toISOString(),
          byok: 'Key 仅用于本次即时查询，未保存',
        },
      }
    } catch (e: any) {
      return reply.status(502).send({ code: 1, error: e?.name === 'AbortError' ? '查询超时（官方接口响应慢）' : '查询失败，请检查网络或 Key' })
    } finally {
      clearTimeout(timer)
    }
  })
}
