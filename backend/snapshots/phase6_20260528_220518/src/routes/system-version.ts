/**
 * routes/system-version.ts — P3-lite: Build Version Consistency
 *
 * 后端版本端点，供前端启动时校验版本一致性。
 * 版本格式：${buildTime}-${buildId}
 */

import { FastifyInstance } from 'fastify'

const BUILD_ID = `build-${Date.now()}-${process.pid}`
const BUILD_TIME = new Date().toISOString()

export default async function systemVersionRoutes(fastify: FastifyInstance) {
  // GET /api/system/version — 无认证（前端启动时需要先于任何登录请求）
  fastify.get('/api/system/version', async (_request, _reply) => {
    return {
      version: `${BUILD_TIME}-${BUILD_ID}`,
      buildTime: BUILD_TIME,
      buildId: BUILD_ID,
    }
  })
}
