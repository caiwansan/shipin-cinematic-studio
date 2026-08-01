/**
 * Phase 3: Growth Execution Layer
 * Mock Channel Adapter — 开发测试用
 *
 * 模拟微信公众号/抖音/小红书的行为，不实际调用外部API。
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
} from '../channel/channel.adapter.js'

/**
 * Phase 3: Growth Execution Layer
 * Mock Channel Adapter — 开发测试用
 *
 * 模拟微信公众号/抖音/小红书的行为，不实际调用外部API。
 * ⚠️ SPRINT-MEDIA-CHANNEL-01 Task02: deprecated（仅开发/测试用），
 * 生产链路必须使用真实 Adapter（DouyinBrowserAdapter）。
 */
export class MockChannelAdapter implements EnterpriseChannelAdapter {
  readonly platform: string
  private connected = true
  private postCounter = 0

  constructor(platform: string) {
    this.platform = platform
  }

  // ─── v1.0 冻结方法（stub：仅开发测试用，生产禁止） ───

  async connect(accountId?: string): Promise<ConnectResult> {
    return { sessionId: `mock_${Date.now()}`, status: 'connected', accountName: `${this.platform}测试账号` }
  }

  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> {
    return { ok: true }
  }

  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    return {
      followerCount: 12580,
      videoCount: 42,
      totalViews: 892300,
      totalLikes: 45210,
      totalComments: 3120,
      totalShares: 1880,
      collectedAt: new Date(),
    }
  }

  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return [
      { commentId: 'mock_1', authorName: '用户1', content: '这个产品怎么购买？', createdAt: new Date() },
      { commentId: 'mock_2', authorName: '用户2', content: '非常感兴趣，请联系我', createdAt: new Date() },
    ]
  }

  async publish(content: ChannelContent): Promise<PublishResult> {
    this.postCounter++
    const platformPostId = `mock_${this.platform}_${Date.now()}_${this.postCounter}`
    return {
      publishId: platformPostId,
      platformPostId,
      url: `https://mock.${this.platform}.com/post/${platformPostId}`,
      publishedAt: new Date(),
      status: 'success',
    }
  }

  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    this.postCounter++
    return {
      publishId: `scheduled_${this.postCounter}`,
      publishedAt: scheduledTime,
      status: 'pending',
    }
  }

  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    // 模拟互动数据
    const types = ['like', 'comment', 'share', 'message', 'follow'] as const
    const comments = [
      '这个产品怎么购买？',
      '价格是多少？',
      '非常感兴趣，请联系我',
      '写的不错',
      '有试用版吗？',
      '我们正好有这个需求',
    ]

    const interactions: PlatformInteraction[] = []
    for (let i = 0; i < 5; i++) {
      const type = types[i % types.length]
      interactions.push({
        platformUserId: `user_${this.platform}_${Date.now()}_${i}`,
        type,
        content: type === 'comment' || type === 'message' ? comments[i % comments.length] : '',
        timestamp: new Date(),
      })
    }
    return interactions
  }

  async reply(interactionId: string, message: string): Promise<boolean> {
    console.log(`[Mock:${this.platform}] 回复 ${interactionId}: ${message.slice(0, 30)}`)
    return true
  }

  async healthCheck(): Promise<ChannelHealth> {
    return {
      platform: this.platform,
      status: this.connected ? 'connected' : 'error',
      rateLimitRemaining: 1000,
    }
  }

  async getAccountInfo() {
    return {
      accountId: `mock_${this.platform}_account`,
      accountName: `${this.platform}测试账号`,
      followerCount: 12580,
      verified: true,
    }
  }
}
