// ============================================================
// Asset Normalizer — HTML → Structured Blocks
// Does NOT generate Entities or Graph data
// Input: raw HTML → Output: StructuredBlock[]
// ============================================================

import type { StructuredBlock } from '../types.js'

/**
 * Strip HTML tags, return clean text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract <title> from HTML
 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? match[1].trim() : null
}

/**
 * Extract <h1>-<h6> headings
 */
function extractHeadings(html: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = []
  for (let i = 1; i <= 6; i++) {
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\/h${i}>`, 'gi')
    let match
    while ((match = re.exec(html)) !== null) {
      headings.push({ level: i, text: stripHtml(match[1]) })
    }
  }
  return headings
}

/**
 * Extract all <p> paragraphs
 */
function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = []
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const text = stripHtml(match[1])
    if (text.length > 10) paragraphs.push(text)
  }
  return paragraphs
}

/**
 * Extract lists (<ul>/<ol>)
 */
function extractLists(html: string): string[][] {
  const lists: string[][] = []
  const re = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const items: string[] = []
    const itemRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let itemMatch
    while ((itemMatch = itemRe.exec(match[2])) !== null) {
      items.push(stripHtml(itemMatch[1]))
    }
    if (items.length > 0) lists.push(items)
  }
  return lists
}

/**
 * Extract meta description (for summary)
 */
function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
  return match ? match[1].trim() : null
}

/**
 * Detect content type from URL path
 */
function detectType(url: string, title: string, headings: string[]): string {
  const path = new URL(url).pathname.toLowerCase()
  const allText = [title, ...headings].join(' ').toLowerCase()

  if (path.includes('/blog') || path.includes('/article') || path.includes('/news') || path.includes('/post')) return 'Article'
  if (path.includes('/faq') || path.includes('/help') || path.includes('/support')) return 'FAQ'
  if (path.includes('/product') || path.includes('/shop') || path.includes('/buy')) return 'Product'
  if (path.includes('/service') || path.includes('/solution')) return 'Service'
  if (path.includes('/api') || path.includes('/doc') || path.includes('/documentation')) return 'Document'
  if (path.includes('/price') || path.includes('/pricing') || path.includes('/plan')) return 'Pricing'
  if (path.includes('/feature')) return 'Feature'
  if (path.includes('/guide') || path.includes('/tutorial')) return 'Guide'
  if (path.includes('/case') || path.includes('/study')) return 'CaseStudy'
  if (path.includes('/white-paper') || path.includes('/whitepaper')) return 'WhitePaper'
  if (path.includes('/glossary')) return 'Glossary'

  if (allText.includes('faq') || allText.includes('frequently asked')) return 'FAQ'
  if (allText.includes('pricing') || allText.includes('price')) return 'Pricing'
  if (allText.includes('product') || allText.includes('buy now')) return 'Product'
  if (allText.includes('service') || allText.includes('our solution')) return 'Service'
  if (allText.includes('blog') || allText.includes('article')) return 'Article'

  return 'Page'
}

export const normalizer = {
  /**
   * Normalize raw HTML into structured blocks
   */
  normalize(html: string, url: string): { blocks: StructuredBlock[]; title: string; summary: string; contentType: string } {
    const title = extractTitle(html) || url
    const description = extractMetaDescription(html) || ''
    const headings = extractHeadings(html)
    const paragraphs = extractParagraphs(html)
    const lists = extractLists(html)

    const blocks: StructuredBlock[] = []

    // Title block
    blocks.push({
      type: 'title',
      title: 'Title',
      content: title,
      metadata: { source: url },
    })

    // Description/summary
    if (description) {
      blocks.push({
        type: 'summary',
        title: 'Summary',
        content: description,
        metadata: { source: url },
      })
    }

    // Heading blocks
    for (const h of headings) {
      blocks.push({
        type: 'heading',
        title: `Heading H${h.level}`,
        content: h.text,
        metadata: { level: h.level },
      })
    }

    // Paragraph blocks
    for (const p of paragraphs) {
      blocks.push({
        type: 'paragraph',
        title: `Paragraph`,
        content: p,
      })
    }

    // List blocks
    for (const list of lists) {
      blocks.push({
        type: 'list',
        title: 'List',
        content: list.join('\n'),
        metadata: { items: list },
      })
    }

    // Summary from first paragraph if no meta description
    const summary = description || (paragraphs[0] || '').slice(0, 200)

    // Detect content type
    const headingTexts = headings.map(h => h.text)
    const contentType = detectType(url, title, headingTexts)

    return { blocks, title, summary, contentType }
  },
}
