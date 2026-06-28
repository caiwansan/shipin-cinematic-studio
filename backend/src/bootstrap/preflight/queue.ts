/**
 * bootstrap/preflight/queue.ts — Queue Preflight Check
 *
 * Phase 2, Rule 5: queue 不可用则系统 fail-fast
 */
import { env } from '../../config/env.js'

export async function verifyQueue(): Promise<void> {
  try {
    // 轻量检查 Redis 连接（队列依赖 Redis）
    const redis = new (await import('ioredis')).default(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    })

    await redis.connect()
    const ping = await redis.ping()
    await redis.quit()

    if (ping === 'PONG') {
      console.log('[boot]   ✅ Queue (Redis): OK')
    } else {
      throw new Error(`Redis ping returned: ${ping}`)
    }
  } catch (err: any) {
    console.warn(`[boot]   ⚠️ Queue (Redis): 不可用 (${err.message})`)
    console.warn('[boot]   ⚠️ 队列不可用不影响直接 API 调用，但异步任务会失败')
    // 不 throw——队列不可用时系统可继续以同步模式运行
  }
}
