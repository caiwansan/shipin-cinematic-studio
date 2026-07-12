// ============================================================
// MissionExecutionAdapter — Mission → PlanningRequest 适配器 (RC3-1)
// ============================================================
// 将 Mission（ActionPlan）转换为统一的 PlanningRequest。
// 未来 Verification / Publishing / Knowledge Refresh 也通过各自的
// Adapter 转换为 PlanningRequest，再交由 ExecutionPlanner 统一处理。

import type { PlanningRequest, PlanningStep } from '../planner/planner.types'
import { DEFAULT_RETRY_CONFIG } from '../types'

/**
 * Mission — 参考 C0-003 ActionPlan Domain
 * 此处定义为 Adapter 所需的接口子集，避免直接依赖 domain 层。
 */
export interface Mission {
  id: string
  brandId: string
  priority: 'low' | 'normal' | 'high'
  steps: {
    id: string
    actionType: string
    description: string
    config?: Record<string, unknown>
  }[]
}

export interface IMissionExecutionAdapter {
  toPlanningRequest(mission: Mission): PlanningRequest
}

export class MissionExecutionAdapter implements IMissionExecutionAdapter {
  /**
   * actionType → capability 映射表
   */
  private readonly typeToCapability: Record<string, string> = {
    discovery: 'reasoning',
    knowledge: 'extraction',
    verification: 'analysis',
    recommendation: 'generation',
    publishing: 'generation',
  }

  toPlanningRequest(mission: Mission): PlanningRequest {
    const steps: PlanningStep[] = mission.steps.map((step, index) => ({
      id: step.id,
      label: step.description,
      type: step.actionType as PlanningStep['type'],
      capability: this.typeToCapability[step.actionType] ?? 'custom',
      // 默认顺序依赖：每个步骤依赖前一个步骤
      dependsOn: index > 0 ? [mission.steps[index - 1].id] : [],
      config: step.config ?? {},
      retryConfig: { ...DEFAULT_RETRY_CONFIG },
      timeout: 30000,
    }))

    return {
      id: `plan-${mission.id}`,
      sourceType: 'mission',
      sourceId: mission.id,
      brandId: mission.brandId,
      tenantId: mission.brandId, // 临时，后续扩展为独立 tenantId
      priority: mission.priority,
      steps,
      providerPolicy: 'FASTEST',
      metadata: { missionId: mission.id },
    }
  }
}
