// ============================================================
// LegacyMockProvider — 使用旧 mockScanner 的兼容 Provider（已废弃）
// @beta-stub: 仅用于 v1 Rollback，不参与生产路径
// RC-D1 标注：此 Provider 不再参与生产路径
// Feature Flag: DISCOVERY_ENGINE=v1（需手动设置环境变量）
// ============================================================

import type { DiscoveryProvider } from './discovery-provider.js'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope.js'

// 导入旧的 mockScanner
// 注意：mockScanner 类型不完整，这里保持兼容
const mockScanner = {
  async scan(projectId: string) {
    return {
      entities: [
        { name: '品牌A', type: 'organization', confidence: 0.8 },
        { name: '品牌B', type: 'product', confidence: 0.6 },
      ],
      visibility: 35,
      authority: 25,
      coverage: 40,
    }
  },
}

export class LegacyMockProvider implements DiscoveryProvider {
  readonly name = 'legacy-mock'

  async discover(projectId: string, entityId: string, entityName: string): Promise<DiscoveryEnvelope> {
    const startTime = Date.now()
    const scanResult = await mockScanner.scan(projectId)

    return {
      version: '1.0',
      executionId: `legacy-${Date.now()}`,
      result: {
        version: '1.0',
        metadata: {
          projectId,
          entityId,
          discoveredAt: new Date().toISOString(),
          providers: ['mock'],
          overralConfidence: scanResult.visibility,
          executionId: `legacy-${Date.now()}`,
          pipelineVersion: '1.0',
          durationMs: Date.now() - startTime,
        },
        entity: {
          name: entityName,
          aliases: [],
          categories: [],
          locations: [],
        },
        presence: {
          providerResults: [],
          visibility: scanResult.visibility,
          sentiment: 0,
          authority: scanResult.authority,
          citations: [],
        },
        knowledge: {
          coverage: scanResult.coverage,
          claims: [],
          evidence: [],
          faq: [],
          schema: [],
          missingKnowledge: [],
        },
        competitors: {
          entities: scanResult.entities.map((e: { name: string; type: string; confidence: number }) => ({
            name: e.name,
            strength: 'moderate' as const,
          })),
          gaps: [],
          opportunities: [],
        },
        recommendations: {
          items: [],
          priority: 'medium' as const,
        },
        evidence: {
          totalCount: 0,
          highConfidence: 0,
          totalCitations: 0,
        },
        diagnostics: {
          stageDurations: {},
          errors: [],
          warnings: [],
        },
        raw: scanResult,
      },
      diagnostics: {
        stages: [{ id: 'mock', name: 'LegacyMock', durationMs: Date.now() - startTime, confidence: 0.5, evidenceCount: 0 }],
        totalDurationMs: Date.now() - startTime,
        retries: 0,
        errors: [],
      },
      execution: {
        projectId,
        entityId,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        providerTokens: {},
        providerLatencyMs: {},
      },
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 }
  }

  capabilities(): string[] {
    return ['presence-scan', 'entity-discovery']
  }
}
