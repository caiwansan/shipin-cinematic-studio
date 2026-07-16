/**
 * P4.2.5.2-IMP-01.5 — Interaction Feed Runtime
 *
 * The 'Interaction Feed' is the canonical customer timeline view
 * that transforms raw WeCom events into Enterprise-understandable
 * interaction sequences.
 *
 * Pipeline:
 *   Raw Event → Normalize → InteractionEvent → Feed Contract
 *
 * 职责:
 * - Customer Timeline (interaction history grouped by customer)
 * - Feed Contract (message mapping to canonical form)
 * - EnterpriseDataEnvelope wrappers
 * - Sentiment storage (hook for AI annotations)
 * - Feed API (paginated, filterable)
 *
 * 不负责:
 * - Event Reception (CallbackEventService)
 * - Identity Resolution (CustomerIdentityService)
 * - Decision / Action triggering (Post-IMP-01.5)
 */

import { prisma } from '../../utils/index.js'
import type { CustomerIdentityDTO } from './customer-identity.service.js'

// ─── Types ─────────────────────────────────────────────────

export type CanonicalInteractionType =
  | 'MESSAGE'
  | 'MEDIA'
  | 'VOICE'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_REMOVED'
  | 'CUSTOMER_UPDATED'
  | 'FOLLOW_UP'
  | 'DECISION'
  | 'ACTION'
  | 'UNKNOWN'

export type InteractionDirection = 'inbound' | 'outbound'

export interface InteractionEvent {
  id: string
  tenantId: string
  customerIdentityId: string | null
  channel: 'wecom'
  type: CanonicalInteractionType
  direction: InteractionDirection
  content: string | null
  contentType: string
  sentiment: 'positive' | 'neutral' | 'negative' | null
  traceId: string | null
  timestamp: string
  metadata: Record<string, any>
}

export interface FeedQuery {
  tenantId: string
  customerIdentityId?: string
  externalId?: string
  channelAccountId?: string
  direction?: InteractionDirection
  type?: CanonicalInteractionType
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface FeedContract {
  customer: CustomerIdentityDTO | null
  interactions: InteractionEvent[]
  totalCount: number
  hasMore: boolean
}

export interface CustomerTimeline {
  customerIdentityId: string
  customerName: string
  totalInteractions: number
  lastInteractionAt: string | null
  timeline: TimelineEntry[]
}

export interface TimelineEntry {
  date: string
  interactions: InteractionEvent[]
}

export interface ChannelEnvelope<T> {
  data: T
  source: 'WeCom'
  syncStatus: 'synced' | 'pending' | 'failed'
  traceId: string
  timestamp: string
}

export interface FeedStats {
  totalInteractions: number
  byType: Record<string, number>
  byDirection: Record<string, number>
  uniqueCustomers: number
  avgPerCustomer: number
  period: string
}

export interface FeedQueryResult {
  interactions: InteractionEvent[]
  total: number
  hasMore: boolean
}

// ─── Interaction Feed Service ──────────────────────────────

export class InteractionFeedService {
  /**
   * Build the Customer Timeline (Feed Contract)
   *
   * Returns interactions grouped by date, with customer context
   */
  async getCustomerTimeline(
    tenantId: string,
    customerIdentityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<CustomerTimeline | null> {
    const customer = await prisma.customerIdentity.findUnique({
      where: { id: customerIdentityId },
    })

    if (!customer || customer.tenantId !== tenantId) {
      return null
    }

    const limit = options?.limit || 100
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: {
        tenantId,
        customerIdentityId,
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: options?.offset || 0,
    })

    const totalCount = await prisma.enterpriseInteraction.count({
      where: { tenantId, customerIdentityId },
    })

    // Group by date
    const byDate = new Map<string, InteractionEvent[]>()
    for (const ix of interactions) {
      const dateKey = ix.occurredAt.toISOString().slice(0, 10)
      const entry = this.toInteractionEvent(ix)
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, [])
      }
      byDate.get(dateKey)!.push(entry)
    }

