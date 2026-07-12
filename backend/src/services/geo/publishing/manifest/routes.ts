// ════════════════════════════════════════════════════════════
// Manifest API Routes — Read-only inspection + management
// ════════════════════════════════════════════════════════════
// Uses manifestRepository for data access.
// In-memory Registry retained as cache layer only.
// ════════════════════════════════════════════════════════════

import type { FastifyInstance } from 'fastify'
import { manifestRegistry } from './registry'
import { manifestRepository } from './manifest-repository'

export function registerManifestRoutes(app: FastifyInstance) {
  // ── GET /api/v1/geo/manifests — List all manifests ──
  app.get('/api/v1/geo/manifests', async (request) => {
    const query = request.query as { type?: string; status?: string }
    const records = await manifestRepository.findAll({ type: query.type, status: query.status })
    return { success: true, data: records, total: records.length }
  })

  // ── GET /api/v1/geo/manifests/stats — Statistics ──
  app.get('/api/v1/geo/manifests/stats', async () => {
    const stats = await manifestRepository.getStats()
    return { success: true, data: stats }
  })

  // ── GET /api/v1/geo/manifests/:slug — Get single manifest ──
  app.get<{ Params: { slug: string } }>(
    '/api/v1/geo/manifests/:slug',
    async (request, reply) => {
      const { slug } = request.params
      const record = await manifestRepository.findBySlug(slug)
      if (!record) {
        return reply.status(404).send({ success: false, error: 'Manifest not found' })
      }
      return { success: true, data: record }
    },
  )

  // ── POST /api/v1/geo/manifests — Create a new manifest ──
  app.post<{ Body: {
    slug: string;
    type: string;
    name: string;
    manifest: any;
    sourceId?: string;
    sourceType?: string;
  } }>('/api/v1/geo/manifests', async (request, reply) => {
    const { slug, type, name, manifest, sourceId, sourceType } = request.body
    if (!slug || !type || !name || !manifest) {
      return reply.status(400).send({ success: false, error: 'Missing required fields: slug, type, name, manifest' })
    }
    const record = await manifestRepository.create({ slug, type, name, manifest, sourceId, sourceType })
    // Update registry cache
    await manifestRegistry.save(manifest)
    return reply.status(201).send({ success: true, data: record })
  })

  // ── POST /api/v1/geo/manifests/:id/publish — Publish ──
  app.post<{ Params: { id: string } }>(
    '/api/v1/geo/manifests/:id/publish',
    async (request, reply) => {
      const { id } = request.params
      const record = await manifestRepository.publish(id)
      if (!record) {
        return reply.status(404).send({ success: false, error: 'Manifest not found' })
      }
      // Update cache
      cache.set(record.slug, record.manifest)
      return { success: true, data: record }
    },
  )

  // ── POST /api/v1/geo/manifests/:id/archive — Archive ──
  app.post<{ Params: { id: string } }>(
    '/api/v1/geo/manifests/:id/archive',
    async (request, reply) => {
      const { id } = request.params
      const record = await manifestRepository.archive(id)
      if (!record) {
        return reply.status(404).send({ success: false, error: 'Manifest not found' })
      }
      return { success: true, data: record }
    },
  )

  // ── POST /api/v1/geo/manifests/rebuild/brands — Rebuild all brand manifests ──
  app.post('/api/v1/geo/manifests/rebuild/brands', async (request, reply) => {
    try {
      const { rebuildAllBrandManifests } = await import('./manifest-adapter')
      const { knowledgeService } = await import('../../../../services/knowledge')
      
      const baseUrl = request.protocol + '://' + request.hostname
      const brands = await knowledgeService.getBrands()
      const manifests = await rebuildAllBrandManifests(() => Promise.resolve(brands), baseUrl)

      // Save each manifest to repository
      const results = []
      for (const manifest of manifests) {
        await manifestRegistry.save(manifest)
        results.push({
          slug: manifest.identity.slug,
          name: manifest.identity.name,
          type: manifest.identity.type,
        })
      }

      return { success: true, data: results, total: results.length }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Rebuild failed' })
    }
  })

  // ── POST /api/v1/geo/manifests/rebuild/status — Rebuild status ──
  app.get('/api/v1/geo/manifests/rebuild/status', async () => {
    const stats = await manifestRepository.getStats()
    return {
      success: true,
      data: {
        lastRebuild: null, // no tracking yet
        totalManifests: stats.total,
        brandCount: stats.byType['brand'] || 0,
      },
    }
  })
}

// Local cache ref for route handlers
const cache = new Map<string, any>()
