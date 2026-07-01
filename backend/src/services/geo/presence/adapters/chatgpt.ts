// ============================================================
// ChatGPT Adapter — AI Presence Engine
// P0-T005: AI Presence Engine Foundation
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt',
  displayName: 'ChatGPT',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 1 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    // Simulated logic — real adapter would call OpenAI API
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasIndustry = !!context.industry
    const hasName = !!context.name

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 150))

    if (hasWebsite && hasDescription && hasIndustry) {
      return {
        provider: 'chatgpt',
        group: 'international',
        displayName: 'ChatGPT',
        visibility: 'visible',
        knowledgeQuality: 82,
        evidenceLevel: 'A',
        confidence: 88,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 5,
        summary: 'ChatGPT 能清晰识别品牌名称、描述和行业定位，表现为高可见度。',
        explain: 'ChatGPT 训练数据中包含了来自官网的品牌信息。品牌描述完整、官网可访问且有明确的行业标签，使其能够准确回答关于品牌的问题。',
        recommendations: [
          '保持官网更新，确保品牌信息准确一致',
          '增加权威第三方来源的品牌引用（如维基百科、行业报告）',
          '在官网添加 FAQ 内容，对齐 AI 常问问题',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'chatgpt',
        group: 'international',
        displayName: 'ChatGPT',
        visibility: 'partial',
        knowledgeQuality: 65,
        evidenceLevel: 'C',
        confidence: 62,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: 'ChatGPT 能识别品牌名称，但缺乏行业定位和详细描述。',
        explain: '仅有官网 URL 和品牌名称，ChatGPT 可以定位到品牌但无法准确描述其业务范围。',
        recommendations: [
          '完善品牌描述信息',
          '明确行业分类标签',
          '在官网添加详细的 About 页面',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'chatgpt',
        group: 'international',
        displayName: 'ChatGPT',
        visibility: 'checking',
        knowledgeQuality: 35,
        evidenceLevel: 'D',
        confidence: 30,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '品牌名称已记录，需要更多数据确认 AI 可见度。',
        explain: '仅凭品牌名称，ChatGPT 可能无法准确获取品牌信息。需要官网 URL 来确认品牌存在性。',
        recommendations: [
          '添加官网 URL',
          '添加品牌描述和行业信息',
          '增加权威品牌引用来源',
        ],
      }
    }

    // No data at all
    return {
      provider: 'chatgpt',
      group: 'international',
      displayName: 'ChatGPT',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '品牌数据不足，无法评估在 ChatGPT 中的可见度。',
      explain: '缺少品牌名称、官网等基础信息，无法进行可见度分析。',
      recommendations: [
        '导入品牌名称和官网 URL',
        '补充品牌行业信息',
        '添加品牌描述',
      ],
    }
  },
}
