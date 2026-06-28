// ============================================================
// Brand GEO Scanner — Step: Asset (images/scripts/styles) discovery
// ============================================================

import type { ScannerStep, ImageResult, ScriptResult, StyleResult } from '../types.js'

/**
 * Extracts images, scripts, and styles from the page.
 */
export const assetsStep: ScannerStep = async (ctx) => {
  try {
    const response = await fetch(ctx.url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) {
      return { images: [], scripts: [], styles: [] }
    }

    const html = await response.text()
    const baseUrl = new URL(ctx.url)

    const images = extractImages(html, baseUrl)
    const scripts = extractScripts(html)
    const styles = extractStyles(html)

    return { images, scripts, styles }
  } catch {
    return { images: [], scripts: [], styles: [] }
  }
}

function extractImages(html: string, baseUrl: URL): ImageResult[] {
  const images: ImageResult[] = []
  const seen = new Set<string>()

  // <img> tags
  const imgRegex = /<img[^>]+src=["']([^"']*)["'][^>]*>/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim()
    if (seen.has(src)) continue
    seen.add(src)

    // Resolve relative URLs
    let fullSrc: string
    try {
      fullSrc = new URL(src, baseUrl.origin).href
    } catch {
      continue
    }

    const altMatch = match[0].match(/alt=["']([^"']*)["']/i)
    const widthMatch = match[0].match(/width=["'](\d+)["']/i)
    const heightMatch = match[0].match(/height=["'](\d+)["']/i)

    images.push({
      src: fullSrc,
      alt: altMatch?.[1] || undefined,
      width: widthMatch ? parseInt(widthMatch[1]) : undefined,
      height: heightMatch ? parseInt(heightMatch[1]) : undefined,
      type: 'img',
    })
  }

  return images.slice(0, 100)
}

function extractScripts(html: string): ScriptResult[] {
  const scripts: ScriptResult[] = []
  const seen = new Set<string>()

  const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1]
    const content = match[2].trim()

    const srcMatch = attrs.match(/src=["']([^"']*)["']/i)
    const typeMatch = attrs.match(/type=["']([^"']*)["']/i)

    if (srcMatch) {
      const src = srcMatch[1]
      if (seen.has(src)) continue
      seen.add(src)
      scripts.push({
        src,
        type: typeMatch?.[1] || 'application/javascript',
        async: /async/i.test(attrs),
        defer: /defer/i.test(attrs),
        inline: false,
      })
    } else if (content) {
      scripts.push({
        inline: true,
        type: typeMatch?.[1] || 'application/javascript',
        contentLength: content.length,
      })
    }
  }

  return scripts.slice(0, 50)
}

function extractStyles(html: string): StyleResult[] {
  const styles: StyleResult[] = []

  // External stylesheets
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']*)["'][^>]*>/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    styles.push({ href: match[1].trim(), inline: false })
  }

  // Inline styles
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  while ((match = styleRegex.exec(html)) !== null) {
    if (match[1].trim()) {
      styles.push({ inline: true, media: 'all' })
    }
  }

  return styles.slice(0, 30)
}
