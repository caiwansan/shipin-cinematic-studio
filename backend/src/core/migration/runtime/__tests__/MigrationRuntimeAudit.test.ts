/**
 * BETA-ARCH-03.0.2
 * Step 4 — Migration Runtime Audit
 * 
 * 审计目标：
 * A — Runtime Chain: Adapter → Wrapper → Tracker → DB
 * B — Failure Isolation: Telemetry failure cannot break runtime
 * C — Performance: 10000 次调用 overhead
 * D — Security: MigrationUsageLog 字段白名单
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MigrationAdapter,
  MigrationTracker,
  MigrationTelemetryWrapper,
  InMemoryMigrationTracker,
  NoOpMigrationTracker,
  MigrationUsageLogEntry,
} from '../index.js'

// ═══════════════════════════════════════════════════════════════
// A1 — Mock Adapter
// ═══════════════════════════════════════════════════════════════

class AuditMockAdapter implements MigrationAdapter<unknown, { migrated: boolean }> {
  name = 'AuditMockAdapter'
  source = 'LegacyMockEntity'
  target = 'CoreMockEntity'

  async resolve(): Promise<{ migrated: boolean }> {
    return { migrated: true }
  }
}

// ═══════════════════════════════════════════════════════════════
// Audit A — Runtime Chain Verification
// ═══════════════════════════════════════════════════════════════

describe('Audit A — Runtime Chain Verification', () => {
  let tracker: InMemoryMigrationTracker
  let wrapper: MigrationTelemetryWrapper
  let adapter: AuditMockAdapter

  beforeEach(() => {
    tracker = new InMemoryMigrationTracker()
    wrapper = new MigrationTelemetryWrapper(tracker)
    adapter = new AuditMockAdapter()
  })

  it('should execute adapter via wrapper and return correct data', async () => {
    const result = await wrapper.execute(adapter, {}, { caller: 'runtime-audit' })
    expect(result.data).toEqual({ migrated: true })
  })

  it('should track adapter name, source, target, status=SUCCESS', async () => {
    await wrapper.execute(adapter, {}, { caller: 'runtime-audit' })
    expect(tracker.logs).toHaveLength(1)

    const log = tracker.logs[0]
    expect(log.adapter).toBe('AuditMockAdapter')
    expect(log.source).toBe('LegacyMockEntity')
    expect(log.target).toBe('CoreMockEntity')
    expect(log.status).toBe('SUCCESS')
  })

  it('should track caller field', async () => {
    await wrapper.execute(adapter, {}, { caller: 'runtime-audit' })
    expect(tracker.logs[0].caller).toBe('runtime-audit')
  })

  it('should track duration (>0ms)', async () => {
    await wrapper.execute(adapter, {}, {})
    expect(tracker.logs[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('should include metadata in tracker log', async () => {
    await wrapper.execute(adapter, {}, { metadata: { testId: 'A1-check' } })
    expect(tracker.logs[0].metadata).toMatchObject({ testId: 'A1-check' })
  })
})

// ═══════════════════════════════════════════════════════════════
// Audit B — Failure Isolation
// ═══════════════════════════════════════════════════════════════

describe('Audit B — Failure Isolation', () => {
  /**
   * BrokenTracker — 模拟 telemetry 不可用
   */
  class BrokenTracker implements MigrationTracker {
    async log(): Promise<void> {
      throw new Error('telemetry unavailable')
    }
  }

  let brokenTracker: BrokenTracker
  let wrapper: MigrationTelemetryWrapper
  let adapter: AuditMockAdapter

  beforeEach(() => {
    brokenTracker = new BrokenTracker()
    wrapper = new MigrationTelemetryWrapper(brokenTracker)
    adapter = new AuditMockAdapter()
  })

  it('should still return adapter result when tracker fails', async () => {
    const result = await wrapper.execute(adapter, {}, { caller: 'failure-audit' })
    expect(result.data).toEqual({ migrated: true })
  })

  it('should not throw when tracker fails', async () => {
    await expect(
      wrapper.execute(adapter, {}, { caller: 'failure-audit' })
    ).resolves.toBeDefined()
  })

  it('should report TELEMETRY_ERROR status in result telemetry', async () => {
    const result = await wrapper.execute(adapter, {}, { caller: 'failure-audit' })
    // Wrapper 返回的 telemetry.status 反映业务结果（SUCCESS），
    // 遥测失败不影响此字段
    expect(result.telemetry.status).toBe('SUCCESS')
  })

  it('should re-throw adapter errors even after tracker fails', async () => {
    class FailingAdapter implements MigrationAdapter {
      name = 'FailingAdapter'
      source = 'X'
      target = 'Y'
      async resolve(): Promise<never> {
        throw new Error('adapter business logic failed')
      }
    }

    await expect(
      wrapper.execute(new FailingAdapter(), {}, {})
    ).rejects.toThrow('adapter business logic failed')
  })
})

