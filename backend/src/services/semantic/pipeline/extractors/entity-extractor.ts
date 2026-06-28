// ============================================================
// Entity Extractor — Rule-based token/pattern analysis
// No LLM calls in this version. Detects entity candidates by:
// - Known brand/company name patterns
// - URL domain patterns
// - Capitalized phrase patterns (names)
// - Common industry terms
// ============================================================

import type { ContentChunk, ExtractionResult } from '../../types.js'

// Industry/common entities for recognition
const KNOWN_ENTITY_PATTERNS: Array<{ type: string; patterns: RegExp[] }> = [
  {
    type: 'Brand',
    patterns: [
      /(?:^|[\s"])@([A-Z][a-zA-Z0-9]{2,})/g,      // @BrandName
      /(?:™|®|©|®️)/g,                               // Trademark indicators
    ],
  },
  {
    type: 'Technology',
    patterns: [
      /\b(AI|API|SDK|SaaS|PaaS|IaaS|ML|NLP|OCR|GPT|LLM)\b/g,
      /\b(OpenAI|Gemini|Claude|DeepSeek|Qwen)\b/gi,
      /\b(machine learning|artificial intelligence|deep learning|neural network)\b/gi,
    ],
  },
  {
    type: 'Product',
    patterns: [
      /\b(v[\d.]+|Pro|Ultra|Max|Lite|Enterprise|Business)\b/gi,
    ],
  },
]

// Simple Chinese entity detection
function detectChineseEntities(text: string): Array<{ name: string; type: string; confidence: number }> {
  const entities: Array<{ name: string; type: string; confidence: number }> = []

  // Match potential brand/organization names: 2-6 Chinese characters that start a sentence or follow keywords
  const orgPattern = /(?:公司|集团|科技|技术|有限|责任|股份|机构|协会|基金会|研究院|实验室|中心|平台|网络|系统)/g
  let match: RegExpExecArray | null
  const chineseChar = /[\u4e00-\u9fff]/

  while ((match = orgPattern.exec(text)) !== null) {
    // Look backwards to capture the full name
    const end = match.index
    let start = end
    let charCount = 0
    while (start > 0 && charCount < 8) {
      start--
      if (chineseChar.test(text[start])) {
        charCount++
      } else if (charCount > 0) {
        start++
        break
      } else {
        start++
        break
      }
    }

    const name = text.substring(start, end + match[0].length).trim()
    if (name.length >= 2 && name.length <= 16 && chineseChar.test(name)) {
      entities.push({ name, type: 'Organization', confidence: 0.5 })
    }
  }

  return entities
}

// Simple English entity detection
function detectEnglishEntities(text: string): Array<{ name: string; type: string; confidence: number }> {
  const entities: Array<{ name: string; type: string; confidence: number }> = []

  // Match capitalized phrases (potential proper nouns)
  const capPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = capPattern.exec(text)) !== null) {
    const name = match[1].trim()
    // Skip common words and short names
    if (
      name.length < 3 ||
      ['This', 'That', 'What', 'When', 'Where', 'Which', 'How', 'The', 'And', 'For', 'With'].includes(name) ||
      seen.has(name.toLowerCase())
    ) {
      continue
    }
    seen.add(name.toLowerCase())

    // Determine likely type
    let type = 'Concept'
    let confidence = 0.3

    if (/(?:Inc|Corp|Ltd|LLC|GmbH|SA)\b/i.test(name)) {
      type = 'Company'
      confidence = 0.7
    } else if (/(?:University|College|Institute|School|Lab)\b/i.test(name)) {
      type = 'Organization'
      confidence = 0.6
    } else if (name.split(/\s+/).length >= 2) {
      type = 'Person'
      confidence = 0.4
    }

    entities.push({ name, type, confidence })
  }

  return entities
}

// URL-based entity detection
function detectUrlEntities(text: string): Array<{ name: string; type: string; confidence: number }> {
  const entities: Array<{ name: string; type: string; confidence: number }> = []
  const urlPattern = /https?:\/\/(?:www\.)?([^/.\s]+)\.(?:com|cn|org|net|io|ai|dev|app)/gi

  let match: RegExpExecArray | null
  while ((match = urlPattern.exec(text)) !== null) {
    const domain = match[1]
    entities.push({
      name: domain.charAt(0).toUpperCase() + domain.slice(1),
      type: 'Brand',
      confidence: 0.6,
    })
  }

  return entities
}

// Known patterns
function detectKnownPatterns(text: string): ExtractionResult['entities'] {
  const entities: ExtractionResult['entities'] = []
  const seen = new Set<string>()

  for (const group of KNOWN_ENTITY_PATTERNS) {
    for (const pattern of group.patterns) {
      // Reset lastIndex
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1] || match[0]
        const key = name.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          entities.push({ name, type: group.type, confidence: 0.8, description: undefined })
        }
      }
    }
  }

  return entities
}

export const entityExtractor = {
  name: 'entity-extractor',
  priority: 100,

  async extract(chunks: ContentChunk[], context?: Record<string, unknown>): Promise<Partial<ExtractionResult>> {
    const allEntities: ExtractionResult['entities'] = []
    const seen = new Set<string>()

    for (const chunk of chunks) {
      const text = chunk.text

      // Known patterns (highest confidence)
      const known = detectKnownPatterns(text)
      for (const e of known) {
        const key = `${e.type}:${e.name.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          allEntities.push(e)
        }
      }

      // Chinese entities
      const cnEntities = detectChineseEntities(text)
      for (const e of cnEntities) {
        const key = `${e.type}:${e.name.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          allEntities.push(e)
        }
      }

      // English entities
      const enEntities = detectEnglishEntities(text)
      for (const e of enEntities) {
        const key = `${e.type}:${e.name.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          allEntities.push(e)
        }
      }

      // URL entities
      const urlEntities = detectUrlEntities(text)
      for (const e of urlEntities) {
        const key = `${e.type}:${e.name.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          allEntities.push(e)
        }
      }
    }

    return { entities: allEntities }
  },
}
