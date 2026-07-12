import { KnowledgeIntelligenceEngine } from '../../../../engines/knowledge-intelligence'
import { KnowledgeActionAdapter } from '../../../../engines/mission/adapters/KnowledgeActionAdapter'
import { Action } from '../../../../engines/mission/models/Action'

/**
 * KnowledgeMissionProvider 封装了从 Knowledge Intelligence Engine 生成 Action 的全过程。
 *
 * Mission 相关代码（ActionCollector / Repository / Route）不直接依赖 KnowledgeIntelligenceEngine。
 */
export class KnowledgeMissionProvider {
  private engine: KnowledgeIntelligenceEngine
  private adapter: KnowledgeActionAdapter

  constructor() {
    this.engine = new KnowledgeIntelligenceEngine()
    this.adapter = new KnowledgeActionAdapter()
  }

  /**
   * 为给定的 Knowledge Object 生成 Action。
   * 支持独立 try/catch，单个 Object 失败不影响其他。
   */
  generate(obj: any): Action {
    const insight = this.engine.evaluate(obj)
    return this.adapter.adapt(
      { recommendation: insight.recommendation },
      obj.id || obj.objectId
    )
  }
}
