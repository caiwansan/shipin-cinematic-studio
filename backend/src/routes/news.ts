// 行业热点路由 — News Routes
// 功能：新闻列表、行业设置、手动抓取

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function newsRoutes(fastify: FastifyInstance) {
  // GET /api/news — 新闻列表
  fastify.get('/api/news', async (request, reply) => {
    const query = request.query as { day?: string; industry?: string; limit?: string; offset?: string }
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)))
    const offset = Math.max(0, Number(query.offset || 0))
    const where: string[] = []
    const params: any[] = []
    if (query.day) { params.push(query.day); where.push(`day = $${params.length}`) }
    if (query.industry) { params.push(query.industry); where.push(`industry = $${params.length}`) }
    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : ''
    params.push(limit, offset)
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM news_item ${whereStr} ORDER BY day DESC, score DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params
    )
    return { success: true, data: { items } }
  })

  // GET /api/news/settings — 行业设置
  fastify.get('/api/news/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const settings = await prisma.$queryRawUnsafe(
      `SELECT * FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    if (!settings.length) return { success: true, data: { industries: [], autoFetch: true } }
    let profileData: any = {}
    try { profileData = JSON.parse(settings[0].profile_data || '{}') } catch { }
    return { success: true, data: profileData.news || { industries: [], autoFetch: true } }
  })

  // POST /api/news/settings — 保存行业设置
  fastify.post('/api/news/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const { industries, autoFetch } = request.body as any
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    const newsData = { industries: industries || [], autoFetch: autoFetch !== false }
    if (existing.length) {
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET profile_data = $1, updated_at = NOW() WHERE id = $2`,
        JSON.stringify({ news: newsData }), existing[0].id
      )
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_setting (user_uid, profile_data) VALUES ($1, $2)`,
        userUid, JSON.stringify({ news: newsData })
      )
    }
    return { success: true, data: newsData }
  })

  // POST /api/news/fetch — 手动抓取（触发后端抓取任务）
  fastify.post('/api/news/fetch', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { industry } = request.body as any
    // 这里触发异步抓取任务，简化版直接返回成功
    return { success: true, data: { message: '抓取任务已触发', industry: industry || 'all' } }
  })

  // GET /api/news/industries — 获取所有行业列表
  fastify.get('/api/news/industries', async (request, reply) => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT industry FROM news_item ORDER BY industry`
    ) as any[]
    return { success: true, data: { industries: rows.map((r: any) => r.industry) } }
  })
}
