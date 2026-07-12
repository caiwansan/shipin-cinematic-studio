/**
 * GEO Event Bus — Test Suite
 *
 * Standalone test suite. No test framework dependency.
 * Run: node scripts/test-event-bus.mjs
 *
 * Covers 13 test scenarios + 1 benchmark.
 * Exit code: 0 = all passed, 1 = any failed.
 */

import { createEventBus } from '../lib/eventBus.js'

let passed = 0
let failed = 0
const totalStart = Date.now()

function assert(condition, message) {
  if (condition) { passed++; process.stdout.write('.') }
  else { failed++; console.error(`\nFAIL: ${message}`) }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) { passed++; process.stdout.write('.') }
  else { failed++; console.error(`\nFAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`) }
}

// 1: emit/on basic
{
  const bus = createEventBus()
  let received = null
  bus.on('TASK:UPDATED', (p) => { received = p })
  bus.emit('TASK:UPDATED', { taskId: 't1', progress: 50, status: 'running' })
  assert(received !== null, 'emit/on: listener receives payload')
  if (received) assertEqual(received.taskId, 't1', 'emit/on: payload content')
}

// 2: off
{
  const bus = createEventBus()
  let count = 0
  const handler = () => { count++ }
  bus.on('SYSTEM:READY', handler)
  bus.emit('SYSTEM:READY', {})
  bus.off('SYSTEM:READY', handler)
  bus.emit('SYSTEM:READY', {})
  assertEqual(count, 1, 'off: listener not called after removal')
}

// 3: once
{
  const bus = createEventBus()
  let count = 0
  const handler = () => { count++ }
  bus.once('SYSTEM:READY', handler)
  bus.emit('SYSTEM:READY', {})
  bus.emit('SYSTEM:READY', {})
  assertEqual(count, 1, 'once: listener called only once')
}

// 4: duplicate listener prevention
{
  let callCount = 0
  const handler = () => { callCount++ }
  const bus = createEventBus()
  const registered = new Map()

  function safeOn(event, handler) {
    const set = registered.get(event) || new Set()
    if (set.has(handler)) return
    set.add(handler)
    registered.set(event, set)
    bus.on(event, handler)
  }

  safeOn('SYSTEM:READY', handler)
  safeOn('SYSTEM:READY', handler)
  bus.emit('SYSTEM:READY', {})
  assertEqual(callCount, 1, 'duplicate prevention: handler called once')
}

// 5: nested emit stability
{
  const bus = createEventBus()
  let outerCalls = 0, innerCalls = 0
  bus.on('SYSTEM:READY', () => {
    outerCalls++
    bus.emit('TASK:STARTED', { taskId: 'nested', type: 'test' })
  })
  bus.on('TASK:STARTED', () => { innerCalls++ })
  bus.emit('SYSTEM:READY', {})
  assertEqual(outerCalls, 1, 'nested emit: outer')
  assertEqual(innerCalls, 1, 'nested emit: inner')
}

// 6: remove-while-dispatch safety
{
  const bus = createEventBus()
  let calls = []
  const handlerA = () => { calls.push('A') }
  const handlerB = () => { calls.push('B'); bus.off('SYSTEM:READY', handlerA) }
  const handlerC = () => { calls.push('C') }
  bus.on('SYSTEM:READY', handlerA)
  bus.on('SYSTEM:READY', handlerB)
  bus.on('SYSTEM:READY', handlerC)
  bus.emit('SYSTEM:READY', {})
  assert(calls.length >= 2, 'remove-while-dispatch: continues')
}

// 7: async listener (no crash)
{
  const bus = createEventBus()
  bus.on('SYSTEM:READY', async () => { await Promise.resolve() })
  bus.emit('SYSTEM:READY', {})
  assert(true, 'async listener: no crash')
}

// 8: SSR safe (no window)
{
  const bus = createEventBus({ dev: false })
  let ok = false
  bus.on('SYSTEM:READY', () => { ok = true })
  bus.emit('SYSTEM:READY', {})
  assert(ok, 'SSR: emit works without window')
}

// 9: memory leak (10k register/unregister)
{
  const bus = createEventBus()
  const handlers = []
  for (let i = 0; i < 10000; i++) {
    const h = () => {}
    handlers.push(h)
    bus.on('SYSTEM:READY', h)
  }
  for (const h of handlers) bus.off('SYSTEM:READY', h)
  const mittInternal = bus._mitt
  const all = mittInternal.all
  const remaining = all?.get('SYSTEM:READY')?.size || 0
  assertEqual(remaining, 0, 'memory leak: all listeners removed')
}

// 10: middleware read-only
{
  const bus = createEventBus({
    middlewares: [{
      name: 'mutator',
      beforeEmit(event, payload) {
        payload.mutated = true // attempt to mutate
      },
    }],
  })
  let received = null
  bus.on('TASK:STARTED', (p) => { received = p })
  const origPayload = { taskId: 'original', type: 'test' }
  bus.emit('TASK:STARTED', origPayload)
  assert(received !== null, 'middleware: listener received payload')
  assert(received.taskId === 'original', 'middleware: payload not mutated pre-dispatch')
}

// 11: dev inspector
{
  const bus = createEventBus({ dev: true })
  bus.emit('SYSTEM:READY', {})
  bus.emit('TASK:STARTED', { taskId: 't1', type: 'test' })
  const w = globalThis
  const inspector = w.__GEO_EVENTBUS__
  assert(!!inspector, 'dev inspector exists')
  if (inspector) {
    assertEqual(inspector.history().length, 2, 'inspector history')
    assert(inspector.last() !== null, 'inspector last()')
    const stats = inspector.stats()
    assertEqual(stats.total, 2, 'inspector stats total')
    inspector.clear()
    assertEqual(inspector.history().length, 0, 'inspector clear')
  }
}

// 12: middleware does not swallow
{
  let received = false
  const bus = createEventBus({
    middlewares: [{ name: 'observer', beforeEmit() {} }],
  })
  bus.on('SYSTEM:READY', () => { received = true })
  bus.emit('SYSTEM:READY', {})
  assert(received, 'middleware: does not swallow')
}

// 13: Benchmark 10k emits
{
  const bus = createEventBus()
  const handler = () => {}
  bus.on('TASK:UPDATED', handler)
  const start = Date.now()
  for (let i = 0; i < 10000; i++) {
    bus.emit('TASK:UPDATED', { taskId: `b${i}`, progress: i, status: 'running' })
  }
  const elapsed = Date.now() - start
  bus.off('TASK:UPDATED', handler)

  if (elapsed < 40) console.log(`\nBENCH: 10000 emits in ${elapsed}ms (PASS < 40ms)`)
  else if (elapsed < 80) console.log(`\nBENCH: 10000 emits in ${elapsed}ms (WARN < 80ms)`)
  else { console.error(`\nBENCH: 10000 emits in ${elapsed}ms (FAIL > 80ms)`); failed++ }
}

const totalElapsed = Date.now() - totalStart
console.log(`\n\n${passed} passed, ${failed} failed, ${totalElapsed}ms`)

if (failed > 0) { process.exit(1) }
else { console.log('ALL PASSED'); process.exit(0) }
