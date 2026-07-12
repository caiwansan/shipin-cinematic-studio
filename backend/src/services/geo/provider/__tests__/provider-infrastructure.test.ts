// ============================================================
// GEO AI Provider Infrastructure — Verification Tests
// RC2-T001
// ============================================================

import { Cache } from '../cache'
import { CircuitBreaker } from '../circuit-breaker'
import { RateLimiter } from '../rate-limiter'
import { RequestDeduplicator } from '../request-deduplicator'
import { MockProvider } from '../mock-provider'
import { GeoProviderRegistry, geoProviderRegistry } from '../provider-registry'
import { FallbackChain } from '../fallback'
import { ProviderObservability } from '../observability'
import { geoProviderRegistry as singletonRegistry } from '../provider-registry'

// Suppress console output during tests
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

function quiet() {
  console.log = () => {}
  console.warn = () => {}
  console.error = () => {}
}

function loud() {
  console.log = originalLog
  console.warn = originalWarn
  console.error = originalError
}

let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}`)
  }
}

async function test() {
  console.log('\n=== GEO AI Provider Infrastructure — Verification ===\n')

  // ─── Test 1: Cache ───
  console.log('\n📦 Test Group 1: Cache')
  {
    const cache = new Cache(1000)
    
    // 1.1 Set and get
    cache.set('key1', { data: 'hello' })
    const val = cache.get<{ data: string }>('key1')
    assert(val?.data === 'hello', 'Cache.set/get works')
    
    // 1.2 Get non-existent
    const missing = cache.get('nonexistent')
    assert(missing === undefined, 'Cache.get returns undefined for missing key')
    
    // 1.3 Invalidate
    cache.invalidate('key1')
    const afterInvalidate = cache.get('key1')
    assert(afterInvalidate === undefined, 'Cache.invalidate removes entry')
    
    // 1.4 TTL expiry
    cache.set('ttl-key', 'value', 10) // 10ms TTL
    let ttlVal = cache.get('ttl-key')
    assert(ttlVal === 'value', 'Cache TTL: value exists before expiry')
    await new Promise(r => setTimeout(r, 20))
    ttlVal = cache.get('ttl-key')
    assert(ttlVal === undefined, 'Cache TTL: value expired after TTL')
    
    // 1.5 Clear
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    assert(cache.get('a') === undefined && cache.get('b') === undefined, 'Cache.clear removes all entries')
    
    // 1.6 getOrSet
    let factoryCalls = 0
    const val1 = await cache.getOrSet('factory-key', async () => { factoryCalls++; return 'computed' })
    assert(val1 === 'computed' && factoryCalls === 1, 'Cache.getOrSet computes on miss')
    const val2 = await cache.getOrSet('factory-key', async () => { factoryCalls++; return 'computed' })
    assert(val2 === 'computed' && factoryCalls === 1, 'Cache.getOrSet returns cached value')
  }

  // ─── Test 2: Circuit Breaker ───
  console.log('\n⚡ Test Group 2: Circuit Breaker')
  {
    const cb = new CircuitBreaker(3, 500) // threshold=3, duration=500ms
    
    // 2.1 Initial state is CLOSED
    assert(cb.allowRequest('provider-a').state === 'CLOSED', 'CB initial state is CLOSED')
    
    // 2.2 Records failures
    cb.recordFailure('provider-a') // 1
    assert(cb.allowRequest('provider-a').allowed, 'CB allows after 1 failure')
    cb.recordFailure('provider-a') // 2
    assert(cb.allowRequest('provider-a').allowed, 'CB allows after 2 failures')
    cb.recordFailure('provider-a') // 3 → OPEN
    assert(!cb.allowRequest('provider-a').allowed, 'CB blocks after threshold failures')
    assert(cb.allowRequest('provider-a').state === 'OPEN', 'CB state is OPEN')
    
    // 2.3 Per-provider isolation
    assert(cb.allowRequest('provider-b').allowed, 'CB allows other provider')
    
    // 2.4 Half-open after duration
    await new Promise(r => setTimeout(r, 600))
    const halfOpenCheck = cb.allowRequest('provider-a')
    assert(halfOpenCheck.allowed, 'CB transitions to HALF_OPEN after cooldown')
    assert(halfOpenCheck.state === 'HALF_OPEN', 'CB state is HALF_OPEN')
    
    // 2.5 Success in HALF_OPEN → CLOSED (after 3 successes)
    cb.recordSuccess('provider-a')
    cb.recordSuccess('provider-a')
    cb.recordSuccess('provider-a')
    assert(cb.allowRequest('provider-a').state === 'CLOSED', 'CB resets to CLOSED after successes')
    
    // 2.6 Failure in HALF_OPEN → back to OPEN
    cb.recordFailure('provider-c')
    cb.recordFailure('provider-c')
    cb.recordFailure('provider-c') // threshold=3 → OPEN
    assert(!cb.allowRequest('provider-c').allowed, 'CB blocks after threshold')
    await new Promise(r => setTimeout(r, 600)) // wait for half-open
    assert(cb.allowRequest('provider-c').state === 'HALF_OPEN', 'CB transitions to HALF_OPEN')
    cb.recordFailure('provider-c') // failure in half-open → back to OPEN
    assert(!cb.allowRequest('provider-c').allowed, 'CB re-opens after probe failure')
    
    // 2.7 Reset
    cb.reset('provider-a')
    assert(cb.allowRequest('provider-a').allowed, 'CB allows after reset')
  }

  // ─── Test 3: Rate Limiter ───
  console.log('\n⏱️ Test Group 3: Rate Limiter')
  {
    const rl = new RateLimiter()
    
    // 3.1 Basic acquire
    assert(rl.acquire('test-provider', 100), 'RL: first request is allowed')
    
    // 3.2 Rate limiting
    for (let i = 0; i < 100; i++) {
      rl.acquire('test-provider', 10)
    }
    // Should be rate limited now
    const blocked = rl.acquire('test-provider', 10)
    assert(!blocked, 'RL: excess requests are blocked')
    
    // 3.3 Different providers are independent
    assert(rl.acquire('other-provider', 10), 'RL: other provider not affected')
  }

  // ─── Test 4: Request Deduplicator ───
  console.log('\n🔄 Test Group 4: Request Deduplicator')
  {
    const dedup = new RequestDeduplicator(100)
    
    // 4.1 Deduplicate in-flight requests
    let callCount = 0
    const factory = async () => {
      callCount++
      await new Promise(r => setTimeout(r, 50))
      return 'result'
    }
    
    const [r1, r2] = await Promise.all([
      dedup.deduplicate('key1', factory),
      dedup.deduplicate('key1', factory),
    ])
    assert(r1 === 'result' && r2 === 'result', 'Dedup: both get result')
    assert(callCount === 1, 'Dedup: factory called only once')
    
    // 4.2 Completed cache
    const r3 = await dedup.deduplicate('key1', async () => { callCount++; return 'new' })
    assert(r3 === 'result', 'Dedup: returns cached completed result')
    assert(callCount === 1, 'Dedup: factory not called for cached result')
    
    // 4.3 Invalidate
    dedup.invalidate('key1')
    const r4 = await dedup.deduplicate('key1', async () => { callCount++; return 'fresh' })
    assert(r4 === 'fresh', 'Dedup: returns fresh result after invalidate')
    assert(callCount === 2, 'Dedup: factory called again after invalidate')
  }

  // ─── Test 5: MockProvider ───
  console.log('\n🎭 Test Group 5: MockProvider')
  {
    const provider = new MockProvider()
    
    // 5.1 Provider metadata
    assert(provider.name === 'mock', 'MockProvider name is "mock"')
    assert(provider.displayName === 'Mock Scanner (Demo)', 'MockProvider displayName set')
    assert(provider.capabilities.includes('discovery'), 'MockProvider has discovery capability')
    assert(provider.capabilities.includes('verification'), 'MockProvider has verification capability')
    
    // 5.2 Discovery
    const discoverResult = await provider.discover({
      entity: 'Acme Robotics',
      matchConfidences: { 'brand-discovery': 0.85, 'tech-review': 0.6 },
    })
    assert(discoverResult.scenarios.length > 0, 'MockProvider discover returns scenarios')
    assert(typeof discoverResult.coverage === 'number', 'MockProvider discover: coverage is number')
    assert(typeof discoverResult.share === 'number', 'MockProvider discover: share is number')
    assert(typeof discoverResult.position === 'number', 'MockProvider discover: position is number')
    assert(discoverResult.meta.provider === 'mock', 'MockProvider discover meta has provider=mock')
    assert(typeof discoverResult.meta.latencyMs === 'number', 'MockProvider discover meta has latencyMs')
    
    // 5.3 Verification
    const verifyResult = await provider.verify({
      entity: 'Acme Robotics',
      projectId: 'test-project',
      claims: ['ADI has improved by 5 points', 'AI presence score increased by 10'],
    })
    assert(verifyResult.claims.length === 2, 'MockProvider verify returns claims')
    assert(typeof verifyResult.overallConfidence === 'number', 'MockProvider verify has overallConfidence')
    verifyResult.claims.forEach(claim => {
      assert(typeof claim.verified === 'boolean', 'MockProvider verify: each claim has verified boolean')
      assert(typeof claim.confidence === 'number', 'MockProvider verify: each claim has confidence')
      assert(Array.isArray(claim.evidence), 'MockProvider verify: each claim has evidence array')
    })
    
    // 5.4 Health
    const health = await provider.health()
    assert(health.ok, 'MockProvider health returns ok')
    assert(typeof health.latencyMs === 'number', 'MockProvider health has latencyMs')
  }

  // ─── Test 6: GeoProviderRegistry ───
  console.log('\n🏛️ Test Group 6: GeoProviderRegistry')
  {
    quiet()
    const registry = new GeoProviderRegistry()
    loud()
    
    // 6.1 MockProvider pre-registered
    assert(registry.listProviders().includes('mock'), 'Registry has mock provider')
    
    // 6.2 Discover through registry
    const result = await registry.discover({
      entity: 'Test Corp',
      matchConfidences: { 'scenario-1': 0.9 },
    })
    assert(result.scenarios.length > 0, 'Registry.discover works')
    assert(!result.meta.cached, 'First call is not cached')
    
    // 6.3 Cache works (same request → cached)
    const cachedResult = await registry.discover({
      entity: 'Test Corp',
      matchConfidences: { 'scenario-1': 0.9 },
    })
    assert(cachedResult.meta.cached, 'Second call returns cached result')
    
    // 6.4 Verify through registry
    const verifyResult = await registry.verify({
      entity: 'Test Corp',
      projectId: 'proj-1',
      claims: ['claim 1', 'claim 2'],
    })
    assert(verifyResult.claims.length > 0, 'Registry.verify works')
    
    // 6.5 Metrics
    const metrics = registry.getMetrics()
    assert(metrics.totalRequests >= 3, 'Registry metrics: totalRequests >= 3')
    assert(metrics.successRate > 0, 'Registry metrics: successRate > 0')
    assert(typeof metrics.latencyMs.avg === 'number', 'Registry metrics: has latencyMs avg')
    
    // 6.6 Provider health
    const health = await registry.providerHealth('mock')
    assert(health.length === 1, 'Registry.providerHealth returns array')
    assert(health[0].healthy, 'Registry.providerHealth: mock is healthy')
  }

  // ─── Test 7: Circuit Breaker Integration ───
  console.log('\n🔌 Test Group 7: Circuit Breaker Integration')
  {
    quiet()
    // Create registry WITH circuit break config in constructor
    const registry = new GeoProviderRegistry({
      retryCount: 0,
      circuitBreakThreshold: 3,
      cacheTtlMs: 100, // short cache
    })
    
    // Register a failing mock (we'll override the discover to simulate failures)
    const failingProvider = new MockProvider()
    let failCount = 0
    failingProvider.discover = async (req) => {
      failCount++
      throw new Error(`Simulated failure #${failCount}`)
    }
    
    // Override the mock's discover to fail
    registry['providers'].set('mock', failingProvider)
    
    // First 3 calls should fail
    for (let i = 0; i < 3; i++) {
      try {
        await registry.discover({ entity: 'Test', matchConfidences: {} })
      } catch (e) {
        // Expected
      }
    }
    
    // 4th call should be blocked by circuit breaker
    try {
      await registry.discover({ entity: 'Test', matchConfidences: {} })
      assert(false, 'CB: should have thrown')
    } catch (e: any) {
      assert(e.message.includes('Circuit breaker'), 'CB: blocks request with circuit breaker error')
    }
    
    loud()
  }
  
  // ─── Test 8: Rate Limiter Integration ───
  console.log('\n⛔ Test Group 8: Rate Limiter Integration')
  {
    quiet()
    const registry = new GeoProviderRegistry({
      rateLimitPerSecond: 1,
      retryCount: 0,
      cacheTtlMs: 100,
    })
    
    // First request should work
    const first = await registry.discover({ entity: 'Test', matchConfidences: {} })
    assert(first.scenarios.length > 0, 'RL Integration: first request succeeds')
    
    // Second immediate request should be rate limited
    try {
      await registry.discover({ entity: 'Test2', matchConfidences: {} })
      assert(false, 'RL Integration: should have been rate limited')
    } catch (e: any) {
      assert(e.message.includes('Rate limit'), 'RL Integration: blocks with rate limit error')
    }
    
    loud()
  }

  // ─── Test 9: Fallback Chain ───
  console.log('\n🔁 Test Group 9: Fallback Chain')
  {
    quiet()
    const registry = new GeoProviderRegistry()
    
    // Create a failing provider and register it as 'deepseek'
    const failingProvider = Object.assign(Object.create(Object.getPrototypeOf(new MockProvider())), {
      _name: 'deepseek',
      _displayName: 'Failing DeepSeek',
      discover: async () => { throw new Error('DeepSeek API unavailable') },
      get name() { return this._name },
      get displayName() { return this._displayName },
    })
    registry.register(failingProvider as any)
    
    // Create fallback chain: deepseek → mock
    const fallback = new FallbackChain(registry, ['deepseek', 'mock'])
    
    // Should fallback to mock and succeed
    const result = await fallback.discover({
      entity: 'Test Corp',
      matchConfidences: { 'scenario-1': 0.9 },
    })
    assert(result.scenarios.length > 0, 'Fallback: succeeds after primary fails')
    assert(result.meta.provider === 'mock', 'Fallback: result comes from mock (the fallback)')
    
    loud()
  }

  // ─── Test 10: Observability ───
  console.log('\n📊 Test Group 10: Observability')
  {
    quiet()
    const registry = new GeoProviderRegistry()
    
    // 10.1 Events fire to listeners
    let receivedEvents: any[] = []
    registry.onEvent((event) => {
      receivedEvents.push(event)
    })
    
    await registry.discover({ entity: 'Test', matchConfidences: {} })
    await registry.verify({ entity: 'Test', projectId: 'p1', claims: ['c1'] })
    
    assert(receivedEvents.length >= 2, 'Events: at least 2 events received')
    const discoverEvents = receivedEvents.filter(e => e.capability === 'discovery')
    assert(discoverEvents.length > 0, 'Events: discovery events fired')
    
    // 10.2 Metrics
    const metrics = registry.getMetrics()
    assert(metrics.totalRequests >= 2, 'Metrics: totalRequests tracked')
    
    // 10.3 Per-provider metrics
    if (metrics.byProvider) {
      assert(metrics.byProvider['mock'] !== undefined, 'Metrics: per-provider breakdown exists')
    }
    
    loud()
  }

  // ─── Summary ───
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  console.log(`${'='.repeat(50)}\n`)
  
  process.exit(failed > 0 ? 1 : 0)
}

test().catch(err => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
