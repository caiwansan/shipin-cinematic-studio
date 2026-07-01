// ============================================================
// Microsoft Copilot Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const copilotAdapter: ProviderAdapter = {
  provider: 'copilot',
  displayName: 'Copilot',
  supportsPresence: true,
  meta: { group: 'international', displayOrder: 6 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'copilot',
        group: 'international',
        displayName: 'Copilot',
        visibility: 'visible',
        knowledgeQuality: 60,
        evidenceLevel: 'C',
        confidence: 58,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 2,
        summary: 'Copilot 能识别品牌基本信息，可见度一般。',
        explain: 'Copilot 通过 Bing 搜索索引获取品牌信息。有官网和描述时能提供基础品牌认知。',
        recommendations: [
          '优化官网的 Bing 搜索引擎可见度',
          '在 Microsoft 生态中增加品牌曝光',
          '确保官网内容包含结构化数据',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'copilot',
        group: 'international',
        displayName: 'Copilot',
        visibility: 'partial',
        knowledgeQuality: 38,
        evidenceLevel: 'D',
        confidence: 35,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: 'Copilot 可确认品牌存在但信息稀缺。',
        explain: '仅有官网名称，Copilot 无法获取足够的品牌背景信息。',
        recommendations: [
          '补充品牌详细描述',
          '添加行业分类信息',
          '在 Bing Webmaster Tools 中提交网站',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'copilot',
        group: 'international',
        displayName: 'Copilot',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 10,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌数据不足，Copilot 中无法确认。',
        recommendations: [
          '添加品牌官网 URL',
          '补充行业信息和品牌描述',
          '考虑在公开目录中注册品牌',
        ],
      }
    }

    return {
      provider: 'copilot',
      group: 'international',
      displayName: 'Copilot',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估 Copilot 可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
