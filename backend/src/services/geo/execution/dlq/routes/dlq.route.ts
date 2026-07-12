// ============================================================
// DLQ HTTP API (RC2-3c)
// ============================================================

import type { Router, Request, Response } from 'express'
import type { DLQService } from '../dlq.service'
import type { DLQQuery } from '../dlq.types'

export function createDLQRoutes(router: Router, dlqService: DLQService): void {
  // GET /api/execution/dlq — 查询 DLQ 记录
  router.get('/api/execution/dlq', async (req: Request, res: Response) => {
    const query: DLQQuery = {
      status: req.query.status as any,
      executionId: req.query.executionId as string,
      provider: req.query.provider as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    }
    const result = await dlqService.query(query)
    res.json(result)
  })

  // GET /api/execution/dlq/:id — 获取单条 DLQ 记录
  router.get('/api/execution/dlq/:id', async (req: Request, res: Response) => {
    const record = await dlqService.findById(req.params.id)
    if (!record) {
      res.status(404).json({ error: 'DLQ record not found' })
      return
    }
    res.json(record)
  })

  // POST /api/execution/dlq/:id/replay — 重放
  router.post('/api/execution/dlq/:id/replay', async (req: Request, res: Response) => {
    const replayedExecutionId = req.body.replayedExecutionId || `replay-${Date.now()}`
    const result = await dlqService.replay(req.params.id, replayedExecutionId)
    res.json({ replayedExecutionId, events: result.events })
  })

  // POST /api/execution/dlq/:id/archive — 归档
  router.post('/api/execution/dlq/:id/archive', async (req: Request, res: Response) => {
    const result = await dlqService.archive(req.params.id)
    res.json({ success: true, events: result.events })
  })

  // POST /api/execution/dlq/archive-execution — 归档整个 execution 的 DLQ
  router.post('/api/execution/dlq/archive-execution', async (req: Request, res: Response) => {
    const { executionId } = req.body
    if (!executionId) {
      res.status(400).json({ error: 'executionId required' })
      return
    }
    const records = await dlqService.findByExecution(executionId)
    for (const r of records) {
      if (r.status === 'pending') {
        await dlqService.archive(r.id)
      }
    }
    res.json({ success: true, archived: records.filter(r => r.status === 'pending').length })
  })
}
