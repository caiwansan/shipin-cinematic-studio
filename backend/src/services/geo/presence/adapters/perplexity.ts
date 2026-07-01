// ============================================================
// Perplexity Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const perplexityAdapter: ProviderAdapter = {
  provider: 'perplexity',
  displayName: 'Perplexity',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 5 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 70 + Math.random() * 100))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'perplexity',
        group: 'international',
        displayName: 'Perplexity',
        visibility: 'visible',
        knowledgeQuality: 68,
        evidenceLevel: 'C',
        confidence: 65,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: 'Perplexity 能根据搜索结果提取品牌信息，可见度中等。',
        explain: 'Perplexity 通过搜索聚合获取信息。品牌有官网和描述时，能提供基本准确的品牌概述。',
        recommendations: [
          '确保官网内容对搜索引擎友好',
          '在权威来源发布品牌相关信息',
          '优化品牌关键词的搜索引擎排名',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'perplexity',
        group: 'international',
        displayName: 'Perplexity',
        visibility: 'partial',
        knowledgeQuality: 45,
        evidenceLevel: 'D',
        confidence: 40,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: 'Perplexity 能定位品牌，但信息有限。',
        explain: '有官网但缺乏详细描述，Perplexity 可获取的基础品牌信息较少。',
        recommendations: [
          '补充品牌详细描述',
          '增加行业分类信息',
          '丰富官网内容',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'perplexity',
        group: 'international',
        displayName: 'Perplexity',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 15,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌信息不足，无法在 Perplexity 中确认存在。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在公开信息源发布品牌资料',
        ],
      }
    }

    return {
      provider: 'perplexity',
      group: 'international',
      displayName: 'Perplexity',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估 Perplexity 可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
