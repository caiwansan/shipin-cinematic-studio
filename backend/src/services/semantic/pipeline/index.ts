// ============================================================
// Semantic Pipeline — Orchestrates extraction from Asset → Entities/Topics/Keywords
// Pipeline: Asset Chunks → Extractor Registry → EntityBuilder → TopicBuilder → Repository
// ============================================================

import { chunkContent } from './chunker.js'
import type { ChunkInput } from '../types.js'
import { extractorRegistry } from './extractor-registry.js'
import { entityExtractor } from './extractors/entity-extractor.js'
import { topicExtractor } from './extractors/topic-extractor.js'
import { keywordExtractor } from './extractors/keyword-extractor.js'
import { entityRepository } from '../repositories/entity.repository.js'
import { topicRepository } from '../repositories/topic.repository.js'
import { keywordRepository } from '../repositories/keyword.repository.js'
import { aliasRepository } from '../repositories/alias.repository.js'
import { relationRepository } from '../repositories/relation.repository.js'
import type { SemanticPipelineConfig, ContentChunk, ExtractionResult } from '../types.js'
import { DEFAULT_PIPELINE_CONFIG } from '../types.js'

/**
 * Initialize the pipeline with default extractors
 * Additional extractors can be registered via extractorRegistry.register()
 */
export function initializePipeline() {
  extractorRegistry.register(entityExtractor)
  extractorRegistry.register(topicExtractor)
  extractorRegistry.register(keywordExtractor)
  console.log('[SemanticPipeline] Registered default extractors:', extractorRegistry.getAll().map(e => e.name))
}

/**
 * Run the full extraction pipeline on a chunk input
 */
export async function runPipeline(
  projectId: string,
  input: ChunkInput,
  config: SemanticPipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Promise<{
  entities: any[]
  topics: any[]
  keywords: any[]
  relations: any[]
}> {
  // 1. Chunk the input
  const chunks = chunkContent(input, config.chunkSize)
  console.log(`[SemanticPipeline] Chunked content into ${chunks.length} chunks`)

  // 2. Run extractors
  const context = {
    maxTopics: config.maxTopics,
    maxKeywords: config.maxKeywords,
    confidenceThreshold: config.confidenceThreshold,
  }
  const extraction = await extractorRegistry.runAll(chunks, context)

  // 3. Build entities
  const savedEntities = await buildEntities(projectId, extraction, input, config)
  console.log(`[SemanticPipeline] Built/updated ${savedEntities.length} entities`)

  // 4. Build topics
  const savedTopics = await buildTopics(projectId, extraction, savedEntities)
  console.log(`[SemanticPipeline] Built/updated ${savedTopics.length} topics`)

  // 5. Build keywords
  const savedKeywords = await buildKeywords(projectId, extraction, savedEntities, config)
  console.log(`[SemanticPipeline] Built/updated ${savedKeywords.length} keywords`)

  // 6. Build relations (between entities that coexist)
  const savedRelations = await buildRelations(projectId, extraction, savedEntities, savedTopics)
  console.log(`[SemanticPipeline] Built ${savedRelations.length} relations`)

  return {
    entities: savedEntities,
    topics: savedTopics,
    keywords: savedKeywords,
    relations: savedRelations,
  }
}

async function buildEntities(
  projectId: string,
  extraction: ExtractionResult,
  input: ChunkInput,
  config: SemanticPipelineConfig,
): Promise<any[]> {
  const saved: any[] = []

  for (const entityData of extraction.entities) {
    try {
      // Skip low confidence
      if (entityData.confidence < (config.confidenceThreshold ?? 0.3)) continue

      // Resolve existing entity
      const existing = await entityRepository.resolveByName(projectId, entityData.name)
      if (existing) {
        // Update confidence if higher
        if (entityData.confidence > existing.entity.confidence) {
          await entityRepository.update(existing.entity.id, {
            confidence: entityData.confidence,
            description: entityData.description || existing.entity.description,
          })
        }
        saved.push(existing.entity)
        continue
      }

      // Create new entity
      const entity = await entityRepository.create({
        projectId,
        assetId: input.metadata?.assetId as string | undefined,
        type: entityData.type,
        name: entityData.name,
        description: entityData.description,
        confidence: entityData.confidence,
      })
      saved.push(entity)
    } catch (err: any) {
      console.error(`[SemanticPipeline] Failed to create entity "${entityData.name}":`, err.message)
    }
  }

  return saved
}

async function buildTopics(
  projectId: string,
  extraction: ExtractionResult,
  entities: any[],
): Promise<any[]> {
  const saved: any[] = []

  for (const topicData of extraction.topics) {
    try {
      // Find or create topic
      let topic = await topicRepository.findByName(projectId, topicData.name)
      if (!topic) {
        topic = await topicRepository.create({
          projectId,
          name: topicData.name,
          description: topicData.description,
          confidence: topicData.confidence,
        })
      } else if (topicData.confidence > topic.confidence) {
        await topicRepository.update(topic.id, { confidence: topicData.confidence })
      }

      saved.push(topic)
    } catch (err: any) {
      console.error(`[SemanticPipeline] Failed to create topic "${topicData.name}":`, err.message)
    }
  }

  return saved
}

async function buildKeywords(
  projectId: string,
  extraction: ExtractionResult,
  entities: any[],
  config: SemanticPipelineConfig,
): Promise<any[]> {
  const saved: any[] = []
  const maxKeywords = config.maxKeywords ?? 20
  const topKeywords = extraction.keywords.slice(0, maxKeywords)

  for (const kwData of topKeywords) {
    try {
      const kw = await keywordRepository.create({
        projectId,
        keyword: kwData.keyword,
        confidence: kwData.confidence,
      })
      saved.push(kw)
    } catch (err: any) {
      // Skip duplicates silently
    }
  }

  return saved
}

async function buildRelations(
  projectId: string,
  extraction: ExtractionResult,
  entities: any[],
  topics: any[],
): Promise<any[]> {
  const saved: any[] = []

  // Create relations between entities that appear together in extraction
  for (const rel of extraction.relations || []) {
    try {
      const fromEntity = entities.find(e => e.name.toLowerCase() === rel.fromName.toLowerCase())
      const toEntity = entities.find(e => e.name.toLowerCase() === rel.toName.toLowerCase())

      if (fromEntity && toEntity) {
        const relation = await relationRepository.create({
          projectId,
          fromEntityId: fromEntity.id,
          toEntityId: toEntity.id,
          relation: rel.relation,
          confidence: rel.confidence,
        })
        saved.push(relation)
      }
    } catch (err: any) {
      console.error(`[SemanticPipeline] Failed to create relation:`, err.message)
    }
  }

  return saved
}
