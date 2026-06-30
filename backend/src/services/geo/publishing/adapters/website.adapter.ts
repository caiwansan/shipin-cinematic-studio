import type { PublishingAdapter, PublishContent, PublishPreview, PublishResult, RollbackResult, PublishStatus } from '../publishing.types'

/**
 * Website adapter — publishes content to a static website or branded content endpoint.
 * Phase 1: Simulated publishing (stores record + returns success).
 * Phase 2: Real HTTP publishing to configured endpoint.
 */
export const adapter: PublishingAdapter = {
  platform: 'website',

  supports(contentType: string): boolean {
    return ['faq', 'schema', 'blog', 'brand_story', 'about', 'knowledge'].includes(contentType)
  },

  async health(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'Website adapter ready (simulation mode)' }
  },

  async capabilities(): Promise<string[]> {
    return ['faq', 'schema', 'blog', 'brand_story', 'about', 'knowledge']
  },

  async preview(content: PublishContent): Promise<PublishPreview> {
    const before = content.beforeContent || {}
    const after = content.afterContent || {}
    const sideBySideDiff: Record<string, { before: any; after: any }> = {}

    // Build side-by-side diff from content
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        sideBySideDiff[key] = { before: before[key], after: after[key] }
      }
    }
    // Also include keys only in before
    for (const key of Object.keys(before)) {
      if (!(key in after)) {
        sideBySideDiff[key] = { before: before[key], after: '(deleted)' }
      }
    }

    return {
      diffSummary: Object.keys(sideBySideDiff).length > 0
        ? `${Object.keys(sideBySideDiff)} 个字段已变更`
        : '无变更',
      beforeContent: before,
      afterContent: after,
      sideBySideDiff,
      estimatedImpact: '预计可提升品牌内容可见度',
      targetPlatform: 'website',
      rollbackRisk: '低 — 保留前一版本可回滚',
    }
  },

  async publish(projectId: string, content: PublishContent): Promise<PublishResult> {
    // Phase 1: simulation — records are created by the pipeline
    return {
      publishId: `pub_${Date.now()}`,
      platform: 'website',
      status: 'published',
      publishedAt: new Date(),
      publishVersion: 1,
    }
  },

  async rollback(projectId: string, version: number): Promise<RollbackResult> {
    return {
      publishId: `rollback_${projectId}_v${version}`,
      rollbackVersion: version,
      status: 'rolled_back',
    }
  },

  async checkStatus(publishId: string): Promise<PublishStatus> {
    return {
      publishId,
      status: 'published',
      publishedAt: new Date(),
    }
  },
}
