/**
 * llm-execution-graph-v2/trace/trace.store.ts
 *
 * LLM Execution Trace — append-only event stream
 * ❗ NEVER mutate, NEVER delete, ONLY append
 */

import { ExecutionGraph } from '../types'
import { prisma } from '../../utils/index.js'

export interface TraceEntry {
  traceId: string
  userId: string
  provider: string
  model: string
  success: boolean
  latencyMs: number
  decisionPath: string[]
  sourcePath: string
  error?: string
}

export async function persistTrace(graph: ExecutionGraph, extras?: {
  success?: boolean
  error?: string
  latencyMs?: number
}): Promise<void> {
  const final = graph.final
  const error = extras?.error
  const success = extras?.success ?? (graph.status === 'executed' || graph.status === 'building')

  const decisionPath = graph.nodes.map(n => `${n.type}:${n.error ? 'FAIL' : 'OK'}`)
  const sourcePath = graph.nodes
    .filter(n => n.type === 'CONFIG_RESOLVE')
    .map(n => (n.output as any)?.source)
    .filter(Boolean)
    .join(' → ') || 'NONE'

  try {
    await prisma.llmExecutionTrace.create({
      data: {
        traceId: graph.traceId,
        userId: graph.userId,
        provider: final?.provider || 'unknown',
        model: final?.model || 'unknown',
        success,
        latencyMs: extras?.latencyMs ?? graph.totalLatencyMs ?? 0,
        decisionPath: decisionPath,
        sourcePath: sourcePath,
        error: error || null,
        timestamp: new Date(),
      },
    })
  } catch (err) {
    console.error('[TraceStore] persist failed:', err)
  }
}

export async function queryTraces(params: {
  userId?: string
  limit?: number
  offset?: number
}): Promise<TraceEntry[]> {
  const where: any = {}
  if (params.userId) where.userId = params.userId

  const rows = await prisma.llmExecutionTrace.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: params.limit || 100,
    skip: params.offset || 0,
  })

  return rows.map((r: any) => ({
    traceId: r.traceId,
    userId: r.userId,
    provider: r.provider,
    model: r.model,
    success: r.success,
    latencyMs: r.latencyMs,
    decisionPath: (r.decisionPath as string[]) || [],
    sourcePath: r.sourcePath || 'NONE',
    error: r.error || undefined,
  }))
}
