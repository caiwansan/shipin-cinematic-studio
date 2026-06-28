import type { ApiResponse } from '../contracts/api/base.js';
import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/kernel-causal.ts — Causal Layer API (v1.1)
 *
 * GET  /api/v2/kernel/causal/:eventId      — 获取单个事件的因果链接
 * GET  /api/v2/kernel/trace/:eventId       — 获取因果链回溯
 * GET  /api/v2/kernel/entity-events/:id    — 获取影响某实体的所有事件
 * GET  /api/v2/kernel/replay/:eventId      — 重建到指定 eventId 的状态
 */

import { Router } from 'express'
import { kernel } from '../kernel-v1/kernel.js'

const router = Router()

// 获取单个事件的因果链接
router.get('/causal/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const causal = kernel.getCausal(eventId)
    if (!causal) {
      return res.status(404).json({ error: 'Event not found in causal graph' })
    }
    res.json(causal)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// 获取因果链回溯
router.get('/trace/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const chain = kernel.trace(eventId)
    res.json({ eventId, chain })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// 获取影响某实体的所有事件
router.get('/entity-events/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params
    const links = kernel.getEventsForEntity(entityId)
    res.json({ entityId, events: links })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// 重建到指定 eventId 的状态（reconstruction replay）
router.get('/replay/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const state = await kernel.replayTo(eventId)
    res.json(state)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// v1.2: 获取因果规则列表
router.get('/rules', async (_req, res) => {
  const rules = [
    { name: 'UI_CANNOT_DIRECT_ENTITY_WRITE', description: 'UI cannot directly write EntityGraph' },
    { name: 'SNAPSHOT_IS_READONLY', description: 'Snapshot is read-only context' },
    { name: 'TIMELINE_MUST_REFERENCE_ENTITY', description: 'Timeline must reference at least one entity' },
    { name: 'AGENT_WRITE_MUST_HAVE_REASON', description: 'Agent write must provide a reason' },
    { name: 'ORDER_VALIDATION', description: 'Event chain must maintain causal order' },
  ]
  res.json({ rules })
})

// v1.2: 校验指定事件的因果约束（不阻塞，仅查询）
router.get('/validate/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const link = kernel.getCausal(eventId)
    if (!link) {
      return res.status(404).json({ error: 'Event not found in causal graph' })
    }

    const history = await kernel.stores.eventLog.getByProject('')
    const violations = kernel['causalEngine'].check(
      {
        id: eventId,
        source: link.triggeredBy as any,
        parentEventId: link.parentEventId,
        affectedEntityIds: link.affects.entityIds,
        affectedTimelineIds: link.affects.timelineIds,
      },
      history.map(e => ({ id: e.id, parentEventId: (e as any).payload?.parentEventId })),
    )

    res.json({ eventId, violations, ok: violations.length === 0 })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
