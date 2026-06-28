/**
 * admin-prompt-runtime.ts — Phase 4-A Prompt Runtime OS 管理路由
 *
 * 职责：
 * 1. 版本管理：查看版本链、切换 label、注册新版本
 * 2. 日志查询：查看 runtime 日志、统计
 * 3. 观测模式：所有操作显式
 *
 * @phase-4a
 */

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { getStableVersion, getAllVersions, getVersion, registerVersion, setVersionLabel, invalidateVersionCache } from '../runtime/prompt/PromptVersionGraph.js'
import { getRecentLogs, getPromptStats } from '../runtime/prompt/PromptRuntimeLogger.js'
import { getPrompt } from '../runtime/prompt/PromptRegistry.js'

export default async function adminPromptRuntimeRoutes(app: FastifyInstance) {
  // ─── 版本管理 ───

  // 获取所有版本
  app.get('/api/admin/prompt-runtime/versions/:name', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name } = req.params
    const versions = await getAllVersions(name)
    return reply.send({ success: true, data: versions })
  })

  // 获取稳定版本
  app.get('/api/admin/prompt-runtime/stable/:name', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name } = req.params
    const version = await getStableVersion(name)
    return reply.send({ success: true, data: { name, stableVersion: version } })
  })

  // 手动切换版本 label
  app.post('/api/admin/prompt-runtime/set-label', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name, version, label } = req.body as any
    if (!name || !version || !label) {
      return reply.status(400).send({ success: false, error: '缺少参数 name/version/label' })
    }
    if (!['stable', 'deprecated', 'override'].includes(label)) {
      return reply.status(400).send({ success: false, error: 'label 必须是 stable/deprecated/override' })
    }
    await setVersionLabel(name, version, label)
    invalidateVersionCache(name)
    return reply.send({ success: true })
  })

  // 注册新版本
  app.post('/api/admin/prompt-runtime/register', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name, version, label, description, parentVersion } = req.body as any
    if (!name || !version) {
      return reply.status(400).send({ success: false, error: '缺少参数 name/version' })
    }
    await registerVersion({ name, version, label, description, parentVersion })
    return reply.send({ success: true })
  })

  // 预览某版本的 prompt 内容
  app.get('/api/admin/prompt-runtime/preview/:name/:version', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name, version } = req.params
    const node = await getVersion(name, version)
    if (!node) {
      return reply.status(404).send({ success: false, error: '版本不存在' })
    }
    return reply.send({ success: true, data: node })
  })

  // ─── 日志查询 ───

  // 获取最近日志
  app.get('/api/admin/prompt-runtime/logs', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const limit = Math.min(Number((req.query as any).limit) || 100, 500)
    const logs = await getRecentLogs(limit)
    return reply.send({ success: true, data: logs, total: logs.length })
  })

  // 获取某 prompt 的统计
  app.get('/api/admin/prompt-runtime/stats/:name', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name } = req.params
    const stats = await getPromptStats(name)
    return reply.send({ success: true, data: stats })
  })
}
