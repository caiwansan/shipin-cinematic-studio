// ════════════════════════════════════════════════════════════
// GEO — AssetMapper
// Maps KnowledgeObject entities → Platform KnowledgeAsset[]
// ════════════════════════════════════════════════════════════

import type { KnowledgeAsset } from '../../core/types'
import type { EntitySnapshot } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectSchema'

/**
 * Map KO EntitySnapshot[] → Platform KnowledgeAsset[]
 *
 * Rules:
 * - Each entity becomes a structured_data asset
 * - Entity name/type/description are serialized into content
 * - Assets are optional; if entities list is empty, return []
 */
export function mapToAssets(entities: EntitySnapshot[]): KnowledgeAsset[] {
  if (!entities || entities.length === 0) return []

  return entities.map((entity: EntitySnapshot): KnowledgeAsset => ({
    id: entity.id,
    type: 'structured_data',
    content: JSON.stringify({
      name: entity.name,
      type: entity.type,
      description: entity.description ?? '',
      ...(entity.metadata ? { metadata: entity.metadata } : {}),
    }),
    mimeType: 'application/json',
  }))
}
