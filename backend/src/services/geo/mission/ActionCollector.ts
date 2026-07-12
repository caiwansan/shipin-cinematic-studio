import { Action } from '../../../engines/mission/models/Action'
import { KnowledgeMissionProvider } from './providers/KnowledgeMissionProvider'

/**
 * ActionCollector 负责调用所有 MissionProvider 采集 Action。
 *
 * 当前仅注册 KnowledgeMissionProvider。
 * 后续增加 Discovery / Packaging 等时，只需在构造器中注册新的 Provider。
 * ActionCollector 不直接依赖任何具体 Engine。
 */
export class ActionCollector {
  constructor(
    private knowledgeProvider: KnowledgeMissionProvider
  ) {}

  /**
   * 收集所有 Actions，基于所有 Knowledge Objects。
   * Objects 来自 KnowledgeMissionProvider 内部获取（不对外部暴露 Engine 细节）。
   */
  collect(objects: any[]): Action[] {
    const actions: Action[] = []

    for (const obj of objects) {
      try {
        actions.push(this.knowledgeProvider.generate(obj))
      } catch (e) {
        console.warn(`[ActionCollector] Failed to generate action for ${obj.id}:`, e)
      }
    }

    return actions
  }
}
