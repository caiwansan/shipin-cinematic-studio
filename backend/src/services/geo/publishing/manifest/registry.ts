// ════════════════════════════════════════════════════════════
// Manifest Registry — Hybrid cache layer
// ════════════════════════════════════════════════════════════
// Cache Layer: in-memory Map for fast reads
// Data Layer: manifestRepository (Prisma) for persistence
// Write: always write to Repository first, then update cache
// Read: check cache first, fall back to Repository
// ════════════════════════════════════════════════════════════

import type { PublishManifest } from './types'
import { manifestRepository } from './manifest-repository'
import type { ManifestRecord } from './manifest-repository'

// Cache: slug -> PublishManifest
const cache = new Map<string, PublishManifest>()

// All slugs (for iteration)
const slugList = new Set<string>()

export const manifestRegistry = {
  /**
   * Get a single manifest by its slug (cache first, fallback to DB).
   */
  async get(slug: string): Promise<PublishManifest | undefined> {
    // Check cache first
    if (cache.has(slug)) return cache.get(slug)
    // Fallback to repository
    const record = await manifestRepository.findBySlug(slug)
    if (record) {
      cache.set(slug, record.manifest)
      slugList.add(slug)
      return record.manifest
    }
    return undefined
  },

  /**
   * Find a manifest by its routing path.
   */
  async getByPath(path: string): Promise<PublishManifest | undefined> {
    for (const m of cache.values()) {
      if (m.routing.path === path) return m
    }
    // Fallback: brute force via DB (slow, but rare)
    const records = await manifestRepository.findAll()
    const match = records.find(r => r.manifest.routing.path === path)
    if (match) {
      cache.set(match.slug, match.manifest)
      slugList.add(match.slug)
      return match.manifest
    }
    return undefined
  },

  /**
   * Sync all manifests from DB into cache.
   */
  async syncCache(): Promise<void> {
    const records = await manifestRepository.findAll()
    cache.clear()
    slugList.clear()
    for (const r of records) {
      cache.set(r.slug, r.manifest)
      slugList.add(r.slug)
    }
  },

  /**
   * Get all manifests (from cache + DB).
   */
  async getAll(): Promise<PublishManifest[]> {
    if (cache.size > 0) return Array.from(cache.values())
    await this.syncCache()
    return Array.from(cache.values())
  },

  /**
   * Get all manifests of a specific identity type.
   */
  async getByType(type: string): Promise<PublishManifest[]> {
    const all = await this.getAll()
    return all.filter(m => m.identity.type === type)
  },

  /**
   * Save (upsert) a manifest into the registry and persist to DB.
   * If a record with the same slug exists, update it; otherwise create.
   */
  async save(manifest: PublishManifest): Promise<void> {
    const slug = manifest.routing.params.slug
    const type = manifest.identity.type
    const name = manifest.identity.name

    // Check for existing record
    const existing = await manifestRepository.findBySlug(slug)

    if (existing) {
      // Update existing record
      await manifestRepository.update(existing.id, { manifest, name })
    } else {
      // Create new record
      await manifestRepository.create({
        slug,
        type,
        name,
        manifest,
        sourceId: manifest.identity.id || undefined,
        sourceType: type,
      })
    }

    // Update cache
    cache.set(slug, manifest)
    slugList.add(slug)
  },

  /**
   * Delete a manifest by slug.
   */
  async delete(slug: string): Promise<boolean> {
    const existing = await manifestRepository.findBySlug(slug)
    if (existing) {
      await manifestRepository.archive(existing.id)
    }
    cache.delete(slug)
    slugList.delete(slug)
    return !!existing
  },

  /**
   * Total number of manifests.
   */
  async count(): Promise<number> {
    const stats = await manifestRepository.getStats()
    return stats.total
  },

  /**
   * Get summary statistics.
   */
  async getStats() {
    return manifestRepository.getStats()
  },

  // Legacy sync methods (for backward compatibility during migration)
  // These write to cache only — use save() for full persistence

  /**
   * Store a manifest in cache only (no DB).
   * @deprecated Use save() for full persistence
   */
  _cacheOnlySave(manifest: PublishManifest): void {
    cache.set(manifest.routing.params.slug, manifest)
    slugList.add(manifest.routing.params.slug)
  },

  /**
   * Get from cache only (no DB fallback).
   * @deprecated Use get() for full lookup
   */
  _cacheOnlyGet(slug: string): PublishManifest | undefined {
    return cache.get(slug)
  },
}
