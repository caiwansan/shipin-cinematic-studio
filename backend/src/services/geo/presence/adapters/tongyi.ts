// ============================================================
// 通义千问 (Tongyi) Adapter — AI Presence Engine
// P0-T005.1: 12 Platform Extension
//
// Stub implementation (no real API call).
// Simulates presence detection based on context completeness.
// ============================================================

import { ProviderAdapter } from '../adapter.interface.js'
import { PresenceContext, ProviderResult } from '../types.js'

export const tongyiAdapter: ProviderAdapter = {
  provider: 'tongyi',
  displayName: '通义千问',
  supportsPresence: true,
  meta: { group: 'china', displayOrder: 8 },

  async checkPresence(context: PresenceContext): Promise<ProviderResult> {
    const hasWebsite = !!context.website
    const hasDescription = !!context.description
    const hasName = !!context.name

    await new Promise((r) => setTimeout(r, 60 + Math.random() * 90))

    if (hasWebsite && hasDescription && hasName) {
      return {
        provider: 'tongyi',
        group: 'china',
        displayName: '通义千问',
        visibility: 'visible',
        knowledgeQuality: 70,
        evidenceLevel: 'B',
        confidence: 68,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 3,
        summary: '通义千问能识别品牌并理解其业务领域。',
        explain: '通义千问基于阿里云生态数据，对中文互联网品牌有良好的覆盖。官网和描述充分可提供详细信息。',
        recommendations: [
          '在阿里生态系统中增加品牌曝光',
          '保持官网中文内容更新',
          '利用阿里云服务增加品牌技术背书',
        ],
      }
    }

    if (hasWebsite && hasName) {
      return {
        provider: 'tongyi',
        group: 'china',
        displayName: '通义千问',
        visibility: 'partial',
        knowledgeQuality: 48,
        evidenceLevel: 'D',
        confidence: 42,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 1,
        summary: '通义千问能确认品牌存在，信息较少。',
        explain: '有官网和名称但信息不完整，通义千问对品牌的认知有限。',
        recommendations: [
          '补充品牌详情描述',
          '添加行业分类',
          '完善阿里云生态中的品牌信息',
        ],
      }
    }

    if (hasName && !hasWebsite) {
      return {
        provider: 'tongyi',
        group: 'china',
        displayName: '通义千问',
        visibility: 'checking',
        evidenceLevel: 'N/A',
        confidence: 18,
        lastCheckedAt: new Date().toISOString(),
        evidenceCount: 0,
        summary: '品牌信息不足，通义千问中无法确认。',
        recommendations: [
          '添加官网 URL',
          '补充品牌描述和行业信息',
          '在中文互联网增加品牌内容',
        ],
      }
    }

    return {
      provider: 'tongyi',
      group: 'china',
      displayName: '通义千问',
      visibility: 'unknown',
      evidenceLevel: 'N/A',
      confidence: 0,
      lastCheckedAt: new Date().toISOString(),
      evidenceCount: 0,
      summary: '缺少品牌资料，无法评估通义千问可见度。',
      recommendations: [
        '配置品牌名称和官网',
        '添加行业和描述信息',
        '完成品牌资料设置',
      ],
    }
  },
}
