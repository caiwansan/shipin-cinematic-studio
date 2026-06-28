// ============================================================
// Raw Document — scanner output interface
// Stores raw fetched data before normalization
// ============================================================

import type { RawDocumentData } from '../types.js'
import { rawDocumentRepository } from '../repositories/raw-document.repository.js'

export { rawDocumentRepository }

export type { RawDocumentData }

/**
 * Create a raw document from scanned HTML
 */
export function createRawDocument(projectId: string, url: string, html: string, headers?: Record<string, string>): RawDocumentData {
  // Simple HTML-to-text extraction
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  // Infer mime type
  const mime = 'text/html'

  return {
    projectId,
    url,
    mime,
    headers: headers || {},
    html,
    markdown: '', // Markdown conversion can be added later
    text,
    status: 200,
    fetchedAt: new Date(),
  }
}
