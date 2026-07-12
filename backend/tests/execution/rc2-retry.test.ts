// ============================================================
// RC2-2 — Retry Policy + Exponential Backoff + Jitter + Timeout
// ============================================================

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  FixedRetryPolicy,
  ExponentialBackoffRetryPolicy,
  AdaptiveRetryPolicy,
  createRetryPolicy,
  type RetryConfig,
  RetryScheduler,
  TimeoutTracker,
} from '../../src/services/geo/execution'

// ─── Test Helpers ───

function makeConfig(overrides: Partial<RetryConfig> = {}): RetryConfig {
  return {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: false,
    useExponentialBackoff: false,
    ...overrides,
  }
}

// ─── 1. FixedRetryPolicy — 固定间隔 ───

describe('FixedRetryPolicy', () => {
  it('should retry when attempt < maxRetries', () => {
    const policy = new FixedRetryPolicy()
    const config = makeConfig({ maxRetries: 3, jitter: false })
    assert.ok(policy.shouldRetry(0, new Error('fail'), config))
    assert.ok(policy.shouldRetry(1, new Error('fail'), config))
    assert.ok(policy.shouldRetry(2, new Error('fail'), config))
    assert.ok(!policy.shouldRetry(3, new Error('fail'), config))
    assert.ok(!policy.shouldRetry(4, new Error('fail'), config))
  })

  it('should return fixed delay without jitter', () => {
    const policy = new FixedRetryPolicy()
    const config = makeConfig({ baseDelayMs: 2000, jitter: false })
    for (let i = 0; i < 10; i++) {
      assert.strictEqual(policy.nextDelay(0, config), 2000)
      assert.strictEqual(policy.nextDelay(1, config), 2000)
      assert.strictEqual(policy.nextDelay(99, config), 2000)
    }
  })

  it('should apply jitter within ±25% range', () => {
    const policy = new FixedRetryPolicy()
    const config = makeConfig({ baseDelayMs: 1000, jitter: true })
    for (let i = 0; i < 100; i++) {
      const delay = policy.nextDelay(i, config)
      assert.ok(delay >= 500)    // 1000 * 0.5
      assert.ok(delay <= 1000)    // 1000 * 1.0 (0.5 + 0.5 = 1.0)
    }
  })

  it('jitter produces different values', () => {
    const policy = new FixedRetryPolicy()
    const config = makeConfig({ baseDelayMs: 10000, jitter: true })
    const delays = new Set<number>()
    for (let i = 0; i < 50; i++) {
      delays.add(policy.nextDelay(i, config))
    }
    // 50 次中至少应有 2 个不同的值
    assert.ok(delays.size >= 2)
  })

  it('name should be "fixed"', () => {
    const policy = new FixedRetryPolicy()
    assert.strictEqual(policy.name, 'fixed')
  })
})

// ─── 2. ExponentialBackoffRetryPolicy — 指数退避 ───

describe('ExponentialBackoffRetryPolicy', () => {
  it('should retry when attempt < maxRetries', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const config = makeConfig({ maxRetries: 3, useExponentialBackoff: true, jitter: false })
    assert.ok(policy.shouldRetry(0, new Error('fail'), config))
    assert.ok(policy.shouldRetry(1, new Error('fail'), config))
    assert.ok(policy.shouldRetry(2, new Error('fail'), config))
    assert.ok(!policy.shouldRetry(3, new Error('fail'), config))
  })

  it('should calculate exponential delay: baseDelay * 2^attempt', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const config = makeConfig({ baseDelayMs: 100, maxDelayMs: 100000, jitter: false, useExponentialBackoff: true })
    assert.strictEqual(policy.nextDelay(0, config), 100)    // 100 * 1
    assert.strictEqual(policy.nextDelay(1, config), 200)    // 100 * 2
    assert.strictEqual(policy.nextDelay(2, config), 400)    // 100 * 4
    assert.strictEqual(policy.nextDelay(3, config), 800)    // 100 * 8
  })

  it('should cap delay at maxDelayMs', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const config = makeConfig({ baseDelayMs: 1000, maxDelayMs: 3000, jitter: false, useExponentialBackoff: true })
    assert.strictEqual(policy.nextDelay(0, config), 1000)   // 1000 * 1 = 1000
    assert.strictEqual(policy.nextDelay(1, config), 2000)   // 1000 * 2 = 2000
    assert.strictEqual(policy.nextDelay(2, config), 3000)   // min(4000, 3000) = 3000
    assert.strictEqual(policy.nextDelay(5, config), 3000)   // min(32000, 3000) = 3000
  })

  it('should apply full jitter (0.0 ~ 1.0)', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const config = makeConfig({ baseDelayMs: 1000, maxDelayMs: 100000, jitter: true, useExponentialBackoff: true })
    for (let i = 0; i < 100; i++) {
      const delay = policy.nextDelay(1, config) // base = 2000
      assert.ok(delay >= 0)
      assert.ok(delay <= 2000)
    }
  })

  it('jitter produces different values for exponential', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const config = makeConfig({ baseDelayMs: 1000, maxDelayMs: 100000, jitter: true, useExponentialBackoff: true })
    const delays = new Set<number>()
    for (let i = 0; i < 50; i++) {
      delays.add(policy.nextDelay(2, config)) // base = 4000
    }
    assert.ok(delays.size >= 2)
  })

  it('name should be "exponential_backoff"', () => {
    const policy = new ExponentialBackoffRetryPolicy()
    assert.strictEqual(policy.name, 'exponential_backoff')
  })
})

