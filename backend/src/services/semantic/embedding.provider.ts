// ============================================================
// Embedding Provider — Vector embedding interface (reserved)
// Phase 3: Interface only — no actual embedding generation
// ============================================================

import type { SemanticEntityData, SemanticTopicData } from './types.js'

export interface EmbeddingVector {
  vector: number[]
  model: string
  dimension: number
}

export interface EmbeddingProvider {
  name: string
  /** Generate embedding for a text string */
  embed(text: string): Promise<EmbeddingVector | null>
  /** Generate embedding for entity */
  embedEntity(entity: SemanticEntityData): Promise<EmbeddingVector | null>
  /** Generate embedding for topic */
  embedTopic(topic: SemanticTopicData): Promise<EmbeddingVector | null>
  /** Calculate cosine similarity between two vectors */
  similarity(a: number[], b: number[]): number
}

/**
 * No-op embedding provider — returns null for all operations
 * Will be replaced with real embedding model in future phase
 */
class NoOpEmbeddingProvider implements EmbeddingProvider {
  name = 'noop-embedding'

  async embed(_text: string): Promise<EmbeddingVector | null> {
    return null
  }

  async embedEntity(_entity: SemanticEntityData): Promise<EmbeddingVector | null> {
    return null
  }

  async embedTopic(_topic: SemanticTopicData): Promise<EmbeddingVector | null> {
    return null
  }

  similarity(_a: number[], _b: number[]): number {
    return 0
  }
}

// Singleton - can be replaced via setProvider()
let activeProvider: EmbeddingProvider = new NoOpEmbeddingProvider()

export function setEmbeddingProvider(provider: EmbeddingProvider) {
  activeProvider = provider
  console.log(`[EmbeddingProvider] Set to: ${provider.name}`)
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return activeProvider
}
