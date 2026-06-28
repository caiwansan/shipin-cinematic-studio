// ═══════════════════════════════════════════════════════════════
// runtime-observability.ts — Runtime 观测Dashboard API v1
//
// 只读REST端点 + SSE实时流
// 数据来源：自治运维Agent + Observability Event Bus
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 模拟自治运维Agent数据（后端没有运行时Node环境，用数据库记录+模拟）
const runtimeMemory: {
  agentFeed: any[]
  repairTraces: any[]
  anomalyTimeline: any[]
} = {
  agentFeed: [],
  repairTraces: [],
  anomalyTimeline: [],
}

// 初始化模拟种子数据
function seedMockData() {
  const now = Date.now()
  const actions = ['patrol', 'diagnosis', 'repair', 'execute', 'verify', 'learn']
  const modules = ['patrol_scheduler', 'health_observer', 'anomaly_engine', 'root_cause_analyzer', 'risk_estimator', 'strategy_generator', 'repair_executor', 'rollback_controller']
  const results = ['success', 'success', 'success', 'success', 'success', 'success', 'failure', 'success']
  const risks = ['low', 'low', 'medium', 'low', 'high', 'low', 'medium', 'critical']

  for (let i = 39; i >= 0; i--) {
    const action = actions[Math.floor(Math.random() * actions.length)]
    const mod = modules[Math.floor(Math.random() * modules.length)]
    const ts = now - i * 7000 - Math.floor(Math.random() * 2000)

    const anomalyTypes = ['gpu_overload', 'worker_stall', 'queue_pileup', 'trace_spike', 'evolution_drift', 'governance_violation']
    const isAnomaly = Math.random() < 0.25
    const anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)]

    runtimeMemory.agentFeed.push({
      id: `feed_${ts}`,
      timestamp: ts,
      time: new Date(ts).toISOString(),
      action,
      module: mod,
      result: results[Math.floor(Math.random() * results.length)],
      risk: risks[Math.floor(Math.random() * risks.length)],
      detail: isAnomaly
        ? `检测到 ${anomalyType === 'gpu_overload' ? 'GPU过载' : anomalyType === 'worker_stall' ? 'Worker卡死' : anomalyType === 'queue_pileup' ? '队列堆积' : anomalyType === 'trace_spike' ? 'Trace错误率飙升' : anomalyType === 'evolution_drift' ? '进化漂移' : '治理违规'}`
        : `系统运行正常，${action === 'patrol' ? '巡检通过' : action === 'diagnosis' ? '无异常' : action === 'repair' ? '无需修复' : action === 'execute' ? '执行完毕' : action === 'verify' ? '恢复验证通过' : '学习完成'}`,
    })

    // 异常事件
    if (isAnomaly) {
      runtimeMemory.anomalyTimeline.push({
        id: `anomaly_${ts}`,
        timestamp: ts,
        time: new Date(ts).toISOString(),
        type: anomalyType,
        severity: risks[Math.floor(Math.random() * risks.length)],
        message: anomalyType === 'gpu_overload' ? 'GPU利用率超过85%安全阈值' :
                 anomalyType === 'worker_stall' ? '2个Worker卡死无响应' :
                 anomalyType === 'queue_pileup' ? '任务队列深度超过阈值' :
                 anomalyType === 'trace_spike' ? 'Trace错误率飙升到12%' :
                 anomalyType === 'evolution_drift' ? '进化策略偏离基线超过10%' :
                 '检测到治理违规次数过多',
        resolved: Math.random() < 0.8,
        resolve_time: Math.random() < 0.7 ? new Date(ts + 8000 + Math.random() * 30000).toISOString() : null,
      })
    }
  }

  // 修复追踪
  for (let i = 9; i >= 0; i--) {
    const ts = now - i * 120000 - Math.floor(Math.random() * 10000)
    const anomalyTypes2 = ['gpu_overload', 'worker_stall', 'queue_pileup', 'trace_spike']
    const at = anomalyTypes2[Math.floor(Math.random() * anomalyTypes2.length)]
    const success = Math.random() < 0.85

    runtimeMemory.repairTraces.push({
      id: `trace_${ts}`,
      timestamp: ts,
      time: new Date(ts).toISOString(),
      anomaly_type: at,
      success,
      duration_ms: 5000 + Math.floor(Math.random() * 45000),
      steps: [
        { step: 'detect', status: 'success', duration_ms: 300 + Math.random() * 700, input: '健康巡检数据', output: `检测到${at}` },
        { step: 'diagnose', status: 'success', duration_ms: 500 + Math.random() * 1500, input: `异常类型: ${at}`, output: `根因分析完成，置信度${(70 + Math.random() * 25).toFixed(0)}%` },
        { step: 'strategy', status: 'success', duration_ms: 200 + Math.random() * 500, input: '根因分析结果', output: `生成修复策略: ${at === 'gpu_overload' ? 'switch_gpu_tier' : at === 'worker_stall' ? 'restart_worker' : at === 'queue_pileup' ? 'clear_queue' : 'trigger_circuit_breaker'}` },
        { step: 'validate', status: success ? 'success' : 'failed', duration_ms: 100 + Math.random() * 300, input: '修复策略', output: success ? '安全校验通过' : '安全校验未通过: 边界越界' },
        { step: 'execute', status: success ? 'success' : 'failed', duration_ms: 1000 + Math.random() * 20000, input: '已批准的修复策略', output: success ? '执行完成' : '执行失败: Worker重启超时' },
        { step: 'verify', status: success ? 'success' : 'skipped', duration_ms: 300 + Math.random() * 1000, input: '执行结果', output: success ? '系统指标恢复，验证通过' : '修复失败，已跳过验证' },
        { step: 'learn', status: success ? 'success' : 'failed', duration_ms: 100 + Math.random() * 200, input: '修复记录', output: success ? '模式学习完成，更新知识库' : '学习失败: 置信度不足' },
      ],
    })
  }
}

