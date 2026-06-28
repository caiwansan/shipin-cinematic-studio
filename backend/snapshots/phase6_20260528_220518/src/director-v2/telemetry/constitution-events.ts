/**
 * constitution-events.ts — Constitution 事件追踪
 *
 * 记录 Constitution 编译过程中的所有关键事件。
 * 下游 Semantic Drift 检测器通过事件流分析宪法漂移趋势。
 */

// ============================================================
// Event Types
// ============================================================

export type ConstitutionEventType =
  | 'constitution_compiled'
  | 'constitution_loaded'
  | 'constitution_fingerprint_mismatch'
  | 'constitution_immutability_violation'
  | 'constitution_degraded'
  | 'constitution_retry'
  | 'constitution_version_upgraded'

// ============================================================
// Event
// ============================================================

export interface ConstitutionEvent {
  /** 事件类型 */
  type: ConstitutionEventType

  /** 项目 ID */
  projectId: string

  /** Constitution 指纹 */
  constitutionHash: string

  /** 事件时间 */
  timestamp: number

  /** 事件详情 */
  details: Record<string, unknown>
}

// ============================================================
// Event Logger
// ============================================================

class ConstitutionEventLogger {
  private events: ConstitutionEvent[] = []
  private maxEvents = 1000

  /**
   * 记录事件
   */
  log(event: Omit<ConstitutionEvent, 'timestamp'>): void {
    const fullEvent: ConstitutionEvent = {
      ...event,
      timestamp: Date.now(),
    }

    this.events.push(fullEvent)

    // 保持内存上限
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // 生产环境也应该输出到 logger
    const logger = (globalThis as any).logger || console
    logger.info(`[ConstitutionEvent] ${event.type} | project=${event.projectId} | hash=${event.constitutionHash.slice(0, 12)}`)
  }

  /**
   * 获取 project 的事件历史
   */
  getProjectEvents(projectId: string): ConstitutionEvent[] {
    return this.events.filter(e => e.projectId === projectId)
  }

  /**
   * 获取所有事件（用于分析）
   */
  getAllEvents(): ConstitutionEvent[] {
    return [...this.events]
  }

  /**
   * 获取某些类型的事件
   */
  getEventsByType(type: ConstitutionEventType): ConstitutionEvent[] {
    return this.events.filter(e => e.type === type)
  }

  /**
   * 清空事件日志
   */
  clear(): void {
    this.events = []
  }
}

/** 全局单例 */
export const constitutionEventLogger = new ConstitutionEventLogger()
