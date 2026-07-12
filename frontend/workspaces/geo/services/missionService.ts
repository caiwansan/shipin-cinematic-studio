/**
 * Mission Engine — Frontend Service
 * P0 — FROZEN
 *
 * This service provides both:
 * 1. Legacy mission engine API (fetchMissionCenter, completeMission, etc.)
 * 2. New Mission Workspace API (fetchMissions)
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

const API_BASE = '/api/geo'

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  }

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Unknown API error')
  }
  return json.data
}

/**
 * Get missions for a brand (Legacy)
 */
export async function fetchMissions(brandId: string): Promise<Mission[]> {
  return apiFetch<Mission[]>(`${API_BASE}/missions?brandId=${encodeURIComponent(brandId)}`)
}

/**
 * Get mission center state (Legacy)
 */
export async function fetchMissionCenter(brandId: string): Promise<MissionCenterState> {
  return apiFetch<MissionCenterState>(`${API_BASE}/missions/center?brandId=${encodeURIComponent(brandId)}`)
}

/**
 * Mark a mission as completed
 */
export async function completeMission(id: string, brandId: string): Promise<void> {
  await apiFetch(`${API_BASE}/missions/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ brandId }),
  })
}

/**
 * Skip a mission
 */
export async function skipMission(id: string, brandId: string): Promise<void> {
  await apiFetch(`${API_BASE}/missions/${encodeURIComponent(id)}/skip`, {
    method: 'POST',
    body: JSON.stringify({ brandId }),
  })
}

/**
 * Regenerate missions for a brand
 */
export async function regenerateMissions(brandId: string): Promise<Mission[]> {
  return apiFetch<Mission[]>(`${API_BASE}/missions/regenerate?brandId=${encodeURIComponent(brandId)}`, {
    method: 'POST',
  })
}

// ── New Mission Workspace API ────────────────────────

import type { MissionResponse as MissionWorkspaceResponse } from '../types/mission'

/**
 * Fetch missions and summary from the real API.
 * GET /api/geo/missions
 *
 * Returns { missions: Mission[], summary: MissionSummary }
 * Used by the new Mission Workspace Page (Sprint W-02.2).
 */
export async function fetchMissionWorkspace(): Promise<MissionWorkspaceResponse> {
  const data = await geoApi<MissionWorkspaceResponse>('/missions')
  return data
}
