/**
 * Mission Engine — Frontend Service
 * P0 — FROZEN
 *
 * This service provides both:
 * 1. Legacy mission engine API (fetchMissionCenter, completeMission, etc.)
 * 2. New Mission Workspace API (fetchMissionWorkspace)
 *
 * No Mock / Fake / Placeholder data.
 * All data comes from real API endpoints.
 */
import { geoApi } from './api'

// ── Legacy types (Mission Engine) ────────────────────
export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type MissionDifficulty = 'easy' | 'medium' | 'hard'

export interface Mission {
  id: string
  brandId: string
  title: string
  description: string
  why: string
  impact: {
    dimension: string
    gain: number
    unit: string
  }[]
  estimatedTime: string
  difficulty: MissionDifficulty
  action: {
    label: string
    type: 'navigate' | 'open_drawer' | 'api_call'
    destination: string
    params?: Record<string, string>
  }
  verification?: {
    type: 'schema_exists' | 'claim_exists' | 'evidence_exists' | 'faq_exists' | 'manual'
    param?: string
  }
  status: MissionStatus
  sourceIssueKind: string
  score: number
  createdAt: string
  completedAt?: string
  order: number
}

export interface MissionCenterState {
  brandId: string
  totalMissions: number
  completedMissions: number
  inProgressMissions: number
  pendingMissions: number
  missions: Mission[]
  nextMission?: Mission
  score: number
}

/**
 * Get missions for a brand (Legacy)
 */
export async function fetchMissions(brandId: string): Promise<Mission[]> {
  const res = await geoApi.get<{ success: boolean; data: Mission[] }>(`/missions?brandId=${encodeURIComponent(brandId)}`)
  return res.data
}

/**
 * Get mission center state (Legacy)
 */
export async function fetchMissionCenter(brandId: string): Promise<MissionCenterState> {
  const res = await geoApi.get<{ success: boolean; data: MissionCenterState }>(`/missions/center?brandId=${encodeURIComponent(brandId)}`)
  return res.data
}

/**
 * Mark a mission as completed
 */
export async function completeMission(id: string, brandId: string): Promise<void> {
  await geoApi.post(`/missions/${encodeURIComponent(id)}/complete`, { brandId })
}

/**
 * Skip a mission
 */
export async function skipMission(id: string, brandId: string): Promise<void> {
  await geoApi.post(`/missions/${encodeURIComponent(id)}/skip`, { brandId })
}

/**
 * Regenerate missions for a brand
 */
export async function regenerateMissions(brandId: string): Promise<Mission[]> {
  const res = await geoApi.post<{ success: boolean; data: Mission[] }>(`/missions/regenerate?brandId=${encodeURIComponent(brandId)}`)
  return res.data
}

// ── New Mission Workspace API ────────────────────────

import type { MissionResponse as MissionWorkspaceResponse } from '../types/mission'

/**
 * Fetch missions and summary from the Mission Workspace API.
 * GET /api/geo/workspace/missions
 *
 * Returns { missions: Mission[], summary: MissionSummary }
 * Used by the new Mission Workspace Page (Sprint W-02.2).
 * NOTE: Uses /workspace/missions path to avoid collision with legacy /missions endpoint.
 */
export async function fetchMissionWorkspace(): Promise<MissionWorkspaceResponse> {
  const res = await geoApi.get<{ success: boolean; data: MissionWorkspaceResponse }>('/workspace/missions')
  return res.data
}

// ── AI Probe — 真实 AI 可见度探测 ──

export interface AIVisibilityResult {
  overall: number
  engines: { engine: string; label: string; mentionRate: number; mentionCount: number; totalQuestions: number }[]
  contentQuality: number
  probedAt: string | null
}

export interface KnowledgeQualityResult {
  overallScore: number
  totalKnowledge: number
  qualifiedKnowledge: number
  topIssues: { type: string; message: string }[]
}

export interface ClosedLoopResult {
  optimizationType: string
  executionResult: { success: boolean; itemsCreated: number; details: string; error?: string }
  beforeScore: number
  afterScore: number
  actualImprovement: number
}

// ── Full Closed-Loop Orchestrator ──

export interface ClosedLoopPhase {
  durationMs: number
  score?: number
  mentionRate?: number
  result?: any
}

export interface FullClosedLoopReport {
  success: boolean
  projectId: string
  executedAt: string
  totalDurationMs: number
  phase1_probe: ClosedLoopPhase
  phase2_diagnose: { durationMs: number; report: any }
  phase3_rewrite: { durationMs: number; result: any }
  phase4_reprobe: ClosedLoopPhase
  comparison: {
    beforeScore: number
    afterScore: number
    scoreChange: number
    beforeMentionRate: number
    afterMentionRate: number
    mentionRateChange: number
    knowledgeAdded: number
    knowledgeUpdated: number
  }
  summary: string
}

// ── Diagnosis ──

export interface DiagnosisResult {
  summary: {
    totalQuestions: number
    mentionCount: number
    missCount: number
    overallMentionRate: number
  }
  missedQuestions: Array<{
    question: string
    reason: string
    reasonDetail: string
    confidence: number
  }>
  knowledgeGaps: Array<{
    topic: string
    description: string
    relatedQuestions: string[]
    priority: number
  }>
  contentIssues: Array<{
    type: string
    description: string
    suggestion: string
  }>
  recommendations: Array<{
    action: string
    targetTopic: string
    detail: string
    priority: number
  }>
}

/**
 * 执行 AI 可见度探测
 * POST /api/geo/projects/:id/ai-probe
 */
export async function runAIProbe(brandId: string): Promise<AIVisibilityResult> {
  const res = await geoApi.post<{ success: boolean; data: AIVisibilityResult }>(
    `/projects/${encodeURIComponent(brandId)}/ai-probe`, {}
  )
  return res.data
}

/**
 * 获取知识内容质量检测报告
 * GET /api/geo/projects/:id/knowledge-quality
 */
export async function fetchKnowledgeQuality(brandId: string): Promise<KnowledgeQualityResult> {
  const res = await geoApi.get<{ success: boolean; data: KnowledgeQualityResult }>(
    `/projects/${encodeURIComponent(brandId)}/knowledge-quality`
  )
  return res.data
}

/**
 * 执行闭环优化（Probe→优化→再Probe）
 * POST /api/geo/projects/:id/closed-loop-optimization
 */
export async function runClosedLoopOptimization(
  brandId: string,
  optimizationType: 'knowledge_generation' | 'entity_expansion'
): Promise<ClosedLoopResult> {
  const res = await geoApi.post<{ success: boolean; data: ClosedLoopResult }>(
    `/projects/${encodeURIComponent(brandId)}/closed-loop-optimization`,
    { optimizationType }
  )
  return res.data
}

/**
 * 一键闭环优化（探测→诊断→改写→再探测）
 * POST /api/geo/projects/:id/full-closed-loop
 */
export async function runFullClosedLoop(brandId: string): Promise<FullClosedLoopReport> {
  const res = await geoApi.post<{ success: boolean; data: FullClosedLoopReport }>(
    `/projects/${encodeURIComponent(brandId)}/full-closed-loop`, {}
  )
  return res.data
}

/**
 * 诊断 AI 可见度失败原因
 * POST /api/geo/projects/:id/diagnose
 */
export async function runDiagnosis(brandId: string): Promise<{ probe: AIVisibilityResult; diagnosis: DiagnosisResult }> {
  const res = await geoApi.post<{ success: boolean; data: { probe: AIVisibilityResult; diagnosis: DiagnosisResult } }>(
    `/projects/${encodeURIComponent(brandId)}/diagnose`, {}
  )
  return res.data
}
