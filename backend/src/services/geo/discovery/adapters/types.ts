// ============================================================
// Adapter Contract — Discovery 仅通过 Adapter 与外部交互
// Adapter 内部管理 Provider 调用，Discovery 不感知
// ============================================================

import type { DiscoveryContext } from '../../domain/discovery-context'
import type { PipelineStageOutput } from '../pipeline/types'

export interface DiscoveryAdapter {
  /** 适配器唯一标识 */
  id: string

  /** 适配器类型 */
  type: 'presence' | 'search' | 'knowledge'

  /** 执行适配逻辑 */
  execute(ctx: DiscoveryContext): Promise<PipelineStageOutput>
}
