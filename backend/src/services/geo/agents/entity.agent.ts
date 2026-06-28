// ============================================================
// Entity Agent — Entity Discovery (KMKI-GEO-AGENT-002)
// Registers via AgentRegistry with capabilities: geo.entity.discovery, knowledge.extraction
// Input:  { research } — ResearchOutput
// Output: { entities: Entity[], relations: EntityRelation[] }
// ============================================================

import { agentService } from '../../platform/agent/agent.service'
import type { AgentDefinition } from '../../platform/agent/types'
import { EntityType, createProvenanceRecord, createLineageRecord } from '../types'
import type { EntityDiscoveryInput, EntityDiscoveryOutput, ResearchOutput } from '../types'

export const ENTITY_AGENT_CODE = 'geo.entity'
export const ENTITY_AGENT_CAPABILITIES = ['geo.entity.discovery', 'knowledge.extraction']

/**
 * Default executor for Entity Discovery Agent.
 */
async function entityExecutor(input: EntityDiscoveryInput, _ctx?: any): Promise<EntityDiscoveryOutput> {
  const research = input.research || {} as ResearchOutput
  const config = input.config || {}

  const maxEntities = config.maxEntities || 8
  const topic = research.primaryTopic || ''

  // Generate provenance for each entity
  const provenance = createProvenanceRecord({
    source: 'geo.entity',
    action: 'created',
    actor: 'agent:geo.entity',
    reason: `Entity discovery for topic: ${topic}`,
  })

  // Stub entity extraction — would normally use AI via Capability → Execution Runtime
  const entities = generateStubEntities(topic, research.keywords || [], maxEntities)
  const entityMap = new Map(entities.map((e) => [e.name, e]))

  // Generate relations between entities
  const relations = generateStubRelations(entities, entityMap)

  // Attach provenance to each entity
  const entitiesWithProvenance = entities.map((e) => ({
    ...e,
    provenance: { ...provenance, reason: `Entity "${e.name}" discovered for topic: ${topic}` },
  }))

  console.log(`[EntityAgent] Discovered ${entitiesWithProvenance.length} entities and ${relations.length} relations for topic="${topic}"`)
  return { entities: entitiesWithProvenance, relations }
}

function generateStubEntities(topic: string, keywords: string[], maxCount: number): Array<{
  name: string
  type: EntityType
  description: string
  metadata?: Record<string, unknown>
  sortOrder: number
}> {
  const base: Array<{ name: string; type: EntityType; description: string }> = [
    { name: topic, type: EntityType.Concept, description: `Core concept: ${topic}` },
    { name: `${topic} Industry`, type: EntityType.Field, description: `Industry sector for ${topic}` },
    { name: `${topic} Technology`, type: EntityType.Technology, description: `Key technologies in ${topic}` },
  ]

  // Add keywords as entities
  for (const kw of keywords.slice(0, maxCount - base.length)) {
    if (!base.find((b) => b.name === kw)) {
      base.push({
        name: kw,
        type: EntityType.Concept,
        description: `Keyword related to ${topic}`,
      })
    }
  }

  return base.slice(0, maxCount).map((item, i) => ({
    ...item,
    sortOrder: i,
    metadata: { source: 'research', relevance: 'high' },
  }))
}

function generateStubRelations(
  entities: Array<{ name: string; type: EntityType }>,
  _entityMap: Map<string, any>,
): Array<{ sourceId: string; targetId: string; type: string; lineage: any }> {
  const relations: Array<{ sourceId: string; targetId: string; type: string; lineage: any }> = []

  if (entities.length >= 2) {
    relations.push({
      sourceId: entities[0].name, // will be resolved to actual IDs in service
      targetId: entities[1].name,
      type: 'related_to',
      lineage: createLineageRecord(entities[0].name, entities[1].name, 'related_to'),
    })
  }
  if (entities.length >= 3) {
    relations.push({
      sourceId: entities[1].name,
      targetId: entities[2].name,
      type: 'subfield_of',
      lineage: createLineageRecord(entities[1].name, entities[2].name, 'subfield_of'),
    })
  }

  return relations
}

let registered = false

/**
 * Register the Entity Discovery Agent with the Agent Registry.
 */
export async function registerEntityAgent(): Promise<void> {
  if (registered) return
  const def: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
    code: ENTITY_AGENT_CODE,
    name: 'Entity Discovery Agent',
    version: '1.0.0',
    description: 'Extracts entities and their relationships from research results.',
    capabilities: ENTITY_AGENT_CAPABILITIES,
    supportedResources: ['llm'],
    executionMode: 'sync',
    category: 'official',
    status: 'active',
    schemaVersion: 1,
  }
  try {
    await agentService.register(def, entityExecutor)
    console.log('[EntityAgent] Registered successfully')
    registered = true
  } catch (err) {
    console.error('[EntityAgent] Registration failed:', err)
    throw err
  }
}

/**
 * Execute entity discovery via the Agent Dispatcher.
 */
export async function executeEntityDiscovery(input: EntityDiscoveryInput): Promise<EntityDiscoveryOutput> {
  const result = await agentService.dispatch({
    agentCode: ENTITY_AGENT_CODE,
    input: input as unknown as Record<string, unknown>,
  })
  const output = result.result?.output as Record<string, unknown> | undefined
  return {
    entities: (output?.entities as EntityDiscoveryOutput['entities']) || [],
    relations: (output?.relations as EntityDiscoveryOutput['relations']) || [],
  }
}

export { entityExecutor }