seedMockData()

// 健康分计算
function calculateHealthScore(now: number): { score: number; stability: number; repair_rate: number; anomaly_freq: number; gpu_pressure: number; queue_pressure: number } {
  const recentAnomalies = runtimeMemory.anomalyTimeline.filter(a => now - a.timestamp < 600000).length
  const recentRepairs = runtimeMemory.repairTraces.filter(r => now - r.timestamp < 600000).length
  const failedRepairs = runtimeMemory.repairTraces.filter(r => r.timestamp > now - 600000 && !r.success).length

  const anomalyFreq = Math.min(recentAnomalies / 10, 1)
  const repairRate = recentRepairs > 0 ? (recentRepairs - failedRepairs) / recentRepairs : 1
  const stability = Math.max(0, 1 - anomalyFreq * 0.5)
  const gpuPressure = 0.2 + Math.random() * 0.4
  const queuePressure = 0.1 + Math.random() * 0.3

  const score = Math.round((stability * 35 + repairRate * 25 + (1 - anomalyFreq) * 20 + (1 - gpuPressure) * 10 + (1 - queuePressure) * 10))
  return { score, stability: Math.round(stability * 100), repair_rate: Math.round(repairRate * 100), anomaly_freq: Math.round(anomalyFreq * 100), gpu_pressure: Math.round(gpuPressure * 100), queue_pressure: Math.round(queuePressure * 100) }
}

// ── 路由注册 ──

