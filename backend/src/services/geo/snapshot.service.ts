// ============================================================
// Brand GEO — Snapshot Service
// Manages WebsiteSnapshot CRUD + scanner pipeline orchestration
// ============================================================

import { prisma } from '../../utils/index.js'
import { runScannerPipeline } from './scanner/pipeline.js'

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

  async getScanStatus(projectId: string) {
    const snapshot = await prisma.websiteSnapshot.findUnique({
      where: { projectId },
      select: { status: true, error: true, updatedAt: true },
    })
    return snapshot || { status: 'not_started', error: null, updatedAt: null }
  },
}
