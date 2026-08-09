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
