// ============================================================
// C0-001: KnowledgeConsumer — Discovery → Knowledge 引擎
//
// 实现 DiscoveryConsumer 接口
// Discovery 完成后，将 Entity / Evidence / Citation 写入 Knowledge Pipeline
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'
import { knowledgePipeline } from '../../runtime/knowledge/KnowledgePipeline'
import type { EntitySnapshot, EvidenceSnapshot, KOProvenance, CitationSnapshot, KnowledgeIngestResult } from '../../runtime/knowledge/KnowledgeObjectSchema'
import { discoveryMetrics } from './discovery-metrics'

export class KnowledgeConsumer implements DiscoveryConsumer {
  readonly name = 'KnowledgeConsumer'

  supports(envelope: DiscoveryEnvelope): boolean {
    // Knowledge 只消费有 signal 的 discovery（provider 真的有返回）
    const signals = envelope.result.metadata.signals
    return signals !== undefined && signals.length > 0
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    const result = envelope.result
    const entityName = result.entity.name
    const projectId = envelope.execution.projectId

    console.log(`[KnowledgeConsumer] Processing: ${entityName} (${projectId})`)

    // Step 1: Entity 信息 → KnowledgeObject
    const entitySnapshots: EntitySnapshot[] = [
      {
        name: entityName,
        id: result.entity.name,
        type: 'organization',
        description: result.entity.description || `${entityName} — GEO Discovery 扫描结果`,
        metadata: {
          aliases: result.entity.aliases,
          categories: result.entity.categories,
          locations: result.entity.locations,
          website: result.entity.website,
        } as Record<string, unknown>,
      },
    ]

    // Step 2: Signals → Evidence / Citation
    const evidenceSnapshots: EvidenceSnapshot[] = []
    const citationSnapshots: CitationSnapshot[] = []

    const signals = envelope.result.metadata.signals
    if (signals) {
      for (const signal of signals) {
        for (const ev of signal.evidence) {
          evidenceSnapshots.push({
            id: `ev-${signal.id}-${evidenceSnapshots.length}`,
            claimId: signal.id,
            source: ev.source,
            confidence: ev.confidence,
            summary: ev.summary,
            metadata: { signalType: signal.type, provider: signal.provider } as Record<string, unknown>,
          })

          if (ev.citation) {
            citationSnapshots.push({
              id: `cit-${signal.id}-${citationSnapshots.length}`,
              url: ev.citation.url || '',
              title: ev.citation.title || '',
              snippet: ev.citation.snippet || '',
            })
          }
        }
      }
    }

    // Step 3: Provenance
    const provenance: KOProvenance = {
      provider: 'discovery-engine-v2',
      model: 'pipeline-2.0',
      promptVersion: 'discovery.v2@1.0.0',
      traceId: envelope.executionId,
      runtimeVersion: '2.0',
    }

    // Step 4: 写入 Knowledge Pipeline
    const ingestResult = await knowledgePipeline.onEntityDiscovery({
      projectId,
      topic: entityName,
      entities: entitySnapshots,
      relations: [],
      provenance,
    })
    if (!ingestResult.ok) {
      console.log(`[KnowledgeConsumer] 跳过 KnowledgeObject 写入: ${ingestResult.reason} (projectId=${ingestResult.projectId})`)
      return
    }
    const ko = ingestResult.object
    console.log(`[KnowledgeConsumer] KnowledgeObject: ${ko.id}`)

    // Step 5: Evidence
    if (evidenceSnapshots.length > 0) {
      await knowledgePipeline.onEvidenceDiscovery({
        projectId,
        topic: entityName,
        evidence: evidenceSnapshots,
        provenance,
      })
      console.log(`[KnowledgeConsumer] Evidence: ${evidenceSnapshots.length} items`)
    }

    // Step 6: Citations
    if (citationSnapshots.length > 0) {
      await knowledgePipeline.onCitationDiscovery({
        projectId,
        topic: entityName,
        citations: citationSnapshots,
        provenance,
      })
      console.log(`[KnowledgeConsumer] Citations: ${citationSnapshots.length} items`)
    }

    // Step 7: Metrics
    discoveryMetrics.collect(envelope, 'v2')
    console.log(`[KnowledgeConsumer] Metrics recorded: ${envelope.executionId}`)
  }
}

export const knowledgeConsumer = new KnowledgeConsumer()
