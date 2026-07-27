/**
 * Media Platform Standalone Server — BETA-06.6 Phase 3.1
 * 
 * 独立服务器，仅服务于新媒体运营部门 API
 * 避免预存代码问题阻塞核心功能验证
 * 
 * 运行：node --import tsx media-server.ts
 */

import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { registerMediaPlatformRoutes } from './src/routes/media-platform.js'

const PORT = 4003  // 独立端口避免冲突
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production'

async function main() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  })

  // JWT 认证
  await app.register(jwt, { secret: JWT_SECRET })

  // 认证装饰器（内联实现）
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }
  })

  // 健康检查（无认证）
  app.get('/health', async () => ({
    status: 'ok',
    service: 'media-platform',
    timestamp: new Date().toISOString(),
  }))

  // 测试 Token 生成（开发用）
  app.get('/gate1/test-token', async () => {
    const token = app.jwt.sign({ id: 'demo-user', email: 'demo@test.com', organizationId: 'demo-org-001' })
    return { code: 0, data: { token } }
  })

  // Gate 1: Browser Health 验证端点（无认证，独立路由）
  app.get('/gate1/browser-health', async () => {
    const { browserRuntime } = await import('./src/services/media/browser-runtime.service.js')
    const health = await browserRuntime.healthCheck()
    return { code: 0, data: { ...health, gate: 'gate1-browser-runtime', timestamp: new Date().toISOString() } }
  })

  // 注册媒体平台路由
  // FIX 2026-07-23: 移除重复注册，主服务器 index.ts 已注册
  // await app.register(registerMediaPlatformRoutes, { prefix: '/api/enterprise/media-department' })

  // 启动
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n🚀 Media Platform Server running on port ${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   API:    http://localhost:${PORT}/api/enterprise/media-department/media/*\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
