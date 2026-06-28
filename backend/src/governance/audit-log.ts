/**
 * governance/audit-log.ts — 治理审计日志
 *
 * 记录所有治理决策、策略触发、模式切换、回滚操作。
 * 提供完整的系统决策追溯能力。
 */

interface AuditEntry {
  timestamp: string
  source: string
  type: 'approve' | 'reject' | 'delay' | 'system' | 'error' | 'manual'
  action: string
  reason: string
  meta?: Record<string, any>
}

const entries: AuditEntry[] = []
const MAX_ENTRIES = 1000

/**
 * 写入一条审计日志
 */
export function auditLog(
  source: string,
  type: AuditEntry['type'],
  action: string,
  reason: string,
  meta?: Record<string, any>
) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    source,
    type,
    action,
    reason,
    meta,
  }

  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()

  // 重要事件也输出到 console
  if (type === 'error' || type === 'system') {
    console.log(`[Audit] [${type.toUpperCase()}] [${source}] ${action}: ${reason}`)
  }
}

/**
 * 获取审计日志
 */
export function getAuditLog(params: {
  limit?: number
  type?: string
  source?: string
} = {}): AuditEntry[] {
  let result = [...entries].reverse()

  if (params.type) {
    result = result.filter(e => e.type === params.type)
  }
  if (params.source) {
    result = result.filter(e => e.source === params.source)
  }

  return result.slice(0, params.limit || 50)
}

/**
 * 获取审计统计
 */
export function getAuditStats() {
  return {
    total: entries.length,
    approveCount: entries.filter(e => e.type === 'approve').length,
    rejectCount: entries.filter(e => e.type === 'reject').length,
    delayCount: entries.filter(e => e.type === 'delay').length,
    systemCount: entries.filter(e => e.type === 'system').length,
    errorCount: entries.filter(e => e.type === 'error').length,
    manualCount: entries.filter(e => e.type === 'manual').length,
  }
}
