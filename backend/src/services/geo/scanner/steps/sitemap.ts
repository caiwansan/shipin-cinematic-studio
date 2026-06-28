// ============================================================
// Brand GEO Scanner — Step: sitemap.xml parsing
// ============================================================

import type { ScannerStep, SitemapResult } from '../types.js'

/**
 * Fetches and parses sitemap.xml from the target domain.
 * Tries common sitemap locations.
 */
export const sitemapStep: ScannerStep = async (ctx) => {
  try {
    const url = new URL(ctx.url)
    const sitemapUrls = [
      `${url.protocol}//${url.host}/sitemap.xml`,
      `${url.protocol}//${url.host}/sitemap_index.xml`,
      `${url.protocol}//${url.host}/sitemap/`,
    ]

    for (const sitemapUrl of sitemapUrls) {
      const result = await tryFetchSitemap(sitemapUrl)
      if (result) return { sitemap: result }
    }

    return { sitemap: { urls: [], count: 0 } }
  } catch (err: any) {
    return { sitemap: { urls: [], count: 0, error: err.message } }
  }
}

async function tryFetchSitemap(url: string): Promise<SitemapResult | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) return null

    const text = await response.text()
    const urls = extractUrlsFromXml(text)

    return { urls, count: urls.length }
  } catch {
    return null
  }
}

function extractUrlsFromXml(xml: string): string[] {
  const urls: string[] = []

  // Match <loc> elements
  const locRegex = /<loc[^>]*>([^<]+)<\/loc>/gi
  let match
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim())
  }

  return [...new Set(urls)]
}
