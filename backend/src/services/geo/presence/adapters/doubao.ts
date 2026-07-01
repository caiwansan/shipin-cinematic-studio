// ============================================================
// 豆包 (Doubao) Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const doubaoAdapter: ProviderAdapter = {
  provider: 'doubao',
  displayName: '豆包',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 7 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 50 + Math.random() * 80))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'doubao',
        group: 'china',
        displayName: '豆包',
        visibility: 'visible',
        knowledgeQuality: 72,
        evidenceLevel: 'B',
        confidence: 70,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: '豆包能识别品牌信息，中文环境可见度良好。',
        explain: '豆包基于字节跳动的训练数据，对中文品牌有较好的覆盖能力。官网和描述充分时能提供准确信息。',
        recommendations: [
          '在中文互联网平台保持品牌活跃度',
          '确保官网中文内容完善',
          '在抖音/头条等平台建立品牌存在',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'doubao',
        group: 'china',
        displayName: '豆包',
        visibility: 'partial',
        knowledgeQuality: 50,
        evidenceLevel: 'D',
        confidence: 45,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '豆包能确认品牌存在，信息覆盖有限。',
        explain: '有官网和名称但缺乏描述，豆包对品牌的了解不够深入。',
        recommendations: [
          '添加品牌中文详细描述',
          '补充行业分类信息',
          '增加中文互联网品牌内容',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'doubao',
        group: 'china',
        displayName: '豆包',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 20,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌信息不足，豆包中无法确认存在。',
        recommendations: [
          '添加官网 URL',
          '补充中文品牌描述',
          '在中文互联网发布品牌资料',
        ],
      }
    }

    return {
      provider: 'doubao',
      group: 'china',
      displayName: '豆包',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估豆包可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
