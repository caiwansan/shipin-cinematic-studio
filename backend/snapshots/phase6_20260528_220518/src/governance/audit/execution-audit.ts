/**
 * governance/audit/execution-audit.ts — 执行审计日志（fire-and-forget）
 *
 * Phase 5 Hotfix: 审计永不阻断执行
 */

export interface AuditLogEntry {
  userId: string
  taskType: string
  provider: string
  model: string
  timestamp: number
  success: boolean
  cost: number
  traceId?: string
  error?: string
}

// 内存审计日志（生产环境应接数据库或日志服务）
const auditLog: AuditLogEntry[] = []
const MAX_AUDIT_LOG = 1000

/**
 * 异步非阻塞审计 — fire-and-forget
 * 不 await，不 throw，永不阻断 execution
 */
export function auditExecution(
  runtime: { userId: string; provider: string; model: string },
  payload: { taskType?: string; traceId?: string },
  _result: any,
  cost: number,
  error?: string
): void {
  try {
    const log: AuditLogEntry = {
      userId: runtime.userId,
      taskType: payload.taskType || 'unknown',
      provider: runtime.provider,
      model: runtime.model,
      timestamp: Date.now(),
      success: !error && true,
      cost,
      traceId: payload.traceId,
      error,
    }

    auditLog.push(log)

    // 限制内存日志大小
    if (auditLog.length > MAX_AUDIT_LOG) {
      auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG)
    }
  } catch (_) {
    // 静默失败 — 审计永不阻断
  }
}

/** 查询审计日志 */
export function getAuditLog(userId?: string, limit: number = 50): AuditLogEntry[] {
  try {
    let logs = auditLog
    if (userId) {
      logs = logs.filter(l => l.userId === userId)
    }
    return logs.slice(-limit).reverse()
  } catch {
    return []
  }
}
