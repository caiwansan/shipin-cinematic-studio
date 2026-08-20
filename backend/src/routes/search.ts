// 搜索路由 — Search Routes
// 功能：用户搜索、帖子搜索、家族搜索、城市搜索

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function searchRoutes(fastify: FastifyInstance) {
  // GET /api/search — 综合搜索
  fastify.get('/api/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { q?: string; type?: string; limit?: string; offset?: string }
    const q = query.q?.trim()
    if (!q) return reply.status(400).send({ success: false, error: '搜索词不能为空' })
    const searchType = query.type || 'all'
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)))
    const offset = Math.max(0, Number(query.offset || 0))
    const userUid = request.user.id

    const result: any = { query: q, type: searchType }

    // 用户搜索
    if (searchType === 'all' || searchType === 'user') {
      const users = await prisma.$queryRawUnsafe(
        `SELECT id, nickname, username, avatar_url, member_tier FROM "User" WHERE nickname ILIKE $1 OR username ILIKE $2 LIMIT $3 OFFSET $4`,
        `%${q}%`, `%${q}%`, limit, offset
      )
      result.users = users
    }

    // 社区帖子搜索
    if (searchType === 'all' || searchType === 'post') {
      const posts = await prisma.$queryRawUnsafe(
        `SELECT id, title, content, user_id, created_at FROM community_post WHERE title ILIKE $1 OR content ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        `%${q}%`, `%${q}%`, limit, offset
      )
      result.posts = posts
    }

    // 茶馆帖子搜索
    if (searchType === 'all' || searchType === 'tea') {
      const teaPosts = await prisma.$queryRawUnsafe(
        `SELECT id, content, uid, created_at FROM tea_post WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        `%${q}%`, limit, offset
      )
      result.teaPosts = teaPosts
    }

    // 城市空间搜索
    if (searchType === 'all' || searchType === 'city') {
      const cities = await prisma.$queryRawUnsafe(
        `SELECT * FROM city WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        `%${q}%`, limit, offset
      )
      result.cities = cities
    }

    // 记录搜索历史
    await prisma.$queryRawUnsafe(
      `INSERT INTO search_history (user_uid, query, search_type) VALUES ($1, $2, $3)`,
      userUid, q, searchType
    )

    return { success: true, data: result }
  })

  // GET /api/search/history — 搜索历史
  fastify.get('/api/search/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const history = await prisma.$queryRawUnsafe(
      `SELECT * FROM search_history WHERE user_uid = $1 ORDER BY created_at DESC LIMIT 20`, userUid
    )
    return { success: true, data: { history } }
  })

  // DELETE /api/search/history — 清除搜索历史
  fastify.delete('/api/search/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    await prisma.$queryRawUnsafe(`DELETE FROM search_history WHERE user_uid = $1`, userUid)
    return { success: true }
  })
}
