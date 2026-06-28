// ============================================================
// Brand GEO — Snapshot Service
// Manages WebsiteSnapshot CRUD + scanner pipeline orchestration
// Phase 2.5: Also creates UnifiedAssets from scan results
// ============================================================

import { prisma } from '../../utils/index.js'
import { runScannerPipeline } from './scanner/pipeline.js'
import { assetRuntime } from '../asset/runtime/asset.runtime.js'

export const geoSnipperService = {
  async getByProjectId(projectId: string) {
    return prisma.websiteSnapshot.findUnique({
      where: { projectId },
    })
  },

  async startScan(projectId: string, url: string) {
    // Create or reset snapshot
    const snapshot = await prisma.websiteSnapshot.upsert({
      where: { projectId },
      create: {
        projectId,
        url,
        status: 'scanning',
        scanVersion: 1,
      },
      update: {
        url,
        status: 'scanning',
        scanVersion: { increment: 1 },
      },
    })

    // Run scanner pipeline in background (non-blocking)
    this.runScanAsync(projectId, url).catch((err) => {
      console.error(`[Scanner] Async scan failed for project ${projectId}:`, err)
    })

    return snapshot
  },

  async runScanAsync(projectId: string, url: string) {
    try {
      const result = await runScannerPipeline({ url, projectId })

      await prisma.websiteSnapshot.update({
        where: { projectId },
        data: {
          title: result.title || null,
          description: result.description || null,
          language: result.language || null,
          robots: result.robots ? JSON.stringify(result.robots) : null,
          sitemap: result.sitemap ? JSON.stringify(result.sitemap) : null,
          meta: result.meta ? JSON.stringify(result.meta) : null,
          openGraph: result.openGraph ? JSON.stringify(result.openGraph) : null,
          schema: result.schema ? JSON.stringify(result.schema) : null,
          jsonLd: result.jsonLd ? JSON.stringify(result.jsonLd) : null,
          pages: result.pages ? JSON.stringify(result.pages) : null,
          images: result.images ? JSON.stringify(result.images) : null,
          scripts: result.scripts ? JSON.stringify(result.scripts) : null,
          styles: result.styles ? JSON.stringify(result.styles) : null,
          headers: result.headers ? JSON.stringify(result.headers) : null,
          status: result.error ? 'error' : 'completed',
          error: result.error || null,
        },
      })

      // Phase 2.5: Create unified assets from scanned pages
      if (result.pages && Array.isArray(result.pages)) {
        this.createAssetsFromPages(projectId, result.pages, url).catch((err) => {
          console.warn(`[AssetRuntime] Failed to create assets from scan: ${err.message}`)
        })
      }

    } catch (err: any) {
      await prisma.websiteSnapshot.update({
        where: { projectId },
        data: {
          status: 'error',
          error: err.message,
        },
      })
    }
  },

  async createAssetsFromPages(projectId: string, pages: any[], baseUrl: string) {
    let assetCount = 0
    for (const page of pages.slice(0, 50)) { // Limit to 50 pages
      try {
        // Fetch page HTML
        const response = await fetch(page.url, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
        })
        if (!response.ok) continue
        const html = await response.text()
        const headers = Object.fromEntries(response.headers.entries())

        // Import through asset runtime
        await assetRuntime.importFromHtml(projectId, page.url, html, headers)
        assetCount++
      } catch {
        // Skip failed pages
        continue
      }
    }

    // Update snapshot with asset count
    try {
      const stats = await assetRuntime.getProjectStats(projectId)
      await prisma.websiteSnapshot.update({
        where: { projectId },
        data: {
          // Store asset count in a metadata-like field (re-use existing structure)
          // Use pages field to store enriched data
        },
      })
    } catch {}

    console.log(`[AssetRuntime] Created ${assetCount} assets from scanner pages`)
  },

  async getScanStatus(projectId: string) {
    const snapshot = await prisma.websiteSnapshot.findUnique({
      where: { projectId },
      select: { status: true, error: true, updatedAt: true },
    })
    return snapshot || { status: 'not_started', error: null, updatedAt: null }
  },
}
