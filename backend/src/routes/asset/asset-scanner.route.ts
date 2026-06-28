// ============================================================
// Asset Scanner Routes — scan URLs and extract assets
// API: /api/asset/scan/*
// ============================================================

import { FastifyInstance } from 'fastify'
import { assetRuntime } from '../../services/asset/runtime/asset.runtime.js'

export default async function assetScannerRoutes(fastify: FastifyInstance) {
  // Scan a URL → raw document + asset
  fastify.post('/api/asset/scan', async (request, reply) => {
    const { projectId, url } = request.body as any
    if (!projectId || !url) {
      return reply.status(400).send({ success: false, error: 'projectId and url are required' })
    }

    let html: string
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'UnifiedAsset-Scanner/1.0' },
      })
      if (!response.ok) {
        return reply.status(502).send({ success: false, error: `Failed to fetch ${url}: ${response.status}` })
      }
      html = await response.text()
    } catch (err: any) {
      return reply.status(502).send({ success: false, error: `Fetch failed: ${err.message}` })
    }

    const result = await assetRuntime.importFromHtml(projectId, url, html)
    return { success: true, data: result }
  })

  // Scan and normalize only (no storage)
  fastify.post('/api/asset/scan/normalize', async (request, reply) => {
    const { html, url } = request.body as any
    if (!html || !url) {
      return reply.status(400).send({ success: false, error: 'html and url are required' })
    }
    const result = assetRuntime.normalize(html, url)
    return { success: true, data: result }
  })
}