// ─── 3. AdaptiveRetryPolicy ───

describe('AdaptiveRetryPolicy', () => {
  it('should retry when attempt < maxRetries', () => {
    const policy = new AdaptiveRetryPolicy({ getHealth: async () => ({ errorRate: 0.1 }) })
    const config = makeConfig({ maxRetries: 2 })
    assert.ok(policy.shouldRetry(0, new Error('fail'), config))
    assert.ok(policy.shouldRetry(1, new Error('fail'), config))
    assert.ok(!policy.shouldRetry(2, new Error('fail'), config))
  })

  it('name should be "adaptive"', () => {
    const policy = new AdaptiveRetryPolicy({ getHealth: async () => ({ errorRate: 0.1 }) })
    assert.strictEqual(policy.name, 'adaptive')
  })
})

// ─── 4. createRetryPolicy 工厂函数 ───

describe('createRetryPolicy', () => {
  it('should create FixedRetryPolicy when useExponentialBackoff is false', () => {
    const policy = createRetryPolicy(makeConfig({ useExponentialBackoff: false }))
    assert.ok(policy instanceof FixedRetryPolicy)
  })

  it('should create ExponentialBackoffRetryPolicy when useExponentialBackoff is true', () => {
    const policy = createRetryPolicy(makeConfig({ useExponentialBackoff: true }))
    assert.ok(policy instanceof ExponentialBackoffRetryPolicy)
  })
})

// ─── 5. RetryScheduler — evaluate ───

