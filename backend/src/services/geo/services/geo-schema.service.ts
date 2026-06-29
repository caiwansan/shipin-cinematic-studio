// ============================================================
// GEO Schema Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoSchemaRepository } from '../repositories/geo-schema.repository'
import type { SchemaMarkup, AgentOutput } from '../types'
import { createProvenanceRecord } from '../types'

export const geoSchemaService = {
  /**
   * Create schema markup for an entity.
   */
  async create(data: {
    entityId: string
    schemaType: string
    markup: Record<string, unknown>
    validationStatus?: string
    validationErrors?: string[]
    metadata?: Record<string, unknown>
  }): Promise<SchemaMarkup> {
    return geoSchemaRepository.create({
      entityId: data.entityId,
      schemaType: data.schemaType,
      markup: data.markup,
      validationStatus: data.validationStatus,
      validationErrors: data.validationErrors,
      provenance: createProvenanceRecord({
        source: 'geo.schema',
        action: 'created',
        actor: 'service:geo.schema',
        reason: `Schema markup for entity ${data.entityId}`,
      }),
      metadata: data.metadata,
    })
  },

  /**
   * Validate schema markup against schema.org structure.
   * Basic validation: checks required fields and JSON-LD structure.
   */
  async validate(markup: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check for @context
    if (!markup['@context']) {
      errors.push('Missing @context (should be https://schema.org)')
    }

    // Check for @type
    if (!markup['@type']) {
      errors.push('Missing @type (should be a valid Schema.org type)')
    }

    // Check @context format
    if (markup['@context'] && markup['@context'] !== 'https://schema.org') {
      errors.push(`Unexpected @context value: ${markup['@context']}`)
    }

    return { valid: errors.length === 0, errors }
  },

  /**
   * Get schema markup for an entity.
   */
  async listByEntity(entityId: string): Promise<SchemaMarkup[]> {
    return geoSchemaRepository.findByEntityId(entityId)
  },

  /**
   * Get all schema markup for a project.
   */
  async listByProject(projectId: string): Promise<SchemaMarkup[]> {
    return geoSchemaRepository.listByProjectId(projectId)
  },

  /**
   * Update schema validation status.
   */
  async updateValidation(id: string, status: string, errors?: string[]): Promise<SchemaMarkup | null> {
    return geoSchemaRepository.update(id, {
      validationStatus: status,
      validationErrors: errors,
    } as any)
  },
}
