/**
 * routes/style-profiles.ts — 视觉风格配置档案 API
 *
 * GET    /api/v1/style-profiles         — 获取所有风格
 * GET    /api/v1/style-profiles/:name   — 获取单个风格
 * POST   /api/v1/style-profiles         — 创建（管理端）
 * PUT    /api/v1/style-profiles/:name   — 更新
 * DELETE /api/v1/style-profiles/:name   — 删除
 */

import { FastifyInstance } from 'fastify'
import { StyleProfileService } from '../services/style-profile.service.js'

export default async function styleProfileRoutes(fastify: FastifyInstance) {
  // 获取所有风格
  fastify.get('/api/v1/style-profiles', async () => {
    const profiles = await StyleProfileService.getAll()
    return { success: true, data: profiles }
  })

  // 获取单个风格
  fastify.get<{ Params: { name: string } }>('/api/v1/style-profiles/:name', async (request) => {
    const profile = await StyleProfileService.getByName(request.params.name)
    if (!profile) return { success: false, error: '风格不存在' }
    return { success: true, data: profile }
  })

  // 创建风格
  fastify.post('/api/v1/style-profiles', async (request) => {
    const body = request.body as any
    if (!body.name || !body.displayName) {
      return { success: false, error: 'name 和 displayName 必填' }
    }
    const profile = await StyleProfileService.create(body)
    return { success: true, data: profile }
  })

  // 更新风格
  fastify.put<{ Params: { name: string } }>('/api/v1/style-profiles/:name', async (request) => {
    const body = request.body as any
    const profile = await StyleProfileService.update(request.params.name, body)
    if (!profile) return { success: false, error: '风格不存在' }
    return { success: true, data: profile }
  })

  // 删除风格
  fastify.delete<{ Params: { name: string } }>('/api/v1/style-profiles/:name', async (request) => {
    const ok = await StyleProfileService.delete(request.params.name)
    return { success: ok, error: ok ? undefined : '删除失败' }
  })
}
