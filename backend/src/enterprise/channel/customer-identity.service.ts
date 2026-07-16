/**
 * P4.2.5.2-IMP-01.4 — Customer Identity Sync
 * 
 * Identity Resolution Pipeline
 * 
 * 职责:
 * - Identity Mapping (external → internal)
 * - Customer Sync Pipeline (create/update/delete)
 * - Identity Boundary enforcement (no direct external ID as customer ID)
 * - Interaction linking
 * - Sync health tracking
 * 
 * 不负责:
 * - Event Processing (CallbackEventService)
 * - Authentication (TokenService)
 * - External API calls (WeComClient → getExternalContacts)
 */

import { prisma } from '../../utils/index.js'

// ─── Types ─────────────────────────────────────────────────

export interface ExternalContact {
  externalId: string
  externalOpenId?: string
  name?: string
  avatar?: string
  type?: number // 1=WeCom user, 2=external contact
  gender?: number
  unionid?: string
}

export interface IdentityResolveInput {
  tenantId: string
  governanceTenantId?: string | null
  organizationId?: string | null
  channelAccountId: string
  channelType?: string
  externalId: string
  externalOpenId?: string | null
  externalName?: string | null
  externalAvatar?: string | null
}

export interface IdentityResolveResult {
  success: boolean
  customerIdentity?: CustomerIdentityDTO
  status: 'mapped' | 'pending' | 'unknown' | 'failed'
  error?: string
}

export interface CustomerIdentityDTO {
  id: string
  tenantId: string
  internalCustomerId: string | null
  internalGovUserId: string | null
  displayName: string
  displayAvatar: string | null
  channelType: string
  channelAccountId: string
  externalId: string
  mappingStatus: string
  firstInteractionAt: Date | null
  lastInteractionAt: Date | null
  interactionCount: number
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SyncStats {
  total: number
  mapped: number
  pending: number
  unknown: number
  recentlySynced: number
}

// ─── Identity Resolver (Interface) ─────────────────────────

export interface IdentityResolver {
  resolve(input: IdentityResolveInput): Promise<IdentityResolveResult>
  lookup(tenantId: string, channelType: string, externalId: string): Promise<CustomerIdentityDTO | null>
  list(tenantId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<CustomerIdentityDTO[]>
  getStats(tenantId: string, channelAccountId?: string): Promise<SyncStats>
  assignInternalCustomer(identityId: string, internalCustomerId: string, internalGovUserId?: string): Promise<CustomerIdentityDTO>
  markPending(identityId: string): Promise<CustomerIdentityDTO>
  recordInteraction(identityId: string): Promise<void>
  syncFromWeCom(tenantId: string, governanceTenantId: string, channelAccountId: string, contacts: ExternalContact[]): Promise<{ created: number; updated: number; unchanged: number }>
  deleteIdentity(identityId: string): Promise<void>
  getHealth(tenantId: string, channelAccountId?: string): Promise<{
    status: 'healthy' | 'degraded' | 'error'
    mappedRatio: number
    lastSyncAt: Date | null
    stats: SyncStats
  }>
}

// ─── Customer Identity Service Implementation ──────────────

export class CustomerIdentityService implements IdentityResolver {
  /**
   * Resolve external identity → enterprise customer
   * 
   * Core flow:
   * 1. Check CustomerIdentity table by (tenantId, channelType, externalId)
   * 2. If not found → create new pending identity
   * 3. Update interaction stats
   * 4. Return canonical customer reference
   */
  async resolve(input: IdentityResolveInput): Promise<IdentityResolveResult> {
    const channelType = input.channelType || 'wechat_work'

    try {
      // Step 1: Check existing mapping
      const existing = await prisma.customerIdentity.findUnique({
        where: {
          tenantId_channelType_externalId: {
            tenantId: input.tenantId,
            channelType,
            externalId: input.externalId,
          },
        },
      })

      if (existing) {
        // Update interaction stats
        const updated = await prisma.customerIdentity.update({
          where: { id: existing.id },
          data: {
            lastInteractionAt: new Date(),
            interactionCount: { increment: 1 },
            ...(input.externalName ? { displayName: input.externalName } : {}),
            ...(input.externalAvatar ? { displayAvatar: input.externalAvatar } : {}),
          },
        })

        return {
          success: true,
          customerIdentity: this.toDTO(updated),
          status: updated.mappingStatus as 'mapped' | 'pending' | 'unknown',
        }
      }

      // Step 2: Create new pending identity
      const created = await prisma.customerIdentity.create({
        data: {
          tenantId: input.tenantId,
          governanceTenantId: input.governanceTenantId,
          organizationId: input.organizationId,
          channelType,
          channelAccountId: input.channelAccountId,
          externalId: input.externalId,
          externalOpenId: input.externalOpenId,
          displayName: input.externalName || `External_${input.externalId.slice(0, 8)}`,
          displayAvatar: input.externalAvatar,
          mappingStatus: 'pending',
          firstInteractionAt: new Date(),
          lastInteractionAt: new Date(),
          interactionCount: 1,
          syncSource: 'wecom_callback',
        },
      })

      return {
        success: true,
        customerIdentity: this.toDTO(created),
        status: 'pending',
      }
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        error: error.message,
      }
    }
  }

