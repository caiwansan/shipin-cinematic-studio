/**
 * routes/health.ts — 生产环境健康检查 + 监控端点
 *
 * 提供 Kubernetes 风格的探针、系统状态摘要、错误率追踪。
 * Phase 3: 生产环境加固
 */

import { FastifyInstance } from 'fastify'
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { prisma } from '../utils/index.js'

/** 内存使用（MB） */
function getMemoryUsage() {
  const mem = process.memoryUsage()
  return {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  }
}

/** CPU 负载 */
function getCpuLoad() {
  try {
    const out = execSync("cat /proc/loadavg | awk '{print $1,$2,$3}'", { encoding: 'utf-8', timeout: 2000 })
    const parts = out.trim().split(' ')
    return { '1m': parseFloat(parts[0]), '5m': parseFloat(parts[1]), '15m': parseFloat(parts[2]) }
  } catch {
    return { '1m': 0, '5m': 0, '15m': 0 }
  }
}

/** 磁盘使用率 */
function getDiskUsage() {
  try {
    const out = execSync("df -h / | tail -1 | awk '{print $5,$3,$4}'", { encoding: 'utf-8', timeout: 2000 })
    const parts = out.trim().split(' ')
    return { usedPercent: parts[0], used: parts[1], available: parts[2] }
  } catch {
    return { usedPercent: 'unknown', used: 'unknown', available: 'unknown' }
  }
}

/** PG 连接状态 */
let lastPgCheck = 0
let pgStatus = 'unknown'
async function checkPgConnection() {
  const now = Date.now()
  if (now - lastPgCheck < 10000) return pgStatus
  lastPgCheck = now
  try {
    const { prisma } = await import('../utils/index.js')
    await prisma.$queryRaw`SELECT 1`
    pgStatus = 'healthy'
  } catch {
    pgStatus = 'unhealthy'
  }
  return pgStatus
}

/** 错误日志统计 */
function getErrorStats(): { lastHour: number; totalBytes: number } {
  const pm2Dir = '/root/.pm2/logs'
  const oneHourAgo = Date.now() - 3600000
  let lastHour = 0
  let totalBytes = 0
  try {
    const files = readdirSync(pm2Dir).filter(f => f.includes('error'))
    for (const f of files) {
      try {
        const fp = join(pm2Dir, f)
        const st = statSync(fp)
        totalBytes += st.size
        if (st.mtimeMs > oneHourAgo) lastHour++
      } catch {}
    }
  } catch {}
  return { lastHour, totalBytes }
}

export default async function healthRoutes(fastify: FastifyInstance) {

  // GET /healthz — K8s 存活探针
  fastify.get('/healthz', async (_request, reply) => {
    const pgOk = (await checkPgConnection()) === 'healthy'
    if (!pgOk) {
      return reply.status(503).send({ status: 'unhealthy', database: pgOk })
    }
    reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // GET /health — Nginx health-check 兼容（与 /healthz 同语义）
  fastify.get('/health', async (_request, reply) => {
    const pgOk = (await checkPgConnection()) === 'healthy'
    if (!pgOk) {
      return reply.status(503).send({ status: 'unhealthy', database: pgOk })
    }
    reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // GET /readyz — K8s 就绪探针
  fastify.get('/readyz', async (_request, reply) => {
    const pgOk = (await checkPgConnection()) === 'healthy'
    reply.send({ status: pgOk ? 'ready' : 'not ready', database: pgOk })
  })

  // GET /api/system/status — 详细系统状态
  fastify.get('/api/system/status', async (_request, reply) => {
    const mem = getMemoryUsage()
    const cpu = getCpuLoad()
    const disk = getDiskUsage()
    const pgHealthy = await checkPgConnection()
    const errors = getErrorStats()

    reply.send({
      status: pgHealthy === 'healthy' ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.versions.node,
      uptime: Math.floor(process.uptime()),
      memory: mem,
      cpu,
      disk,
      database: pgHealthy,
      errors,
      apiInstances: 6,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/system/error-log — 最近错误日志摘要
  fastify.get('/api/system/error-log', async (_request, reply) => {
    const pm2Dir = '/root/.pm2/logs'
    const errors: { file: string; lines: number; updated: string }[] = []
    try {
      const files = readdirSync(pm2Dir)
        .filter(f => f.includes('error') && f.endsWith('.log'))
        .slice(0, 20)
      for (const f of files) {
        const fp = join(pm2Dir, f)
        const st = statSync(fp)
        const content = readFileSync(fp, 'utf-8')
        const lines = content.split('\n').length
        if (lines > 0) {
          // 只取最后一行错误
          const lastLine = content.trim().split('\n').pop() || ''
          errors.push({
            file: f,
            lines,
            updated: st.mtime.toISOString(),
            lastError: lastLine.substring(0, 200),
          })
        }
      }
    } catch {}
    // 按行数降序排列显示
    errors.sort((a, b) => b.lines - a.lines)
    reply.send({ success: true, totalFiles: errors.length, errors: errors.slice(0, 20) })
  })

  // POST /api/system/error-log/clear — 清理错误日志
  fastify.post('/api/system/error-log/clear', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const pm2Dir = '/root/.pm2/logs'
    try {
      const files = readdirSync(pm2Dir).filter(f => f.includes('error') && f.endsWith('.log'))
      let cleared = 0
      const { execSync } = await import('child_process')
      for (const f of files) {
        try {
          execSync(`> "${pm2Dir}/${f}"`, { timeout: 1000 })
          cleared++
        } catch {}
      }
      reply.send({ success: true, clearedCount: cleared })
    } catch (e: any) {
      reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/system/pm2/restart — 重启单个 API 实例
  fastify.post('/api/system/pm2/restart', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { instanceId } = request.body as any
    if (instanceId === undefined) {
      return reply.status(400).send({ success: false, error: '缺少 instanceId' })
    }
    try {
      const { execSync } = await import('child_process')
      execSync(`pm2 restart ${instanceId}`, { timeout: 10000 })
      reply.send({ success: true, message: `实例 ${instanceId} 已重启` })
    } catch (e: any) {
      reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/providers/health — Check video provider readiness for current user
  fastify.get('/api/providers/health', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.send({ success: true, data: { system: { ready: false, reason: '未登录' } } })
    }
    try {
      const config = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      const hasVideoKey = !!(config?.videoApiKey)
      const provider = config?.videoProvider || 'not_configured'
      const model = config?.videoModel || ''
      reply.send({
        success: true,
        data: {
          video: {
            provider,
            model,
            hasKey: hasVideoKey,
            ready: hasVideoKey,
          },
          llm: {
            provider: config?.llmProvider || '',
            hasKey: !!(config?.llmApiKey),
            ready: !!(config?.llmApiKey),
          },
        },
      })
    } catch (e: any) {
      reply.status(500).send({ success: false, error: e.message })
    }
  })
}
