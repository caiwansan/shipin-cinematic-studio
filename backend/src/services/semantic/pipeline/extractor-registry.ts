// ============================================================
// Extractor Registry — Plugin-based extractor registration
// New domain extractors can be added without modifying core code
// ============================================================

import type { ContentChunk, ExtractionResult } from '../types.js'

/**
 * Extractor interface — any module can implement this
 */
export interface SemanticExtractor {
  name: string
  priority: number // Higher = runs first
  extract(chunks: ContentChunk[], context?: Record<string, unknown>): Promise<Partial<ExtractionResult>>
}

class ExtractorRegistry {
  private extractors: SemanticExtractor[] = []

  /** Register an extractor plugin */
  register(extractor: SemanticExtractor) {
    // Remove existing with same name if present
    this.extractors = this.extractors.filter(e => e.name !== extractor.name)
    this.extractors.push(extractor)
    // Sort by priority descending
    this.extractors.sort((a, b) => b.priority - a.priority)
  }

  /** Get all registered extractors */
  getAll(): SemanticExtractor[] {
    return [...this.extractors]
  }

  /** Get extractor by name */
  get(name: string): SemanticExtractor | undefined {
    return this.extractors.find(e => e.name === name)
  }

  /** Run all extractors and merge results */
  async runAll(chunks: ContentChunk[], context?: Record<string, unknown>): Promise<ExtractionResult> {
    const merged: ExtractionResult = {
      entities: [],
      topics: [],
      keywords: [],
      relations: [],
    }

    const seenKeys = new Set<string>()

    for (const extractor of this.extractors) {
      try {
        const result = await extractor.extract(chunks, context)
        if (!result) continue

        // Merge entities (dedup by type+name)
        for (const entity of result.entities || []) {
          const key = `${entity.type}:${entity.name.toLowerCase()}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            merged.entities.push(entity)
          }
        }

        // Merge topics (dedup by name)
        for (const topic of result.topics || []) {
          const key = `topic:${topic.name.toLowerCase()}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            merged.topics.push(topic)
          }
        }

        // Merge keywords
        for (const kw of result.keywords || []) {
          const key = `kw:${kw.keyword.toLowerCase()}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            merged.keywords.push(kw)
          }
        }

        // Merge relations
        for (const rel of result.relations || []) {
          const key = `rel:${rel.fromName.toLowerCase()}:${rel.relation}:${rel.toName.toLowerCase()}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            merged.relations.push(rel)
          }
        }
      } catch (err: any) {
        console.error(`[ExtractorRegistry] Extractor "${extractor.name}" failed:`, err.message)
      }
    }

    return merged
  }

  /** Clear all extractors */
  clear() {
    this.extractors = []
  }
}

// Singleton registry
export const extractorRegistry = new ExtractorRegistry()
