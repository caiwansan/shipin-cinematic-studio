// ============================================================
// DeepSeek Adapter — AI Presence Engine
// P0-T005: AI Presence Engine Foundation
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const deepseekAdapter: ProviderAdapter = {
  provider: 'deepseek',
  displayName: 'DeepSeek',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 4 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 60 + Math.random() * 90))

    if (hasWebsite && hasName) {
      return {
        provider: 'deepseek',
        group: 'international',
        displayName: 'DeepSeek',
        visibility: 'visible',
        knowledgeQuality: 75,
        evidenceLevel: 'B',
        confidence: 72,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: 'DeepSeek 能识别品牌及其主要业务领域。',
        explain: 'DeepSeek 的训练数据覆盖了中文互联网品牌信息，配合官网能够提供较准确的品牌描述。',
        recommendations: [
          '在中文互联网平台增加品牌曝光',
          '确保官网对搜索引擎友好',
          '在中文技术社区和论坛建立品牌讨论',
        ],
      }
    }

    if (hasName && hasDescription) {
      return {
        provider: 'deepseek',
        group: 'international',
        displayName: 'DeepSeek',
        visibility: 'visible',
        knowledgeQuality: 70,
        evidenceLevel: 'B',
        confidence: 68,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: 'DeepSeek 能根据描述确认品牌信息。',
        explain: '品牌描述为 DeepSeek 提供了足够的上下文来定位和理解品牌。',
        recommendations: [
          '添加官网 URL 以提升可信度',
          '在更多中文知识来源中注册品牌',
          '提供具体的产品/服务描述',
        ],
      }
    }

    if (hasName) {
      return {
        provider: 'deepseek',
        group: 'international',
        displayName: 'DeepSeek',
        visibility: 'partial',
        knowledgeQuality: 45,
        evidenceLevel: 'D',
        confidence: 38,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: 'DeepSeek 可识别品牌名称但信息有限。',
        explain: '有品牌名称但缺少官网和描述，DeepSeek 只能提供基础级别的品牌认知。',
        recommendations: [
          '添加官网 URL 以验证品牌',
          '补充品牌详细描述',
          '在互联网上增加中文品牌内容',
        ],
      }
    }

    return {
      provider: 'deepseek',
      group: 'international',
      displayName: 'DeepSeek',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '无法评估 DeepSeek 可见度。',
      explain: '未提供足够的品牌信息进行分析。',
      recommendations: [
        '输入品牌名称和官网信息',
        '添加品牌行业和描述',
        '运行 Quick Discovery 进行初步扫描',
      ],
    }
  },
}
