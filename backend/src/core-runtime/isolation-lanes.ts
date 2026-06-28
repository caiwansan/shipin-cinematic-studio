// ============================================================================
// 盘古斧 AI OS — Phase 8.2c: Isolation Lanes (逻辑执行泳道)
//
// 职责：
//   1. 定义全局隔离泳道配置
//   2. 每个 lane 有预留 worker 数 (供 future 硬隔离使用)
//   3. 当前为逻辑标记层，物理隔离层驻留于 WorkerPool + SDS
// ============================================================================

export type LaneId = 'lane_a' | 'lane_b' | 'lane_c' | 'lane_d'

export interface LaneConfig {
  /** 泳道 ID */
  id: LaneId
  /** 预留 Worker 数 (硬隔离上限) */
  reservedWorkers: number
  /** 对应的 SLA tier */
  slaTier: string
  /** 描述 */
  label: string
}

export const ISOLATION_LANES: Record<LaneId, LaneConfig> = {
  lane_a: {
    id: 'lane_a',
    reservedWorkers: 20,
    slaTier: 'SLA_A',
    label: 'Premium — 高优先级执行泳道',
  },
  lane_b: {
    id: 'lane_b',
    reservedWorkers: 10,
    slaTier: 'SLA_B',
    label: 'Business — 标准执行泳道',
  },
  lane_c: {
    id: 'lane_c',
    reservedWorkers: 5,
    slaTier: 'SLA_C',
    label: 'Standard — 默认执行泳道',
  },
  lane_d: {
    id: 'lane_d',
    reservedWorkers: 2,
    slaTier: 'SLA_D',
    label: 'Best Effort — 尽力执行泳道',
  },
}

/**
 * 获取泳道使用概况
 */
export function getLaneUsage(): Record<LaneId, {
  reservedWorkers: number
  slaTier: string
  label: string
}> {
  const result: any = {}
  for (const lane of Object.values(ISOLATION_LANES)) {
    result[lane.id] = {
      reservedWorkers: lane.reservedWorkers,
      slaTier: lane.slaTier,
      label: lane.label,
    }
  }
  return result
}
