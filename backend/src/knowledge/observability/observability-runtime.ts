/**
 * Phase 4.5: Agent Observability Runtime
 * 
 * 核心运行时：Trace + Metrics + Analytics + Alert + Dashboard
 */

import type {
  AgentSpan,
  AgentTrace,
  AgentMetrics,
  TokenMetrics,
  QualityMetrics,
  AlertRule,
  Alert,
  AgentHealth,
  ObservabilityDashboard,
} from './types'

// ═══════════════════════════════════════════════════════════════
// 1. Trace Recorder（链路记录器）
// ═══════════════════════════════════════════════════════════════

export class TraceRecorder {
  private activeTraces = new Map<string, AgentTrace>()
  private completedTraces: AgentTrace[] = []
  private spans = new Map<string, AgentSpan[]>()

  /**
   * 开始 Trace
   */
  startTrace(params: {
    agent: string
    userInput: string
    organizationId?: string
    userId?: string
  }): string {
    const traceId = this.generateId('trace')
    const trace: AgentTrace = {
      id: traceId,
      agent: params.agent,
      organizationId: params.organizationId,
      userId: params.userId,
      userInput: params.userInput,
      spans: [],
      totalDuration: 0,
      totalCost: 0,
      totalTokens: 0,
      status: 'success',
      timestamp: Date.now(),
    }
    this.activeTraces.set(traceId, trace)
    this.spans.set(traceId, [])
    return traceId
  }

  /**
   * 记录 Span
   */
  recordSpan(params: {
    traceId: string
    type: AgentSpan['type']
    name: string
    input?: unknown
    output?: unknown
    cost?: number
    tokens?: number
    duration: number
    status?: AgentSpan['status']
    error?: string
    metadata?: Record<string, unknown>
  }): string {
    const spanId = this.generateId('span')
    const span: AgentSpan = {
      id: spanId,
      traceId: params.traceId,
      type: params.type,
      name: params.name,
      startTime: Date.now(),
      duration: params.duration,
      input: params.input,
      output: params.output,
      cost: params.cost || 0,
      tokens: params.tokens || 0,
      status: params.status || 'success',
      error: params.error,
      metadata: params.metadata,
    }

    const traceSpans = this.spans.get(params.traceId) || []
    traceSpans.push(span)
    this.spans.set(params.traceId, traceSpans)

    return spanId
  }

  /**
   * 结束 Trace
   */
  endTrace(traceId: string, params?: {
    finalOutput?: unknown
    status?: AgentTrace['status']
    evaluationScore?: number
  }): AgentTrace | null {
    const trace = this.activeTraces.get(traceId)
    if (!trace) return null

    const spans = this.spans.get(traceId) || []
    trace.spans = spans
    trace.totalDuration = spans.reduce((sum, s) => sum + s.duration, 0)
    trace.totalCost = spans.reduce((sum, s) => sum + s.cost, 0)
    trace.totalTokens = spans.reduce((sum, s) => sum + (s.tokens || 0), 0)

    if (params?.finalOutput !== undefined) trace.finalOutput = params.finalOutput
    if (params?.status) trace.status = params.status
    if (params?.evaluationScore !== undefined) trace.evaluationScore = params.evaluationScore

    this.activeTraces.delete(traceId)
    this.spans.delete(traceId)
    this.completedTraces.push(trace)

    return trace
  }

  /**
   * 获取 Trace
   */
  getTrace(traceId: string): AgentTrace | null {
    return this.activeTraces.get(traceId) || this.completedTraces.find(t => t.id === traceId) || null
  }

  /**
   * 查询 Traces
   */
  queryTraces(filter?: {
    agent?: string
    organizationId?: string
    status?: string
    startTime?: number
    endTime?: number
    limit?: number
  }): AgentTrace[] {
    let traces = this.completedTraces
    if (filter?.agent) traces = traces.filter(t => t.agent === filter.agent)
    if (filter?.organizationId) traces = traces.filter(t => t.organizationId === filter.organizationId)
    if (filter?.status) traces = traces.filter(t => t.status === filter.status)
    if (filter?.startTime) traces = traces.filter(t => t.timestamp >= filter.startTime!)
    if (filter?.endTime) traces = traces.filter(t => t.timestamp <= filter.endTime!)
    return traces.slice(0, filter?.limit || 100)
  }

