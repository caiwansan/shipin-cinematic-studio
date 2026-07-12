// ════════════════════════════════════════════════════════════
// GEO — ClaimMapper
// Maps KnowledgeObject claims → Platform KnowledgeClaim[]
// ════════════════════════════════════════════════════════════

import type { KnowledgeClaim } from '../../core/types'
import type { ClaimSnapshot } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectSchema'

/**
 * Map KO ClaimSnapshot[] → Platform KnowledgeClaim[]
 *
 * Rules:
 * - statement → text
 * - confidence → confidence (0-1)
 * - metadata.claimType → category (if present)
 * - metadata.sourceType → source (if present)
 */
export function mapClaims(claimSnapshots: ClaimSnapshot[]): KnowledgeClaim[] {
  if (!claimSnapshots || claimSnapshots.length === 0) return []

  return claimSnapshots.map((snapshot: ClaimSnapshot): KnowledgeClaim => ({
    id: snapshot.id,
    text: snapshot.statement,
    confidence: snapshot.confidence ?? undefined,
    category: (snapshot.metadata as Record<string, unknown>)?.['claimType'] as string | undefined
      ?? (snapshot.metadata as Record<string, unknown>)?.['category'] as string | undefined,
    source: (snapshot.metadata as Record<string, unknown>)?.['sourceType'] as string | undefined,
  }))
}
