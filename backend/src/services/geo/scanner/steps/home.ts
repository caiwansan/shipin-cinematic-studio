// ============================================================
// Brand GEO Scanner — Step: Home page parsing
// ============================================================

import type { ScannerStep } from '../types.js'

/**
 * Fetches and parses the homepage of the target URL.
 * Extracts title, description, and basic page info.
 */
export const homeStep: ScannerStep = async (ctx) => {
  try {
    const response = await fetch(ctx.url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const html = await response.text()
    const title = extractTitle(html)
    const description = extractMetaDescription(html)
    const language = extractLanguage(html)

    return { title, description, language }
  } catch (err: any) {
    return { error: `Failed to fetch homepage: ${err.message}` }
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : undefined
}

function extractMetaDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
  return match ? match[1].trim() : undefined
}

function extractLanguage(html: string): string | undefined {
  const match = html.match(/<html[^>]+lang=["']([^"']+)["'][^>]*>/i)
  return match ? match[1].toLowerCase() : undefined
}
