/**
 * P4.2.5.2-IMP-01.3 — Callback Event Runtime
 * 
 * Production Event Processing Pipeline
 * 
 * 职责:
 * - Event Deduplication (eventId + channelAccountId)
 * - Event Ordering (occurredAt-based canonical stream)
 * - Error Recovery (retry with exponential backoff)
 * - Dead Letter Queue (permanent failure isolation)
 * - Runtime Observability (EventTraceLog per stage)
 * 
 * 不负责:
 * - Channel Authentication (TokenService)
 * - Business Logic (InteractionSyncService)
 * - Customer Sync (CustomerSyncService - IMP-01.4)
 */

import { randomUUID } from 'crypto'
import { prisma } from '../../utils/index.js'
import { interactionSyncService } from '../../services/enterprise/channel/interaction-sync.service.js'
import { customerIdentityService } from './customer-identity.service.js'
import { interactionSignalBridge } from './interaction-signal.service.js'
import { WeComAdapter } from './wecom-adapter.js'
import type { ChannelHealth } from './channel-adapter.interface.js'
import type { InteractionEvent } from './channel-adapter.interface.js'

// ─── Types ─────────────────────────────────────────────────

export interface RawWeComEvent {
  eventId?: string
  Event?: string
  MsgType?: string
  UserID?: string
  external_userid?: string
  userid?: string
  content?: string
  msgtype?: string
  CreateTime?: number
  [key: string]: any
}

export interface EventProcessResult {
  success: boolean
  eventId: string
  traceId: string
  status: 'processed' | 'deduplicated' | 'failed' | 'dead_lettered'
  stage?: string
  error?: string
  retryCount?: number
}

export interface EventTraceEntry {
  traceId: string
  eventId: string
  tenantId?: string
  channelAccountId?: string
  stage: 'received' | 'normalized' | 'dedup_check' | 'processed' | 'failed' | 'retried' | 'dead_lettered'
  status: 'ok' | 'error' | 'skipped'
  message?: string
  metadata?: Record<string, any>
}

// ─── Constants ─────────────────────────────────────────────

const MAX_RETRY_COUNT = 3
const RETRY_DELAYS_MS = [1000, 3000, 10000] // exponential backoff

// ─── Callback Event Service ────────────────────────────────

export class CallbackEventService {
  /**
   * 处理 WeCom 回调事件（完整 Pipeline）
   * 
   * Pipeline:
   * 1. Generate traceId
   * 2. Log "received"
   * 3. Normalize event → Internal format
   * 4. Dedup check (eventId + channelAccountId)
   * 5. Process → call InteractionSyncService
   * 6. On error → Retry → Dead Letter Queue
   * 7. Log every stage
   */
  async processEvent(
    channelAccountId: string,
    tenantId: string,
    rawEvent: RawWeComEvent
  ): Promise<EventProcessResult> {
    const traceId = this.generateTraceId()

    try {
      // ─── Stage 1: Received ──────────────────────────────
      await this.logTrace({
        traceId,
        eventId: rawEvent.eventId || traceId,
        tenantId,
        channelAccountId,
        stage: 'received',
        status: 'ok',
        message: 'Event received from WeCom',
        metadata: {
          eventType: rawEvent.Event || rawEvent.MsgType || rawEvent.msgtype,
          userId: rawEvent.UserID || rawEvent.userid,
        },
      })

      // ─── Stage 2: Normalize ─────────────────────────────
      const eventId = rawEvent.eventId || this.generateEventId(rawEvent)
      const adapter = new WeComAdapter()
      adapter.setChannelAccountId(channelAccountId)
      const normalizedEvent = adapter.normalizeEvent(rawEvent)

      await this.logTrace({
        traceId,
        eventId,
        tenantId,
        channelAccountId,
        stage: 'normalized',
        status: 'ok',
        message: `Event normalized: ${normalizedEvent.type}`,
        metadata: {
          type: normalizedEvent.type,
          actor: normalizedEvent.actor,
        },
      })

      // ─── Stage 3: Dedup Check ───────────────────────────
      const dedupResult = await this.checkDuplicate(eventId, channelAccountId)
      if (dedupResult.isDuplicate) {
        await this.logTrace({
          traceId,
          eventId,
          tenantId,
          channelAccountId,
          stage: 'dedup_check',
          status: 'skipped',
          message: 'Duplicate event detected, skipping',
          metadata: { existingId: dedupResult.existingId },
        })

        return {
          success: true,
          eventId,
          traceId,
          status: 'deduplicated',
        }
      }

      await this.logTrace({
        traceId,
        eventId,
        tenantId,
        channelAccountId,
        stage: 'dedup_check',
        status: 'ok',
        message: 'Event is unique, proceeding',
      })

      // ─── Stage 4: Process (with retry) ──────────────────
      const processResult = await this.processWithRetry(
        traceId,
        eventId,
        channelAccountId,
        tenantId,
        normalizedEvent,
        rawEvent
      )

      return {
        ...processResult,
        traceId,
      }
    } catch (error: any) {
      const errorResult: EventProcessResult = {
        success: false,
        eventId: rawEvent.eventId || traceId,
        traceId,
        status: 'failed',
        error: error.message,
      }

      // Last resort: try to DLQ
      try {
        await this.moveToDeadLetter({
          eventId: errorResult.eventId,
          channelAccountId,
          tenantId,
          eventType: rawEvent.Event || rawEvent.msgtype || 'unknown',
          rawEvent,
          error: error.message,
          retryCount: MAX_RETRY_COUNT,
        })

        errorResult.status = 'dead_lettered'
      } catch (dlqError: any) {
        errorResult.error += ` | DLQ failed: ${dlqError.message}`
      }

      return errorResult
    }
  }

