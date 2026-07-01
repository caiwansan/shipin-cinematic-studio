// ============================================================
// 讯飞星火 (Xinghuo) Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const xinghuoAdapter: ProviderAdapter = {
  provider: 'xinghuo',
  displayName: '讯飞星火',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 12 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 50 + Math.random() * 80))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'xinghuo',
        group: 'china',
        displayName: '讯飞星火',
        visibility: 'visible',
        knowledgeQuality: 62,
        evidenceLevel: 'C',
        confidence: 60,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: '讯飞星火能识别品牌基础信息，可见度中等。',
        explain: '讯飞星火基于科大讯飞的训练数据，对中文品牌有一定覆盖能力。官网和描述充分可提供基本信息。',
        recommendations: [
          '在中文教育和技术领域增加品牌曝光',
          '确保官网对搜索引擎友好',
          '在公开知识平台发布品牌资料',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'xinghuo',
        group: 'china',
        displayName: '讯飞星火',
        visibility: 'partial',
        knowledgeQuality: 36,
        evidenceLevel: 'D',
        confidence: 32,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '讯飞星火能确认品牌存在，信息有限。',
        explain: '有官网和名称但缺乏描述，讯飞星火对品牌的认知较浅。',
        recommendations: [
          '补充品牌详情描述',
          '添加行业分类',
          '增加互联网上的品牌内容',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'xinghuo',
        group: 'china',
        displayName: '讯飞星火',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 14,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌信息不足，讯飞星火中无法确认。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在中文互联网增加品牌内容',
        ],
      }
    }

    return {
      provider: 'xinghuo',
      group: 'china',
      displayName: '讯飞星火',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估讯飞星火可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
