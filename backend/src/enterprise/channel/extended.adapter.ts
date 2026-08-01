/**
 * Phase 3 Gateway 扩展: 4个新渠道适配器
 * 视频号 / 微博 / B站 / QQ
 * 复用统一接口 EnterpriseChannelAdapter
 */
import type {
  ChannelContent,
  PublishResult,
  PlatformInteraction,
  ChannelHealth,
  ConnectResult,
  ChannelMetrics,
  ChannelComment,
  EnterpriseChannelAdapter,
} from './channel.adapter.js'

// SPRINT-MEDIA-CHANNEL-01 Task02: v1.0 接口冻结适配（stub，开发测试用，Task07 复制渠道时统一真实实现）

// 视频号适配器
// 视频号适配器
export class VideoAccountAdapter implements EnterpriseChannelAdapter {
  readonly platform = 'video_account'
  private postCounter = 0

  async connect(accountId?: string): Promise<ConnectResult> {
    return { sessionId: `va_${Date.now()}`, status: 'connected', accountName: '企业视频号' }
  }
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> { return { ok: true } }
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    return { followerCount: 8500, videoCount: 68, totalViews: 420000, totalLikes: 21800, totalComments: 1650, totalShares: 920, collectedAt: new Date() }
  }
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return [{ commentId: 'va_1', authorName: '用户', content: '视频很实用', createdAt: new Date() }]
  }

  async publish(content: ChannelContent): Promise<PublishResult> {
    this.postCounter++
    const id = `va_${Date.now()}_${this.postCounter}`
    return { publishId: id, platformPostId: id, url: `https://channels.weixin.qq.com/video/${id}`, publishedAt: new Date(), status: 'success' }
  }
  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return { publishId: `va_sched_${Date.now()}`, publishedAt: scheduledTime, status: 'pending' }
  }
  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    const comments = ['视频很实用', '想了解企业方案', '能加微信详聊吗', '这个怎么操作']
    return comments.map((c, i) => ({ platformUserId: `va_user_${i}`, type: 'comment', content: c, timestamp: new Date() }))
  }
  async reply(interactionId: string, message: string): Promise<boolean> { return true }
  async healthCheck(): Promise<ChannelHealth> { return { platform: 'video_account', status: 'connected', rateLimitRemaining: 500 } }
  async getAccountInfo() { return { accountId: 'va_001', accountName: '企业视频号', followerCount: 8500, verified: true } }
}

// 微博适配器
export class WeiboAdapter implements EnterpriseChannelAdapter {
  readonly platform = 'weibo'
  private postCounter = 0

  async connect(accountId?: string): Promise<ConnectResult> {
    return { sessionId: `wb_${Date.now()}`, status: 'connected', accountName: '企业微博' }
  }
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> { return { ok: true } }
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    return { followerCount: 25600, videoCount: 210, totalViews: 1800000, totalLikes: 96000, totalComments: 8200, totalShares: 4100, collectedAt: new Date() }
  }
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return [{ commentId: 'wb_1', authorName: '用户', content: '已转发', createdAt: new Date() }]
  }

  async publish(content: ChannelContent): Promise<PublishResult> {
    this.postCounter++
    const id = `wb_${Date.now()}_${this.postCounter}`
    return { publishId: id, platformPostId: id, url: `https://weibo.com/p/${id}`, publishedAt: new Date(), status: 'success' }
  }
  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return { publishId: `wb_sched_${Date.now()}`, publishedAt: scheduledTime, status: 'pending' }
  }
  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    const comments = ['已转发', '关注了', '求合作链接', '这个观点很有道理']
    return comments.map((c, i) => ({ platformUserId: `wb_user_${i}`, type: i === 0 ? 'share' : 'comment', content: c, timestamp: new Date() }))
  }
  async reply(interactionId: string, message: string): Promise<boolean> { return true }
  async healthCheck(): Promise<ChannelHealth> { return { platform: 'weibo', status: 'connected', rateLimitRemaining: 2000 } }
  async getAccountInfo() { return { accountId: 'wb_001', accountName: '企业微博', followerCount: 25600, verified: true } }
}

// B站适配器
export class BilibiliAdapter implements EnterpriseChannelAdapter {
  readonly platform = 'bilibili'
  private postCounter = 0

  async connect(accountId?: string): Promise<ConnectResult> {
    return { sessionId: `bv_${Date.now()}`, status: 'connected', accountName: '企业B站' }
  }
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> { return { ok: true } }
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    return { followerCount: 12000, videoCount: 156, totalViews: 980000, totalLikes: 51200, totalComments: 4300, totalShares: 2100, collectedAt: new Date() }
  }
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return [{ commentId: 'bv_1', authorName: '用户', content: '已三连', createdAt: new Date() }]
  }

  async publish(content: ChannelContent): Promise<PublishResult> {
    this.postCounter++
    const id = `bv_${Date.now()}_${this.postCounter}`
    return { publishId: id, platformPostId: id, url: `https://www.bilibili.com/video/${id}`, publishedAt: new Date(), status: 'success' }
  }
  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return { publishId: `bv_sched_${Date.now()}`, publishedAt: scheduledTime, status: 'pending' }
  }
  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    const comments = ['太专业了', '已三连', '求更新', '企业版能试用吗？', '码住']
    return comments.map((c, i) => ({ platformUserId: `bv_user_${i}`, type: i < 3 ? 'like' : 'comment', content: c, timestamp: new Date() }))
  }
  async reply(interactionId: string, message: string): Promise<boolean> { return true }
  async healthCheck(): Promise<ChannelHealth> { return { platform: 'bilibili', status: 'connected', rateLimitRemaining: 800 } }
  async getAccountInfo() { return { accountId: 'bv_001', accountName: '企业B站', followerCount: 12000, verified: true } }
}

// QQ适配器
export class QQAdapter implements EnterpriseChannelAdapter {
  readonly platform = 'qq'
  private postCounter = 0

  async connect(accountId?: string): Promise<ConnectResult> {
    return { sessionId: `qq_${Date.now()}`, status: 'connected', accountName: '企业QQ' }
  }
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> { return { ok: true } }
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    return { followerCount: 6800, videoCount: 45, totalViews: 260000, totalLikes: 13800, totalComments: 1100, totalShares: 480, collectedAt: new Date() }
  }
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return [{ commentId: 'qq_1', authorName: '用户', content: '加群讨论', createdAt: new Date() }]
  }

  async publish(content: ChannelContent): Promise<PublishResult> {
    this.postCounter++
    const id = `qq_${Date.now()}_${this.postCounter}`
    return { publishId: id, platformPostId: id, url: `https://mp.qq.com/p/${id}`, publishedAt: new Date(), status: 'success' }
  }
  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return { publishId: `qq_sched_${Date.now()}`, publishedAt: scheduledTime, status: 'pending' }
  }
  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    const comments = ['加群讨论', '求详细资料', '正好公司要采购']
    return comments.map((c, i) => ({ platformUserId: `qq_user_${i}`, type: i === 2 ? 'message' : 'comment', content: c, timestamp: new Date() }))
  }
  async reply(interactionId: string, message: string): Promise<boolean> { return true }
  async healthCheck(): Promise<ChannelHealth> { return { platform: 'qq', status: 'connected', rateLimitRemaining: 1500 } }
  async getAccountInfo() { return { accountId: 'qq_001', accountName: '企业QQ', followerCount: 6800, verified: false } }
}
