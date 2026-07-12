// ============================================================
// RC2-3a — Circuit Breaker — 10 个测试场景
// ============================================================
// 严格按 spec 的 `9. 测试场景` 实现

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  InMemoryCircuitBreakerRepository,
  CircuitBreakerService,
  createDefaultBreakerConfig,
  createDefaultBreakerState,
} from '../../src/services/geo/execution'

import type { CircuitBreakerConfig } from '../../src/services/geo/execution'

// ─── Test Helpers ───

function makeConfig(overrides?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  return createDefaultBreakerConfig({
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    halfOpenMaxRequests: 1,
    slidingWindowMs: 60000,
    ...overrides,
  })
}

// Mock Date.now for time-sensitive scenarios
let mockNow = Date.now()
const RealDateNow = Date.now

function useMockTime() {
  mockNow = Date.now()
  Date.now = () => mockNow
}

function advanceTime(ms: number) {
  mockNow += ms
}

function restoreRealTime() {
  Date.now = RealDateNow
}

// ─── 场景 1: 正常执行不熔断 ───

describe('场景 1: 正常执行不熔断', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig())
  })

  it('连续 4 次成功，failureCount < 5，CLOSED', async () => {
    for (let i = 0; i < 4; i++) {
      const result = await cb.recordSuccess('provider-a')
      assert.ok(result.events.length === 0, `成功不应产生事件 (iter ${i})`)
    }

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.failureCount, 0, '成功应该重置 failureCount 为 0')
  })

  it('成功重置 failureCount', async () => {
    // 先记录 3 次失败
    for (let i = 0; i < 3; i++) {
      await cb.recordFailure('provider-a')
    }
    let state = await cb.getState('provider-a')
    assert.equal(state.failureCount, 3)

    // 再记录 1 次成功，重置计数器
    await cb.recordSuccess('provider-a')
    state = await cb.getState('provider-a')
    assert.equal(state.failureCount, 0)
    assert.equal(state.status, 'CLOSED')
  })
})

// ─── 场景 2: 达到阈值熔断 ───

describe('场景 2: 达到阈值熔断', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 5 }))
  })

  it('连续 5 次失败 → OPEN，emit circuit_breaker_open', async () => {
    for (let i = 0; i < 4; i++) {
      const result = await cb.recordFailure('provider-a')
      assert.ok(result.events.length === 0, `第 ${i + 1} 次失败未达阈值不应产生事件`)
    }

    // 第 5 次失败 → 熔断
    const result = await cb.recordFailure('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_open')
    assert.equal(result.events[0].data?.provider, 'provider-a')
    assert.equal(result.events[0].data?.failureCount, 5)
    assert.equal(result.events[0].data?.threshold, 5)

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')
    assert.equal(state.failureCount, 5)
    assert.notEqual(state.openedAt, null)
  })

  it('阈值=3 时 3 次失败即熔断', async () => {
    const cb3 = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3 }))

    await cb3.recordFailure('provider-b')
    await cb3.recordFailure('provider-b')
    const result = await cb3.recordFailure('provider-b')

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_open')

    const state = await cb3.getState('provider-b')
    assert.equal(state.status, 'OPEN')
    assert.equal(state.failureCount, 3)
  })
})

// ─── 场景 3: 熔断后拒绝请求 ───

describe('场景 3: 熔断后拒绝请求', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 30000 }))
  })

  it('OPEN 状态 allowRequest = false（未到恢复时间）', async () => {
    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')

    // 拒绝请求
    const allowed = await cb.allowRequest('provider-a')
    assert.equal(allowed, false)
  })

  it('拒绝增加 rejectedCount', async () => {
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    await cb.allowRequest('provider-a')
    await cb.allowRequest('provider-a')
    await cb.allowRequest('provider-a')

    const state = await cb.getState('provider-a')
    assert.equal(state.rejectedCount, 3)
  })
})

// ─── 场景 4: 恢复探测 ───

describe('场景 4: 恢复探测', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 1000 }))
  })

  it('超过 recoveryTimeout → HALF_OPEN，emit circuit_breaker_half_open', async () => {
    useMockTime()

    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    let state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')

    // 未到恢复时间 → 拒绝
    assert.equal(await cb.allowRequest('provider-a'), false)

    // 超过恢复时间
    advanceTime(1500) // > 1000ms

    // 应返回 true（探针放行）
    const allowed = await cb.allowRequest('provider-a')
    assert.equal(allowed, true)

    state = await cb.getState('provider-a')
    assert.equal(state.status, 'HALF_OPEN')
    assert.equal(state.halfOpenRequests, 1)

    restoreRealTime()
  })
})

// ─── 场景 5: 探针成功恢复 ───

