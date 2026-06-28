/**
 * Redis 分布式状态层 v2 — ioredis
 *
 * 所有跨进程状态统一走 Redis，解决 PM2 cluster 下状态不一致
 *
 * 状态命名空间:
 *   sys:<key>    — 系统级状态
 *   bp:<key>     — 背压/控制状态
 *   wkr:<key>    — worker 状态
 */

import Redis from 'ioredis'

let client: Redis | null = null

const REDIS_URL = process.env.REDIS_URL || '127.0.0.1:6379'

export async function getRedis(): Promise<Redis> {
  if (!client) {
    client = new Redis(REDIS_URL)
    client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })
  }
  return client
}

// ============================================================
// 系统级状态
// ============================================================

export const SystemState = {
  async get(key: string): Promise<string | null> {
    return (await getRedis()).get(`sys:${key}`)
  },

  async set(key: string, value: string | number): Promise<void> {
    await (await getRedis()).set(`sys:${key}`, String(value))
  },

  async getBool(key: string): Promise<boolean> {
    return (await this.get(key)) === '1'
  },

  async setBool(key: string, value: boolean): Promise<void> {
    await this.set(key, value ? '1' : '0')
  },

  async getNum(key: string, defaultVal = 0): Promise<number> {
    const v = await this.get(key)
    return v !== null ? parseFloat(v) : defaultVal
  },

  async incr(key: string): Promise<number> {
    return (await getRedis()).incr(`sys:${key}`)
  },
}

// ============================================================
// 背压状态
// ============================================================

export const BackpressureState = {
  prefix: 'bp:',

  async snapshot(): Promise<{
    running: boolean
    mode: string
    currentRate: number
    queueLength: number
    queuePressure: number
    workerThroughput: number
    ses: number
  }> {
    const r = await getRedis()
    const results = await r.mget(
      'bp:running', 'bp:mode', 'bp:currentRate',
      'bp:queueLength', 'bp:queuePressure', 'bp:workerThroughput', 'bp:ses'
    )
    return {
      running: results[0] === '1',
      mode: results[1] || 'idle',
      currentRate: parseFloat(results[2] || '0'),
      queueLength: parseFloat(results[3] || '0'),
      queuePressure: parseFloat(results[4] || '0'),
      workerThroughput: parseFloat(results[5] || '0'),
      ses: parseFloat(results[6] || '1'),
    }
  },

  async setSnapshot(data: {
    running: boolean
    mode: string
    currentRate: number
    queueLength: number
    queuePressure: number
    workerThroughput: number
    ses: number
  }): Promise<void> {
    const r = await getRedis()
    await r.mset(
      'bp:running', data.running ? '1' : '0',
      'bp:mode', data.mode,
      'bp:currentRate', String(data.currentRate),
      'bp:queueLength', String(data.queueLength),
      'bp:queuePressure', String(data.queuePressure),
      'bp:workerThroughput', String(data.workerThroughput),
      'bp:ses', String(data.ses)
    )
  },
}

// ============================================================
// 采集器状态
// ============================================================

export const CollectorState = {
  async isRunning(): Promise<boolean> {
    return SystemState.getBool('collector:running')
  },

  async setRunning(val: boolean): Promise<void> {
    await SystemState.setBool('collector:running', val)
  },

  async getSamplesWritten(): Promise<number> {
    return SystemState.getNum('collector:samples')
  },

  async incrSamples(): Promise<number> {
    return SystemState.incr('collector:samples')
  },

  async getLastSampleTime(): Promise<number | null> {
    const v = await SystemState.get('collector:lastSample')
    return v ? parseInt(v) : null
  },

  async setLastSampleTime(ts: number): Promise<void> {
    await SystemState.set('collector:lastSample', ts)
  },
}

// ============================================================
// Metric Cache（实时采样缓存 — Redis List）
// ============================================================

export const MetricCache = {
  async push(snapshot: Record<string, number>): Promise<void> {
    const r = await getRedis()
    const key = `sys:metrics:recent`
    await r.lpush(key, JSON.stringify(snapshot))
    await r.ltrim(key, 0, 299)  // keep last 300 samples
    await r.expire(key, 600)     // 10min TTL
  },

  async recent(count = 60): Promise<Record<string, number>[]> {
    const r = await getRedis()
    const items = await r.lrange('sys:metrics:recent', 0, count - 1)
    return items.map(i => JSON.parse(i))
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

