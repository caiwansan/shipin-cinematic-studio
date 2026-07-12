/**
 * Mission Types — GEO Workspace Mission Page
 *
 * Maps from backend Mission model to Product Language.
 * No Engine / Repository / PriorityScore / Generator concepts exposed.
 *
 * @see backend/src/engines/mission/models/Mission.ts
 */

/** Mission Priority — 'P0' | 'P1' | 'P2' | 'P3' */
export type MissionPriority = 'P0' | 'P1' | 'P2' | 'P3'

/** Impact of completing a mission */
export interface MissionImpact {
  /** Percentage gain (e.g. 12 means +12%) */
  percentage: number
  /** Human-readable impact text (e.g. "+12%") */
  text: string
}

/** A single action the user can take */
export interface MissionActionItem {
  id: string
  label: string
  type: 'navigate' | 'create' | 'edit' | 'review' | 'publish' | 'dismiss' | 'custom'
}

/** Source metadata (not exposed in UI) */
export interface MissionSource {
  engine: string
  version: string
  objectId: string
  objectType: string
}

/** A single Mission Card */
export interface Mission {
  id: string
  title: string
  reason: string
  priority: MissionPriority
  impact: MissionImpact
  actions: MissionActionItem[]
  source: MissionSource
}

/** Summary shown at the top of the Mission Workspace Page */
export interface MissionSummary {
  total: number
  p0: number
  p1: number
  p2: number
  p3: number
}

/** API response from GET /api/geo/missions */
export interface MissionResponse {
  missions: Mission[]
  summary: MissionSummary
}