  /**
   * 获取统计
   */
  getStats(): { activeTraces: number; completedTraces: number; totalSpans: number } {
    return {
      activeTraces: this.activeTraces.size,
      completedTraces: this.completedTraces.length,
      totalSpans: this.completedTraces.reduce((sum, t) => sum + t.spans.length, 0),
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. Metrics Collector（指标收集器）
// ═══════════════════════════════════════════════════════════════

export class MetricsCollector {
  private metrics: AgentMetrics[] = []
  private tokenMetrics = new Map<string, TokenMetrics>()
  private qualityMetrics: QualityMetrics[] = []

  /**
   * 记录 Agent 指标
   */
  recordAgentMetrics(params: Omit<AgentMetrics, 'timestamp'>): void {
    this.metrics.push({ ...params, timestamp: Date.now() })
  }

  /**
   * 从 Trace 自动聚合指标
   */
  aggregateFromTraces(traces: AgentTrace[], agent: string, period: AgentMetrics['period']): AgentMetrics {
    if (traces.length === 0) {
      return this.emptyMetrics(agent, period)
    }

    const latencies = traces.flatMap(t => t.spans.map(s => s.duration)).sort((a, b) => a - b)
    const costs = traces.map(t => t.totalCost)
    const tokens = traces.map(t => t.totalTokens)
    const scores = traces.filter(t => t.evaluationScore !== undefined).map(t => t.evaluationScore!)
    const successCount = traces.filter(t => t.status === 'success').length

    const metrics: AgentMetrics = {
      agent,
      period,
      timestamp: Date.now(),
      totalCalls: traces.length,
      successCalls: successCount,
      failedCalls: traces.filter(t => t.status === 'failed').length,
      timeoutCalls: traces.filter(t => t.status === 'partial').length,
      successRate: Math.round((successCount / traces.length) * 100),
      avgLatency: Math.round(this.avg(latencies)),
      p50Latency: this.percentile(latencies, 50),
      p95Latency: this.percentile(latencies, 95),
      p99Latency: this.percentile(latencies, 99),
      totalCost: costs.reduce((a, b) => a + b, 0),
      avgCost: this.avg(costs),
      totalTokens: tokens.reduce((a, b) => a + b, 0),
      avgTokens: Math.round(this.avg(tokens)),
      avgScore: scores.length > 0 ? Math.round(this.avg(scores)) : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    }

    this.metrics.push(metrics)
    return metrics
  }

  /**
   * 记录 Token 指标
   */
  recordTokenMetrics(params: TokenMetrics): void {
    this.tokenMetrics.set(`${params.organizationId}_${params.period}`, params)
  }

  /**
   * 记录质量指标
   */
  recordQualityMetrics(params: QualityMetrics): void {
    this.qualityMetrics.push(params)
  }

  /**
   * 获取 Agent 指标
   */
  getAgentMetrics(agent: string, period?: AgentMetrics['period']): AgentMetrics[] {
    let filtered = this.metrics.filter(m => m.agent === agent)
    if (period) filtered = filtered.filter(m => m.period === period)
    return filtered
  }

  /**
   * 获取 Token 指标
   */
  getTokenMetrics(organizationId: string, period: 'day' | 'month'): TokenMetrics | null {
    return this.tokenMetrics.get(`${organizationId}_${period}`) || null
  }

  /**
   * 获取质量指标
   */
  getQualityMetrics(agent: string, period?: QualityMetrics['period']): QualityMetrics[] {
    let filtered = this.qualityMetrics.filter(m => m.agent === agent)
    if (period) filtered = filtered.filter(m => m.period === period)
    return filtered
  }

  /**
   * 获取所有 Agent 列表
   */
  getAllAgents(): string[] {
    return [...new Set(this.metrics.map(m => m.agent))]
  }

  private emptyMetrics(agent: string, period: AgentMetrics['period']): AgentMetrics {
    return {
      agent, period, timestamp: Date.now(),
      totalCalls: 0, successCalls: 0, failedCalls: 0, timeoutCalls: 0,
      successRate: 0, avgLatency: 0, p50Latency: 0, p95Latency: 0, p99Latency: 0,
      totalCost: 0, avgCost: 0, totalTokens: 0, avgTokens: 0,
      avgScore: 0, minScore: 0, maxScore: 0,
    }
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. Alert Engine（告警引擎）
// ═══════════════════════════════════════════════════════════════

export class AlertEngine {
  private rules = new Map<string, AlertRule>()
  private alerts: Alert[] = []

  /**
   * 注册告警规则
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * 评估告警
   */
  evaluate(metrics: AgentMetrics): Alert[] {
    const triggered: Alert[] = []

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue
      if (rule.agent && rule.agent !== metrics.agent) continue

      let value = 0
      switch (rule.metric) {
        case 'error_rate':
          value = 100 - metrics.successRate
          break
        case 'cost':
          value = metrics.totalCost
          break
        case 'latency':
          value = metrics.avgLatency
          break
        case 'score':
          value = metrics.avgScore
          break
        case 'token_spike':
          value = metrics.totalTokens
          break
      }

      const triggered_alert = value >= rule.threshold
      if (triggered_alert || (rule.metric === 'score' && value <= rule.threshold)) {
        const alert: Alert = {
          id: this.generateId(),
          ruleId: rule.id,
          agent: metrics.agent,
          metric: rule.metric,
          severity: rule.severity,
          message: this.formatAlertMessage(rule, value, metrics.agent),
          value,
          threshold: rule.threshold,
          timestamp: Date.now(),
          acknowledged: false,
        }
        triggered.push(alert)
        this.alerts.push(alert)
      }
    }

    return triggered
  }

  /**
   * 获取告警
   */
  getAlerts(filter?: { agent?: string; severity?: string; acknowledged?: boolean }): Alert[] {
    let alerts = this.alerts
    if (filter?.agent) alerts = alerts.filter(a => a.agent === filter.agent)
    if (filter?.severity) alerts = alerts.filter(a => a.severity === filter.severity)
    if (filter?.acknowledged !== undefined) alerts = alerts.filter(a => a.acknowledged === filter.acknowledged)
    return alerts
  }

  /**
   * 确认告警
   */
  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (!alert) return false
    alert.acknowledged = true
    return true
  }

  private formatAlertMessage(rule: AlertRule, value: number, agent: string): string {
    const unit = rule.metric === 'cost' ? '¥' : rule.metric === 'latency' ? 'ms' : rule.metric === 'score' ? '分' : '%'
    return `[${agent}] ${rule.name}: ${value}${unit} (阈值: ${rule.threshold}${unit})`
  }

  private generateId(): string {
    return `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. Agent Health Monitor（健康监控）
// ═══════════════════════════════════════════════════════════════

export class AgentHealthMonitor {
  constructor(private metricsCollector: MetricsCollector) {}

  /**
   * 获取 Agent 健康状态
   */
  getHealth(agent: string): AgentHealth {
    const metrics = this.metricsCollector.getAgentMetrics(agent, 'day')
    const latest = metrics[metrics.length - 1]

    if (!latest) {
      return {
        agent,
        status: 'offline',
        lastCheckedAt: Date.now(),
        metrics: { uptime: 0, errorRate: 0, avgLatency: 0, avgScore: 0, costEfficiency: 0 },
        issues: ['无运行数据'],
        recommendations: ['检查 Agent 是否已注册'],
      }
    }

    const errorRate = 100 - latest.successRate
    const issues: string[] = []
    const recommendations: string[] = []

    if (errorRate > 5) {
      issues.push(`错误率过高: ${errorRate.toFixed(1)}%`)
      recommendations.push('检查 LLM Provider 连接')
    }
    if (latest.avgLatency > 5000) {
      issues.push(`延迟过高: ${latest.avgLatency}ms`)
      recommendations.push('优化 Prompt 或切换到更快的模型')
    }
    if (latest.avgScore > 0 && latest.avgScore < 70) {
      issues.push(`质量评分偏低: ${latest.avgScore}`)
      recommendations.push('运行 Regression Test 检查 Prompt 版本')
    }

    let status: AgentHealth['status'] = 'healthy'
    if (issues.length >= 2) status = 'critical'
    else if (issues.length === 1) status = 'degraded'

    return {
      agent,
      status,
      lastCheckedAt: Date.now(),
      metrics: {
        uptime: latest.successRate,
        errorRate,
        avgLatency: latest.avgLatency,
        avgScore: latest.avgScore,
        costEfficiency: Math.max(0, 100 - Math.round(latest.avgCost * 10000)),
      },
      issues,
      recommendations,
    }
  }

  /**
   * 获取所有 Agent 健康状态
   */
  getAllHealth(): AgentHealth[] {
    const agents = this.metricsCollector.getAllAgents()
    return agents.map(agent => this.getHealth(agent))
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. Observability Runtime 主类
// ═══════════════════════════════════════════════════════════════

export class ObservabilityRuntime {
  private traceRecorder = new TraceRecorder()
  private metricsCollector = new MetricsCollector()
  private alertEngine = new AlertEngine()
  private healthMonitor: AgentHealthMonitor

  constructor() {
    this.healthMonitor = new AgentHealthMonitor(this.metricsCollector)
    this.registerDefaultRules()
  }

  /**
   * 获取 Trace Recorder
   */
  getTracer(): TraceRecorder {
    return this.traceRecorder
  }

  /**
   * 获取 Metrics Collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector
  }

  /**
   * 获取 Alert Engine
   */
  getAlertEngine(): AlertEngine {
    return this.alertEngine
  }

  /**
   * 获取 Health Monitor
   */
  getHealthMonitor(): AgentHealthMonitor {
    return this.healthMonitor
  }

  /**
   * 生成 Dashboard 报告
   */
  generateDashboard(period: 'day' | 'week' | 'month' = 'day'): ObservabilityDashboard {
    const agents = this.metricsCollector.getAllAgents()
    const agentStats = agents.map(agent => {
      const metrics = this.metricsCollector.getAgentMetrics(agent, period)
      const latest = metrics[metrics.length - 1]
      const health = this.healthMonitor.getHealth(agent)
      return {
        agent,
        status: health.status,
        calls: latest?.totalCalls || 0,
        successRate: latest?.successRate || 0,
        avgLatency: latest?.avgLatency || 0,
        avgScore: latest?.avgScore || 0,
        totalCost: latest?.totalCost || 0,
        costPercent: 0, // 稍后计算
      }
    })

    const totalCost = agentStats.reduce((sum, a) => sum + a.totalCost, 0)
    for (const stat of agentStats) {
      stat.costPercent = totalCost > 0 ? Math.round((stat.totalCost / totalCost) * 100) : 0
    }

    return {
      generatedAt: Date.now(),
      period,
      overview: {
        totalAgents: agents.length,
        activeAgents: agentStats.filter(a => a.status === 'healthy').length,
        totalCalls: agentStats.reduce((sum, a) => sum + a.calls, 0),
        totalCost,
        avgSuccessRate: Math.round(this.avg(agentStats.map(a => a.successRate))),
        avgQualityScore: Math.round(this.avg(agentStats.map(a => a.avgScore))),
      },
      agents: agentStats,
      alerts: this.alertEngine.getAlerts({ acknowledged: false }).slice(0, 10),
      trends: {
        calls: metrics_to_trend(this.metricsCollector, 'totalCalls', period),
        cost: metrics_to_trend(this.metricsCollector, 'totalCost', period),
        quality: metrics_to_trend(this.metricsCollector, 'avgScore', period),
      },
    }
  }

  /**
   * 记录完整 Trace（从执行到评估）
   */
  recordFullTrace(params: {
    traceId: string
    agent: string
    spans: Array<Omit<AgentSpan, 'id' | 'traceId'>>
    finalOutput?: unknown
    evaluationScore?: number
    organizationId?: string
  }): AgentTrace | null {
    for (const span of params.spans) {
      this.traceRecorder.recordSpan({
        traceId: params.traceId,
        ...span,
      })
    }

    return this.traceRecorder.endTrace(params.traceId, {
      finalOutput: params.finalOutput,
      evaluationScore: params.evaluationScore,
      status: 'success',
    })
  }

  /**
   * 运行 Metrics Pipeline
   */
  runMetricsPipeline(agent: string, period: AgentMetrics['period'] = 'day'): AgentMetrics {
    const traces = this.traceRecorder.queryTraces({ agent, limit: 10000 })
    const metrics = this.metricsCollector.aggregateFromTraces(traces, agent, period)
    this.alertEngine.evaluate(metrics)
    return metrics
  }

  private registerDefaultRules(): void {
    this.alertEngine.registerRule({
      id: 'error_rate_critical',
      name: '错误率过高',
      metric: 'error_rate',
      threshold: 10,
      window: 300,
      severity: 'critical',
      action: 'fallback',
      enabled: true,
    })
    this.alertEngine.registerRule({
      id: 'cost_daily_limit',
      name: '日成本超限',
      metric: 'cost',
      threshold: 100,
      window: 86400,
      severity: 'warning',
      action: 'throttle',
      enabled: true,
    })
    this.alertEngine.registerRule({
      id: 'latency_high',
      name: '延迟过高',
      metric: 'latency',
      threshold: 5000,
      window: 300,
      severity: 'warning',
      action: 'notify',
      enabled: true,
    })
    this.alertEngine.registerRule({
      id: 'score_low',
      name: '质量评分过低',
      metric: 'score',
      threshold: 70,
      window: 3600,
      severity: 'warning',
      action: 'notify',
      enabled: true,
    })
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
  }
}

// 辅助函数
function metrics_to_trend(
  collector: MetricsCollector,
  field: keyof AgentMetrics,
  period: AgentMetrics['period'],
): Array<{ date: string; value: number }> {
  const agents = collector.getAllAgents()
  const result: Array<{ date: string; value: number }> = []
  
  for (const agent of agents) {
    const metrics = collector.getAgentMetrics(agent, period)
    for (const m of metrics.slice(-7)) {
      const date = new Date(m.timestamp).toLocaleDateString()
      const value = m[field] as number
      const existing = result.find(r => r.date === date)
      if (existing) {
        existing.value += value
      } else {
        result.push({ date, value })
      }
    }
  }
  
  return result
}
