import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P5 — Cluster API Routes
 *
 *  - GET  /api/v2/cluster/status       — 集群状态
 *  - POST /api/v2/cluster/node/register — 注册远程节点
 *  - POST /api/v2/cluster/node/fail     — 模拟节点故障
 *  - GET  /api/v2/cluster/migrations    — 迁移记录
 *  - POST /api/v2/cluster/reconcile     — 触发一致性检查
 */

import { FastifyInstance } from 'fastify'
import { clusterManager } from '../core/cluster/cluster-manager.js'
import { taskMigrator } from '../core/cluster/task-migrator.js'
import { consistencyManager } from '../core/cluster/consistency-manager.js'
import { distributedScheduler } from '../core/cluster/distributed-scheduler.js'

export default async function clusterRoutes(app: FastifyInstance) {
  // 集群状态
  app.get('/api/v2/cluster/status', async () => {
    return {
      success: true,
      data: clusterManager.getStatus(),
    }
  })

  // 注册远程节点
  app.post('/api/v2/cluster/node/register', async (request: any, reply) => {
    const { nodeId, name, host, port, capabilities } = request.body
    if (!nodeId || !host) {
      return reply.status(400).send({ success: false, error: '需要 nodeId 和 host' })
    }

    clusterManager.registerRemoteNode(nodeId, name || nodeId, host, port || 4002, capabilities)
    return { success: true, data: { nodeId, registered: true } } satisfies ApiResponse<unknown>;

  })

  // 模拟节点故障
  app.post('/api/v2/cluster/node/fail', async (request: any, reply) => {
    const { nodeId } = request.body
    if (!nodeId) {
      return reply.status(400).send({ success: false, error: '需要 nodeId' })
    }

    clusterManager.simulateNodeFailure(nodeId)
    await taskMigrator.migrateAllFromNode(nodeId)

    return { success: true, data: { nodeId, failed: true, migrated: true } } satisfies ApiResponse<unknown>;

  })

  // 迁移记录
  app.get('/api/v2/cluster/migrations', async () => {
    return {
      success: true,
      data: { migrations: taskMigrator.getMigrations() },
    }
  })

  // 一致性检查
  app.post('/api/v2/cluster/reconcile', async () => {
    const report = await consistencyManager.reconcile()
    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })

  // 调度记录
  app.get('/api/v2/cluster/scheduled', async () => {
    return {
      success: true,
      data: { tasks: distributedScheduler.getScheduledTasks() },
    }
  })
}
