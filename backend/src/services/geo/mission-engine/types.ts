// ─────────────────────────────────────────────────
// Mission Engine — Canonical Types
// P0 — FROZEN
// ─────────────────────────────────────────────────

export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type MissionDifficulty = 'easy' | 'medium' | 'hard'
export type MissionCategory = 'schema' | 'content' | 'authority' | 'technical'

export interface Mission {
  id: string
  brandId: string
  title: string
  description: string
  why: string                    // 为什么要做
  impact: {                     // 预计收益
    dimension: string           // e.g. 'AI引用率'
    gain: number                // e.g. 18, 表示 +18%
    unit: string               // e.g. '%'
  }[]
  estimatedTime: string         // e.g. '2分钟' '30分钟'
  difficulty: MissionDifficulty
  action: {                     // 用户操作
    label: string              // e.g. '立即补充Schema'
    type: 'navigate' | 'open_drawer' | 'api_call'
    destination: string        // 路由路径，e.g. '/workspace/geo/knowledge'
    params?: Record<string, string>
  }
  verification?: {              // 如何验证完成
    type: 'schema_exists' | 'claim_exists' | 'evidence_exists' | 'faq_exists' | 'manual'
    param?: string
  }
  status: MissionStatus
  sourceIssueKind: string      // 来源 issue kindId
  score: number                // 优先级分数 (0-100)
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
  score: number               // 整体进度分数 0-100
}
