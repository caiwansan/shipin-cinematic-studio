import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P7-GOV — Governance API Routes
 *
 *  - GET  /api/v2/governance/status      — 系统稳定性状态
 *  - GET  /api/v2/governance/policy       — 当前策略
 *  - PUT  /api/v2/governance/policy       — 更新策略
 *  - GET  /api/v2/governance/audit        — 审计日志
 *  - GET  /api/v2/governance/evolution    — 进化守卫统计
 *  - GET  /api/v2/governance/drift        — 漂移告警
 *  - GET  /api/v2/governance/snapshots    — 快照列表
 *  - POST /api/v2/governance/rollback/:id — 回滚到指定快照
 */

import { FastifyInstance } from 'fastify'
import { stabilityController } from '../core/governance/stability-controller.js'
import { policyEngine } from '../core/governance/policy-engine.js'
import { learningAuditLog } from '../core/governance/learning-audit-log.js'
import { evolutionGuard } from '../core/governance/evolution-guard.js'
import { driftDetector } from '../core/governance/drift-detector.js'
import { rollbackManager } from '../core/governance/rollback-manager.js'

export default async function governanceRoutes(app: FastifyInstance) {
  // 系统稳定性状态
  app.get('/api/v2/governance/status', async () => {
    return { success: true, data: stabilityController.report() } satisfies ApiResponse<unknown>;

  })

  // 当前策略
  app.get('/api/v2/governance/policy', async () => {
    return { success: true, data: policyEngine.getPolicy() } satisfies ApiResponse<unknown>;

  })

  // 更新策略
  app.put('/api/v2/governance/policy', async (request: any, reply) => {
    const updates = request.body
    if (!updates || Object.keys(updates).length === 0) {
      return reply.status(400).send({ success: false, error: '需要策略更新数据' })
    }
    policyEngine.updatePolicy(updates)
    return { success: true, data: policyEngine.getPolicy() } satisfies ApiResponse<unknown>;

  })

  // 审计日志
  app.get('/api/v2/governance/audit', async (request: any) => {
    const { type, approved, limit } = request.query
    const entries = learningAuditLog.query({ type, approved: approved !== undefined ? approved === 'true' : undefined, limit: limit ? parseInt(limit) : undefined })
    return { success: true, data: { entries, stats: learningAuditLog.getStats() } } satisfies ApiResponse<unknown>;

  })

  // 进化守卫统计
  app.get('/api/v2/governance/evolution', async () => {
    return { success: true, data: evolutionGuard.getStats() } satisfies ApiResponse<unknown>;

  })

  // 漂移告警
  app.get('/api/v2/governance/drift', async () => {
    const alerts = driftDetector.getAlerts()
    const history = driftDetector.getHistory()
    return { success: true, data: { alerts, history } } satisfies ApiResponse<unknown>;

  })

  // 快照列表
  app.get('/api/v2/governance/snapshots', async () => {
    return { success: true, data: { snapshots: rollbackManager.getSnapshots() } } satisfies ApiResponse<unknown>;

  })

  // 回滚到指定快照
  app.post('/api/v2/governance/rollback/:snapshotId', async (request: any, reply) => {
    const snapshotId = request.params.snapshotId
    const snapshot = await rollbackManager.rollback(snapshotId)
    if (!snapshot) {
      return reply.status(404).send({ success: false, error: '快照不存在' })
    }
    return { success: true, data: snapshot } satisfies ApiResponse<unknown>;

  })
}
