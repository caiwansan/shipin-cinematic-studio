// ============================================================
// Brand GEO Scanner — Pipeline
// Orchestrates all scanner steps and aggregates results.
// ============================================================

import type { ScannerContext, ScanResult } from './types.js'
import { homeStep } from './steps/home.js'
import { robotsStep } from './steps/robots.js'
import { sitemapStep } from './steps/sitemap.js'
import { metaStep } from './steps/meta.js'
import { pagesStep } from './steps/pages.js'
import { assetsStep } from './steps/assets.js'

const STEPS = [homeStep, robotsStep, sitemapStep, metaStep, pagesStep, assetsStep] as const

/**
 * Runs the full website scanner pipeline.
 * Each step runs independently; errors in one step don't block others.
 */
export async function runScannerPipeline(ctx: ScannerContext): Promise<ScanResult> {
  const result: ScanResult = {}

  for (const step of STEPS) {
    try {
      const partial = await step(ctx)
      Object.assign(result, partial)
    } catch (err: any) {
      // Individual step failure doesn't abort the pipeline
      console.warn(`[Scanner] Step ${step.name || 'unknown'} failed:`, err.message)
    }
  }

  return result
}
