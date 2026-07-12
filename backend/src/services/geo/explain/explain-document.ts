// ===================================================
// ExplainDocument — GEO 统一 Explain 数据格式
// 所有 Explain 内容（Mission/Verification/Knowledge/Discovery）
// 都输出为 ExplainDocument，前端不关心 type
// ===================================================

export interface ExplainDocument {
  id: string                    // Explain ID (unique per generation)
  title: string                 // 简短标题，如 "识别到 Visibility 提升机会"
  summary: string               // 摘要，1-3 句话说明核心结论
  sections: ExplainSection[]    // 数据驱动的 Section 列表
  confidence: number | null     // 0-1，决定引擎提供
  metadata: ExplainMetadata
}

export type ExplainSectionType = 
  | 'evidence'      // 证据概览
  | 'threshold'     // 阈值触发详情
  | 'impact'        // 影响预测
  | 'rule'          // 规则匹配
  | 'reasoning'     // 推理链
  | 'recommendation' // 建议/行动项
  | 'metric'        // 指标展示
  | 'timeline'      // 时间线

export interface ExplainSection {
  type: ExplainSectionType
  title: string
  order: number
  items: ExplainItem[]
}

export interface ExplainItem {
  id: string
  label: string
  value: string | number | boolean | null
  detail?: string          // 展开详情
  source?: string          // 数据来源引用（必须指向真实数据）
  confidence?: number      // 该项的置信度
  status?: 'positive' | 'negative' | 'neutral' | 'action_required'
}

export interface ExplainMetadata {
  type: 'mission' | 'verification' | 'knowledge' | 'discovery'
  sourceId: string             // 原始数据 ID（如 missionId）
  sourceType: string           // Provider 类型
  generatedAt: string          // ISO datetime
  provider: string             // 生成 Provider 名称（如 "MissionExplainProvider"）
  version: string              // Schema 版本，当前 "1.0"
}

// 辅助函数
export function createExplainDocument(params: {
  id: string
  title: string
  summary: string
  sections: ExplainSection[]
  confidence: number | null
  metadata: Omit<ExplainMetadata, 'version' | 'generatedAt'>
}): ExplainDocument {
  return {
    ...params,
    metadata: {
      ...params.metadata,
      version: '1.0',
      generatedAt: new Date().toISOString(),
    },
  }
}
