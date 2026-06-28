/**
 * r11-api.ts
 *
 * R11 Observability Console — API consumer
 *
 * 与前端的唯一接口层。
 * 直接从浏览器调 R11UIService 的纯数据投影。
 * 所有数据都是 derived + passive — 不含任何后端存储。
 *
 * 注意：当前 R11 后端是 TypeScript 服务端代码。
 * 前端通过 API 路由接收投影数据。
 * 这里只定义了接口契约，后端路由另行注册。
 */

export interface LayoutNode {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  incomingCount: number
  outgoingCount: number
  domainId?: string
  rawSnippet?: string
}

export interface LayoutEdge {
  from: string
  to: string
  type: string
  path: Array<{ x: number; y: number }>
}

export interface GraphRenderData {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

export interface DiffRenderData {
  baselineId: string
  currentId: string
  stats: {
    equal: number
    modified: number
    added: number
    removed: number
  }
  changes: Array<{
    changeType: string
    nodeId: string
    color: string
    detail?: string
  }>
}

export interface ReplayStepRender {
  step: number
  nodeId: string
  nodeType: string
  incomingFrom: string[]
  outgoingTo: string[]
  label: string
}

export interface ReplayRenderData {
  domain: string
  iteration: number
  totalSteps: number
  deterministic: boolean
  traceHash: string
  steps: ReplayStepRender[]
}

export interface FidelityInfo {
  score: number
  nodeLoss: number
  edgeLoss: number
  semanticRetention: number
}

import type { FidelityInfo } from './r11-api'

// ── Drift Monitor types ────────────────────────────────────

export interface DriftTimelinePoint {
  fromTimestamp: number
  toTimestamp: number
  fidelityScore: number
  projectionDrift: boolean
  replayDrift: boolean
  regression: boolean
}

export interface AdapterChangeResult {
  stable: boolean
  degraded: boolean
  versionChanged: boolean
  oldVersion: string
  newVersion: string
  delta: number
}

export interface DriftTimelineData {
  domains: string[]
  totalRecords: number
  latestFidelity: number
  trend: DriftTimelinePoint[]
  regressionCount: number
  adapterChanges: AdapterChangeResult[]
}

/**
 * Fetch graph view data from R11 backend.
 */
export async function fetchGraphView(
  domain: string,
  rawGraph: any,
  viewMode: 'raw' | 'normalized' = 'normalized'
): Promise<GraphRenderData | null> {
  try {
    const res = await fetch('/api/r11/graph-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, rawGraph, viewMode }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Fetch diff timeline data.
 */
export async function fetchDiffView(params: {
  domain: string
  baseline: any
  current: any
  baselineId: string
  currentId: string
}): Promise<DiffRenderData | null> {
  try {
    const res = await fetch('/api/r11/diff-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Fetch replay trace data.
 */
export async function fetchReplayView(
  domain: string,
  rawGraph: any,
  iteration: number = 1
): Promise<ReplayRenderData | null> {
  try {
    const res = await fetch('/api/r11/replay-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, rawGraph, iteration }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Fetch fidelity check.
 */
export async function fetchFidelity(
  domain: string,
  rawGraph: any
): Promise<FidelityInfo | null> {
  try {
    const res = await fetch('/api/r11/fidelity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, rawGraph }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Phase 3B: Drift Monitor ──────────────────────────────────

/**
 * Fetch drift timeline data.
 */
export async function fetchDriftTimeline(
  domain?: string
): Promise<DriftTimelineData | null> {
  try {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : ''
    const res = await fetch(`/api/r11/drift/timeline${params}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Record a drift snapshot.
 */
export async function recordDriftSnapshot(
  domain: string,
  rawGraph: any,
  runId?: string
): Promise<any> {
  try {
    const res = await fetch('/api/r11/drift/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, rawGraph, runId: runId ?? `run-${Date.now()}` }),
    })
    if (!res.ok) throw new Error('record failed')
    return res.json()
  } catch {
    return null
  }
}

/**
 * Clear all drift history.
 */
export async function clearDriftHistory(): Promise<boolean> {
  try {
    const res = await fetch('/api/r11/drift/clear', { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}
