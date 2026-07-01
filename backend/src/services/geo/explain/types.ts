// ============================================================
// ExplainEngine — Canonical Model
// RC1-T004: Explain Everywhere
//
// SSOT for all explain data across GEO Workspace.
// Every provider must return this shape.
// ============================================================

export interface ExplainResult {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  score?: number;
  reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>;
  evidence: Array<{ source: string; detail: string }>;
  citations: Array<{ title: string; url?: string }>;
  recommendations: Array<{ action: string; priority: string; impact: string }>;
  suggestions: string[];
  updatedAt: string;
}

export interface ExplainProvider {
  type: string;
  canHandle(type: string, id: string): boolean;
  getExplain(type: string, id: string): Promise<ExplainResult>;
}