export async function registerRuntimeObservabilityRoutes(fastify: FastifyInstance) {
  const now = Date.now()

  // ── 1. 系统健康 ──
  fastify.get('/api/runtime/observability/health', async (_req, reply) => {
    const health = calculateHealthScore(now)
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      system_health: health.score >= 70 ? 'healthy' : health.score >= 40 ? 'degraded' : 'unhealthy',
      health_score: health.score,
      components: {
        stability: health.stability,
        repair_success_rate: health.repair_rate,
        anomaly_frequency: health.anomaly_freq,
        gpu_pressure: health.gpu_pressure,
        queue_pressure: health.queue_pressure,
      },
      worker_count: 6 + Math.floor(Math.random() * 3),
      queue_depth: Math.floor(Math.random() * 200),
      uptime: Math.floor((now - 1778445000000) / 1000),
      risk_level: health.score >= 70 ? 'low' : health.score >= 40 ? 'medium' : 'high',
    }
  })

  // ── 2. Agent行为流 ──
  fastify.get('/api/runtime/observability/agent/feed', async (req, reply) => {
    const query = req.query as any
    const limit = Math.min(parseInt(query.limit || '50'), 200)
    const offset = parseInt(query.offset || '0')

    // 模拟时间推移，每次请求更新一点
    const newFeed: any[] = []
    if (Math.random() < 0.3) {
      const ts = Date.now()
      const actions = ['patrol', 'diagnosis', 'repair', 'execute', 'verify', 'learn']
      const newEntry = {
        id: `feed_${ts}`,
        timestamp: ts,
        time: new Date(ts).toISOString(),
        action: actions[Math.floor(Math.random() * actions.length)],
        module: 'auto_maintenance_loop',
        result: Math.random() < 0.9 ? 'success' : 'failure',
        risk: Math.random() < 0.7 ? 'low' : Math.random() < 0.5 ? 'medium' : 'high',
        detail: Math.random() < 0.8 ? '系统运行正常，巡检通过' : '检测到轻微异常，已自动修复',
      }
      runtimeMemory.agentFeed.unshift(newEntry)
    }

    const sorted = [...runtimeMemory.agentFeed].sort((a, b) => b.timestamp - a.timestamp)
    const sliced = sorted.slice(offset, offset + limit)

    return {
      total: runtimeMemory.agentFeed.length,
      limit,
      offset,
      entries: sliced,
      has_more: offset + limit < runtimeMemory.agentFeed.length,
    }
  })

  // ── 3. 异常时间轴 ──
  fastify.get('/api/runtime/observability/anomalies/timeline', async (req, reply) => {
    const query = req.query as any
    const limit = Math.min(parseInt(query.limit || '50'), 200)
    const filter = query.filter || 'all'

    let filtered = [...runtimeMemory.anomalyTimeline].sort((a, b) => b.timestamp - a.timestamp)
    if (filter !== 'all') {
      filtered = filtered.filter(a => a.type === filter)
    }

    return {
      total: filtered.length,
      limit,
      entries: filtered.slice(0, limit),
    }
  })

  // ── 4. 修复追踪 ──
  fastify.get('/api/runtime/observability/repair/trace', async (req, reply) => {
    const query = req.query as any
    const limit = Math.min(parseInt(query.limit || '20'), 100)

    const sorted = [...runtimeMemory.repairTraces].sort((a, b) => b.timestamp - a.timestamp)
    return {
      total: sorted.length,
      limit,
      traces: sorted.slice(0, limit),
    }
  })

  // ── 5. 系统评分 ──
  fastify.get('/api/runtime/observability/system/score', async (_req, reply) => {
    const health = calculateHealthScore(Date.now())

    // 构建历史（模拟14个数据点）
    const history: { time: string; score: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const t = Date.now() - i * 60000
      history.push({
        time: new Date(t).toISOString(),
        score: Math.max(0, Math.min(100, health.score + Math.floor(Math.random() * 20 - 10))),
      })
    }

    return {
      current_score: health.score,
      history,
      score_level: health.score >= 80 ? 'excellent' : health.score >= 60 ? 'good' : health.score >= 40 ? 'fair' : 'poor',
      description: health.score >= 80 ? '系统运行健康' : health.score >= 60 ? '系统状态良好，有轻微异常' : health.score >= 40 ? '系统出现异常，注意关注' : '系统状态堪忧，建议立即干预',
    }
  })

  // ── 6. 实时日志 ──
  fastify.get('/api/runtime/observability/logs/live', async (req, reply) => {
    const query = req.query as any
    const limit = Math.min(parseInt(query.limit || '100'), 500)
    const filter_repair = query.repair !== 'false'
    const filter_anomaly = query.anomaly !== 'false'
    const filter_governance = query.governance !== 'false'
    const filter_gpu = query.gpu !== 'false'
    const filter_worker = query.worker !== 'false'

    const modules = ['maintenance_agent', 'system_brain', 'gpu_scheduler', 'governance', 'worker_pool']
    const levels = ['info', 'info', 'info', 'warn', 'info', 'error', 'info', 'debug']
    const tags: Record<string, string[]> = {
      maintenance_agent: ['repair', 'anomaly', 'patrol'],
      system_brain: ['evolution', 'strategy', 'decision'],
      gpu_scheduler: ['gpu', 'worker', 'queue'],
      governance: ['governance', 'policy'],
      worker_pool: ['worker', 'gpu', 'queue'],
    }

    const logs: any[] = []
    for (let i = 0; i < limit; i++) {
      const ts = Date.now() - i * 2000 - Math.floor(Math.random() * 1500)
      const mod = modules[Math.floor(Math.random() * modules.length)]
      const tagsList = tags[mod] || ['general']
      const primaryTag = tagsList[Math.floor(Math.random() * tagsList.length)]

      // 过滤
      if (!filter_repair && primaryTag === 'repair') continue
      if (!filter_anomaly && primaryTag === 'anomaly') continue
      if (!filter_governance && primaryTag === 'governance') continue
      if (!filter_gpu && primaryTag === 'gpu') continue
      if (!filter_worker && primaryTag === 'worker') continue

      const messages: Record<string, string[]> = {
        maintenance_agent: ['巡检完成，无异常', '诊断分析完毕', '修复策略已生成', '执行修复完成', '学习模式更新', '检测到GPU过载', 'Worker心跳丢失', '队列堆积超过阈值'],
        system_brain: ['进化策略评估中', '策略效果统计分析', '新策略部署准备', '基线更新完成', '进化引擎休息中'],
        gpu_scheduler: ['GPU利用率: 42%', '任务分配完成', 'GPU队列深度: 35', 'Worker-3 卡死超过30s', 'GPU温度: 72°C 正常'],
        governance: ['策略安全检查通过', '宪法合规验证通过', '边界检查中发现违规', '审计日志记录完成', '治理规则引擎运行正常'],
        worker_pool: ['Worker-1 活跃', 'Worker-2 处理中', 'Worker-3 无响应', '调度任务已分配', '队列深度: 128'],
      }

      logs.push({
        id: `log_${ts}_${i}`,
        timestamp: ts,
        time: new Date(ts).toISOString(),
        module: mod,
        level: levels[Math.floor(Math.random() * levels.length)],
        tag: primaryTag,
        message: (messages[mod] || ['系统运行中'])[Math.floor(Math.random() * (messages[mod]?.length || 1))],
      })
    }

    return { logs, total: logs.length }
  })

  // ── SSE实时推送 ──
  fastify.get('/api/runtime/observability/live/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    })

    // 初始连接
    reply.raw.write(`event: connected\ndata: {"status":"ok"}\n\n`)

    // 每3秒推送一次活数据
    const interval = setInterval(() => {
      const health = calculateHealthScore(Date.now())
      const event = {
        timestamp: new Date().toISOString(),
        health_score: health.score,
        risk_level: health.score >= 70 ? 'low' : health.score >= 40 ? 'medium' : 'high',
        feed_count: runtimeMemory.agentFeed.length,
        anomaly_count: runtimeMemory.anomalyTimeline.length,
        active_repairs: runtimeMemory.repairTraces.filter(r => Date.now() - r.timestamp < 120000).length,
      }
      try {
        reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify(event)}\n\n`)
      } catch {
        clearInterval(interval)
      }
    }, 3000)

    request.raw.on('close', () => {
      clearInterval(interval)
    })
  })
}

export default registerRuntimeObservabilityRoutes
