/**
 * Phase 3: Growth Execution Layer
 * Enterprise Channel Gateway — 统一渠道抽象接口
 *
 * 禁止每个平台单独开发。
 * 所有渠道（微信公众号/抖音/小红书/快手/企微）必须实现此接口。
 */
export interface ChannelContent {
  title: string
  body: string
  images?: string[]
  video?: string
  hashtags?: string[]
  link?: string
  metadata?: Record<string, any>
}

export interface PublishResult {
  publishId: string
  platformPostId?: string
  url?: string
  publishedAt: Date
  status: 'success' | 'failed' | 'pending'
  error?: string
}

export interface PlatformInteraction {
  platformUserId: string
  type: 'like' | 'comment' | 'share' | 'message' | 'follow'
  content: string
  timestamp: Date
  rawData?: Record<string, any>
}

export interface ChannelHealth {
  platform: string
  status: 'connected' | 'expired' | 'rate_limited' | 'error'
  expiresAt?: Date
  rateLimitRemaining?: number
  errorMessage?: string
}

/**
 * 企业渠道适配器接口 — 所有渠道必须实现
 */
export interface EnterpriseChannelAdapter {
  readonly platform: string

  /**
   * 发布内容
   */
  publish(content: ChannelContent): Promise<PublishResult>

  /**
   * 定时发布
   */
  schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult>

  /**
   * 拉取用户互动（评论/私信/点赞等）
   */
  fetchInteractions(since?: Date): Promise<PlatformInteraction[]>

  /**
   * 回复用户（评论/私信）
   */
  reply(interactionId: string, message: string): Promise<boolean>

  /**
   * 健康检查
   */
  healthCheck(): Promise<ChannelHealth>

  /**
   * 获取账号信息
   */
  getAccountInfo(): Promise<{
    accountId: string
    accountName: string
    followerCount?: number
    verified?: boolean }>
}

/**
 * 内容状态枚举
 */
export enum ContentStatus {
  DRAFT = 'draft',
  AI_REVIEW = 'ai_review',
  WAIT_APPROVAL = 'wait_approval',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  REVISION_REQUIRED = 'revision_required',
}

/**
 * 客户意向等级
 */
export enum LeadTemperature {
  COLD = 'cold',
  WARM = 'warm',
  HOT = 'hot',
  CUSTOMER = 'customer',
}
