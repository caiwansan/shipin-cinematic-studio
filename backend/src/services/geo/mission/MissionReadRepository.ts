import { MissionGenerator } from '../../../engines/mission/MissionGenerator'
import { MissionPrioritizer } from '../../../engines/mission/MissionPrioritizer'
import { ActionCollector } from './ActionCollector'
import { Mission } from '../../../engines/mission/models/Mission'

export interface MissionSummary {
  total: number
  p0: number
  p1: number
  p2: number
  p3: number
}

export interface MissionResponse {
  missions: Mission[]
  summary: MissionSummary
}

/**
 * MissionReadRepository 是 Mission 的唯一读入口。
 *
 * 职责：
 *   1. 调用 ActionCollector 收集当前所有 Action
 *   2. 调用 MissionGenerator 生成 Mission
 *   3. 调用 MissionPrioritizer 排序
 *   4. 返回 MissionResponse（含 summary）
 *
 * 自包含：getAll() 不接受外部 Object 参数。
 * 不做：持久化、写操作、业务逻辑（评分/过滤/去重）。
 *
 * 每次调用都重新生成，确保 Mission 始终基于最新的 Insight。
 */
export class MissionReadRepository {
  constructor(
    private actionCollector: ActionCollector,
    private missionGenerator: MissionGenerator,
    private missionPrioritizer: MissionPrioritizer
  ) {}

  getAll(objects: any[]): MissionResponse {
    const actions = this.actionCollector.collect(objects)
    const missions = this.missionGenerator.generate(actions)
    const sorted = this.missionPrioritizer.prioritize(missions)

    // Summary 是展示数据，不是业务逻辑
    const summary: MissionSummary = {
      total: sorted.length,
      p0: 0,
      p1: 0,
      p2: 0,
      p3: 0
    }

    for (const m of sorted) {
      if (m.priority === 'P0') summary.p0++
      else if (m.priority === 'P1') summary.p1++
      else if (m.priority === 'P2') summary.p2++
      else if (m.priority === 'P3') summary.p3++
    }

    return { missions: sorted, summary }
  }
}
