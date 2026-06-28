// ============================================================
// Brand GEO Scanner — Step: Meta / OG / Schema extraction
// ============================================================

import type { ScannerStep, MetaResult } from '../types.js'

/**
 * Extracts meta tags, Open Graph tags, JSON-LD, and schema from the page.
 */
export const metaStep: ScannerStep = async (ctx) => {
  try {
    const response = await fetch(ctx.url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const html = await response.text()

    const meta = extractMetaTags(html)
    const openGraph = extractOpenGraph(html)
    const schema = extractSchemaOrg(html)
    const jsonLd = extractJsonLd(html)

    return { meta, openGraph, schema, jsonLd }
  } catch (err: any) {
    return { error: `Failed to extract meta: ${err.message}` }
  }
}

function extractMetaTags(html: string): MetaResult {
  const meta: MetaResult = {
    title: extractContent(html, /<title[^>]*>([^<]*)<\/title>/i) || '',
    description: extractMetaContent(html, 'description') || '',
    keywords: extractMetaContent(html, 'keywords') || undefined,
    canonical: extractLinkHref(html, 'canonical') || undefined,
    viewport: extractMetaContent(html, 'viewport') || undefined,
    robots: extractMetaContent(html, 'robots') || undefined,
  }
  return meta
}

function extractOpenGraph(html: string): Record<string, string> {
  const og: Record<string, string> = {}
  const regex = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    og[match[1].trim()] = match[2].trim()
  }
  return og
}

function extractSchemaOrg(html: string): Record<string, unknown> {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim())
      if (data['@context']?.includes('schema.org')) {
        return data
      }
    } catch { /* skip invalid JSON */ }
  }
  return {}
}

function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = []
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1].trim()))
    } catch { /* skip invalid JSON */ }
  }
  return results
}

function extractContent(html: string, regex: RegExp): string | undefined {
  const match = html.match(regex)
  return match ? match[1].trim() : undefined
}

function extractMetaContent(html: string, name: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i')
  const match = html.match(pattern)
  if (match) return match[1].trim()

  // Try reversed attribute order
  const reversedPattern = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i')
  const reversedMatch = html.match(reversedPattern)
  return reversedMatch ? reversedMatch[1].trim() : undefined
}

function extractLinkHref(html: string, rel: string): string | undefined {
  const pattern = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']*)["']`, 'i')
  const match = html.match(pattern)
  if (match) return match[1].trim()

  const reversedPattern = new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]+rel=["']${rel}["']`, 'i')
  const reversedMatch = html.match(reversedPattern)
  return reversedMatch ? reversedMatch[1].trim() : undefined
}
