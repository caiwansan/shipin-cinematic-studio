// ════════════════════════════════════════════════════════════
// KH1 — Platform Canonical Types
// ════════════════════════════════════════════════════════════
// These types live in the platform layer, not in any workspace.
// Workspaces consume these; platform never imports workspace types.
// ════════════════════════════════════════════════════════════

// ─── KnowledgeClaim ───
export interface KnowledgeClaim {
  id: string
  text: string
  category?: string
  confidence?: number
  source?: string
}

// ─── KnowledgeEvidence ───
export interface KnowledgeEvidence {
  id: string
  source: string
  content: string
  url?: string
  publishedAt?: string
}

// ─── KnowledgeAsset ───
export interface KnowledgeAsset {
  id: string
  type: 'image' | 'document' | 'structured_data' | 'other'
  url?: string
  content?: string
  mimeType?: string
}

// ─── Citation ───
export interface Citation {
  id: string
  url: string
  title: string
  snippet?: string
}

// ─── PublishingTarget ───
export interface PublishingTarget {
  adapter: string
  config: Record<string, unknown>
  enabled: boolean
}

// ─── Status Change ───
export interface StatusChange {
  from: string
  to: string
  at: string
  by: string
  reason?: string
}

// ─── Recommendation ───
export interface Recommendation {
  id: string
  type: string
  priority: 'high' | 'medium' | 'low'
  description: string
}

// ─── Canonical KnowledgePackage ───
export interface KnowledgePackage {
  // ── Identity ──
  id: string
  workspace: string
  entityType: string
  entityId: string
  title: string
  description: string
  version: string

  // ── Status ──
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
  statusHistory: StatusChange[]

  // ── Content ──
  claims: KnowledgeClaim[]
  evidence: KnowledgeEvidence[]
  assets: KnowledgeAsset[]
  citations: Citation[]
  tags: string[]

  // ── Workspace-specific (optional) ──
  recommendations?: Recommendation[]

  // ── Publishing ──
  publishingTargets: PublishingTarget[]

  // ── Timestamps ──
  createdAt: string
  updatedAt: string
}

// ─── KnowledgeProvider Interface (KH1-T005) ───
export interface KnowledgeProvider {
  workspace: string
  name: string

  /** Build the content of a KnowledgePackage for the given entity */
  buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage | null>

  /** Can this provider handle this entity? */
  canHandle(entityType: string, entityId: string): boolean

  /** Extract claims from the built package */
  getClaims?(pkg: KnowledgePackage): KnowledgeClaim[]

  /** Extract evidence from the built package */
  getEvidence?(pkg: KnowledgePackage): KnowledgeEvidence[]

  /** Extract assets from the built package */
  getAssets?(pkg: KnowledgePackage): KnowledgeAsset[]

  /** Extract citations from the built package */
  getCitations?(pkg: KnowledgePackage): Citation[]

  /** Extract publishing targets from the built package */
  getPublishingTargets?(pkg: KnowledgePackage): PublishingTarget[]
}

// ─── PackageBuilder Options ───
export interface BuildOptions {
  workspace: string
  entityType: string
  entityId: string
  title: string
  description?: string
  tags?: string[]
  bypassValidation?: boolean
}

// ─── Build Result ───
export interface BuildResult {
  success: boolean
  pkg?: KnowledgePackage
  errors?: string[]
}