describe('场景 5: 探针成功恢复', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 1000 }))
  })

  it('HALF_OPEN 下成功 1 次 → CLOSED，emit circuit_breaker_closed', async () => {
    useMockTime()

    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    // 进入 HALF_OPEN
    advanceTime(1500)
    await cb.allowRequest('provider-a')

    let state = await cb.getState('provider-a')
    assert.equal(state.status, 'HALF_OPEN')

    // 探针成功
    const result = await cb.recordSuccess('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_closed')
    assert.equal(result.events[0].data?.provider, 'provider-a')

    state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.failureCount, 0)

    restoreRealTime()
  })
})

// ─── 场景 6: 探针失败回退熔断 ───

describe('场景 6: 探针失败回退熔断', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 1000 }))
  })

  it('HALF_OPEN 下失败 1 次 → OPEN，emit circuit_breaker_open (probeFailed)', async () => {
    useMockTime()

    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    // 进入 HALF_OPEN
    advanceTime(1500)
    await cb.allowRequest('provider-a')

    let state = await cb.getState('provider-a')
    assert.equal(state.status, 'HALF_OPEN')

    // 探针失败
    const result = await cb.recordFailure('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_open')
    assert.equal(result.events[0].data?.probeFailed, true)

    state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')
    assert.equal(state.halfOpenRequests, 0, 'halfOpenRequests 应重置为 0')

    restoreRealTime()
  })
})

// ─── 场景 7: 半开状态限制探针数 ───

describe('场景 7: 半开状态限制探针数', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    // halfOpenMaxRequests = 1
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 1000, halfOpenMaxRequests: 1 }))
  })

  it('HALF_OPEN 已有 probe，再次请求 → false', async () => {
    useMockTime()

    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    // 进入 HALF_OPEN，消耗唯一的探针位
    advanceTime(1500)
    const firstAllowed = await cb.allowRequest('provider-a')
    assert.equal(firstAllowed, true)

    // 此时 halfOpenRequests = 1 = halfOpenMaxRequests
    const secondAllowed = await cb.allowRequest('provider-a')
    assert.equal(secondAllowed, false, 'HALF_OPEN 已有探针应拒绝')

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'HALF_OPEN')
    assert.equal(state.halfOpenRequests, 1)

    restoreRealTime()
  })

  it('halfOpenMaxRequests=2 时允许 2 个探针', async () => {
    useMockTime()

    const cb2 = new CircuitBreakerService(
      repo,
      makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 1000, halfOpenMaxRequests: 2 }),
    )

    await cb2.recordFailure('provider-b')
    await cb2.recordFailure('provider-b')
    await cb2.recordFailure('provider-b')

    advanceTime(1500)
    assert.equal(await cb2.allowRequest('provider-b'), true)
    assert.equal(await cb2.allowRequest('provider-b'), true)
    assert.equal(await cb2.allowRequest('provider-b'), false, '超过 max 应拒绝')

    const state = await cb2.getState('provider-b')
    assert.equal(state.halfOpenRequests, 2)

    restoreRealTime()
  })
})

// ─── 场景 8: Reset ───

describe('场景 8: Reset', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3, recoveryTimeoutMs: 30000 }))
  })

  it('OPEN 状态调 reset → CLOSED', async () => {
    // 触发熔断
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    let state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')

    // reset
    const result = await cb.reset('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_closed')
    assert.equal(result.events[0].data?.manual, true)

    state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.failureCount, 0)
    assert.equal(state.rejectedCount, 0)
    assert.equal(state.openedAt, null)
  })

  it('HALF_OPEN 状态调 reset → CLOSED', async () => {
    useMockTime()

    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    advanceTime(35000)
    await cb.allowRequest('provider-a')

    let state = await cb.getState('provider-a')
    assert.equal(state.status, 'HALF_OPEN')

    await cb.reset('provider-a')

    state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')

    restoreRealTime()
  })
})

// ─── 场景 9: Repository CRUD ───

