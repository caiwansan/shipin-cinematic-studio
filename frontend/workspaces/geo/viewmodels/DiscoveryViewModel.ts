/**
 * DiscoveryViewModel — 统一 ViewModel 层
 *
 * Discovery 页面的所有 UI 状态和 KPI 都从这里输出。
 * 组件只负责渲染 ViewModel，不写条件逻辑。
 */

import type { DiscoveryReport, DiscoveryOpportunity } from '../services/discoveryService'

export type DiscoveryStatus = 'idle' | 'loading' | 'running' | 'completed' | 'empty' | 'error'

export interface DiscoveryVM {
  /** 统一状态 */
  status: DiscoveryStatus
  /** 错误信息 */
  error: string | null
  /** 品牌名 */
  brandName: string
  /** 搜索输入（query） */
  query: string
  /** 当前是否有已加载的 report */
  hasReport: boolean

  // ── Hero Header ──
  hero: {
    brandName: string
    adi: number
    lastScan: string         // 格式: "2 minutes ago" 或 "--"
    scanStatus: string       // "Ready to Scan" / "Scanning…" / "Completed" / "Failed"
    isRunning: boolean
    isCompleted: boolean
    actions: {
      runScan: boolean       // 是否显示 Run Scan 按钮
      rescan: boolean         // 是否显示 Rescan 按钮
    }
  }

  // ── Snapshot ──
  snapshot: {
    adi: number
    scenariosTotal: number
    opportunitiesTotal: number
    highPriorityCount: number
    isComplete: boolean       // snapshot 是否有意义
  }

  // ── Progress (Running & Completed) ──
  progress: {
    percent: number           // 0-100
    isRunning: boolean
    isCompleted: boolean
    steps: string[]           // 已完成步骤列表
  }

  // ── Opportunities Preview ──
  opportunities: {
    items: OpportunityPreviewItem[]
    total: number
    showAll: boolean          // 是否显示"View All"
  }

  // ── Bottom CTA ──
  cta: {
    label: string
    action: 'run-scan' | 'goto-knowledge' | 'goto-packaging' | 'goto-dashboard' | 'noop'
    visible: boolean
  }
}

export interface OpportunityPreviewItem {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  expectedAdiGain: number
  suggestion: string
  actionUrl: string
}

export function buildEmptyVM(query?: string): DiscoveryVM {
  return {
    status: query ? 'idle' : 'empty',
    error: null,
    brandName: query || '',
    query: query || '',
    hasReport: false,
    hero: {
      brandName: query || '—',
      adi: 0,
      lastScan: '—',
      scanStatus: query ? 'Ready to Scan' : 'No Brand Selected',
      isRunning: false,
      isCompleted: false,
      actions: { runScan: !!query, rescan: false },
    },
    snapshot: { adi: 0, scenariosTotal: 0, opportunitiesTotal: 0, highPriorityCount: 0, isComplete: false },
    progress: { percent: 0, isRunning: false, isCompleted: false, steps: [] },
    opportunities: { items: [], total: 0, showAll: false },
    cta: { label: query ? 'Run Discovery Scan' : 'Create Brand', action: query ? 'run-scan' : 'goto-dashboard', visible: true },
  }
}

export function buildLoadingVM(query: string): DiscoveryVM {
  return {
    status: 'loading',
    error: null,
    brandName: query,
    query,
    hasReport: false,
    hero: {
      brandName: query,
      adi: 0,
      lastScan: '—',
      scanStatus: 'Scanning…',
      isRunning: true,
      isCompleted: false,
      actions: { runScan: false, rescan: false },
    },
    snapshot: { adi: 0, scenariosTotal: 0, opportunitiesTotal: 0, highPriorityCount: 0, isComplete: false },
    progress: { percent: 30, isRunning: true, isCompleted: false, steps: ['Starting discovery scan…'] },
    opportunities: { items: [], total: 0, showAll: false },
    cta: { label: 'Scanning…', action: 'noop', visible: false },
  }
}

export function buildRunningVM(query: string): DiscoveryVM {
  return {
    status: 'running',
    error: null,
    brandName: query,
    query,
    hasReport: true,
    hero: {
      brandName: query,
      adi: 0,
      lastScan: '—',
      scanStatus: 'Scanning in Progress…',
      isRunning: true,
      isCompleted: false,
      actions: { runScan: false, rescan: false },
    },
    snapshot: { adi: 0, scenariosTotal: 0, opportunitiesTotal: 0, highPriorityCount: 0, isComplete: false },
    progress: { percent: 65, isRunning: true, isCompleted: false, steps: ['Scenario matching', 'AI presence scanning', 'Detecting opportunities'] },
    opportunities: { items: [], total: 0, showAll: false },
    cta: { label: 'Scanning…', action: 'noop', visible: false },
  }
}

export function buildCompletedVM(report: DiscoveryReport, query: string): DiscoveryVM {
  const opportunities: OpportunityPreviewItem[] = (report.opportunities || [])
    .sort((a, b) => b.expectedAdiGain - a.expectedAdiGain)
    .slice(0, 5)
    .map(o => ({
      id: o.id,
      title: o.scenarioName || o.id,
      priority: o.priority,
      expectedAdiGain: o.expectedAdiGain,
      suggestion: o.suggestion,
      actionUrl: `/workspace/geo/knowledge`,
    }))

  const highPriority = report.opportunities?.filter(o => o.priority === 'high').length || 0

  return {
    status: 'completed',
    error: null,
    brandName: query,
    query,
    hasReport: true,
    hero: {
      brandName: query,
      adi: report.adi,
      lastScan: 'Just now',
      scanStatus: 'Completed',
      isRunning: false,
      isCompleted: true,
      actions: { runScan: false, rescan: true },
    },
    snapshot: {
      adi: report.adi,
      scenariosTotal: report.scenarios?.length || 0,
      opportunitiesTotal: report.opportunities?.length || 0,
      highPriorityCount: highPriority,
      isComplete: true,
    },
    progress: {
      percent: 100,
      isRunning: false,
      isCompleted: true,
      steps: [
        'Scenario matching completed',
        'AI presence scan completed',
        'ADI calculation completed',
        'Opportunity detection completed',
        'Action plan generated',
      ],
    },
    opportunities: {
      items: opportunities,
      total: report.opportunities?.length || 0,
      showAll: (report.opportunities?.length || 0) > 5,
    },
    cta: {
      label: 'Continue to Knowledge Workspace',
      action: 'goto-knowledge',
      visible: true,
    },
  }
}

export function buildErrorVM(query: string, error: string): DiscoveryVM {
  return {
    status: 'error',
    error,
    brandName: query,
    query,
    hasReport: false,
    hero: {
      brandName: query,
      adi: 0,
      lastScan: '—',
      scanStatus: 'Failed',
      isRunning: false,
      isCompleted: false,
      actions: { runScan: true, rescan: false },
    },
    snapshot: { adi: 0, scenariosTotal: 0, opportunitiesTotal: 0, highPriorityCount: 0, isComplete: false },
    progress: { percent: 0, isRunning: false, isCompleted: false, steps: [] },
    opportunities: { items: [], total: 0, showAll: false },
    cta: { label: 'Retry Scan', action: 'run-scan', visible: true },
  }
}
