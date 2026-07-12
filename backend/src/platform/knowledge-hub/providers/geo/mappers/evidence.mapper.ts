// ════════════════════════════════════════════════════════════
// GEO — EvidenceMapper
// Maps KnowledgeObject evidence → Platform KnowledgeEvidence[]
// ════════════════════════════════════════════════════════════

import type { KnowledgeEvidence } from '../../core/types'
import type { EvidenceSnapshot } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectSchema'

/**
 * Map KO EvidenceSnapshot[] → Platform KnowledgeEvidence[]
 *
 * Rules:
 * - content → content
 * - sourceUrl → url
 * - sourceUrl can also fill source text
 * - metadata can carry extra fields
 */
export function mapEvidence(evidenceSnapshots: EvidenceSnapshot[]): KnowledgeEvidence[] {
  if (!evidenceSnapshots || evidenceSnapshots.length === 0) return []

  return evidenceSnapshots.map((snapshot: EvidenceSnapshot): KnowledgeEvidence => ({
    id: snapshot.id,
    source: snapshot.sourceUrl ?? (snapshot.metadata as Record<string, unknown>)?.['source'] as string ?? '',
    content: snapshot.content,
    url: snapshot.sourceUrl ?? undefined,
    publishedAt: (snapshot.metadata as Record<string, unknown>)?.['collectedAt'] as string
      ?? (snapshot.metadata as Record<string, unknown>)?.['publishedAt'] as string
      ?? undefined,
  }))
}
