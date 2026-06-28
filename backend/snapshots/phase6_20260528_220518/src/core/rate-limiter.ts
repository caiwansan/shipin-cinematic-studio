/**
 * core/rate-limiter.ts — 用户级令牌桶速率限制
 *
 * 基于 Redis 实现，支持多实例共享状态。
 * 如果 Redis 不可用，自动降级到内存模式（单实例容错）。
 */

import Redis from 'ioredis'
import { env } from '../config/env.js'

interface TokenBucketConfig {
  capacity: number        // 桶容量（最大突发）
  refillRate: number      // 每秒补充速率
  refillInterval: number  // 补充间隔 (ms)
}

// 用户等级对应的限速配置
const TIER_LIMITS: Record<string, TokenBucketConfig> = {
  free:   { capacity: 3,   refillRate: 1/86400, refillInterval: 1000 },  // 每天 3 次
  basic:  { capacity: 10,  refillRate: 1/3600,  refillInterval: 1000 },  // 每小时 1 次
  vip:    { capacity: 50,  refillRate: 10,       refillInterval: 100 },   // 每秒 10 次
  premium:{ capacity: 100, refillRate: 20,       refillInterval: 100 },   // 每秒 20 次
}

interface RedisTokenBucket {
  tokens: number
  lastRefill: number  // timestamp ms
}

// Fallback: 内存存储（Redis 不可用时）
const memBuckets = new Map<string, RedisTokenBucket>()

let redis: Redis | null = null
let redisAvailable = false

// 尝试连接 Redis
try {
  if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,  // 不重试，快速降级
      lazyConnect: true,
    })
    redis.on('error', () => { redisAvailable = false })
    redis.on('ready', () => { redisAvailable = true })
    redis.connect().catch(() => { redisAvailable = false })
  }
} catch {
  redisAvailable = false
}

const REDIS_PREFIX = 'ratelimit:'

/**
 * 检查并消费令牌
 * @param userId 用户 ID
 * @param tier 用户等级
 * @param cost 本次消耗的令牌数（默认 1）
 * @returns 是否允许 + 剩余令牌
 */
export async function checkRateLimit(
  userId: string,
  tier: string = 'free',
  cost: number = 1
): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> {
  const config = TIER_LIMITS[tier] || TIER_LIMITS.free
  const key = `${tier}:${userId}`

  if (redisAvailable && redis) {
    try {
      return await redisRateLimit(redis, key, config, cost)
    } catch {
      redisAvailable = false
      // 降级到内存
    }
  }

  return memRateLimit(key, config, cost)
}

/**
 * Redis 版令牌桶
 */
async function redisRateLimit(
  r: Redis,
  key: string,
  config: TokenBucketConfig,
  cost: number
): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> {
  const now = Date.now()
  const redisKey = REDIS_PREFIX + key

  // Lua 脚本保证原子性
  const script = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local refillRate = tonumber(ARGV[3])
    local refillInterval = tonumber(ARGV[4])
    local cost = tonumber(ARGV[5])

    local data = redis.call('GET', key)
    if not data then
      -- 新桶：初始化满桶
      redis.call('SET', key, now .. ':' .. capacity, 'EX', 86400)
      if cost <= capacity then
        redis.call('SET', key, now .. ':' .. (capacity - cost), 'EX', 86400)
        return {1, capacity - cost, 0}
      end
      return {0, 0, 0}
    end

    local lastRefill, tokens = string.match(data, '^(%d+):([%d.]+)$')
    lastRefill = tonumber(lastRefill)
    tokens = tonumber(tokens)

    -- 补充令牌
    local elapsed = now - lastRefill
    local newTokens = math.min(capacity, tokens + elapsed * refillRate / refillInterval)
    
    if newTokens < cost then
      -- 不够
      local waitMs = math.ceil((cost - newTokens) * refillInterval / refillRate)
      return {0, math.floor(newTokens), waitMs}
    end

    -- 够，消耗
    local remaining = newTokens - cost
    redis.call('SET', key, now .. ':' .. remaining, 'EX', 86400)
    return {1, math.floor(remaining), 0}
  `

  const result = await r.eval(script, 1, redisKey,
    now.toString(),
    config.capacity.toString(),
    config.refillRate.toString(),
    config.refillInterval.toString(),
    cost.toString()
  ) as [number, number, number]

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetInMs: result[2],
  }
}

/**
 * 内存版令牌桶（Redis 降级）
 */
function memRateLimit(
  key: string,
  config: TokenBucketConfig,
  cost: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now()
  let bucket = memBuckets.get(key)

  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now }
    memBuckets.set(key, bucket)
  }

  // 补充
  const elapsed = now - bucket.lastRefill
  if (elapsed >= config.refillInterval) {
    const refillAmount = Math.floor(elapsed / config.refillInterval) * (config.refillRate / (1000 / config.refillInterval))
    bucket.tokens = Math.min(config.capacity, bucket.tokens + refillAmount)
    bucket.lastRefill = now
  }

  if (bucket.tokens < cost) {
    const waitMs = Math.ceil((cost - bucket.tokens) * (config.refillInterval / config.refillRate))
    return { allowed: false, remaining: Math.floor(bucket.tokens), resetInMs: waitMs }
  }

  bucket.tokens -= cost
  return { allowed: true, remaining: Math.floor(bucket.tokens), resetInMs: 0 }
}

/**
 * 获取用户等级对应的限流配置
 */
export function getTierLimit(tier: string): TokenBucketConfig {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

/**
 * 获取所有等级的限流配置
 */
export function getAllTierLimits(): Record<string, TokenBucketConfig> {
  return { ...TIER_LIMITS }
}

/**
 * 重置用户的限流状态
 */
export function resetUserRateLimit(userId: string, tier?: string) {
  const prefix = tier ? `${tier}:${userId}` : userId
  // 清除内存
  for (const key of memBuckets.keys()) {
    if (key.endsWith(`:${userId}`)) memBuckets.delete(key)
  }
  // 清除 Redis
  if (redis && redisAvailable) {
    const pattern = REDIS_PREFIX + `*:${userId}`
    redis.keys(pattern).then(keys => {
      if (keys.length > 0) redis?.del(...keys)
    }).catch(() => {})
  }
}
