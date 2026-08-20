// ============================================================
// RC-D1-004: Workspace Mission Control Route
//
// Workspace 不再以功能菜单为中心
// 用户进入 GEO → Mission Control 首页
// ============================================================

import { FastifyInstance } from 'fastify'
import { getMissionControl } from './mission-control'

export async function workspaceRoutes(app: FastifyInstance) {
  // Mission Control — GEO 首页
  app.get('/api/geo/workspace/mission-control', { preHandler: [] }, async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    const user = req.user as any
    const userId = user?.id  // May be undefined for public access
    const control = await getMissionControl(projectId, userId)
    return { success: true, data: control }
  })
}
