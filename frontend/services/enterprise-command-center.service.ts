/**
 * Enterprise Command Center Service
 * 
 * 责任：从 Backend API 获取数据，包装为 Envelope
 * 禁止：缓存 / 状态管理 / UI 逻辑 / confidence 计算 / mock fallback
 */

import type {
  EnterpriseDataEnvelope,
  MetricValue,
  Decision,
  ActionProgress,
  Signal,
  ChannelAccount,
  SyncStatus,
  Outcome,
  EvidenceGraph,
} from '~/types/enterprise-envelope'

const API_BASE = '/api/enterprise'

async function fetchEnvelope<T>(
  path: string,
  source: string,
  tenantId: string
): Promise<EnterpriseDataEnvelope<T>> {
  const headers: Record<string, string> = {}
  const token = useAuthStore()?.getToken?.()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/${tenantId}${path}`, { headers })
  
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`)
  }

  const json = await res.json()
  
  return {
    data: json.data as T,
    source,
    freshness: new Date().toISOString(),
    confidence: json.confidence,
    timestamp: new Date().toISOString(),
  }
}

// ─── Today Intelligence ───

export async function getTodayMetrics(tenantId: string): Promise<EnterpriseDataEnvelope<any>> {
  return fetchEnvelope('/dashboard', 'OperationEvent', tenantId)
}

// ─── Decision Queue ───

export async function getDecisionQueue(tenantId: string, limit = 3): Promise<EnterpriseDataEnvelope<Decision>[]> {
  const envelope = await fetchEnvelope<any>(`/decisions/top?limit=${limit}`, 'DecisionEngine', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map((d: any) => ({
    ...envelope,
    data: {
      id: d.id,
      title: d.title,
      rationale: d.rationale || '',
      priorityLevel: d.priorityLevel,
      priorityScore: d.priorityScore,
      decisionStatus: d.decisionStatus,
      confidence: d.confidence,
      impact: d.expectedImpact || (d.impact ? `Impact: ${d.impact}` : undefined),
      recommendation: d.actionPlan,
      evidence: d.evidenceGraph,
    } as Decision,
  }))
}

export async function getEvidence(tenantId: string, decisionId: string): Promise<EnterpriseDataEnvelope<EvidenceGraph>> {
  return fetchEnvelope(`/decisions/${decisionId}/evidence`, 'EvidenceGraph', tenantId)
}

export async function acceptDecision(tenantId: string, decisionId: string, note: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useAuthStore()?.getToken?.()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/${tenantId}/decisions/${decisionId}/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ note }),
  })

  if (!res.ok) throw new Error(`Accept failed: ${res.status}`)
}

export async function rejectDecision(tenantId: string, decisionId: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useAuthStore()?.getToken?.()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/${tenantId}/decisions/${decisionId}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })

  if (!res.ok) throw new Error(`Reject failed: ${res.status}`)
}

// ─── Execution Timeline ───

/**
 * 将 Backend Action 数据映射为前端 ActionProgress
 */
function mapActionEnvelope(envelope: EnterpriseDataEnvelope<any>) {
  return (a: any): EnterpriseDataEnvelope<ActionProgress> => ({
    ...envelope,
    data: {
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status,
      priority: a.priority,
      ownerType: a.ownerType,
      ownerId: a.ownerId,
      ownerName: a.ownerName || a.ownerId,
      triggerSource: a.decisionId ? `Decision: ${a.decisionId.slice(0, 8)}` : undefined,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      expectedOutcome: a.expectedOutcome,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    } as ActionProgress,
  })
}

export async function getActiveActions(tenantId: string): Promise<EnterpriseDataEnvelope<ActionProgress>[]> {
  // Backend uses 'executing' not 'running'
  const envelope = await fetchEnvelope<any>(`/actions/history?status=executing`, 'ActionLifecycle', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map(mapActionEnvelope(envelope))
}

export async function getPendingApprovalActions(tenantId: string): Promise<EnterpriseDataEnvelope<ActionProgress>[]> {
  // Backend uses 'pending' not 'pending_approval'
  const envelope = await fetchEnvelope<any>(`/actions/history?status=pending`, 'ActionLifecycle', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map(mapActionEnvelope(envelope))
}

export async function getAllActions(tenantId: string): Promise<EnterpriseDataEnvelope<ActionProgress>[]> {
  const envelope = await fetchEnvelope<any>(`/actions/history?limit=20`, 'ActionLifecycle', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map(mapActionEnvelope(envelope))
}

export async function approveAction(tenantId: string, actionId: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useAuthStore()?.getToken?.()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/${tenantId}/actions/${actionId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })

  if (!res.ok) throw new Error(`Approve failed: ${res.status}`)
}

export async function rejectAction(tenantId: string, actionId: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useAuthStore()?.getToken?.()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/${tenantId}/actions/${actionId}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })

  if (!res.ok) throw new Error(`Reject failed: ${res.status}`)
}

// ─── Signals ───

export async function getSignals(tenantId: string): Promise<EnterpriseDataEnvelope<Signal>[]> {
  const envelope = await fetchEnvelope<any>('/signals', 'OperationEvent', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map((s: Signal) => ({
    ...envelope,
    data: s,
  }))
}

// ─── Channel Health ───

export async function getChannelStatus(tenantId: string): Promise<EnterpriseDataEnvelope<ChannelAccount>[]> {
  const envelope = await fetchEnvelope<any>('/channels/accounts', 'ChannelSync', tenantId)
  
  const data = Array.isArray(envelope.data) ? envelope.data : []
  return data.map((c: ChannelAccount) => ({
    ...envelope,
    data: c,
  }))
}

export async function getSyncStatus(tenantId: string): Promise<EnterpriseDataEnvelope<SyncStatus>> {
  return fetchEnvelope('/dashboard/channels', 'ChannelSync', tenantId)
}

// ─── Outcome ───

export async function getLatestOutcome(tenantId: string): Promise<EnterpriseDataEnvelope<Outcome>> {
  return fetchEnvelope('/outcomes?limit=1', 'OutcomeIntelligence', tenantId)
}
