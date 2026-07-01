// ============================================================
// Kimi Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const kimiAdapter: ProviderAdapter = {
  provider: 'kimi',
  displayName: 'Kimi',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 11 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 65 + Math.random() * 100))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'kimi',
        group: 'china',
        displayName: 'Kimi',
        visibility: 'visible',
        knowledgeQuality: 74,
        evidenceLevel: 'B',
        confidence: 72,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: 'Kimi 能识别品牌并理解业务信息，可见度良好。',
        explain: 'Kimi 对大上下文和中文内容有较好的处理能力。官网和描述充分时可提供详尽品牌介绍。',
        recommendations: [
          '在中文互联网增加高质量品牌内容',
          '确保官网内容丰富且结构化',
          '在技术社区和媒体发布品牌信息',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'kimi',
        group: 'china',
        displayName: 'Kimi',
        visibility: 'partial',
        knowledgeQuality: 52,
        evidenceLevel: 'D',
        confidence: 48,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: 'Kimi 可确认品牌存在但了解不深。',
        explain: '有官网和名称但缺乏描述，Kimi 无法深入了解品牌详情。',
        recommendations: [
          '补充品牌中文详细描述',
          '添加行业分类信息',
          '在文档平台建设品牌知识库',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'kimi',
        group: 'china',
        displayName: 'Kimi',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 22,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌数据不足，Kimi 中无法确认。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在公开平台发布品牌资料',
        ],
      }
    }

    return {
      provider: 'kimi',
      group: 'china',
      displayName: 'Kimi',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估 Kimi 可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