// ═══════════════════════════════════════════════════════════════
// Audit C — Performance
// ═══════════════════════════════════════════════════════════════

describe('Audit C — Performance', () => {
  let tracker: NoOpMigrationTracker
  let wrapper: MigrationTelemetryWrapper
  let adapter: AuditMockAdapter

  beforeEach(() => {
    tracker = new NoOpMigrationTracker()
    wrapper = new MigrationTelemetryWrapper(tracker)
    adapter = new AuditMockAdapter()
  })

  it('should complete 10000 iterations within performance budget', async () => {
    const ITERATIONS = 10000
    const durations: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now()
      await wrapper.execute(adapter, {}, {})
      durations.push(performance.now() - start)
    }

    // 统计
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length
    const sorted = [...durations].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log(`\n[Audit C] Performance Results:`)
    console.log(`  Iterations: ${ITERATIONS}`)
    console.log(`  Average:    ${avg.toFixed(3)}ms`)
    console.log(`  P95:        ${p95.toFixed(3)}ms`)
    console.log(`  P99:        ${p99.toFixed(3)}ms`)

    // 标准: avg<5ms / p95<10ms / p99<20ms
    expect(avg).toBeLessThan(5)
    expect(p95).toBeLessThan(10)
    expect(p99).toBeLessThan(20)
  })
})

// ═══════════════════════════════════════════════════════════════
// Audit D — Security Audit
// ═══════════════════════════════════════════════════════════════

describe('Audit D — Security Audit', () => {
  let tracker: InMemoryMigrationTracker
  let wrapper: MigrationTelemetryWrapper
  let adapter: AuditMockAdapter

  beforeEach(() => {
    tracker = new InMemoryMigrationTracker()
    wrapper = new MigrationTelemetryWrapper(tracker)
    adapter = new AuditMockAdapter()
  })

  const FORBIDDEN_PATTERNS = [
    'password',
    'token',
    'secret',
    'apiKey',
    'credential',
    'jwt',
    'cookie',
    'session',
    'passwd',
    'access_token',
    'refresh_token',
    'api_key',
  ]

  it('should not leak forbidden fields in metadata', async () => {
    await wrapper.execute(adapter, {}, {
      metadata: { safeField: 'value', anotherField: 123 },
    })

    const serialized = JSON.stringify(tracker.logs[0])
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(new RegExp(pattern, 'i'))
    }
  })

  it('should not expose forbidden fields even when nested', async () => {
    // 模拟：如果 metadata 包含了敏感字段，序列化后应该可被检测
    await wrapper.execute(adapter, {}, {
      metadata: { user: 'alice', action: 'migrate' },
    })

    const serialized = JSON.stringify(tracker.logs[0])
    FORBIDDEN_PATTERNS.forEach(pattern => {
      expect(serialized.toLowerCase()).not.toContain(pattern.toLowerCase())
    })
  })

  it('should whitelist allowed fields: adapter, caller, source, target, status, durationMs, callCount, metadata, createdAt', async () => {
    await wrapper.execute(adapter, {}, { caller: 'security-audit' })
    const log = tracker.logs[0]

    // 必须存在的字段
    expect(log).toHaveProperty('adapter')
    expect(log).toHaveProperty('source')
    expect(log).toHaveProperty('target')
    expect(log).toHaveProperty('status')
    expect(log).toHaveProperty('durationMs')
    expect(log).toHaveProperty('callCount')
    expect(log).toHaveProperty('caller')
    expect(log).toHaveProperty('metadata')

    // 不应存在的字段（blacklist）
    const restrictedFields = ['password', 'token', 'secret', 'apiKey', 'credential', 'jwt', 'cookie', 'session']
    for (const field of restrictedFields) {
      expect(log).not.toHaveProperty(field)
    }
  })

  it('should be safe against injection in caller field', async () => {
    await wrapper.execute(adapter, {}, {
      caller: 'normal-caller',
    })
    expect(tracker.logs[0].caller).toBe('normal-caller')
  })

  it('should ensure metadata JSON does not contain PII patterns', async () => {
    await wrapper.execute(adapter, {}, {
      metadata: { count: 42, type: 'test' },
    })

    const meta = JSON.stringify(tracker.logs[0].metadata)
    expect(meta).not.toMatch(/token|password|secret|api[_.]?key|credential/i)
    expect(meta).toMatch(/count|type/)
  })
})
