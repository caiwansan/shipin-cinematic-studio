/**
 * Replay Engine API — 回放/时间轴/差异分析端点
 */

import { FastifyInstance } from 'fastify'
import {
  queryReplayFrames,
  queryRecentReplayFrames,
  getReplayFrameAtTime,
  computeReplayDiff,
} from './replay-engine.js'

export async function registerReplayRoutes(app: FastifyInstance) {
  // 时间范围回放（前端时间轴的主要数据源）
  app.get('/api/replay/frames', async (request) => {
    const query = request.query as any
    const startTime = parseInt(query.start || '0')
    const endTime = parseInt(query.end || Date.now().toString())
    const limit = parseInt(query.limit || '500')

    const frames = await queryReplayFrames(startTime, endTime, limit)
    return {
      frames,
      count: frames.length,
      timeRange: { start: startTime, end: endTime },
    }
  })

  // 最近的帧
  app.get('/api/replay/frames/recent', async (request) => {
    const query = request.query as any
    const limit = parseInt(query.limit || '100')
    const frames = await queryRecentReplayFrames(limit)
    return { frames, count: frames.length }
  })

  // 单个时间点的帧（回放拖动时定帧）
  app.get('/api/replay/frame', async (request) => {
    const query = request.query as any
    const t = parseInt(query.t || Date.now().toString())
    const frame = await getReplayFrameAtTime(t)
    return frame ? { frame } : { frame: null, error: 'No frame at this time' }
  })

  // A/B 差异分析
  app.get('/api/replay/diff', async (request) => {
    const query = request.query as any
    const timeA = parseInt(query.a || '0')
    const timeB = parseInt(query.b || Date.now().toString())

    if (!timeA || !timeB) {
      return { error: 'Required: ?a=<timestamp>&b=<timestamp>' }
    }

    const diff = await computeReplayDiff(timeA, timeB)
    return diff
  })
}