    const timeline: TimelineEntry[] = Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, ints]) => ({
        date,
        interactions: ints,
      }))

    return {
      customerIdentityId,
      customerName: customer.displayName,
      totalInteractions: totalCount,
      lastInteractionAt: customer.lastInteractionAt?.toISOString() || null,
      timeline,
    }
  }

  /**
   * Query interactions with filters (Feed Query)
   */
  async queryFeed(query: FeedQuery): Promise<FeedQueryResult> {
    const {
      tenantId,
      customerIdentityId,
      externalId,
      channelAccountId,
      direction,
      type,
      startDate,
      endDate,
      limit = 30,
      offset = 0,
    } = query

    const where: any = { tenantId }

    if (customerIdentityId) where.customerIdentityId = customerIdentityId
    if (externalId) where.externalId = externalId
    if (channelAccountId) where.channelAccountId = channelAccountId
    if (direction) where.direction = direction

    if (type && type !== 'UNKNOWN') {
      where.interactionType = type
    }

    if (startDate || endDate) {
      where.occurredAt = {}
      if (startDate) where.occurredAt.gte = new Date(startDate)
      if (endDate) where.occurredAt.lte = new Date(endDate)
    }

    const [interactions, total] = await Promise.all([
      prisma.enterpriseInteraction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.enterpriseInteraction.count({ where }),
    ])

    return {
      interactions: interactions.map(ix => this.toInteractionEvent(ix)),
      total,
      hasMore: offset + limit < total,
    }
  }

  /**
   * Get Feed Contract (customer + interactions)
   */
  async getFeedContract(
    tenantId: string,
    customerIdentityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<FeedContract> {
    const [customerResult, feedResult] = await Promise.all([
      prisma.customerIdentity.findUnique({
        where: { id: customerIdentityId },
      }),
      this.queryFeed({
        tenantId,
        customerIdentityId,
        limit: options?.limit || 50,
        offset: options?.offset || 0,
      }),
    ])

    return {
      customer: customerResult
        ? {
            id: customerResult.id,
            tenantId: customerResult.tenantId,
            internalCustomerId: customerResult.internalCustomerId,
            internalGovUserId: customerResult.internalGovUserId,
            displayName: customerResult.displayName,
            displayAvatar: customerResult.displayAvatar,
            channelType: customerResult.channelType,
            channelAccountId: customerResult.channelAccountId,
            externalId: customerResult.externalId,
            mappingStatus: customerResult.mappingStatus,
            firstInteractionAt: customerResult.firstInteractionAt,
            lastInteractionAt: customerResult.lastInteractionAt,
            interactionCount: customerResult.interactionCount,
            lastSyncedAt: customerResult.lastSyncedAt,
            createdAt: customerResult.createdAt,
            updatedAt: customerResult.updatedAt,
          }
        : null,
      interactions: feedResult.interactions,
      totalCount: feedResult.total,
      hasMore: feedResult.hasMore,
    }
  }

  /**
   * Get Feed Statistics
   */
  async getStats(
    tenantId: string,
    channelAccountId?: string,
    days: number = 30
  ): Promise<FeedStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const baseWhere: any = {
      tenantId,
      occurredAt: { gte: startDate },
    }
    if (channelAccountId) baseWhere.channelAccountId = channelAccountId

    const interactions = await prisma.enterpriseInteraction.findMany({
      where: baseWhere,
      select: {
        direction: true,
        interactionType: true,
        customerIdentityId: true,
      },
    })

    const byType: Record<string, number> = {}
    const byDirection: Record<string, number> = {}
    const uniqueCustomers = new Set<string>()

    for (const ix of interactions) {
      byType[ix.interactionType] = (byType[ix.interactionType] || 0) + 1
      byDirection[ix.direction] = (byDirection[ix.direction] || 0) + 1
      if (ix.customerIdentityId) uniqueCustomers.add(ix.customerIdentityId)
    }

    return {
      totalInteractions: interactions.length,
      byType,
      byDirection,
      uniqueCustomers: uniqueCustomers.size,
      avgPerCustomer:
        uniqueCustomers.size > 0
          ? Math.round(interactions.length / uniqueCustomers.size)
          : 0,
      period: `${days} days`,
    }
  }

  /**
   * Wrap data in Enterprise Data Envelope
   */
  envelope<T>(
    data: T,
    traceId: string,
    syncStatus: ChannelEnvelope<T>['syncStatus'] = 'synced'
  ): ChannelEnvelope<T> {
    return {
      data,
      source: 'WeCom',
      syncStatus,
      traceId,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Store sentiment annotation (for AI-generated sentiment)
   */
  async storeSentiment(
    interactionId: string,
    sentiment: 'positive' | 'neutral' | 'negative',
    confidence: number = 0.8
  ): Promise<void> {
    await prisma.enterpriseInteraction.update({
      where: { id: interactionId },
      data: {
        sentiment,
      },
    })
  }

  // ─── Private Helpers ─────────────────────────────────────

  /**
   * Convert DB record → Canonical InteractionEvent
   */
  private toInteractionEvent(record: any): InteractionEvent {
    return {
      id: record.id,
      tenantId: record.tenantId,
      customerIdentityId: record.customerIdentityId || null,
      channel: 'wecom',
      type: (record.interactionType || 'UNKNOWN') as CanonicalInteractionType,
      direction: record.direction as InteractionDirection,
      content: record.content,
      contentType: record.contentType,
      sentiment: record.sentiment || null,
      traceId: record.traceId || null,
      timestamp: record.occurredAt.toISOString(),
      metadata: record.rawPayload || {},
    }
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const interactionFeedService = new InteractionFeedService()
