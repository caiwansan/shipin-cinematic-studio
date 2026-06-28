// ============================================================
// Chunker — Asset → ContentChunks
// Splits asset content into manageable chunks for extraction
// ============================================================

import type { ContentChunk, ChunkInput } from '../types.js'

// ChunkInput is now defined in types.ts

/**
 * Split content into chunks by paragraphs or size
 * Respects natural boundaries (paragraphs, headings)
 */
export function chunkContent(input: ChunkInput, maxChunkSize = 5000): ContentChunk[] {
  const { content, sourceUrl, metadata } = input
  if (!content) return []

  const chunks: ContentChunk[] = []
  const paragraphs = content.split(/\n\n+/)

  let currentChunk = ''
  let chunkIndex = 0

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk.length + trimmed.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        sourceUrl,
        metadata,
      })
      currentChunk = ''
    }

    // If a single paragraph exceeds max size, split it
    if (trimmed.length > maxChunkSize) {
      // Save any existing chunk first
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          sourceUrl,
          metadata,
        })
        currentChunk = ''
      }
      // Split long paragraph
      let remaining = trimmed
      while (remaining.length > 0) {
        const slice = remaining.substring(0, maxChunkSize)
        chunks.push({
          index: chunkIndex++,
          text: slice.trim(),
          sourceUrl,
          metadata,
        })
        remaining = remaining.substring(maxChunkSize)
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.trim(),
      sourceUrl,
      metadata,
    })
  }

  return chunks
}

/**
 * Split content by explicit boundary markers (e.g., ---, headings)
 */
export function splitByHeadings(content: string): ContentChunk[] {
  if (!content) return []

  const chunks: ContentChunk[] = []
  const sections = content.split(/(?=^#{1,3}\s)/m)
  let index = 0

  for (const section of sections) {
    const trimmed = section.trim()
    if (trimmed) {
      chunks.push({ index: index++, text: trimmed })
    }
  }

  return chunks.length > 0 ? chunks : [{ index: 0, text: content.trim() }]
}
