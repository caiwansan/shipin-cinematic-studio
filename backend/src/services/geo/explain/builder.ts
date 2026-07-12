// ===================================================
// ExplainDocumentBuilder — PURE ASSEMBLY — NO COMPUTATION
//
// 这个 Builder 是纯组装器，不进行任何计算/预测：
// - 不计算 confidence
// - 不计算 score delta
// - 不计算 expectedScore
// - 不触发任何 AI 调用
// - 只从输入数据中提取并组装为 ExplainDocument
// ===================================================

import type { ExplainDocument, ExplainSection, ExplainSectionType, ExplainItem, ExplainMetadata } from './explain-document'

export class ExplainDocumentBuilder {
  private sections: Map<ExplainSectionType, { title: string; items: ExplainItem[] }> = new Map()
  private orderCounter = 0

  addSection(type: ExplainSectionType, title: string): this {
    if (!this.sections.has(type)) {
      this.sections.set(type, { title, items: [] })
    }
    return this
  }

  addItem(type: ExplainSectionType, item: ExplainItem): this {
    if (!this.sections.has(type)) {
      this.sections.set(type, { title: type, items: [] })
    }
    this.sections.get(type)!.items.push(item)
    return this
  }

  build(params: {
    id: string
    title: string
    summary: string
    confidence: number | null
    metadata: { type: string; sourceId: string; sourceType: string; provider: string }
  }): ExplainDocument {
    const sections: ExplainSection[] = []
    for (const [type, data] of this.sections) {
      sections.push({
        type: type as ExplainSectionType,
        title: data.title,
        order: this.orderCounter++,
        items: data.items,
      })
    }
    return {
      id: params.id,
      title: params.title,
      summary: params.summary,
      sections,
      confidence: params.confidence,
      metadata: {
        type: params.metadata.type as ExplainMetadata['type'],
        sourceId: params.metadata.sourceId,
        sourceType: params.metadata.sourceType,
        generatedAt: new Date().toISOString(),
        provider: params.metadata.provider,
        version: '1.0',
      },
    }
  }
}
