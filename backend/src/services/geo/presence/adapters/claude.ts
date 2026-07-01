// ============================================================
// Claude Adapter — AI Presence Engine
// P0-T005: AI Presence Engine Foundation
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const claudeAdapter: ProviderAdapter = {
  provider: 'claude',
  displayName: 'Claude',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 3 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 90 + Math.random() * 110))

    if (hasWebsite && hasDescription) {
      return {
        provider: 'claude',
        group: 'international',
        displayName: 'Claude',
        visibility: 'partial',
        knowledgeQuality: 65,
        evidenceLevel: 'C',
        confidence: 60,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: 'Claude 能获取部分品牌信息，但知识覆盖有限。',
        explain: 'Claude 的训练数据截止时间较早，对较新品牌的认知可能不完整。有官网和描述时能提供基本品牌信息。',
        recommendations: [
          '在官网添加详细的品牌信息和时间线',
          '在知名技术/商业出版物中引用品牌',
          '提供权威的第三方品牌背书',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'claude',
        group: 'international',
        displayName: 'Claude',
        visibility: 'partial',
        knowledgeQuality: 48,
        evidenceLevel: 'D',
        confidence: 42,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: 'Claude 只能获取有限的品牌信息。',
        explain: '仅有官网和名称的情况下，Claude 对品牌的描述较为模糊。',
        recommendations: [
          '补充详细的品牌描述和定位',
          '添加行业分类信息',
          '在公开可访问的知识库中发布品牌资料',
        ],
      }
    }

    if (hasName) {
      return {
        provider: 'claude',
        group: 'international',
        displayName: 'Claude',
        visibility: 'checking',
        knowledgeQuality: 25,
        evidenceLevel: 'D',
        confidence: 20,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌在 Claude 中可见度较低，需增加资料。',
        explain: 'Claude 知识库中品牌覆盖率较低，需要更多公开可靠的品牌信息来源。',
        recommendations: [
          '建设完整的品牌官网',
          '在行业权威网站注册品牌信息',
          '提供多语种的品牌描述',
        ],
      }
    }

    return {
      provider: 'claude',
      group: 'international',
      displayName: 'Claude',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '无品牌数据，无法评估 Claude 可见度。',
      explain: '缺少品牌名称、官网等基础信息。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成 Quick Discovery 扫描',
      ],
    }
  },
}
