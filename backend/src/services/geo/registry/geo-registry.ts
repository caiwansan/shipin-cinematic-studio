// ============================================================
// GEO Registry — Register GEO workspace type to Workspace Runtime
// ============================================================

import type { AgentDefinition } from '../../platform/agent/types'

/**
 * GEO workspace type constant for Workspace Runtime.
 */
export const GEO_WORKSPACE_TYPE = 'geo'

/**
 * GEO module descriptor for registration with Workspace Runtime.
 */
export interface GEOModuleDescriptor {
  moduleId: string
  name: string
  version: string
  description: string
  agents: Array<{
    code: string
    name: string
    capabilities: string[]
    executionMode: 'sync' | 'async' | 'streaming'
  }>
}

/**
 * Built-in GEO agent definitions for the Agent Registry.
 */
export function getGEOAgentDefinitions(): Array<Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>> {
  return [
    {
      code: 'geo.research',
      name: 'Topic Research Agent',
      version: '1.0.0',
      description: 'Discovers primary and secondary topics, intent, audience, and keywords for a given topic.',
      capabilities: ['geo.research', 'knowledge.discovery'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.entity',
      name: 'Entity Discovery Agent',
      version: '1.0.0',
      description: 'Extracts entities and their relationships from research results.',
      capabilities: ['geo.entity.discovery', 'knowledge.extraction'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.knowledge-graph',
      name: 'Knowledge Graph Agent',
      version: '1.0.0',
      description: 'Builds a knowledge graph from entities and relations.',
      capabilities: ['geo.graph.build', 'knowledge.graph'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    // ── Sprint 1B: Knowledge Quality Agents ──
    {
      code: 'geo.claim',
      name: 'Claim Agent',
      version: '1.0.0',
      description: 'Extracts authoritative factual claims from knowledge graph entities.',
      capabilities: ['geo.claim.extract', 'knowledge.quality'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.evidence',
      name: 'Evidence Agent',
      version: '1.0.0',
      description: 'Gathers and verifies supporting evidence for claims.',
      capabilities: ['geo.evidence.gather', 'knowledge.verification'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.citation',
      name: 'Citation Agent',
      version: '1.0.0',
      description: 'Formats evidence into standardized citations (APA/MLA/Custom).',
      capabilities: ['geo.citation.format', 'knowledge.formatting'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.faq',
      name: 'FAQ Agent',
      version: '1.0.0',
      description: 'Generates structured FAQ pairs from entity knowledge and claims.',
      capabilities: ['geo.faq.generate', 'knowledge.qa'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
    {
      code: 'geo.schema',
      name: 'Schema Agent',
      version: '1.0.0',
      description: 'Generates and validates schema.org JSON-LD structured data markup.',
      capabilities: ['geo.schema.generate', 'knowledge.structured'],
      supportedResources: ['llm'],
      executionMode: 'sync',
      status: 'active',
      category: 'official',
      schemaVersion: 1,
    },
  ]
}

/**
 * GEO module descriptor for Workspace Runtime registration.
 */
export function getGEOModuleDescriptor(): GEOModuleDescriptor {
  return {
    moduleId: 'kmki.geo',
    name: 'GEO Knowledge Skeleton',
    version: '1.0.0',
    description: 'GEO (Generative Engine Optimization) knowledge management module for topic research, entity discovery, and knowledge graph construction.',
    agents: getGEOAgentDefinitions().map((def) => ({
      code: def.code,
      name: def.name,
      capabilities: def.capabilities,
      executionMode: def.executionMode,
    })),
  }
}

/**
 * Default GEO workspace settings for Workspace Runtime.
 */
export function getDefaultGEOWorkspaceSettings(): Record<string, unknown> {
  return {
    moduleId: 'kmki.geo',
    pipelineSteps: [
      'topic_research',
      'entity_discovery',
      'knowledge_graph',
      'review',
      'publish',
    ],
    defaultLanguage: 'zh',
    enableProvenance: true,
    enableLineage: true,
  }
}
