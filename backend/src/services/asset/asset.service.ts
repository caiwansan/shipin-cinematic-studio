// ============================================================
// Asset Service — business orchestrator for Unified Assets
// Uses Repository pattern: does NOT directly access Prisma
// ============================================================

import crypto from 'crypto'
import { assetRepository } from './repositories/asset.repository.js'
import { assetVersionRepository } from './repositories/asset-version.repository.js'
import { assetRelationRepository } from './repositories/asset-relation.repository.js'
import type { AssetData, AssetFilter, AssetEvent, AssetEventType } from './types.js'

// Event bus (simple in-memory; can be replaced with EventEmitter or message queue)
const eventListeners: Map<AssetEventType, Array<(event: AssetEvent) => void>> = new Map()

function emitEvent(type: AssetEventType, assetId: string, projectId: string, data?: Record<string, unknown>) {
  const event: AssetEvent = { type, assetId, projectId, timestamp: new Date(), data }
  const listeners = eventListeners.get(type) || []
  for (const listener of listeners) {
    try { listener(event) } catch { /* swallow */ }
  }
}

export function onAssetEvent(type: AssetEventType, listener: (event: AssetEvent) => void) {
  if (!eventListeners.has(type)) eventListeners.set(type, [])
  eventListeners.get(type)!.push(listener)
}

export function offAssetEvent(type: AssetEventType, listener: (event: AssetEvent) => void) {
  const listeners = eventListeners.get(type)
  if (listeners) {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export const assetService = {
  async createAsset(data: AssetData) {
    // Dedup by hash if content provided
    if (data.content) {
      const hash = computeHash(data.content)
      data.hash = hash
      const existing = await assetRepository.findByHash(hash)
      if (existing) return existing
    }

    const asset = await assetRepository.create(data)

    // Create initial version if content exists
    if (data.content) {
      await assetVersionRepository.createVersion(asset.id, data.content, data.hash)
    }

    emitEvent('created', asset.id, asset.projectId, { type: data.type })
    return asset
  },

  async getAsset(id: string) {
    return assetRepository.findById(id)
  },

  async updateAsset(id: string, data: Partial<AssetData>) {
    const updated = await assetRepository.update(id, data)

    // Create a new version if content changed
    if (data.content) {
      const hash = computeHash(data.content)
      await assetVersionRepository.createVersion(id, data.content, hash)
    }

    emitEvent('updated', id, data.projectId || '', { type: data.type })
    return updated
  },

  async deleteAsset(id: string) {
    const asset = await assetRepository.findById(id)
    if (!asset) return null

    await assetRelationRepository.deleteRelationsForAsset(id)
    await assetRepository.softDelete(id)
    emitEvent('deleted', id, asset.projectId)
    return { success: true }
  },

  async hardDeleteAsset(id: string) {
    const asset = await assetRepository.findById(id)
    if (!asset) return null
    await assetRelationRepository.deleteRelationsForAsset(id)
    await assetRepository.hardDelete(id)
    return { success: true }
  },

  async listByProject(projectId: string, filter?: Omit<AssetFilter, 'projectId'>) {
    return assetRepository.list({ ...filter, projectId })
  },

  async search(filter: AssetFilter) {
    return assetRepository.list(filter)
  },

  async getProjectStats(projectId: string) {
    return assetRepository.getStats(projectId)
  },

  async addTag(assetId: string, tag: string) {
    const { prisma } = await import('../../utils/index.js')
    return prisma.unifiedAssetTag.upsert({
      where: { assetId_tag: { assetId, tag } },
      create: { assetId, tag },
      update: {},
    })
  },

  async removeTag(assetId: string, tag: string) {
    const { prisma } = await import('../../utils/index.js')
    return prisma.unifiedAssetTag.deleteMany({
      where: { assetId, tag },
    })
  },

  async createRelation(fromAssetId: string, toAssetId: string, relation: string) {
    return assetRelationRepository.createRelation(fromAssetId, toAssetId, relation)
  },

  async getRelations(assetId: string) {
    return assetRelationRepository.listRelations(assetId)
  },
}
