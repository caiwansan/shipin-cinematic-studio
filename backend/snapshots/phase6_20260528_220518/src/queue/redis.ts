/**
 * queue/redis.ts — Redis 连接管理（单例，供队列使用）
 */
import Redis from 'ioredis'
import { env } from '../config/env.js'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // BullMQ 要求
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    })
    redisInstance.on('connect', () => console.log('[Redis] Queue Redis connected'))
    redisInstance.on('error', (err) => console.error('[Redis] Queue Redis error:', err.message))
  }
  return redisInstance
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit()
    redisInstance = null
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

