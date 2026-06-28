/**
 * routes/admin-customer-service.ts — 后台客服管理路由
 *
 * GET    /api/admin/customer-service/settings         — 获取客服配置
 * PUT    /api/admin/customer-service/settings         — 保存客服配置
 * GET    /api/admin/customer-service/sessions         — 获取用户对话列表
 * GET    /api/admin/customer-service/sessions/:id     — 获取单条对话详情
 */

import { FastifyInstance } from 'fastify'
import { prisma, getRouteConfig, setRouteConfig } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

const CONFIG_KEY = 'route:admin-customer-service'

interface CustomerServiceSettings {
  enabled: boolean
  type: string
  workHours: string
  contact: string
}

interface FaqEntry {
  question: string
  answer: string
}

interface AgentEntry {
  name: string
  email: string
}

export default async function adminCustomerServiceRoutes(fastify: FastifyInstance) {
  // GET 客服配置
  fastify.get('/api/admin/customer-service/settings', { preHandler: [requireAdmin] }, async () => {
    const settings = await getRouteConfig<CustomerServiceSettings>(CONFIG_KEY, 'settings', {
      enabled: true,
      type: 'hybrid',
      workHours: '09:00-22:00',
      contact: '400-888-8888',
    })

    const faqs = await getRouteConfig<FaqEntry[]>(CONFIG_KEY, 'faqs', [
      { question: '如何升级 VIP 会员？', answer: '前往「设置 - 会员中心」选择相应套餐进行升级，支持微信/支付宝支付。' },
      { question: '视频生成速度如何？', answer: '普通用户约 3-5 分钟，VIP 用户优先处理约 1-2 分钟。' },
      { question: '支持哪些导出格式？', answer: '支持 720P、1080P、4K 分辨率导出，格式为 MP4。' },
      { question: '如何联系人工客服？', answer: '工作时间 09:00-22:00 内，点击右下角客服图标即可与客服对话。' },
    ])

    const agents = await getRouteConfig<AgentEntry[]>(CONFIG_KEY, 'agents', [
      { name: '小美', email: 'xiaomei@example.com' },
      { name: '小帅', email: 'xiaoshuai@example.com' },
    ])

    const deepseekApiKey = await getRouteConfig<string>(CONFIG_KEY, 'deepseekApiKey', '')

    return { success: true, settings, faqs, agents, deepseekApiKey }
  })

  // PUT 保存客服配置
  fastify.put('/api/admin/customer-service/settings', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any

    if (body.settings) {
      await setRouteConfig(CONFIG_KEY, 'settings', body.settings)
    }
    if (body.faqs !== undefined) {
      await setRouteConfig(CONFIG_KEY, 'faqs', body.faqs)
    }
    if (body.agents !== undefined) {
      await setRouteConfig(CONFIG_KEY, 'agents', body.agents)
    }
    // 保存 DeepSeek API Key（放到独立 key 下，避免与 settings 混在一起）
    if (body.deepseekApiKey !== undefined) {
      await setRouteConfig(CONFIG_KEY, 'deepseekApiKey', body.deepseekApiKey)
    }

    return { success: true }
  })

  // GET 用户对话列表
  fastify.get('/api/admin/customer-service/sessions', { preHandler: [requireAdmin] }, async () => {
    const sessions = await prisma.customerChatSession.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 3, // 取前几条做预览
        },
        user: {
          select: { id: true, nickName: true, phone: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return {
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        nickName: (s.user as any)?.nickName || '匿名用户',
        phone: (s.user as any)?.phone || '',
        status: s.status,
        messageCount: s.messages.length,
        preview: s.messages.slice(-1)[0]?.content?.slice(0, 80) || '',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    }
  })

  // GET 单条对话详情
  fastify.get<{ Params: { id: string } }>('/api/admin/customer-service/sessions/:id', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params

    const session = await prisma.customerChatSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: {
          select: { id: true, nickName: true, phone: true, avatar: true },
        },
      },
    })

    if (!session) {
      return { success: false, error: '对话不存在' }
    }

    return {
      success: true,
      session: {
        id: session.id,
        userId: session.userId,
        nickName: (session.user as any)?.nickName || '匿名用户',
        phone: (session.user as any)?.phone || '',
        avatar: (session.user as any)?.avatar || '',
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      },
    }
  })
}
