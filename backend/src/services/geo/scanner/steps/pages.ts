// ============================================================
// Brand GEO Scanner — Step: Page / internal link discovery
// ============================================================

import type { ScannerStep, PageResult } from '../types.js'

/**
 * Scans the homepage for internal links and classifies them.
 */
export const pagesStep: ScannerStep = async (ctx) => {
  try {
    const response = await fetch(ctx.url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) {
      return { pages: [] }
    }

    const html = await response.text()
    const baseUrl = new URL(ctx.url)
    const links = extractLinks(html, baseUrl)

    return { pages: links.slice(0, 200) }
  } catch (err: any) {
    return { pages: [] }
  }
}

function extractLinks(html: string, baseUrl: URL): PageResult[] {
  const pages: PageResult[] = []
  const seen = new Set<string>()

  const linkRegex = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim()
    const innerHtml = match[2]

    // Resolve relative URLs
    let fullUrl: string
    try {
      fullUrl = new URL(href, baseUrl.origin).href
    } catch {
      continue
    }

    // External links
    if (!fullUrl.startsWith(baseUrl.origin)) continue

    // Skip anchors, mailto, tel, javascript
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue

    // Deduplicate
    if (seen.has(fullUrl)) continue
    seen.add(fullUrl)

    // Extract title from inner HTML
    const titleMatch = innerHtml.replace(/<[^>]+>/g, '').trim()
    const title = titleMatch || fullUrl

    // Classify page type
    const type = classifyUrl(fullUrl)

    // Calculate depth from path
    const path = new URL(fullUrl).pathname
    const depth = path.split('/').filter(Boolean).length

    pages.push({ url: fullUrl, title, depth, type })
  }

  return pages
}

function classifyUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase()

  if (path === '/' || path === '') return 'home'
  if (path.includes('/blog') || path.includes('/article') || path.includes('/news') || path.includes('/post')) return 'article'
  if (path.includes('/product') || path.includes('/shop') || path.includes('/buy')) return 'product'
  if (path.includes('/service') || path.includes('/solution')) return 'service'
  if (path.includes('/faq') || path.includes('/help') || path.includes('/support')) return 'faq'
  if (path.includes('/api') || path.includes('/doc') || path.includes('/documentation')) return 'api'
  if (path.includes('/about') || path.includes('/team') || path.includes('/company')) return 'page'
  if (path.includes('/contact') || path.includes('/location')) return 'page'
  if (path.includes('/price') || path.includes('/pricing') || path.includes('/plan')) return 'page'

  return 'page'
}
