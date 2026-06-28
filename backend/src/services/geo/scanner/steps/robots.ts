// ============================================================
// Brand GEO Scanner — Step: robots.txt parsing
// ============================================================

import type { ScannerStep } from '../types.js'

/**
 * Fetches and parses robots.txt from the target domain.
 */
export const robotsStep: ScannerStep = async (ctx) => {
  try {
    const url = new URL(ctx.url)
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`

    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'BrandGEO-Scanner/1.0' },
    })

    if (!response.ok) {
      return { robots: { available: false, status: response.status } }
    }

    const text = await response.text()
    const parsed = parseRobotsTxt(text)

    return { robots: { available: true, content: text, ...parsed } }
  } catch (err: any) {
    return { robots: { available: false, error: err.message } }
  }
}

function parseRobotsTxt(text: string): Record<string, unknown> {
  const disallowed: string[] = []
  const allowed: string[] = []
  const sitemaps: string[] = []
  let currentAgent = '*'

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase()
    const value = trimmed.slice(colonIdx + 1).trim()

    switch (key) {
      case 'user-agent':
        currentAgent = value
        break
      case 'disallow':
        if (value) disallowed.push(value)
        break
      case 'allow':
        if (value) allowed.push(value)
        break
      case 'sitemap':
        sitemaps.push(value)
        break
    }
  }

  return { disallowed, allowed, sitemaps, agent: currentAgent }
}
