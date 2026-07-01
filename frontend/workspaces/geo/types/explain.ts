// ============================================================
// Explain — Canonical Model (frontend)
// RC1-T004: Explain Everywhere
// ============================================================

export interface ExplainResult {
  id: string
  title: string
  summary: string
  confidence: number
  score?: number
  reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>
  evidence: Array<{ source: string; detail: string }>
  citations: Array<{ title: string; url?: string }>
  recommendations: Array<{ action: string; priority: string; impact: string }>
  suggestions: string[]
  updatedAt: string
}
