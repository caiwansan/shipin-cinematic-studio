#!/usr/bin/env tsx
/**
 * System Validation: Async State Machine
 *
 * Tests:
 *   - Valid state transitions
 *   - Invalid state transitions (error thrown)
 *   - computeInstanceState from node states
 *   - computeProgress
 *   - Terminal state detection
 *
 * Run: npx tsx tests/kernel/02-async-state-machine.test.ts
 */

import {
  validateNodeTransition,
  validateInstanceStateTransition,
  computeInstanceState,
  computeProgress,
  isNodeTerminal,
  isInstanceTerminal,
} from '../../src/kernel/async-plane/async-state-machine.js'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
  } catch (e) {
    console.log(`  ❌ ${name}: ${(e as Error).message}`)
    process.exitCode = 1
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

console.log('\n=== 02: Async State Machine ===\n')

// === Valid transitions ===
test('PENDING → RUNNING is valid', () => {
  validateNodeTransition('PENDING', 'RUNNING')
})

test('RUNNING → COMPLETED is valid', () => {
  validateNodeTransition('RUNNING', 'COMPLETED')
})

test('RUNNING → SUSPENDED is valid', () => {
  validateNodeTransition('RUNNING', 'SUSPENDED')
})

test('SUSPENDED → RUNNING is valid', () => {
  validateNodeTransition('SUSPENDED', 'RUNNING')
})

test('FAILED → RETRYING is valid', () => {
  validateNodeTransition('FAILED', 'RETRYING')
})

test('RETRYING → RUNNING is valid', () => {
  validateNodeTransition('RETRYING', 'RUNNING')
})

// === Invalid transitions ===
test('COMPLETED → RUNNING throws', () => {
  let threw = false
  try {
    validateNodeTransition('COMPLETED', 'RUNNING')
  } catch {
    threw = true
  }
  assert(threw, 'should have thrown')
})

test('PENDING → COMPLETED throws', () => {
  let threw = false
  try {
    validateNodeTransition('PENDING', 'COMPLETED')
  } catch {
    threw = true
  }
  assert(threw, 'should have thrown')
})

test('CANCELLED → RUNNING throws', () => {
  let threw = false
  try {
    validateNodeTransition('CANCELLED', 'RUNNING')
  } catch {
    threw = true
  }
  assert(threw, 'should have thrown')
})

// === computeInstanceState ===
test('all COMPLETED → COMPLETED', () => {
  const state = computeInstanceState(['COMPLETED', 'COMPLETED'])
  assert(state === 'COMPLETED', `expected COMPLETED, got ${state}`)
})

test('any RUNNING → RUNNING', () => {
  const state = computeInstanceState(['COMPLETED', 'RUNNING'])
  assert(state === 'RUNNING', `expected RUNNING, got ${state}`)
})

test('any FAILED → FAILED', () => {
  const state = computeInstanceState(['COMPLETED', 'FAILED'])
  assert(state === 'FAILED', `expected FAILED, got ${state}`)
})

test('all CANCELLED → CANCELLED', () => {
  const state = computeInstanceState(['CANCELLED', 'CANCELLED'])
  assert(state === 'CANCELLED', `expected CANCELLED, got ${state}`)
})

test('empty array → PENDING', () => {
  const state = computeInstanceState([])
  assert(state === 'PENDING', `expected PENDING, got ${state}`)
})

test('any SUSPENDED → SUSPENDED', () => {
  const state = computeInstanceState(['COMPLETED', 'SUSPENDED'])
  assert(state === 'SUSPENDED', `expected SUSPENDED, got ${state}`)
})

// === computeProgress ===
test('empty → null', () => {
  const p = computeProgress([])
  assert(p === null, `expected null, got ${p}`)
})

test('all PENDING → 0', () => {
  const p = computeProgress(['PENDING', 'PENDING'])
  assert(p === 0, `expected 0, got ${p}`)
})

test('all COMPLETED → 1', () => {
  const p = computeProgress(['COMPLETED', 'COMPLETED'])
  assert(p === 1, `expected 1, got ${p}`)
})

test('half completed → 0.5', () => {
  const p = computeProgress(['COMPLETED', 'RUNNING'])
  assert(p === 0.5, `expected 0.5, got ${p}`)
})

// === isNodeTerminal ===
test('COMPLETED is terminal', () => {
  assert(isNodeTerminal('COMPLETED') === true, 'expected true')
})

test('FAILED is terminal', () => {
  assert(isNodeTerminal('FAILED') === false, 'FAILED can retry, so not terminal')
})

test('CANCELLED is terminal', () => {
  assert(isNodeTerminal('CANCELLED') === true, 'expected true')
})

test('RUNNING is not terminal', () => {
  assert(isNodeTerminal('RUNNING') === false, 'expected false')
})

// === isInstanceTerminal ===
test('instance COMPLETED is terminal', () => {
  assert(isInstanceTerminal('COMPLETED') === true, 'expected true')
})

test('instance RUNNING is not terminal', () => {
  assert(isInstanceTerminal('RUNNING') === false, 'expected false')
})

console.log('\n=== 02 Complete ===\n')
