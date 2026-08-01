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
 * ────────────────────────────────────────────────────────────────
 * SPRINT-MEDIA-CHANNEL-01 Task02 — Media Channel Runtime v1.0 冻结
 *
 * EnterpriseChannelAdapter = 唯一渠道执行接口（Channel Runtime Layer）
 * - 官方 OAuth 到位后只替换执行层（DouyinBrowserAdapter → DouyinOAuthAdapter）
 * - 禁止每个平台单独开发接口；所有渠道必须实现此接口
 * - v1.0 冻结方法：connect / refreshCredential / publish / fetchMetrics / fetchComments / healthCheck
 * - 兼容保留：schedule / fetchInteractions / reply / getAccountInfo（历史实现不破坏）
 * ────────────────────────────────────────────────────────────────
 */

/**
 * 连接结果（扫码/登录会话）
 */
export interface ConnectResult {
  sessionId: string
  status: 'waiting_login' | 'connected' | 'expired' | 'failed'
  loginUrl?: string
  accountName?: string
  externalAccountId?: string
  message?: string
}

/**
 * 账号核心指标（真实数据，禁止 mock）
 */
export interface ChannelMetrics {
  followerCount: number
  videoCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  // 近期表现（可选，便于 AI 分析员工消费）
  recentViews?: number
  recentLikes?: number
  interactionRate?: number
  collectedAt: Date
  rawData?: Record<string, any>
}

/**
 * 评论/互动列表项
 */
export interface ChannelComment {
  commentId: string
  authorName: string
  content: string
  likeCount?: number
  createdAt: Date
  rawData?: Record<string, any>
}

/**
 * 企业渠道适配器接口 — 所有渠道必须实现（v1.0 冻结）
 */
export interface EnterpriseChannelAdapter {
  readonly platform: string

  /**
   * [v1.0] 连接渠道（浏览器自动化：启动会话进入登录页 / OAuth：发起授权）
   */
  connect(accountId?: string): Promise<ConnectResult>

  /**
   * [v1.0] 刷新凭证（cookie 续期 / OAuth refresh_token）
   */
  refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }>

  /**
   * [v1.0] 读取账号真实核心指标（粉丝/播放/互动，AI 分析员工数据源）
   */
  fetchMetrics(accountId: string): Promise<ChannelMetrics>

  /**
   * [v1.0] 拉取评论列表
   */
  fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]>

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
