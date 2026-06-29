// KMKI-RUNTIME-010 — Execution Trace Service
// 提供对 AI Runtime 执行记录的查询和聚合

import { prisma } from '../../../../utils/index'

export interface ExecutionTrace {
  traceId: string
  projectId: string | null
  userId: string | null
  agent: string
  provider: string
  model: string
  promptKey: string | null
  promptVersion: string | null
  capability: string | null
  parserStage: string | null
  retryCount: number
  fallbackUsed: boolean
  schemaValidated: boolean
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  latencyMs: number
  status: string
  error: string | null
  createdAt: string
}

export interface TraceSummary {
  totalTraces: number
  totalTokens: number
  totalCost: number
  avgLatencyMs: number
  successRate: number
  byAgent: { agent: string; count: number; avgTokens: number }[]
  byProvider: { provider: string; count: number; avgCost: number }[]
}

export class ExecutionTraceService {
  // 获取最近 trace 列表（分页）
  async listTraces(options: {
    projectId?: string
    agent?: string
    limit?: number
    offset?: number
  }): Promise<{ traces: ExecutionTrace[]; total: number }> {
    const where: any = {}
    if (options.projectId) where.projectId = options.projectId
    if (options.agent) where.agent = options.agent

    const [traces, total] = await Promise.all([
      prisma.lLMUsageRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.lLMUsageRecord.count({ where }),
    ])

    return {
      traces: traces.map((r: any) => this.mapTrace(r)),
      total,
    }
  }

  // 获取单条 trace
  async getTrace(traceId: string): Promise<ExecutionTrace | null> {
    const record = await prisma.lLMUsageRecord.findUnique({ where: { id: traceId } })
    return record ? this.mapTrace(record) : null
  }

  // 获取 project 的 trace 摘要
  async getProjectSummary(projectId: string): Promise<TraceSummary | null> {
    const records = await prisma.lLMUsageRecord.findMany({ where: { projectId } })
    if (!records.length) return null

    // 计算各项汇总
    const totalTokens = records.reduce((sum: number, r: any) => sum + (r.totalTokens || 0), 0)
    const totalCost = records.reduce((sum: number, r: any) => sum + (r.cost || 0), 0)
    const avgLatencyMs = Math.round(records.reduce((sum: number, r: any) => sum + (r.latencyMs || 0), 0) / records.length)
    const successCount = records.filter((r: any) => r.status === 'success').length
    const successRate = Math.round((successCount / records.length) * 100)

    // 按 agent 聚合
    const agentMap = new Map<string, { count: number; tokensTotal: number }>()
    const providerMap = new Map<string, { count: number; costTotal: number }>()
    for (const r of records) {
      const a = r.agent || 'unknown'
      const p = r.provider || 'unknown'
      const ag = agentMap.get(a) || { count: 0, tokensTotal: 0 }
      ag.count++; ag.tokensTotal += (r.totalTokens || 0)
      agentMap.set(a, ag)
      const pr = providerMap.get(p) || { count: 0, costTotal: 0 }
      pr.count++; pr.costTotal += (r.cost || 0)
      providerMap.set(p, pr)
    }

    return {
      totalTraces: records.length,
      totalTokens,
      totalCost,
      avgLatencyMs,
      successRate,
      byAgent: Array.from(agentMap.entries()).map(([agent, d]) => ({
        agent,
        count: d.count,
        avgTokens: Math.round(d.tokensTotal / d.count),
      })),
      byProvider: Array.from(providerMap.entries()).map(([provider, d]) => ({
        provider,
        count: d.count,
        avgCost: Math.round((d.costTotal / d.count) * 100000) / 100000,
      })),
    }
  }

  private mapTrace(r: any): ExecutionTrace {
    return {
      traceId: r.id,
      projectId: r.projectId,
      userId: r.userId,
      agent: r.agent || 'unknown',
      provider: r.provider || 'unknown',
      model: r.model || 'unknown',
      promptKey: r.promptKey,
      promptVersion: r.promptVersion,
      capability: null,
      parserStage: null,
      retryCount: 0,
      fallbackUsed: false,
      schemaValidated: false,
      promptTokens: r.promptTokens || 0,
      completionTokens: r.completionTokens || 0,
      totalTokens: r.totalTokens || 0,
      cost: r.cost || 0,
      latencyMs: r.latencyMs || 0,
      status: r.status || 'unknown',
      error: r.error,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
    }
  }
}

export const executionTraceService = new ExecutionTraceService()
