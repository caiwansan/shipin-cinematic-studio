// ============================================================
// 腾讯元宝 (Yuanbao) Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const yuanbaoAdapter: ProviderAdapter = {
  provider: 'yuanbao',
  displayName: '腾讯元宝',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 10 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 50 + Math.random() * 80))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'yuanbao',
        group: 'china',
        displayName: '腾讯元宝',
        visibility: 'visible',
        knowledgeQuality: 64,
        evidenceLevel: 'C',
        confidence: 62,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: '腾讯元宝能识别品牌基础信息，可见度中等。',
        explain: '腾讯元宝基于腾讯生态数据，对微信/QQ生态内品牌有较好覆盖。官网和描述充分时可提供基本信息。',
        recommendations: [
          '在微信生态中建立品牌存在',
          '利用微信公众号/小程序增加品牌曝光',
          '在腾讯新闻等平台发布品牌内容',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'yuanbao',
        group: 'china',
        displayName: '腾讯元宝',
        visibility: 'partial',
        knowledgeQuality: 40,
        evidenceLevel: 'D',
        confidence: 36,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '腾讯元宝能定位品牌但信息有限。',
        explain: '有官网和名称但缺乏描述，腾讯元宝对品牌的认知范围有限。',
        recommendations: [
          '补充品牌详情描述',
          '添加行业分类',
          '在腾讯生态中完善品牌信息',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'yuanbao',
        group: 'china',
        displayName: '腾讯元宝',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 12,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌信息不足，腾讯元宝中无法确认。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在互联网上增加品牌内容',
        ],
      }
    }

    return {
      provider: 'yuanbao',
      group: 'china',
      displayName: '腾讯元宝',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估腾讯元宝可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
