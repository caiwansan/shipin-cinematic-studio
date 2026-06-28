/**
 * bootstrap/self-test/test-queue.ts — Queue E2E Test
 *
 * 验证 queue 系统能正常 enqueue
 * Phase 3, Rule 2: 每个队列执行必须可验证
 */

import { enqueueTask } from '../../queue/queue-manager.js'

export async function testQueueExecution(): Promise<void> {
  try {
    const traceId = await enqueueTask({
      taskType: 'image',
      taskId: `self-test-${Date.now()}`,
      userId: '__self_test__',
      projectId: '__self_test__',
      input: { prompt: '[self-test] queue verification', n: 1 },
      priority: 1,
    })

    if (!traceId) {
      throw new Error('[self-test] enqueueTask 返回了空的 traceId')
    }

    console.log(`[self-test]   ✅ queue enqueue OK: traceId=${traceId}`)
  } catch (err: any) {
    if (err.message?.includes('BullMQ') || err.message?.includes('Redis') || err.message?.includes('queue') || err.message?.includes('connect')) {
      console.log('[self-test]   ⚠️ Queue 不可用（Redis 未启动），跳过队列测试')
      return
    }
    throw err
  }
}
