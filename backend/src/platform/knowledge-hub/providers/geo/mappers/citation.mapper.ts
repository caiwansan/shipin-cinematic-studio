// ════════════════════════════════════════════════════════════
// GEO — CitationMapper
// Maps KnowledgeObject citations → Platform Citation[]
// ════════════════════════════════════════════════════════════

import type { Citation } from '../../core/types'
import type { CitationSnapshot } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectSchema'

/**
 * Map KO CitationSnapshot[] → Platform Citation[]
 *
 * Rules:
 * - sourceUrl → url
 * - title → title
 * - snippet → snippet
 */
export function mapCitations(citationSnapshots: CitationSnapshot[]): Citation[] {
  if (!citationSnapshots || citationSnapshots.length === 0) return []

  return citationSnapshots.map((snapshot: CitationSnapshot): Citation => ({
    id: snapshot.id,
    url: snapshot.sourceUrl,
    title: snapshot.title ?? '',
    snippet: snapshot.snippet ?? undefined,
  }))
}