  /**
   * 重试死信队列中的事件
   * 
   * Flow:
   * 1. Get unresolved DLQ entries
   * 2. Re-process each event
   * 3. On success → mark resolved
   * 4. On failure → update retry count
   */
  async retryDeadLetters(
    channelAccountId: string,
    limit: number = 10
  ): Promise<{ attempted: number; resolved: number; failed: number }> {
    const entries = await prisma.deadLetterEvent.findMany({
      where: {
        channelAccountId,
        resolvedAt: null,
        retryCount: { lt: MAX_RETRY_COUNT },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    let resolved = 0
    let failed = 0

    for (const entry of entries) {
      try {
        const rawEvent = entry.payload as RawWeComEvent
        const tenantId = entry.tenantId

        // Re-process
        await this.processEvent(channelAccountId, tenantId, rawEvent)

        // Mark resolved
        await prisma.deadLetterEvent.update({
          where: { id: entry.id },
          data: {
            resolvedAt: new Date(),
            resolution: 'Auto-resolved on retry',
          },
        })

        resolved++
      } catch (error: any) {
        await prisma.deadLetterEvent.update({
          where: { id: entry.id },
          data: {
            retryCount: entry.retryCount + 1,
            lastRetriedAt: new Date(),
            error: `Retry ${entry.retryCount + 1}: ${error.message}`,
          },
        })

        failed++
      }
    }

    return { attempted: entries.length, resolved, failed }
  }

  /**
   * 获取死信队列统计
   */
  async getDeadLetterStats(channelAccountId: string) {
    const total = await prisma.deadLetterEvent.count({
      where: { channelAccountId },
    })
    const unresolved = await prisma.deadLetterEvent.count({
      where: { channelAccountId, resolvedAt: null },
    })
    const resolved = total - unresolved
    const byType = await prisma.deadLetterEvent.groupBy({
      by: ['eventType'],
      where: { channelAccountId },
      _count: { eventType: true },
    })

    return {
      total,
      unresolved,
      resolved,
      byType: Object.fromEntries(byType.map(t => [t.eventType, t._count.eventType])),
    }
  }

  /**
   * 获取事件统计 (GATE-01.3: Channel Health API)
   */
  async getEventStats(channelAccountId: string): Promise<{
    totalEvents: number
    successCount: number
    failedCount: number
    deduplicatedCount: number
    deadLetteredCount: number
    successRate: number
  }> {
    const [total, success, dedup, dlq] = await Promise.all([
      prisma.processedEvent.count({ where: { channelAccountId } }),
      prisma.processedEvent.count({ where: { channelAccountId, status: 'success' } }),
      prisma.processedEvent.count({ where: { channelAccountId, status: 'deduplicated' } }),
      prisma.deadLetterEvent.count({ where: { channelAccountId } }),
    ])

    const failed = total - success - dedup
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100

    return {
      totalEvents: total,
      successCount: success,
      failedCount: Math.max(0, failed),
      deduplicatedCount: dedup,
      deadLetteredCount: dlq,
      successRate,
    }
  }

  /**
   * 获取事件 Trace
   */
  async getEventTrace(traceId: string): Promise<EventTraceEntry[]> {
    const entries = await prisma.eventTraceLog.findMany({
      where: { traceId },
      orderBy: { createdAt: 'asc' },
    })

    return entries.map(e => ({
      traceId: e.traceId,
      eventId: e.eventId,
      stage: e.stage as EventTraceEntry['stage'],
      status: e.status as EventTraceEntry['status'],
      message: e.message || undefined,
      metadata: e.metadata as any,
    }))
  }

  // ─── Private Methods ─────────────────────────────────────

  /**
   * 检查事件是否重复（Deduplication）
   * 
   * Key: (eventId, channelAccountId)
   * 
   * Optimization:
   * - Use ProcessedEvent table with unique constraint
   * - Gracefully handle on conflict
   */
  private async checkDuplicate(
    eventId: string,
    channelAccountId: string
  ): Promise<{ isDuplicate: boolean; existingId?: string }> {
    try {
      const existing = await prisma.processedEvent.findFirst({
        where: { eventId, channelAccountId },
      })

      if (existing) {
        return { isDuplicate: true, existingId: existing.id }
      }

      return { isDuplicate: false }
    } catch (e: any) {
      // Unique constraint violation means duplicate
      if (e.code === 'P2002') {
        const existing = await prisma.processedEvent.findFirst({
          where: { eventId, channelAccountId },
        })
        return { isDuplicate: true, existingId: existing?.id }
      }
      throw e
    }
  }

  /**
   * 处理事件（带重试和退避）
   */
  private async processWithRetry(
    traceId: string,
    eventId: string,
    channelAccountId: string,
    tenantId: string,
    normalizedEvent: InteractionEvent,
    rawEvent: RawWeComEvent,
    retryCount: number = 0
  ): Promise<EventProcessResult> {
    try {
      // Step 1: Save to ProcessedEvent (dedup marker)
      await prisma.processedEvent.create({
        data: {
          eventId,
          tenantId,
          channelAccountId,
          channelType: 'wechat_work',
          eventType: normalizedEvent.type,
          status: 'success',
          traceId,
        },
      })

      // Step 2: Process via InteractionSyncService
      const interaction = await interactionSyncService.ingestInteraction({
        tenantId,
        channelAccountId,
        externalId: normalizedEvent.customer?.externalId || normalizedEvent.actor,
        externalName: rawEvent.external_userid || rawEvent.userid,
        interactionType: normalizedEvent.type,
        direction: 'inbound',
        content: rawEvent.content || rawEvent.msgtype || JSON.stringify(rawEvent),
        contentType: rawEvent.msgtype || 'event',
        traceId,
        rawPayload: rawEvent as any,
        occurredAt: this.extractEventTime(rawEvent),
      })

      // Step 2.5: Resolve customer identity (IMP-01.4)
      const account = await prisma.enterpriseChannelAccount.findUnique({
        where: { id: channelAccountId },
        select: { governanceTenantId: true, organizationId: true },
      })

      const identityResult = await customerIdentityService.resolve({
        tenantId,
        governanceTenantId: account?.governanceTenantId,
        organizationId: account?.organizationId,
        channelAccountId,
        channelType: 'wechat_work',
        externalId: normalizedEvent.customer?.externalId || normalizedEvent.actor,
        externalOpenId: rawEvent.external_userid || rawEvent.userid,
        externalName: rawEvent.external_userid || rawEvent.userid,
      })

      // Link interaction to customer identity if resolved
      if (identityResult.success && identityResult.customerIdentity && interaction) {
        try {
          await prisma.enterpriseInteraction.update({
            where: { id: interaction.id },
            data: { customerIdentityId: identityResult.customerIdentity.id },
          })
        } catch (linkError) {
          // Non-fatal: interaction exists but link failed
          console.warn(`[IMP-01.4] Failed to link interaction to customer identity: ${linkError}`)
        }
      }

      // Step 2.75: Trigger Intelligence Signal (GATE-01.2)
      if (interaction) {
        try {
          await interactionSignalBridge.analyzeAndTrigger({
            tenantId,
            interactionId: interaction.id,
            interactionType: normalizedEvent.type,
            content: rawEvent.content || rawEvent.msgtype,
            externalId: normalizedEvent.customer?.externalId || normalizedEvent.actor,
            direction: 'inbound',
            channel: 'wecom',
          })
        } catch (signalError) {
          // Non-fatal: signal generation failure should not break callback
          console.warn(`[GATE-01.2] Signal bridge error: ${signalError}`)
        }
      }

      // Step 3: Log success
      await this.logTrace({
        traceId,
        eventId,
        tenantId,
        channelAccountId,
        stage: 'processed',
        status: 'ok',
        message: 'Event processed successfully',
      })

      return {
        success: true,
        eventId,
        traceId,
        status: 'processed',
      }
    } catch (error: any) {
      const stage = retryCount < MAX_RETRY_COUNT ? 'failed' : 'dead_lettered'

      await this.logTrace({
        traceId,
        eventId,
        tenantId,
        channelAccountId,
        stage,
        status: 'error',
        message: `Processing failed (attempt ${retryCount + 1}): ${error.message}`,
        metadata: { retryCount, maxRetries: MAX_RETRY_COUNT },
      })

      // Retry with exponential backoff
      if (retryCount < MAX_RETRY_COUNT) {
        await this.sleep(RETRY_DELAYS_MS[retryCount])

        await this.logTrace({
          traceId,
          eventId,
          tenantId,
          channelAccountId,
          stage: 'retried',
          status: 'ok',
          message: `Retrying (attempt ${retryCount + 2}/${MAX_RETRY_COUNT + 1})`,
          metadata: { retryCount: retryCount + 1 },
        })

        return this.processWithRetry(
          traceId,
          eventId,
          channelAccountId,
          tenantId,
          normalizedEvent,
          rawEvent,
          retryCount + 1
        )
      }

      // Exhausted retries → Dead Letter Queue
      await this.moveToDeadLetter({
        eventId,
        channelAccountId,
        tenantId,
        eventType: normalizedEvent.type,
        rawEvent,
        error: error.message,
        retryCount,
      })

      return {
        success: false,
        eventId,
        traceId,
        status: 'dead_lettered',
        error: error.message,
        retryCount,
      }
    }
  }

  /**
   * 将事件移入死信队列
   */
  private async moveToDeadLetter(params: {
    eventId: string
    channelAccountId: string
    tenantId: string
    eventType: string
    rawEvent: RawWeComEvent
    error: string
    retryCount: number
  }): Promise<void> {
    await prisma.deadLetterEvent.create({
      data: {
        eventId: params.eventId,
        tenantId: params.tenantId,
        channelAccountId: params.channelAccountId,
        channelType: 'wechat_work',
        eventType: params.eventType,
        payload: params.rawEvent as any,
        error: params.error,
        retryCount: params.retryCount,
      },
    })

    // Also update ChannelHealth
    await prisma.enterpriseChannelAccount.update({
      where: { id: params.channelAccountId },
      data: {
        lastError: `DLQ: ${params.error}`,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 写入 Trace 日志
   */
  private async logTrace(entry: EventTraceEntry): Promise<void> {
    try {
      await prisma.eventTraceLog.create({
        data: {
          traceId: entry.traceId,
          eventId: entry.eventId,
          tenantId: entry.tenantId || 'unknown',
          channelAccountId: entry.channelAccountId || 'unknown',
          stage: entry.stage,
          status: entry.status,
          message: entry.message,
          metadata: entry.metadata || {},
        },
      })
    } catch (e) {
      // Trace logging should never break the main flow
      console.error('Failed to write trace log:', e)
    }
  }

  /**
   * 从原始事件提取时间戳
   * 
   * Event Ordering: occurredAt 决定事件顺序
   */
  private extractEventTime(rawEvent: RawWeComEvent): Date {
    if (rawEvent.CreateTime) {
      return new Date(rawEvent.CreateTime * 1000)
    }

    // Fallback: use current time
    return new Date()
  }

  /**
   * 生成 traceId
   */
  private generateTraceId(): string {
    return `trace_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`
  }

  /**
   * 生成 eventId（当 WeCom 没有提供 msgid 时）
   * 
   * Deterministic: 基于内容 hash，相同事件内容产生相同 ID
   */
  private generateEventId(rawEvent: RawWeComEvent): string {
    const content = JSON.stringify({
      userID: rawEvent.UserID || rawEvent.userid,
      event: rawEvent.Event || rawEvent.msgtype,
      time: rawEvent.CreateTime,
      content: rawEvent.content || rawEvent.Content,
    })

    // Simple hash for deterministic eventId
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return `evt_${Math.abs(hash).toString(36)}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const callbackEventService = new CallbackEventService()
