// ============================================================
// Knowledge Graph Agent — Graph Builder (KMKI-GEO-AGENT-003)
// Registers via AgentRegistry with capabilities: geo.graph.build, knowledge.graph
// Input:  { entities: Entity[], relations: EntityRelation[] }
// Output: { graph: KnowledgeGraph }
// ============================================================

import { agentService } from '../../platform/agent/agent.service'
import type { AgentDefinition } from '../../platform/agent/types'
import { createProvenanceRecord, EntityType } from '../types'
import type { GraphBuildInput, GraphBuildOutput, KnowledgeGraph, Entity, EntityRelation } from '../types'

export const KG_AGENT_CODE = 'geo.knowledge-graph'
export const KG_AGENT_CAPABILITIES = ['geo.graph.build', 'knowledge.graph']

/**
 * Default executor for Knowledge Graph Agent.
 */
async function kgExecutor(input: GraphBuildInput, ctx?: any): Promise<GraphBuildOutput> {
  const rawEntities: any[] = input.entities || []
  const rawRelations: any[] = input.relations || []

  const projectId = ctx?.projectId || 'unknown'

  const provenance = createProvenanceRecord({
    source: 'geo.knowledge-graph',
    action: 'created',
    actor: 'agent:geo.knowledge-graph',
    reason: `Knowledge graph build for project: ${projectId}`,
  })

  // Convert input entities to Entity type with provenance
  const graphEntities: Entity[] = rawEntities.map((e: any, i: number) => ({
    id: e.id || `kg-entity-${i}`,
    projectId: e.projectId || projectId,
    name: e.name,
    type: e.type as EntityType,
    description: e.description,
    metadata: e.metadata,
    provenance: e.provenance || provenance,
    sortOrder: e.sortOrder || i,
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
  }))

  // Convert input relations to EntityRelation type with lineage
  const graphEdges: EntityRelation[] = rawRelations.map((r: any, i: number) => ({
    id: r.id || `kg-edge-${i}`,
    projectId: r.projectId || projectId,
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type || 'related_to',
    lineage: r.lineage || {
      outputType: 'entity_relation',
      outputSegment: r.type || 'related_to',
      tracePath: [r.sourceId, '→', r.targetId],
    },
    metadata: r.metadata,
    createdAt: r.createdAt || new Date().toISOString(),
  }))

  const graph: KnowledgeGraph = {
    entities: graphEntities,
    edges: graphEdges,
    metadata: {
      projectId,
      buildVersion: 1,
      nodeCount: graphEntities.length,
      edgeCount: graphEdges.length,
      builtAt: new Date().toISOString(),
    },
  }

  console.log(`[KGAgent] Built graph with ${graphEntities.length} nodes and ${graphEdges.length} edges for project=${projectId}`)
  return { graph }
}

let registered = false

/**
 * Register the Knowledge Graph Agent with the Agent Registry.
 */
export async function registerKGAgent(): Promise<void> {
  if (registered) return
  const def: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
    code: KG_AGENT_CODE,
    name: 'Knowledge Graph Agent',
    version: '1.0.0',
    description: 'Builds a knowledge graph from entities and relations.',
    capabilities: KG_AGENT_CAPABILITIES,
    supportedResources: ['llm'],
    executionMode: 'sync',
    category: 'official',
    status: 'active',
    schemaVersion: 1,
  }
  try {
    await agentService.register(def, kgExecutor)
    console.log('[KGAgent] Registered successfully')
    registered = true
  } catch (err) {
    console.error('[KGAgent] Registration failed:', err)
    throw err
  }
}

/**
 * Execute knowledge graph build via the Agent Dispatcher.
 */
export async function executeGraphBuild(input: GraphBuildInput): Promise<GraphBuildOutput> {
  const result = await agentService.dispatch({
    agentCode: KG_AGENT_CODE,
    input: input as unknown as Record<string, unknown>,
  })
  const output = result.result?.output as Record<string, unknown> | undefined
  return {
    graph: output?.graph as unknown as KnowledgeGraph || { entities: [], edges: [], metadata: { projectId: '', buildVersion: 0, nodeCount: 0, edgeCount: 0, builtAt: new Date().toISOString() } },
  }
}

export { kgExecutor }
