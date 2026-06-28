// ============================================================================
// 盘古斧 AI OS — Phase 7A-BOOT Runtime API Gateway
// 注入实际 Event Bus 的事件驱动 API
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { runtimeEventBus } from '../events/runtime-event-bus.js'
// ═══ Phase 8.2a: SLA Router ═══
import { routeToWorkerPool } from '../core-runtime/sla-router.js'
// ═══ Phase 8.2a: Metrics + Worker Pool status ═══
import { slaMetricsCollector, getImmunitySnapshot } from '../core-runtime/sla-metrics.js'
import { workerPool } from '../core-runtime/worker-pool.js'
// ═══ Phase 8.3: Distributed Runtime State ═══
import { getJournal, getJournalSize } from '../core-runtime/distributed/runtime-state-journal.js'
import { getLatestSnapshot, getAllSnapshots, getSnapshotCount } from '../core-runtime/distributed/snapshot-replication.js'
import { getAllVersions } from '../core-runtime/distributed/version-clock.js'
import { validateConsistency, validateAllConsistency } from '../core-runtime/distributed/consistency-validator.js'

// ── API 路由注册 ──────────────────────────────────────────────────────────

export async function registerGatewayRoutes(app: FastifyInstance) {

  // ============================================================
  // 1. Execution API (事件驱动 — 真实走 Event Bus)
  // ============================================================

  // ═══ Phase 8.1: SaaS Contract Validation ═══
  function validateContract(
    tenantId: string, slaTier: string, payload: any
  ): { valid: boolean; reason?: string; violations?: string[] } {
    const tier = slaTier || 'SLA_C'
    // LIGHT(SAFE) → 全量保证; MODERATE → 有界; HEAVY → 部分; SATURATION → 无
    const tierOrder = ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']
    const tierIndex = tierOrder.indexOf(tier)
    if (tierIndex < 0) return { valid: false, reason: `UNKNOWN_SLA_TIER: ${tier}` }

    // 基于 SLA tier 的约束检查
    const dagSize = payload?.dagId ? 1 : 0
    if (tier === 'SLA_A' && dagSize > 100) {
      return { valid: false, reason: 'SLA_A: DAG size exceeds 100 nodes', violations: ['DAG_SIZE_LIMIT'] }
    }
    if (tier === 'SLA_D' && dagSize > 0) {
      // SLA_D 仍然允许执行，但标记为 best-effort
      return { valid: true }
    }

    return { valid: true }
  }

  app.post('/api/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    const { dagId, input, seed } = req.body as any
    const execId = `exec_${Date.now()}`

    // ═══ Phase 8.1: Contract Hook ═══
    const tenant = (req as any).tenant
    if (tenant) {
      const contractResult = validateContract(tenant.tenantId, tenant.slaTier, { dagId, input })
      if (!contractResult.valid) {
        return reply.status(425).send({
          error: 'CONTRACT_VIOLATION',
          message: contractResult.reason,
          violations: contractResult.violations
        })
      }
    }

    // ═══ Phase 8.2a: SLA Router → Worker Pool ═══
    // 代替直接 emit → 先入队，由 Worker Loop 出队后 emit
    const routeResult = routeToWorkerPool(
      tenant?.tenantId || 'anonymous',
      tenant?.slaTier || 'SLA_C',
      dagId || `auto_${execId}`,
      input || {},
      seed || '0x7A3F',
      runtimeEventBus.backpressureTier,
    )

    if (!routeResult.queued) {
      return reply.status(503).send({
        error: 'QUEUE_REJECTED',
        message: routeResult.reason || '系统负荷已满，请稍后重试',
        slaTier: routeResult.slaTier,
        queueDepth: routeResult.queueDepth,
      })
    }

    return {
      executionId: execId,
      status: 'queued',
      slaTier: routeResult.slaTier,
      queueDepth: routeResult.queueDepth,
      poolLabel: routeResult.poolConfig.label,
      reason: routeResult.reason,
      seed: seed || '0x7A3F',
      timestamp: new Date().toISOString(),
      totalTicks: runtimeEventBus.tick,
      tenantId: tenant?.tenantId
    }
  })

  app.get('/api/execute/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const history = runtimeEventBus.getHistory(['dag.execute', 'dag.complete', 'dag.error'])
    const match = history.find(e => (e.data as any).executionId === id || (e.data as any).dagId === id)
    return {
      executionId: id,
      status: match ? (match.type === 'dag.complete' ? 'complete' : match.type === 'dag.error' ? 'error' : 'running') : 'unknown',
      events: match ? [match] : [],
      totalTicks: runtimeEventBus.tick
    }
  })

  // ============================================================
  // 2. DAG API
  // ============================================================

  app.get('/api/dag/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    return {
      id,
      nodes: [],
      edges: [],
      version: '1.0',
      lastValidated: new Date().toISOString()
    }
  })

  app.post('/api/dag', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body
    return { id: `dag_${Date.now()}`, status: 'created', nodes: 0, edges: 0 }
  })

  // ============================================================
  // 3. Trace / Replay API
  // ============================================================

  app.get('/api/trace/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    return {
      traceId: id,
      ticks: [],
      driftRate: 0.004,
      hashStable: true,
      duration: '1.2s'
    }
  })

  app.post('/api/replay', async (req: FastifyRequest, reply: FastifyReply) => {
    const { executionId, seed } = req.body as any
    const replayId = `replay_${Date.now()}`

    runtimeEventBus.emit('replay.start', {
      replayId,
      executionId: executionId || 'unknown',
      seed: seed || '0x7A3F'
    })

    // 模拟回放进度
    const drift = Math.random() * 0.008
    setTimeout(() => {
      runtimeEventBus.emit('replay.drift', {
        replayId,
        driftRate: drift,
        hashStable: drift < 0.005
      })
    }, 500)

    setTimeout(() => {
      runtimeEventBus.emit('replay.complete', {
        replayId,
        driftRate: drift,
        hashStable: drift < 0.005,
        totalNodes: 12,
        mismatches: drift < 0.005 ? 0 : 2
      })
    }, 1500)

    return {
      replayId,
      executionId: executionId || 'unknown',
      seed: seed || '0x7A3F',
      status: 'replaying',
      snapshotChain: 'intact'
    }
  })

  // ============================================================
  // 4. Repair API
  // ============================================================

  app.post('/api/repair', async (req: FastifyRequest, reply: FastifyReply) => {
    const { issue, nodeId, autoApprove } = req.body as any
    const repairId = `repair_${Date.now()}`

    runtimeEventBus.emit('repair.trigger', {
      repairId,
      issue: issue || 'unknown',
      nodeId: nodeId || 'unknown',
      requiresApproval: !autoApprove
    })

    return {
      repairId,
      plan: [
        { step: 1, action: 'diagnose', status: 'pending' },
        { step: 2, action: 'root_cause_analysis', status: 'pending' },
        { step: 3, action: 'execute_repair', status: 'pending' },
        { step: 4, action: 'verify_recovery', status: 'pending' }
      ],
      requiresApproval: !autoApprove,
      estimatedDuration: '3.2s'
    }
  })

  // ============================================================
  // 5. Health API (实时数据 — 从 Event Bus 获取最新指标)
  // ============================================================

  app.get('/api/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    const history = runtimeEventBus.getHistory(['health.update'])
    const latest = history.length > 0 ? history[history.length - 1].data : {}
    const status = runtimeEventBus.getStatusSnapshot()

    return {
      status: 'healthy',
      ...latest,
      totalTicks: status.totalTicks,
      totalEvents: status.totalEvents,
      uptime: status.uptime,
      timestamp: new Date().toISOString()
    }
  })

  // ============================================================
  // 6. Admin API
  // ============================================================

  // ============================================================
  // ═════ 7A-STABILIZE: System Status API ═══════════════════════
  // ============================================================

  app.get('/api/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return {
      phase: '7A-STABILIZE',
      status: 'running',
      ...runtimeEventBus.getStatusSnapshot(),
      timestamp: new Date().toISOString()
    }
  })

  // ═══ Phase 8.1: Usage / Billing API ═══
  app.get('/api/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenant = (req as any).tenant
    const userId = tenant?.tenantId || 'unknown'

    const { prisma } = await import('../utils/index.js')
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const logs = await prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const dagCount = logs.filter(l => l.taskType === 'dag_execution').length
    const aiCount = logs.filter(l => l.taskType !== 'dag_execution').length
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)

    return {
      monthlyExecutions: dagCount,
      monthlyAICalls: aiCount,
      monthlyStorage: `${(logs.length * 0.5).toFixed(1)} MB`,
      estimatedCost: `¥${totalCost.toFixed(2)}`,
      plan: tenant?.plan || 'free',
      slaTier: tenant?.slaTier || 'SLA_C',
      logs: logs.slice(0, 20)
    }
  })

  // ═══ Phase 8.2a: Worker Pool + SLA Metrics ═══
  // ═══ Phase 8.2c: Tenant Isolation Metrics ═══
  app.get('/api/metrics', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { workerPool: poolStatus } = await import('../core-runtime/worker-pool.js')
    const { tenantQueues } = await import('../core-runtime/execution-queue.js')
    const { getTenantIsolationSummary, getActiveTenantCount } = await import('../core-runtime/concurrency-budget.js')
    const { getNoisyTenants } = await import('../core-runtime/noisy-neighbor.js')
    const { getLaneUsage } = await import('../core-runtime/isolation-lanes.js')

    const queuePartitions: Record<string, number> = {}
    for (const [tid, tasks] of Object.entries(tenantQueues)) {
      queuePartitions[tid] = tasks.length
    }

    return {
      workerPool: poolStatus.getStatus(),
      slaMetrics: slaMetricsCollector.getAggregated(),
      backpressureTier: runtimeEventBus.backpressureTier,
      immunity: getImmunitySnapshot(),
      tenantIsolation: {
        activeTenants: getActiveTenantCount(),
        noisyTenants: getNoisyTenants(),
        queuePartitions,
        laneUsage: getLaneUsage(),
        isolationSummary: getTenantIsolationSummary(),
      },
    }
  })

  // ═══ Phase 8.3: Runtime State API ═══

  /** GET /api/runtime/state/:dagId — 获取 dag 的最新 runtime state */
  app.get('/api/runtime/state/:dagId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { dagId } = req.params as { dagId: string }
    const snapshot = getLatestSnapshot(dagId)
    if (!snapshot) {
      return reply.status(404).send({ error: `No state found for dag: ${dagId}` })
    }

    const consistency = validateConsistency(dagId)
    return {
      dagId,
      snapshotState: snapshot.state,
      snapshotVersion: snapshot.version,
      snapshotCreatedAt: snapshot.createdAt,
      consistency,
    }
  })

  /** GET /api/runtime/snapshot/:dagId — 获取 dag 的最新 snapshot */
  app.get('/api/runtime/snapshot/:dagId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { dagId } = req.params as { dagId: string }
    const snapshot = getLatestSnapshot(dagId)
    if (!snapshot) {
      return reply.status(404).send({ error: `No snapshot for dag: ${dagId}` })
    }
    return snapshot
  })

  /** GET /api/runtime/journal/:dagId — 获取 dag 的 journal 事件列表 */
  app.get('/api/runtime/journal/:dagId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { dagId } = req.params as { dagId: string }
    const events = getJournal(dagId)
    return {
      dagId,
      eventCount: events.length,
      events: events.slice(-100), // 最近 100 条
    }
  })

  /** GET /api/runtime/consistency — 全系统一致性报表 */
  app.get('/api/runtime/consistency', async (_req: FastifyRequest, reply: FastifyReply) => {
    const results = validateAllConsistency()
    const allValid = results.every(r => r.valid)
    return {
      allValid,
      totalDags: results.length,
      journalSize: getJournalSize(),
      snapshotCount: getSnapshotCount(),
      versionClock: getAllVersions(),
      details: results,
    }
  })

  // ============================================================
  // 8. Workbench Redirect / Admin Redirect
  // ============================================================

  app.get('/workbench', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.redirect('/workbench/console')
  })

  app.get('/admin', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.redirect('/admin/users')
  })
}

// ── 路由导出 ──────────────────────────────────────────────────────────────

export default registerGatewayRoutes
