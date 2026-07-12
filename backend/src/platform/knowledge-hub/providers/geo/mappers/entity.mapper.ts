// ════════════════════════════════════════════════════════════
// GEO — EntityMapper
// Maps KnowledgeObject entities → additional context
// ════════════════════════════════════════════════════════════

import type { EntitySnapshot } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectSchema'

/**
 * EntityMappingResult — non-Platform type, used by KnowledgeObjectProvider
 * to populate package metadata (title, description, tags).
 */
export interface EntityMappingResult {
  title: string
  description: string
  tags: string[]
}

/**
 * Extract primary entity from KO entities list.
 * The first entity with type matching primary types is used as the "main" entity.
 *
 * Rules:
 * - If entities is empty, return a fallback
 * - The first entity named "Brand" | "Product" | "Person" | "Organization" is primary
 * - Otherwise the first entity in the list is primary
 */
export function resolvePrimaryEntity(
  entities: EntitySnapshot[],
): EntitySnapshot | null {
  if (!entities || entities.length === 0) return null

  const primaryTypes = ['Brand', 'Product', 'Person', 'Organization', 'Concept']
  const primary = entities.find(e => primaryTypes.includes(e.type))
  return primary ?? entities[0]
}

/**
 * Build package title and description from KO entities.
 */
export function mapEntityToPackageMeta(
  entities: EntitySnapshot[],
  topic?: string | null,
): EntityMappingResult {
  const primary = resolvePrimaryEntity(entities)

  if (!primary) {
    return {
      title: topic ?? 'Untitled Knowledge',
      description: '',
      tags: [],
    }
  }

  return {
    title: primary.description
      ? `${primary.name}: ${primary.description}`
      : primary.name,
    description: primary.description ?? topic ?? '',
    tags: [
      primary.type.toLowerCase(),
      ...(topic ? [topic.toLowerCase()] : []),
    ],
  }
}
