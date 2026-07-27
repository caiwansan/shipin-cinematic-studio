/**
 * Media Platform Service — BETA-06.6 Phase 3.1
 * 
 * 职责：管理媒体平台账号和内容
 * - 账号授权
 * - 内容创建/审核/发布
 * - 热点分析记录
 */

import { prisma } from '../../utils/index.js'

// ─── Types ───

export interface CreatePlatformAccountRequest {
  organizationId: string
  platform: string
  accountName: string
  accountNickname?: string
  sessionData?: string  // 浏览器 session JSON
}

export interface CreateContentRequest {
  organizationId: string
  platformAccountId: string
  title: string
  body: string
  tags?: string[]
  imageUrls?: string[]
  hotspotId?: string
  createdBy: string
}

export interface ReviewContentRequest {
  contentId: string
  score: number
  feedback: string
  reviewerId: string
}

export interface CreateHotspotRequest {
  organizationId: string
  industry: string
  title: string
  description: string
  source: string
  sourceUrl?: string
  trendScore?: number
  volume?: number
  relatedTags?: string[]
  generatedFor?: string
}

class MediaPlatformService {

  // ─── Platform Account ───

  async createAccount(req: CreatePlatformAccountRequest) {
    const account = await prisma.mediaPlatformAccount.create({
      data: {
        organizationId: req.organizationId,
        platform: req.platform,
        accountName: req.accountName,
        accountNickname: req.accountNickname,
        status: req.sessionData ? 'active' : 'pending_auth',
        credentialVaultId: req.sessionData 
          ? await this.encryptCredential(req.sessionData) 
          : null,
        lastSyncAt: new Date(),
      },
    })
    return account
  }

  async getAccountsByOrg(organizationId: string) {
    return prisma.mediaPlatformAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getAccount(organizationId: string, accountId: string) {
    return prisma.mediaPlatformAccount.findFirst({
      where: { id: accountId, organizationId },
    })
  }

  async updateAccountStatus(accountId: string, status: string) {
    return prisma.mediaPlatformAccount.update({
      where: { id: accountId },
      data: { status, updatedAt: new Date() },
    })
  }

  // ─── Hotspot ───

  async createHotspot(req: CreateHotspotRequest) {
    return prisma.mediaHotspot.create({
      data: {
        organizationId: req.organizationId,
        industry: req.industry,
        title: req.title,
        description: req.description,
        source: req.source,
        sourceUrl: req.sourceUrl,
        trendScore: req.trendScore ?? 0,
        volume: req.volume ?? 0,
        relatedTags: JSON.stringify(req.relatedTags || []),
        generatedFor: req.generatedFor,
      },
    })
  }

  async getHotspots(organizationId: string, limit = 20) {
    return prisma.mediaHotspot.findMany({
      where: { organizationId },
      orderBy: { analysisDate: 'desc' },
      take: limit,
    })
  }

  // ─── Content ───

  async createContent(req: CreateContentRequest) {
    return prisma.mediaContent.create({
      data: {
        organizationId: req.organizationId,
        platformAccountId: req.platformAccountId,
        accountId: req.platformAccountId,  // 冗余
        title: req.title,
        body: req.body,
        tags: JSON.stringify(req.tags || []),
        imageUrls: JSON.stringify(req.imageUrls || []),
        status: 'pending_review',
        hotspotId: req.hotspotId,
        createdBy: req.createdBy,
      },
    })
  }

  async getContentById(organizationId: string, contentId: string) {
    return prisma.mediaContent.findFirst({
      where: { id: contentId, organizationId },
    })
  }

  async getContentsByAccount(organizationId: string, platformAccountId: string) {
    return prisma.mediaContent.findMany({
      where: { organizationId, platformAccountId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async reviewContent(req: ReviewContentRequest) {
    return prisma.mediaContent.update({
      where: { id: req.contentId },
      data: {
        reviewScore: req.score,
        reviewFeedback: req.feedback,
        status: req.score >= 85 ? 'approved' : 'rejected',
        updatedAt: new Date(),
      },
    })
  }

  async updateContentStatus(contentId: string, status: string) {
    return prisma.mediaContent.update({
      where: { id: contentId },
      data: { status, updatedAt: new Date() },
    })
  }

  // ─── Publish Records ───

  async createPublishRecord(data: {
    organizationId: string
    platformAccountId: string
    contentId: string
  }) {
    return prisma.mediaContentPublish.create({
      data: {
        organizationId: data.organizationId,
        platformAccountId: data.platformAccountId,
        accountId: data.platformAccountId,
        contentId: data.contentId,
        status: 'pending',
      },
    })
  }

  async updatePublishStatus(publishId: string, data: {
    status: string
    platformContentId?: string
    platformUrl?: string
    errorCode?: string
    errorMessage?: string
    publishedAt?: Date
  }) {
    return prisma.mediaContentPublish.update({
      where: { id: publishId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }

  async getPublishRecords(organizationId: string) {
    return prisma.mediaContentPublish.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── Private ───

  private async encryptCredential(data: string): Promise<string> {
    return Buffer.from(data).toString('base64')
  }

  async decryptCredential(vaultId: string): Promise<string> {
    const result = await prisma.$queryRaw`SELECT encrypted_payload FROM media_credential_vault WHERE id = ${vaultId}` as any[]
    if (!result || result.length === 0) throw new Error('Credential not found')
    return Buffer.from(result[0].encrypted_payload, 'base64').toString('utf-8')
  }

  // ─── BETA-06.7.1 Cookie Refresh ───

  async refreshCookies(data: {
    organizationId: string
    platform: string
    credentialType: string
    encryptedPayload: string
    encryptionVersion: number
  }) {
    await prisma.$queryRaw`UPDATE media_credential_vault SET status = 'EXPIRED', updated_at = NOW() WHERE organization_id = ${data.organizationId} AND platform = ${data.platform} AND status = 'active'`

    const newVault = await prisma.$queryRaw`INSERT INTO media_credential_vault (organization_id, platform, credential_type, encrypted_payload, encryption_version, status, last_verified_at) VALUES (${data.organizationId}, ${data.platform}, ${data.credentialType}, ${data.encryptedPayload}, ${data.encryptionVersion}, 'active', NOW()) RETURNING id` as any[]

    const vaultId = newVault[0]?.id
    if (!vaultId) throw new Error('Failed to create credential vault entry')

    await prisma.$queryRaw`UPDATE media_platform_account SET credential_vault_id = ${vaultId}, status = 'active', last_sync_at = NOW(), updated_at = NOW() WHERE organization_id = ${data.organizationId} AND platform = ${data.platform} AND status IN ('active', 'expired')`

    return { vaultId, status: 'active' }
  }

  async checkAccountHealth(organizationId: string, platform: string) {
    const accounts = await prisma.$queryRaw`SELECT mpa.id, mpa.account_name, mpa.status, mpa.credential_vault_id, mcv.status as credential_status, mcv.expires_at, mcv.last_verified_at FROM media_platform_account mpa LEFT JOIN media_credential_vault mcv ON mpa.credential_vault_id = mcv.id WHERE mpa.organization_id = ${organizationId} AND mpa.platform = ${platform} LIMIT 1` as any[]
    if (!accounts || accounts.length === 0) return { hasAccount: false }

    const a = accounts[0]
    return {
      hasAccount: true,
      accountId: a.id,
      accountName: a.account_name,
      accountStatus: a.status,
      credentialStatus: a.credential_status || 'unknown',
    }
  }
}

export const mediaPlatformService = new MediaPlatformService()
