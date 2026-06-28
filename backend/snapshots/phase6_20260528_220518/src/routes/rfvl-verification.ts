import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/rfvl-verification.ts — RFVL 运行时证明查询 + 违规检测 API
 *
 * RFVL: 实时查询每个请求的执行证明链
 * 检测: direct provider call / bypass queue / MSAL mismatch
 */

import { FastifyInstance } from 'fastify'
import { rfvl } from '../runtime/rfvl-injector.js'

export default async function rfvlRoutes(fastify: FastifyInstance) {

  // GET /rfvl/status — RFVL 引擎状态 + 违规检测报告
  fastify.get('/rfvl/status', async () => {
    const rate = rfvl.getViolationRate(500)
    return {
      success: true,
      data: {
        engine: 'RFVL Runtime Formal Verification',
        status: 'active',
        violationRate: rate,
        activeTraces: {
          count: 0, // tracks would need Map inspection
        },
        invariants: {
          singleEntry: 'execution_entry === SEEL_GATE',
          noDirectProvider: 'provider_call ⇒ path.contains(queue)',
          msalAuthority: 'model_selection_source === MSAL',
          adapterUniqueness: 'adapter_resolved_via === ModelAdapterRegistry',
          orchestrationIsolation: 'orchestration_layer !== execution_layer',
        },
        invariantStatus: rate.violations === 0 ? 'ALL_PASS' : 'VIOLATIONS_DETECTED',
        lastChecked: new Date().toISOString(),
      },
    }
  })

  // GET /rfvl/violations — 最近违规记录
  fastify.get('/rfvl/violations', async (request) => {
    const query = request.query as any
    const limit = Math.min(Number(query.limit) || 100, 1000)
    const allProofs = rfvl.getCompletedProofs(limit)
    const violations = allProofs.filter(p => !p.verified)
    return {
      success: true,
      data: {
        totalProofs: allProofs.length,
        violations: violations.length,
        violationRate: allProofs.length > 0 ? violations.length / allProofs.length : 0,
        recentViolations: violations.slice(-20).map(v => ({
          requestId: v.requestId,
          timestamp: new Date(v.timestamp).toISOString(),
          steps: v.chain.length,
          failedSteps: v.chain.filter(s => s.status === 'FAIL').map(s => s.name),
          finalHash: v.finalHash,
        })),
      },
    }
  })

  // GET /rfvl/trace/:traceId — 查询单个 trace 的完整证明链
  fastify.get('/rfvl/trace/:traceId', async (request, reply) => {
    const { traceId } = request.params as any
    if (!traceId) return reply.status(400).send({ error: 'traceId required' })

    const allProofs = rfvl.getCompletedProofs(10000)
    const trace = allProofs.find(p => p.requestId === traceId)
    if (!trace) return reply.status(404).send({ error: 'trace not found' })

    return {
      success: true,
      data: trace,
    }
  })
}
