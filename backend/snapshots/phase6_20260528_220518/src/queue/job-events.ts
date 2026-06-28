/**
 * queue/job-events.ts — 任务事件监听
 *
 * 监听队列事件，集成到观察系统
 */
import { QueueEvents } from 'bullmq'
import { getRedis } from './redis.js'
import { TaskType } from './queue-manager.js'

const queueTypes: TaskType[] = ['image', 'video', 'tts', 'llm']
const listeners: QueueEvents[] = []

export function startEventListeners(): void {
  for (const t of queueTypes) {
    const events = new QueueEvents(`ai-${t}`, { connection: getRedis() })

    events.on('completed', ({ jobId }) => {
      console.log(`[JobEvents] ${t}/${jobId.substring(0,8)} completed`)
    })

    events.on('failed', ({ jobId, failedReason }) => {
      console.error(`[JobEvents] ${t}/${jobId.substring(0,8)} failed: ${failedReason}`)
    })

    events.on('progress', ({ jobId, data }) => {
      console.log(`[JobEvents] ${t}/${jobId.substring(0,8)} progress: ${data}`)
    })

    listeners.push(events)
  }
  console.log(`[JobEvents] Started ${listeners.length} event listeners`)
}

export async function stopEventListeners(): Promise<void> {
  for (const l of listeners) {
    await l.close()
  }
  listeners.length = 0
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

