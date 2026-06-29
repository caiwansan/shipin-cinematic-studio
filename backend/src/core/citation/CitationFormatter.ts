// ============================================================
// Citation Formatter — Format citations as text, HTML, Markdown
// ============================================================

import type { Citation } from './types'

/**
 * Format a citation as plain text in the given format style.
 */
export function formatCitation(citation: Citation, format: string = 'custom'): string {
  const parts: string[] = []
  const datePart = citation.datePublished
    ? new Date(citation.datePublished).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  switch (format) {
    case 'apa':
      if (citation.author) parts.push(`${citation.author}.`)
      if (datePart) parts.push(`(${datePart}).`)
      parts.push(`${citation.citationText}.`)
      if (citation.publisher) parts.push(citation.publisher)
      if (citation.sourceUrl) parts.push(citation.sourceUrl)
      break

    case 'mla':
      if (citation.author) parts.push(`${citation.author}.`)
      parts.push(`"${citation.citationText}."`)
      if (citation.publisher) parts.push(citation.publisher)
      if (datePart) parts.push(datePart)
      if (citation.sourceUrl) parts.push(citation.sourceUrl)
      break

    case 'custom':
    default:
      parts.push(citation.citationText)
      if (citation.sourceUrl) parts.push(`Source: ${citation.sourceUrl}`)
      break
  }

  return parts.join(' ')
}

/**
 * Generate an HTML-formatted citation block.
 */
export function generateHtmlCitation(citation: Citation): string {
  const text = formatCitation(citation, citation.format)
  const levelClass = `citation-level-${citation.authorityLevel}`
  return `<blockquote class="citation ${levelClass}" data-evidence-id="${citation.evidenceId}">
  <p>${text}</p>
  <footer>
    <cite>${citation.author || 'Unknown Author'}</cite>
    ${citation.publisher ? `<span class="publisher"> — ${citation.publisher}</span>` : ''}
    ${citation.datePublished ? `<time datetime="${citation.datePublished}">${citation.datePublished}</time>` : ''}
  </footer>
</blockquote>`
}

/**
 * Generate a Markdown-formatted citation.
 */
export function generateMarkdownCitation(citation: Citation): string {
  const lines: string[] = []
  lines.push(`> ${formatCitation(citation, citation.format)}`)
  if (citation.author || citation.publisher) {
    const sourceParts: string[] = []
    if (citation.author) sourceParts.push(`*${citation.author}*`)
    if (citation.publisher) sourceParts.push(citation.publisher)
    lines.push(`> — ${sourceParts.join(', ')}`)
  }
  if (citation.datePublished) {
    lines.push(`> ${citation.datePublished}`)
  }
  return lines.join('\n')
}