  /**
   * Lookup existing customer identity
   */
  async lookup(tenantId: string, channelType: string, externalId: string): Promise<CustomerIdentityDTO | null> {
    const identity = await prisma.customerIdentity.findUnique({
      where: { tenantId_channelType_externalId: { tenantId, channelType, externalId } },
    })

    return identity ? this.toDTO(identity) : null
  }

  /**
   * List identities by tenant
   */
  async list(
    tenantId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<CustomerIdentityDTO[]> {
    const identities = await prisma.customerIdentity.findMany({
      where: {
        tenantId,
        ...(options?.status ? { mappingStatus: options.status } : {}),
      },
      orderBy: { lastInteractionAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    })

    return identities.map(i => this.toDTO(i))
  }

  /**
   * Get sync statistics
   */
  async getStats(tenantId: string, channelAccountId?: string): Promise<SyncStats> {
    const baseWhere = channelAccountId ? { tenantId, channelAccountId } : { tenantId }

    const [total, mapped, pending, unknown, recentlySynced] = await Promise.all([
      prisma.customerIdentity.count({ where: baseWhere }),
      prisma.customerIdentity.count({ where: { ...baseWhere, mappingStatus: 'mapped' } }),
      prisma.customerIdentity.count({ where: { ...baseWhere, mappingStatus: 'pending' } }),
      prisma.customerIdentity.count({ where: { ...baseWhere, mappingStatus: 'unknown' } }),
      prisma.customerIdentity.count({
        where: {
          ...baseWhere,
          mappingStatus: 'mapped',
          lastSyncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    return { total, mapped, pending, unknown, recentlySynced }
  }

  /**
   * Assign internal customer (manual mapping)
   */
  async assignInternalCustomer(
    identityId: string,
    internalCustomerId: string,
    internalGovUserId?: string
  ): Promise<CustomerIdentityDTO> {
    const identity = await prisma.customerIdentity.update({
      where: { id: identityId },
      data: {
        internalCustomerId,
        ...(internalGovUserId ? { internalGovUserId } : {}),
        mappingStatus: 'mapped',
        lastSyncedAt: new Date(),
        syncSource: 'manual',
      },
    })

    return this.toDTO(identity)
  }

  /**
   * Mark identity as pending
   */
  async markPending(identityId: string): Promise<CustomerIdentityDTO> {
    const identity = await prisma.customerIdentity.update({
      where: { id: identityId },
      data: { mappingStatus: 'pending' },
    })

    return this.toDTO(identity)
  }

  /**
   * Update interaction stats
   */
  async recordInteraction(identityId: string): Promise<void> {
    await prisma.customerIdentity.update({
      where: { id: identityId },
      data: {
        lastInteractionAt: new Date(),
        interactionCount: { increment: 1 },
      },
    })
  }

  /**
   * Sync from WeCom (batch)
   * 
   * Import all external contacts from WeCom as CustomerIdentity records
   */
  async syncFromWeCom(
    tenantId: string,
    governanceTenantId: string,
    channelAccountId: string,
    contacts: ExternalContact[]
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    let created = 0
    let updated = 0
    let unchanged = 0

    for (const contact of contacts) {
      const existing = await prisma.customerIdentity.findUnique({
        where: {
          tenantId_channelType_externalId: {
            tenantId,
            channelType: 'wechat_work',
            externalId: contact.externalId,
          },
        },
      })

      if (existing) {
        // Check if changed
        const needsUpdate =
          existing.displayName !== contact.name ||
          existing.displayAvatar !== contact.avatar

        if (needsUpdate) {
          await prisma.customerIdentity.update({
            where: { id: existing.id },
            data: {
              displayName: contact.name || existing.displayName,
              displayAvatar: contact.avatar || existing.displayAvatar,
              externalOpenId: contact.unionid || existing.externalOpenId,
              lastSyncedAt: new Date(),
              syncSource: 'wecom_sync',
              metadata: {
                type: contact.type,
                gender: contact.gender,
              },
            },
          })
          updated++
        } else {
          unchanged++
        }
      } else {
        // Create new identity
        await prisma.customerIdentity.create({
          data: {
            tenantId,
            governanceTenantId,
            channelAccountId,
            channelType: 'wechat_work',
            externalId: contact.externalId,
            externalOpenId: contact.unionid,
            displayName: contact.name || `External_${contact.externalId.slice(0, 8)}`,
            displayAvatar: contact.avatar,
            mappingStatus: 'pending',
            lastSyncedAt: new Date(),
            syncSource: 'wecom_sync',
            metadata: {
              type: contact.type,
              gender: contact.gender,
            },
          },
        })
        created++
      }
    }

    return { created, updated, unchanged }
  }

  /**
   * Delete identity (GDPR compliance / data removal)
   */
  async deleteIdentity(identityId: string): Promise<void> {
    await prisma.customerIdentity.delete({
      where: { id: identityId },
    })
  }

  /**
   * Get sync health report
   */
  async getHealth(tenantId: string, channelAccountId?: string): Promise<{
    status: 'healthy' | 'degraded' | 'error'
    mappedRatio: number
    lastSyncAt: Date | null
    stats: SyncStats
  }> {
    const stats = await this.getStats(tenantId, channelAccountId)

    const lastSync = await prisma.customerIdentity.findFirst({
      where: {
        tenantId,
        ...(channelAccountId ? { channelAccountId } : {}),
        lastSyncedAt: { not: null },
      },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    })

    const mappedRatio = stats.total > 0 ? stats.mapped / stats.total : 0

    let status: 'healthy' | 'degraded' | 'error' = 'healthy'
    if (mappedRatio < 0.3 && stats.total > 5) status = 'error'
    else if (mappedRatio < 0.6) status = 'degraded'

    return {
      status,
      mappedRatio,
      lastSyncAt: lastSync?.lastSyncedAt || null,
      stats,
    }
  }

  // ─── Private Helpers ─────────────────────────────────────

  private toDTO(identity: any): CustomerIdentityDTO {
    return {
      id: identity.id,
      tenantId: identity.tenantId,
      internalCustomerId: identity.internalCustomerId,
      internalGovUserId: identity.internalGovUserId,
      displayName: identity.displayName,
      displayAvatar: identity.displayAvatar,
      channelType: identity.channelType,
      channelAccountId: identity.channelAccountId,
      externalId: identity.externalId,
      mappingStatus: identity.mappingStatus,
      firstInteractionAt: identity.firstInteractionAt,
      lastInteractionAt: identity.lastInteractionAt,
      interactionCount: identity.interactionCount,
      lastSyncedAt: identity.lastSyncedAt,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    }
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const customerIdentityService = new CustomerIdentityService()
