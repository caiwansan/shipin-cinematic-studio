import type { Evidence } from './models/Evidence'

/**
 * Knowledge Object input shape used by the Evidence Collector.
 */
export interface KnowledgeObjectInput {
  id: string
  content: string
  category: string
  status: string
  lastUpdated?: string | null
  citationCount?: number
  authoritativeCount?: number
  scenarioCount?: number
  totalScenarios?: number
  sourceTypes?: string[]
  entityMentions?: number
  contradictions?: number
}

/**
 * KnowledgeEvidenceCollector
 *
 * Extracts evidence from a Knowledge Object.
 * This is a deterministic simulation — no Math.random, no external service calls.
 */
export class KnowledgeEvidenceCollector {
  collect(object: KnowledgeObjectInput): Evidence[] {
    const evidence: Evidence[] = []

    // Citation evidence
    evidence.push({
      type: 'citation',
      source: 'Knowledge Repository',
      value: object.citationCount ?? (object.content.length % 10),
      confidence: 1.0,
    })

    // Last updated evidence
    evidence.push({
      type: 'lastUpdated',
      source: 'Knowledge Repository',
      value: object.lastUpdated ?? 'unknown',
      confidence: object.lastUpdated ? 1.0 : 0.3,
    })

    // Scenario coverage evidence
    evidence.push({
      type: 'scenarioCoverage',
      source: 'Discovery Engine',
      value: object.scenarioCount ?? Math.ceil(object.content.length / 50),
      confidence: 0.85,
    })

    // Entity consistency evidence
    evidence.push({
      type: 'entityConsistency',
      source: 'Knowledge Repository',
      value: object.entityMentions ?? Math.ceil(object.content.length / 30),
      confidence: 0.75,
    })

    // Source types evidence
    evidence.push({
      type: 'sourceTypes',
      source: 'Knowledge Repository',
      value: (object.sourceTypes ?? (object.category === 'Product' ? ['official_website'] : ['wikipedia'])).join(','),
      confidence: 0.7,
    })

    return evidence
  }
}
