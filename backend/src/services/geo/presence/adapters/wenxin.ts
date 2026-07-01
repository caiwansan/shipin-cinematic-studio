// ============================================================
// 文心一言 (Wenxin) Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const wenxinAdapter: ProviderAdapter = {
  provider: 'wenxin',
  displayName: '文心一言',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 9 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 55 + Math.random() * 85))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'wenxin',
        group: 'china',
        displayName: '文心一言',
        visibility: 'visible',
        knowledgeQuality: 66,
        evidenceLevel: 'B',
        confidence: 64,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: '文心一言能识别品牌和业务范围，可见度良好。',
        explain: '文心一言基于百度搜索生态，对中文品牌有较好的覆盖能力。官网和描述充分时可提供较准确信息。',
        recommendations: [
          '在百度搜索中优化品牌 SEO',
          '在百度百科创建品牌词条',
          '保持官网对百度爬虫友好',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'wenxin',
        group: 'china',
        displayName: '文心一言',
        visibility: 'partial',
        knowledgeQuality: 42,
        evidenceLevel: 'D',
        confidence: 38,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '文心一言可确认品牌存在，信息不完整。',
        explain: '有官网和名称但缺乏描述，文心一言对品牌的深入了解有限。',
        recommendations: [
          '补充品牌详情描述',
          '添加行业分类',
          '在百度生态中完善品牌信息',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'wenxin',
        group: 'china',
        displayName: '文心一言',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 16,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌数据不足，文心一言中无法确认。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在百度搜索中建立品牌存在',
        ],
      }
    }

    return {
      provider: 'wenxin',
      group: 'china',
      displayName: '文心一言',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估文心一言可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
