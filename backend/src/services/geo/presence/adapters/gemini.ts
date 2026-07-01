// ============================================================
// Gemini Adapter — AI Presence Engine
// P0-T005: AI Presence Engine Foundation
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini',
  displayName: 'Gemini',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 2 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasIndustry = !!context.industry
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'gemini',
        group: 'international',
        displayName: 'Gemini',
        visibility: 'visible',
        knowledgeQuality: 71,
        evidenceLevel: 'B',
        confidence: 76,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 4,
        summary: 'Gemini 能识别品牌的基本信息，但描述准确度中等。',
        explain: 'Gemini 可以获取到品牌官网和描述信息，但训练数据中品牌信息的覆盖度中等。',
        recommendations: [
          '在官网添加结构化数据（Schema.org）',
          '确保官网内容频繁更新',
          '增加中文和多语言品牌内容',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'gemini',
        group: 'international',
        displayName: 'Gemini',
        visibility: 'partial',
        knowledgeQuality: 58,
        evidenceLevel: 'C',
        confidence: 54,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: 'Gemini 能确认品牌存在，但信息覆盖不完整。',
        explain: '有官网和名称，但缺乏描述信息，Gemini 对品牌的了解有限。',
        recommendations: [
          '添加品牌详细描述',
          '补充行业分类',
          '在官网添加更多品牌上下文',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'gemini',
        group: 'international',
        displayName: 'Gemini',
        visibility: 'checking',
        knowledgeQuality: 30,
        evidenceLevel: 'D',
        confidence: 25,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: 'Gemini 中品牌信息不足，需补充资料。',
        explain: '仅凭名称无法在 Gemini 中确认品牌存在。需要官网 URL 等验证材料。',
        recommendations: [
          '添加官网 URL',
          '补充行业信息和品牌描述',
          '考虑在公开知识平台发布品牌资料',
        ],
      }
    }

    return {
      provider: 'gemini',
      group: 'international',
      displayName: 'Gemini',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估 Gemini 可见度。',
      explain: '未提供品牌名称、官网等必要信息。',
      recommendations: [
        '导入品牌基本信息',
        '添加官网和行业信息',
        '完成品牌资料配置',
      ],
    }
  },
}
