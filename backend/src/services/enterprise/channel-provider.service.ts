/**
 * channel-provider.service.ts — 渠道提供商注册中心
 * Sprint 4.2.9 Phase 4.5
 *
 * 统一管理所有新媒体渠道类型
 * 新渠道只需 INSERT 数据，不改代码
 */
import { prisma } from '../../utils/index.js'

export interface ChannelProvider {
  id: string
  name: string        // wechat_work, douyin, kuaishou, weibo...
  displayName: string // 企业微信, 抖音, 快手, 微博...
  category: string    // content | customer | service
  capabilities: string[]
  icon: string
  status: string
  createdAt: string
}

export class ChannelProviderService {

  /**
   * 获取所有活跃渠道路由
   */
  async listActive(): Promise<ChannelProvider[]> {
    const rows = await prisma.enterpriseChannelProvider.findMany({
      where: { status: 'active' },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    })
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      category: r.category,
      capabilities: r.capabilities as string[],
      icon: r.icon,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  /**
   * 按分类获取
   */
  async listByCategory(category: string): Promise<ChannelProvider[]> {
    const rows = await prisma.enterpriseChannelProvider.findMany({
      where: { category, status: 'active' },
      orderBy: { displayName: 'asc' },
    })
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      category: r.category,
      capabilities: r.capabilities as string[],
      icon: r.icon,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  /**
   * 注册新渠道（INSERT 即扩展）
   */
  async register(data: {
    name: string
    displayName: string
    category?: string
    capabilities?: string[]
    icon?: string
  }) {
    return prisma.enterpriseChannelProvider.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        category: data.category || 'content',
        capabilities: data.capabilities || ['read'],
        icon: data.icon || '📱',
      },
    })
  }

  /**
   * 批量初始化中国新媒体渠道路由
   */
  async seedProviders() {
    const providers = [
      // Customer Communication
      { name: 'wechat_work', displayName: '企业微信', category: 'customer', capabilities: ['read', 'reply', 'createTask', 'followup'], icon: '💼' },
      { name: 'wechat_official', displayName: '微信公众号', category: 'customer', capabilities: ['read', 'reply', 'createTicket'], icon: '📢' },
      { name: 'website_chat', displayName: '官网客服', category: 'customer', capabilities: ['read', 'reply', 'createTicket'], icon: '🌐' },
      // Content Platforms
      { name: 'wechat_video', displayName: '视频号', category: 'content', capabilities: ['publish', 'analyze', 'schedule'], icon: '🎬' },
      { name: 'douyin', displayName: '抖音', category: 'content', capabilities: ['publish', 'analyze', 'schedule', 'comment'], icon: '🎵' },
      { name: 'kuaishou', displayName: '快手', category: 'content', capabilities: ['publish', 'analyze', 'schedule'], icon: '⚡' },
      { name: 'xiaohongshu', displayName: '小红书', category: 'content', capabilities: ['publish', 'analyze', 'schedule', 'comment'], icon: '📕' },
      { name: 'weibo', displayName: '微博', category: 'content', capabilities: ['publish', 'analyze', 'schedule', 'comment'], icon: '📣' },
      { name: 'bilibili', displayName: 'B站', category: 'content', capabilities: ['publish', 'analyze', 'schedule', 'comment'], icon: '📺' },
      { name: 'toutiao', displayName: '今日头条', category: 'content', capabilities: ['publish', 'analyze'], icon: '📰' },
      { name: 'baijiahao', displayName: '百家号', category: 'content', capabilities: ['publish', 'analyze'], icon: '🔵' },
      { name: 'haokan', displayName: '好看视频', category: 'content', capabilities: ['publish', 'analyze'], icon: '🎥' },
      { name: 'qiehao', displayName: '企鹅号', category: 'content', capabilities: ['publish', 'analyze'], icon: '🐧' },
    ]

    for (const p of providers) {
      await prisma.enterpriseChannelProvider.upsert({
        where: { name: p.name },
        update: { displayName: p.displayName, category: p.category, capabilities: p.capabilities, icon: p.icon },
        create: p,
      })
    }
    return providers.length
  }
}

export const channelProviderService = new ChannelProviderService()
