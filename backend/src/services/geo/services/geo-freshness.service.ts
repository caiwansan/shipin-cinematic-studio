// ============================================================
// GEO Freshness Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoFreshnessRepository } from '../repositories/geo-freshness.repository'
import type { FreshnessRecord } from '../types'
import { createProvenanceRecord } from '../types'

export const geoFreshnessService = {
  /**
   * Register freshness tracking for a knowledge object.
   */
  async register(data: {
    projectId: string
    objectType: string
    objectId: string
    ttlSeconds?: number
    nextReviewAt?: Date
  }): Promise<FreshnessRecord> {
    return geoFreshnessRepository.create({
      projectId: data.projectId,
      objectType: data.objectType,
      objectId: data.objectId,
      freshnessState: 'fresh',
      ttlSeconds: data.ttlSeconds,
      nextReviewAt: data.nextReviewAt,
      metadata: {
        provenance: createProvenanceRecord({
          source: 'geo.freshness',
          action: 'created',
          actor: 'service:geo.freshness',
          reason: `Freshness tracking registered for ${data.objectType}:${data.objectId}`,
        }),
      },
    })
  },

  /**
   * Track a knowledge object by creating freshness record if not exists.
   */
  async track(data: {
    projectId: string
    objectType: string
    objectId: string
    ttlSeconds?: number
  }): Promise<FreshnessRecord> {
    const existing = await geoFreshnessRepository.findByObject(data.objectType, data.objectId)
    if (existing) return existing
    return this.register(data)
  },

  /**
   * Mark a knowledge object as verified (freshness confirmed).
   */
  async verify(objectType: string, objectId: string, verified: boolean): Promise<FreshnessRecord | null> {
    const record = await geoFreshnessRepository.findByObject(objectType, objectId)
    if (!record) return null
    return geoFreshnessRepository.verify(record.id, verified)
  },

  /**
   * Run freshness check for all objects in a project.
   * Returns counts of stale and expired objects.
   */
  async checkProject(projectId: string): Promise<{ stale: number; expired: number }> {
    return geoFreshnessRepository.checkAndUpdate(projectId)
  },

  /**
   * Get all freshness records for a project.
   */
  async listByProject(projectId: string): Promise<FreshnessRecord[]> {
    return geoFreshnessRepository.findByProjectId(projectId)
  },

  /**
   * Get objects that are due for review.
   */
  async getDueForReview(projectId: string): Promise<FreshnessRecord[]> {
    const records = await geoFreshnessRepository.findByProjectId(projectId)
    const now = new Date()
    return records.filter((r) => r.nextReviewAt && new Date(r.nextReviewAt) <= now)
  },

  /**
   * Get stale objects in a project.
   */
  async getStaleObjects(projectId: string): Promise<FreshnessRecord[]> {
    return geoFreshnessRepository.findByState(projectId, 'stale')
  },
}