describe('场景 9: Repository CRUD', () => {
  let repo: InMemoryCircuitBreakerRepository

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
  })

  it('save / get / delete / getAll', async () => {
    const state1 = createDefaultBreakerState('provider-a')
    state1.failureCount = 3
    state1.rejectedCount = 5

    const state2 = createDefaultBreakerState('provider-b')

    await repo.save(state1)
    await repo.save(state2)

    // get
    const loaded = await repo.get('provider-a')
    assert.notEqual(loaded, null)
    assert.equal(loaded!.provider, 'provider-a')
    assert.equal(loaded!.failureCount, 3)
    assert.equal(loaded!.rejectedCount, 5)

    // getAll
    const all = await repo.getAll()
    assert.equal(all.size, 2)
    assert.ok(all.has('provider-a'))
    assert.ok(all.has('provider-b'))

    // get non-existent
    const nonExistent = await repo.get('not-exists')
    assert.equal(nonExistent, null)

    // delete
    await repo.delete('provider-a')
    const afterDelete = await repo.get('provider-a')
    assert.equal(afterDelete, null)
    const allAfterDelete = await repo.getAll()
    assert.equal(allAfterDelete.size, 1)
    assert.ok(!allAfterDelete.has('provider-a'))
    assert.ok(allAfterDelete.has('provider-b'))
  })

  it('保存是复制（不可变）', async () => {
    const state = createDefaultBreakerState('provider-a')
    state.failureCount = 3
    await repo.save(state)

    // 修改原对象
    state.failureCount = 999

    // 获取应返回原始值
    const loaded = await repo.get('provider-a')
    assert.equal(loaded!.failureCount, 3)
  })
})

// ─── 场景 10: 滑动窗口基础 ───

describe('场景 10: 滑动窗口基础', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({
      failureThreshold: 5,
      recoveryTimeoutMs: 30000,
      slidingWindowMs: 1000, // 1s 窗口
    }))
  })

  it('窗口内故障数不超阈值，stay in CLOSED', async () => {
    // 4 次失败 < 5 阈值 → 保持 CLOSED
    for (let i = 0; i < 4; i++) {
      const result = await cb.recordFailure('provider-a')
      assert.equal(result.events.length, 0, '未达阈值不应产生事件')
    }

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.failureCount, 4)
  })

  it('窗口内连续失败达到阈值触发熔断', async () => {
    for (let i = 0; i < 4; i++) {
      await cb.recordFailure('provider-a')
    }
    // 第 5 次 → 熔断
    const result = await cb.recordFailure('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_open')

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'OPEN')
  })

  it('成功重置 failureCount 相当于窗口重置', async () => {
    // 3 次失败
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    // 1 次成功 → 重置 failureCount
    await cb.recordSuccess('provider-a')

    // 再 4 次失败 → failureCount = 4，仍 CLOSED
    for (let i = 0; i < 4; i++) {
      await cb.recordFailure('provider-a')
    }

    const state = await cb.getState('provider-a')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.failureCount, 4)

    // 再 1 次失败 → 5 → OPEN
    const result = await cb.recordFailure('provider-a')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'circuit_breaker_open')

    const state2 = await cb.getState('provider-a')
    assert.equal(state2.status, 'OPEN')
  })
})

// ─── 边缘场景: CLOSED 状态 allowRequest ───

describe('边缘场景: CLOSED 状态 allowRequest', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig())
  })

  it('CLOSED 时 allowRequest = true', async () => {
    assert.equal(await cb.allowRequest('provider-a'), true)
    assert.equal(await cb.allowRequest('provider-b'), true)
  })
})

// ─── 边缘场景: 多个 Provider 独立 ───

describe('边缘场景: 多个 Provider 独立', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3 }))
  })

  it('provider-a 熔断不影响 provider-b', async () => {
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    const stateA = await cb.getState('provider-a')
    assert.equal(stateA.status, 'OPEN')

    const stateB = await cb.getState('provider-b')
    assert.equal(stateB.status, 'CLOSED')
    assert.equal(await cb.allowRequest('provider-b'), true)
  })
})

// ─── 边缘场景: getAllStates ───

describe('边缘场景: getAllStates', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig({ failureThreshold: 3 }))
  })

  it('返回所有 provider 状态', async () => {
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')
    await cb.recordFailure('provider-a')

    await cb.recordFailure('provider-b')
    await cb.recordFailure('provider-b')

    const all = await cb.getAllStates()
    assert.equal(all.size, 2)
    assert.equal(all.get('provider-a')!.status, 'OPEN')
    assert.equal(all.get('provider-b')!.status, 'CLOSED')
  })
})

// ─── 边缘场景: 从未见过的 Provider ───

describe('边缘场景: 未记录的 Provider', () => {
  let repo: InMemoryCircuitBreakerRepository
  let cb: CircuitBreakerService

  beforeEach(() => {
    repo = new InMemoryCircuitBreakerRepository()
    cb = new CircuitBreakerService(repo, makeConfig())
  })

  it('getState 返回默认 CLOSED 状态', async () => {
    const state = await cb.getState('never-seen')
    assert.equal(state.status, 'CLOSED')
    assert.equal(state.provider, 'never-seen')
    assert.equal(state.failureCount, 0)
  })

  it('allowRequest 对未记录的 Provider 返回 true', async () => {
    assert.equal(await cb.allowRequest('never-seen'), true)
  })
})
