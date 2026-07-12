// ============================================================
// C0-002: RecommendationsConsumer — Discovery → Recommendations 引擎
//
// Discovery 完成后，将 Presence / Knowledge / Search Signal
// 写入 Recommendations 引擎的初始数据（Score Snapshot）
//
// 消费逻辑：
//   - presence signal → visibility 基准分
//   - knowledge signal → knowledge 维度基准分
//   - search signal → content 基准分
// 而非从零开始重新查询数据库
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'
import type { DiscoverySignal } from '../../domain/discovery-signal'
import { geoScoreSnapshotRepository } from '../../repositories/geo-score-snapshot.repository.js'
import { snapshotBuilder } from '../../workspace/snapshot-builder.js'

/**
 * 将 DiscoverySignal 映射为 Recommendations 基准数据
 */
function createBaseScore(signals: DiscoverySignal[]): {
  visibility: number
  authority: number
  content: number
  website: number
  knowledge: number
} {
  const base = {
    visibility: 0,
    authority: 0,
    content: 0,
    website: 0,
    knowledge: 0,
  }

  for (const signal of signals) {
    switch (signal.type) {
      case 'presence':
        // presence signal → visibility 基准分
        base.visibility = Math.round(signal.confidence * 100)
        // authority 也受 presence 的影响
        base.authority = Math.round(signal.confidence * 60)
        break
      case 'knowledge':
        // knowledge signal → knowledge 维度基准分
        base.knowledge = Math.round(signal.confidence * 100)
        // 知识覆盖也会提升 authority
        base.authority = Math.max(base.authority, Math.round(signal.confidence * 70))
        break
      case 'search':
        // search signal（有 recommendation 条目）→ content 基准分
        base.content = Math.round(signal.confidence * 100)
        // 可搜索到 website 信息
        base.website = Math.round(signal.confidence * 50)
        break
    }
  }

  return base
}

export class RecommendationsConsumer implements DiscoveryConsumer {
  readonly name = 'RecommendationsConsumer'

  supports(envelope: DiscoveryEnvelope): boolean {
    // Recommendations 需要至少有一个 signal
    const signals = envelope.result.metadata.signals
    return signals !== undefined && signals.length > 0
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    const signals = envelope.result.metadata.signals!
    const projectId = envelope.execution.projectId
    const entityName = envelope.result.entity.name

    console.log(`[RecommendationsConsumer] Processing: ${entityName} (${projectId})`)

    // 从 DiscoverySignal 映射为 Recommendations 基准分数
    const baseScore = createBaseScore(signals)

    console.log(`[RecommendationsConsumer] 基准评分: ` +
      `visibility=${baseScore.visibility}, knowledge=${baseScore.knowledge}, ` +
      `content=${baseScore.content}, authority=${baseScore.authority}, website=${baseScore.website}`
    )

    // 写入 Score Snapshot（不可变 — 始终 create 新快照）
    const overallScore = Math.round(
      (baseScore.visibility + baseScore.authority + baseScore.content +
       baseScore.website + baseScore.knowledge) / 5
    )

    const snapshotData = snapshotBuilder.build({
      projectId,
      sourceType: 'real',
      snapshotData: {
        visibilityScore: baseScore.visibility,
        authorityScore: baseScore.authority,
        contentScore: baseScore.content,
        websiteScore: baseScore.website,
        knowledgeScore: baseScore.knowledge,
        overallScore,
        discoveryId: envelope.execution.entityId,
      },
      metadataData: {
        lastProvider: 'discovery-engine-v2',
        lastExecution: envelope.executionId,
        source: 'recommendations-consumer',
      },
    })

    await geoScoreSnapshotRepository.create(snapshotData)
    console.log(`[RecommendationsConsumer] Score snapshot 已创建 (discovery: ${envelope.executionId})`)

    console.log(`[RecommendationsConsumer] 完成: ${envelope.executionId}`)
  }
}

export const recommendationsConsumer = new RecommendationsConsumer()
