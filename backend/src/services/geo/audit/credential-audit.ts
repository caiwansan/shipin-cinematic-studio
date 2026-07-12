// ============================================================
// Credential Audit Framework — GEO Credential 审计服务
// SEC-004-T001: Credential Access Audit
//
// 职责：
//   1. 定义 Credential 审计事件
//   2. 记录每次 Credential 解析结果
//   3. 提供查询接口（内存 Ring Buffer）
//
// 设计约束：
//   - 永远不记录 Secret（apiKey / token / auth header）
//   - Audit 失败不影响业务（fire-and-forget）
//   - 事件 Schema 已冻结（D7）
// ============================================================

// ─── 审计事件类型（D7: Schema Freeze） ────────────────

export enum CredentialAuditEvent {
  CredentialResolved = 'CredentialResolved',
  CredentialResolveFailed = 'CredentialResolveFailed',
  CredentialMissing = 'CredentialMissing',
  CredentialInvalid = 'CredentialInvalid',
  CredentialDecryptFailed = 'CredentialDecryptFailed',
}

// ─── 审计事件体（D7: Schema Freeze） ───────────────────

export interface CredentialAuditEntry {
  /** 事件类型 */
  event: CredentialAuditEvent
  /** ISO 时间戳 */
  timestamp: string
  /** Provider 名称: 'deepseek' | 'volcengine' | ... */
  provider: string
  /** 能力类型: 'llm' | 'image' | 'video' | 'tts' */
  capability: string
  /** 凭据来源: 'UserModelConfigV2' | 'ApiKey' */
  source: string
  /** 脱敏 userId（前 8 位 + '...'） */
  userIdMasked: string
  /** 是否成功 */
  success: boolean
  /** 失败原因（仅失败时有值） */
  failureReason?: string
  /** resolve 耗时（ms） */
  durationMs?: number
}

// ─── Ring Buffer 配置 ──────────────────────────────────

const MAX_RECENT_ENTRIES = 1000

// ─── Audit Service ─────────────────────────────────────

/**
 * CredentialAuditService
 *
 * 旁路审计服务，记录所有凭据获取事件。
 * D6: 所有 record() 调用必须 fire-and-forget，不阻塞业务。
 */
export class CredentialAuditService {
  private buffer: CredentialAuditEntry[] = []

  /**
   * 记录一条审计事件。
   * D6: try/catch 保证 audit 失败不影响业务。
   */
  record(entry: CredentialAuditEntry): void {
    try {
      this.buffer.push(entry)

      // Ring Buffer：超出上限时移除最旧的
      if (this.buffer.length > MAX_RECENT_ENTRIES) {
        this.buffer.shift()
      }

      // Logger 输出（production 可替换为 structured logger）
      const masked = entry.userIdMasked
      if (entry.success) {
        console.log(
          `[CredentialAudit] ✅ ${entry.event} | ` +
          `provider=${entry.provider} capability=${entry.capability} ` +
          `source=${entry.source} user=${masked} duration=${entry.durationMs || '?'}ms`
        )
      } else {
        console.warn(
          `[CredentialAudit] ❌ ${entry.event} | ` +
          `provider=${entry.provider} capability=${entry.capability} ` +
          `source=${entry.source} user=${masked} reason=${entry.failureReason || '?'}`
        )
      }
    } catch {
      // D6: Audit 失败不影响业务。静默忽略。
    }
  }

  // ─── 查询接口 ──────────────────────────────────────

  /** 获取最近 N 条审计事件 */
  getRecent(limit: number = 50): CredentialAuditEntry[] {
    return this.buffer.slice(-limit)
  }

  /** 按事件类型筛选 */
  getByEvent(event: CredentialAuditEvent, limit: number = 50): CredentialAuditEntry[] {
    return this.buffer.filter(e => e.event === event).slice(-limit)
  }

  /** 仅获取失败事件 */
  getFailures(limit: number = 50): CredentialAuditEntry[] {
    return this.buffer.filter(e => !e.success).slice(-limit)
  }

  /** 获取统计摘要 */
  getStats(): { total: number; byEvent: Record<string, number>; successRate: number } {
    const total = this.buffer.length
    const byEvent: Record<string, number> = {}
    let successes = 0
    for (const entry of this.buffer) {
      byEvent[entry.event] = (byEvent[entry.event] || 0) + 1
      if (entry.success) successes++
    }
    return {
      total,
      byEvent,
      successRate: total > 0 ? Math.round((successes / total) * 10000) / 100 : 0,
    }
  }
}

/** 全局单例 */
export const credentialAuditService = new CredentialAuditService()
