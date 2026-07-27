/**
 * Phase 4.5: Agent Observability Runtime
 * 
 * 企业级 Agent 可观测平台：企业不仅能使用 AI 员工，还能看到 AI 员工每天做了什么、花多少钱、效果如何、哪里需要优化。
 * 
 * 核心原则：不修改 Agent Runtime，只观察。
 * 
 * 架构：
 *   Agent Execution → Trace → Metrics → Evaluation → Dashboard
 *                    → Alert → Health Monitor
 */

// ═══════════════════════════════════════════════════════════════
// 1. Agent Trace Types
// ═══════════════════════════════════════════════════════════════

export interface AgentSpan {
  id: string
  traceId: string
  parentId?: string
  type: 'intent' | 'knowledge' | 'tool' | 'llm' | 'output' | 'evaluation' | 'orchestration'
  name: string
  startTime: number
  duration: number            // ms
  input?: unknown
  output?: unknown
  cost: number                // 元
  tokens?: number
  status: 'success' | 'failed' | 'timeout'
  error?: string
  metadata?: Record<string, unknown>
}

export interface AgentTrace {
  id: string
  agent: string
  organizationId?: string
  userId?: string
  userInput: string
  finalOutput?: unknown
  spans: AgentSpan[]
  totalDuration: number
  totalCost: number
  totalTokens: number
  status: 'success' | 'failed' | 'partial'
  evaluationScore?: number
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════
// 2. Agent Metrics Types
// ═══════════════════════════════════════════════════════════════

export interface AgentMetrics {
  agent: string
  period: 'hour' | 'day' | 'week' | 'month'
  timestamp: number
  // 调用量
  totalCalls: number
  successCalls: number
  failedCalls: number
  timeoutCalls: number
  successRate: number          // 0-100
  // 性能
  avgLatency: number           // ms
  p50Latency: number
  p95Latency: number
  p99Latency: number
  // 成本
  totalCost: number            // 元
  avgCost: number
  totalTokens: number
  avgTokens: number
  // 质量
  avgScore: number
  minScore: number
  maxScore: number
}

export interface TokenMetrics {
  organizationId: string
  period: 'day' | 'month'
  totalTokens: number
  totalCost: number
  byProvider: Record<string, { tokens: number; cost: number; calls: number }>
  byAgent: Record<string, { tokens: number; cost: number; calls: number }>
  byWorkbench: Record<string, { tokens: number; cost: number; calls: number }>
  budgetUsagePercent: number
}

export interface QualityMetrics {
  agent: string
  period: 'day' | 'week' | 'month'
  avgAccuracy: number
  avgEvidence: number
  avgReasoning: number
  avgSchema: number
  avgSafety: number
  avgOverall: number
  trend: Array<{ date: string; score: number }>
  topIssues: Array<{ issue: string; count: number }>
}

// ═══════════════════════════════════════════════════════════════
// 3. Alert Types
// ═══════════════════════════════════════════════════════════════

export interface AlertRule {
  id: string
  name: string
  agent?: string               // undefined = all agents
  metric: 'error_rate' | 'cost' | 'latency' | 'score' | 'token_spike'
  threshold: number
  window: number               // 时间窗口（秒）
  severity: 'critical' | 'warning' | 'info'
  action: 'notify' | 'fallback' | 'throttle' | 'disable'
  enabled: boolean
}

export interface Alert {
  id: string
  ruleId: string
  agent: string
  metric: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  value: number
  threshold: number
  timestamp: number
  acknowledged: boolean
}

// ═══════════════════════════════════════════════════════════════
// 4. Agent Health
// ═══════════════════════════════════════════════════════════════

export interface AgentHealth {
  agent: string
  status: 'healthy' | 'degraded' | 'critical' | 'offline'
  lastCheckedAt: number
  metrics: {
    uptime: number            // 0-100
    errorRate: number         // 0-100
    avgLatency: number
    avgScore: number
    costEfficiency: number    // 0-100
  }
  issues: string[]
  recommendations: string[]
}

// ═══════════════════════════════════════════════════════════════
// 5. Dashboard Report
// ═══════════════════════════════════════════════════════════════

export interface ObservabilityDashboard {
  generatedAt: number
  period: 'day' | 'week' | 'month'
  // 总览
  overview: {
    totalAgents: number
    activeAgents: number
    totalCalls: number
    totalCost: number
    avgSuccessRate: number
    avgQualityScore: number
  }
  // 按 Agent
  agents: Array<{
    agent: string
    status: 'healthy' | 'degraded' | 'critical' | 'offline'
    calls: number
    successRate: number
    avgLatency: number
    avgScore: number
    totalCost: number
    costPercent: number
  }>
  // 按企业
  organizations?: Array<{
    organizationId: string
    totalCalls: number
    totalCost: number
    avgScore: number
    budgetUsagePercent: number
  }>
  // 告警
  alerts: Alert[]
  // 趋势
  trends: {
    calls: Array<{ date: string; value: number }>
    cost: Array<{ date: string; value: number }>
    quality: Array<{ date: string; value: number }>
  }
}
