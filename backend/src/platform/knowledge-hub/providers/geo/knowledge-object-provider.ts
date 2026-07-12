// ════════════════════════════════════════════════════════════
// P1A-002 — KnowledgeObjectProvider
// ════════════════════════════════════════════════════════════
// Adapter between GEO KnowledgeObject and Platform KnowledgeProvider.
//
// This is the ONLY entry point for Packaging Engine into GEO data.
// Input:  koId (KnowledgeObject ID)
// Output: Platform KnowledgeProvider interface (compatible with PackageBuilder)
//
// Mappers are separate for reusability across Distribution/Evidence/Observation.
// ════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid'
import type { KnowledgeProvider, KnowledgePackage, KnowledgeClaim, KnowledgeEvidence, KnowledgeAsset, Citation, PublishingTarget } from '../../core/types'
import { knowledgeObjectService } from '../../../../services/geo/runtime/knowledge/KnowledgeObjectService'
import { mapClaims } from './mappers/claim.mapper'
import { mapEvidence } from './mappers/evidence.mapper'
import { mapCitations } from './mappers/citation.mapper'
import { mapToAssets } from './mappers/asset.mapper'
import { mapEntityToPackageMeta } from './mappers/entity.mapper'

/**
 * KnowledgeObjectProvider — PackageBuilder 的唯一 GEO 数据源。
 *
 * 实现 KnowledgeProvider 接口，输入统一为 koId（KnowledgeObject ID）。
 * buildContent() 完成所有 mapping，后续 getter 直接从缓存的 pkg 读取。
 * 避免 getter 重复读取 KnowledgeObject。
 */
export class KnowledgeObjectProvider implements KnowledgeProvider {
  workspace = 'geo'
  name = 'KnowledgeObjectProvider'

  canHandle(_entityType: string, _entityId: string): boolean {
    // KnowledgeObjectProvider 不通过 entityType/entityId 路由
    // 由外部调用方根据 koId 直接选择 Provider
    return true
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage | null> {
    const koId = pkg.entityId

    // 读取 KnowledgeObject（RUNTIME-013 Repository）
    const ko = await knowledgeObjectService.getById(koId)
    if (!ko) return null

    // 从 Entity Mapper 获取 package metadata
    const meta = mapEntityToPackageMeta(ko.entities, ko.topic)

    // 填充 Package 基础信息
    pkg.title = meta.title
    pkg.description = meta.description
    pkg.tags = [...meta.tags, ...(pkg.tags || [])]

    // 在 buildContent 内完成所有 mapping，写入 pkg 字段
    // 这样后续 getter 直接从 pkg 读取，无需重新查询 KO
    pkg.claims = mapClaims(ko.claims)
    pkg.evidence = mapEvidence(ko.evidence)
    pkg.citations = mapCitations(ko.citations)
    pkg.assets = mapToAssets(ko.entities)

    return pkg
  }

  getClaims(pkg: KnowledgePackage): KnowledgeClaim[] {
    return pkg.claims ?? []
  }

  getEvidence(pkg: KnowledgePackage): KnowledgeEvidence[] {
    return pkg.evidence ?? []
  }

  getAssets(pkg: KnowledgePackage): KnowledgeAsset[] {
    return pkg.assets ?? []
  }

  getCitations(pkg: KnowledgePackage): Citation[] {
    return pkg.citations ?? []
  }

  getPublishingTargets(_pkg: KnowledgePackage): PublishingTarget[] {
    return [] // Phase 2: Distribution Engine 会填入
  }
}

/**
 * buildPackageFromKO — 基于 koId 构建完整的 KnowledgePackage
 *
 * 这是 PackageBuilder 的外部调用接口。
 * 输入：koId
 * 输出：完整的 KnowledgePackage + BuildResult
 */
export async function buildPackageFromKO(
  koId: string,
  options?: {
    bypassValidation?: boolean
    tags?: string[]
  },
): Promise<{
  success: boolean
  pkg?: KnowledgePackage
  errors?: string[]
}> {
  const { PackageBuilder } = await import('../../core/package-builder')
  const { PackageValidator } = await import('../../core/package-validator')

  const ko = await knowledgeObjectService.getById(koId)
  if (!ko) {
    return { success: false, errors: [`KnowledgeObject not found: ${koId}`] }
  }

  const provider = new KnowledgeObjectProvider()
  const validator = new PackageValidator()
  const builder = new PackageBuilder(validator)

  // entityType='knowledge-object', entityId=koId
  // 这是 Provider 的唯一外部标识，Platform 层也使用同样的模式
  const result = await builder.build(provider, {
    workspace: 'geo',
    entityType: 'knowledge-object',
    entityId: koId,
    title: ko.topic ?? `Knowledge: ${koId.slice(0, 8)}`,
    tags: options?.tags ?? [],
    bypassValidation: options?.bypassValidation ?? false,
  })

  return result
}