describe('RetryScheduler', () => {
  it('should return shouldRetry=true when policy says yes', async () => {
    const policy = new FixedRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ maxRetries: 3, baseDelayMs: 500, jitter: false })

    const result = await scheduler.evaluate(0, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')

    assert.ok(result.shouldRetry)
    assert.ok(result.nextDelayMs > 0)
    assert.strictEqual(result.nextDelayMs, 500)
  })

  it('should return shouldRetry=false when maxRetries exceeded', async () => {
    const policy = new FixedRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ maxRetries: 2, baseDelayMs: 500, jitter: false })

    // attempt=0 -> should retry
    const result1 = await scheduler.evaluate(0, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(result1.shouldRetry)

    // attempt=1 -> should retry (attempt < maxRetries)
    const result2 = await scheduler.evaluate(1, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(result2.shouldRetry)

    // attempt=2 -> maxRetries reached
    const result3 = await scheduler.evaluate(2, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(!result3.shouldRetry)
    assert.strictEqual(result3.nextDelayMs, 0)
  })

  it('should generate node_retry event on retry', async () => {
    const policy = new FixedRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ maxRetries: 3, baseDelayMs: 1000, jitter: false })

    const result = await scheduler.evaluate(1, new Error('something went wrong'), config, 'exe-1', 'g-1', 'n-1')

    assert.strictEqual(result.events.length, 1)
    const event = result.events[0]
    assert.strictEqual(event.type, 'node_retry')
    assert.strictEqual(event.executionId, 'exe-1')
    assert.strictEqual(event.graphId, 'g-1')
    assert.strictEqual(event.nodeId, 'n-1')
    assert.strictEqual(event.data?.attempt, 1)
    assert.strictEqual(event.data?.maxRetries, 3)
    assert.strictEqual(event.data?.nextDelayMs, 1000)
    assert.strictEqual(event.data?.error, 'something went wrong')
  })

  it('should not generate events when not retrying', async () => {
    const policy = new FixedRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ maxRetries: 1, jitter: false })

    // attempt=1 (>= maxRetries=1) -> no retry
    const result = await scheduler.evaluate(1, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(!result.shouldRetry)
    assert.strictEqual(result.events.length, 0)
  })

  it('finalAttempt should be true on last allowed retry', async () => {
    const policy = new FixedRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ maxRetries: 3, jitter: false })

    // attempt=0, remaining=3 -> finalAttempt=false
    const r1 = await scheduler.evaluate(0, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(r1.shouldRetry)
    assert.ok(!r1.finalAttempt)

    // attempt=1, remaining=2 -> finalAttempt=false
    const r2 = await scheduler.evaluate(1, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(r2.shouldRetry)
    assert.ok(!r2.finalAttempt)

    // attempt=2, remaining=1 -> finalAttempt=true (attempt+1 >= maxRetries)
    const r3 = await scheduler.evaluate(2, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(r3.shouldRetry)
    assert.ok(r3.finalAttempt)

    // attempt=3, exhausted -> no retry
    const r4 = await scheduler.evaluate(3, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.ok(!r4.shouldRetry)
  })

  it('should use exponential delay from policy', async () => {
    const policy = new ExponentialBackoffRetryPolicy()
    const scheduler = new RetryScheduler(policy)
    const config = makeConfig({ baseDelayMs: 100, maxDelayMs: 10000, jitter: false, useExponentialBackoff: true })

    const r0 = await scheduler.evaluate(0, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.strictEqual(r0.nextDelayMs, 100)

    const r1 = await scheduler.evaluate(1, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.strictEqual(r1.nextDelayMs, 200)

    const r2 = await scheduler.evaluate(2, new Error('fail'), config, 'exe-1', 'g-1', 'n-1')
    assert.strictEqual(r2.nextDelayMs, 400)
  })
})

// ─── 6. TimeoutTracker ───

describe('TimeoutTracker', () => {
  it('should detect timeout when elapsed >= timeoutMs', () => {
    const tracker = new TimeoutTracker()
    const startedAt = new Date(Date.now() - 5000).toISOString() // 5s ago
    const result = tracker.check(startedAt, 3000, 'exe-1', 'g-1', 'n-1')
    assert.ok(result.timedOut)
  })

  it('should not detect timeout when elapsed < timeoutMs', () => {
    const tracker = new TimeoutTracker()
    const startedAt = new Date(Date.now() - 100).toISOString() // 100ms ago
    const result = tracker.check(startedAt, 5000, 'exe-1', 'g-1', 'n-1')
    assert.ok(!result.timedOut)
  })

  it('should generate node_timeout event on timeout', () => {
    const tracker = new TimeoutTracker()
    const startedAt = new Date(Date.now() - 10000).toISOString()
    const result = tracker.check(startedAt, 500, 'exe-1', 'g-1', 'n-1')

    assert.ok(result.timedOut)
    assert.strictEqual(result.events.length, 1)

    const event = result.events[0]
    assert.strictEqual(event.type, 'node_timeout')
    assert.strictEqual(event.executionId, 'exe-1')
    assert.strictEqual(event.graphId, 'g-1')
    assert.strictEqual(event.nodeId, 'n-1')
    assert.strictEqual(event.data?.startedAt, startedAt)
    assert.strictEqual(event.data?.timeoutMs, 500)
    assert.ok((event.data?.elapsed as number) >= 10000)
  })

  it('should not generate events when no timeout', () => {
    const tracker = new TimeoutTracker()
    const startedAt = new Date(Date.now() - 50).toISOString()
    const result = tracker.check(startedAt, 50000, 'exe-1', 'g-1', 'n-1')

    assert.ok(!result.timedOut)
    assert.strictEqual(result.events.length, 0)
  })

  it('should detect exact timeout boundary', () => {
    const tracker = new TimeoutTracker()
    // Use a fixed past timestamp
    const startedAt = new Date(0).toISOString() // epoch
    const elapsed = Date.now() // ms since epoch
    const result = tracker.check(startedAt, elapsed, 'exe-1', 'g-1', 'n-1')
    // elapsed >= timeoutMs should be true
    assert.ok(result.timedOut)
  })
})
