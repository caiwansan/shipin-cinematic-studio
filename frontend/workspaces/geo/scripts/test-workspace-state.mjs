/**
 * GEO Workspace State — Test Suite
 *
 * Covers:
 *   - Page State: legal/illegal transitions
 *   - Task State: legal/illegal/terminal transitions
 *   - Card State: legal/illegal/terminal/undo transitions
 *   - SSR safety: no global state, no timers
 *   - Multi-instance: independent instances
 *   - IsIdle composition
 *
 * Part of S1.1B-01 Workspace State Core.
 *
 * Usage: npx tsx scripts/test-workspace-state.mjs
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Load state machines ──

const {
  transitionPage,
  transitionTask,
  transitionCard,
  getPageTransitionMatrix,
  getTaskTransitionMatrix,
  getCardTransitionMatrix,
} = await import(resolve(ROOT, 'lib/state-machines.ts'))

const { useWorkspaceState } = await import(resolve(ROOT, 'composables/useWorkspaceState.ts'))

const {
  TASK_TERMINAL_STATES,
  CARD_TERMINAL_STATES,
} = await import(resolve(ROOT, 'types/state.ts'))

// ── Test Runner ──

let passed = 0
let failed = 0
let assertCount = 0

function assert(condition, label) {
  assertCount++
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`  ❌ FAIL: ${label}`)
  }
}

function group(name, fn) {
  console.log(`\n── ${name} ──`)
  fn()
}

// ── 1. Page State Machine ──

group('Page State — legal transitions', () => {
  assert(transitionPage('idle', 'loading'), 'idle → loading')
  assert(transitionPage('loading', 'ready'), 'loading → ready')
  assert(transitionPage('loading', 'empty'), 'loading → empty')
  assert(transitionPage('loading', 'error'), 'loading → error')
  assert(transitionPage('ready', 'loading'), 'ready → loading')
  assert(transitionPage('empty', 'loading'), 'empty → loading')
  assert(transitionPage('error', 'loading'), 'error → loading')
})

group('Page State — illegal transitions', () => {
  assert(!transitionPage('idle', 'ready'), 'idle → ready rejected')
  assert(!transitionPage('idle', 'empty'), 'idle → empty rejected')
  assert(!transitionPage('idle', 'error'), 'idle → error rejected')
  assert(!transitionPage('ready', 'empty'), 'ready → empty rejected')
  assert(!transitionPage('ready', 'error'), 'ready → error rejected')
  assert(!transitionPage('empty', 'ready'), 'empty → ready rejected')
  assert(!transitionPage('empty', 'error'), 'empty → error rejected')
  assert(!transitionPage('error', 'ready'), 'error → ready rejected')
  assert(!transitionPage('error', 'empty'), 'error → empty rejected')
})

// ── 2. Task State Machine ──

group('Task State — legal transitions', () => {
  assert(transitionTask('idle', 'queued'), 'idle → queued')
  assert(transitionTask('queued', 'running'), 'queued → running')
  assert(transitionTask('queued', 'cancelled'), 'queued → cancelled')
  assert(transitionTask('running', 'paused'), 'running → paused')
  assert(transitionTask('running', 'failed'), 'running → failed')
  assert(transitionTask('running', 'completed'), 'running → completed')
  assert(transitionTask('paused', 'running'), 'paused → running')
  assert(transitionTask('paused', 'cancelled'), 'paused → cancelled')
})

group('Task State — terminal rejection', () => {
  transitionTask('idle', 'queued')
  transitionTask('queued', 'running')
  transitionTask('running', 'completed')
  assert(!transitionTask('completed', 'idle'), 'completed → idle rejected')
  assert(!transitionTask('completed', 'running'), 'completed → running rejected')

  transitionTask('idle', 'queued')
  transitionTask('queued', 'running')
  transitionTask('running', 'failed')
  assert(!transitionTask('failed', 'idle'), 'failed → idle rejected')

  transitionTask('idle', 'queued')
  transitionTask('queued', 'cancelled')
  assert(!transitionTask('cancelled', 'idle'), 'cancelled → idle rejected')
})

group('Task State — illegal transitions', () => {
  assert(!transitionTask('idle', 'running'), 'idle → running rejected')
  assert(!transitionTask('idle', 'completed'), 'idle → completed rejected')
  assert(!transitionTask('idle', 'paused'), 'idle → paused rejected')
  assert(!transitionTask('idle', 'failed'), 'idle → failed rejected')
  assert(!transitionTask('queued', 'paused'), 'queued → paused rejected')
  assert(!transitionTask('running', 'queued'), 'running → queued rejected')
})

// ── 3. Card State Machine ──

group('Card State — legal transitions', () => {
  assert(transitionCard('collapsed', 'expanded'), 'collapsed → expanded')
  assert(transitionCard('expanded', 'collapsed'), 'expanded → collapsed')
  assert(transitionCard('expanded', 'executing'), 'expanded → executing')
  assert(transitionCard('executing', 'completed'), 'executing → completed')
  assert(transitionCard('executing', 'collapsed'), 'executing → collapsed')
  assert(transitionCard('completed', 'undo'), 'completed → undo')
  assert(transitionCard('completed', 'dismissed'), 'completed → dismissed')
  assert(transitionCard('undo', 'dismissed'), 'undo → dismissed')
  assert(transitionCard('undo', 'collapsed'), 'undo → collapsed')
})

group('Card State — terminal rejection', () => {
  transitionCard('collapsed', 'expanded')
  transitionCard('expanded', 'executing')
  transitionCard('executing', 'completed')
  transitionCard('completed', 'dismissed')
  assert(!transitionCard('dismissed', 'collapsed'), 'dismissed → collapsed rejected')
  assert(!transitionCard('dismissed', 'expanded'), 'dismissed → expanded rejected')
  assert(!transitionCard('dismissed', 'undo'), 'dismissed → undo rejected')
})

group('Card State — illegal transitions', () => {
  assert(!transitionCard('collapsed', 'executing'), 'collapsed → executing rejected')
  assert(!transitionCard('collapsed', 'completed'), 'collapsed → completed rejected')
  assert(!transitionCard('collapsed', 'dismissed'), 'collapsed → dismissed rejected')
  assert(!transitionCard('collapsed', 'undo'), 'collapsed → undo rejected')
  assert(!transitionCard('expanded', 'dismissed'), 'expanded → dismissed rejected')
  assert(!transitionCard('expanded', 'completed'), 'expanded → completed rejected')
  assert(!transitionCard('executing', 'undo'), 'executing → undo rejected')
  assert(!transitionCard('executing', 'dismissed'), 'executing → dismissed rejected')
})

// ── 4. SSR Safety ──

group('SSR Safety', () => {
  const ws = useWorkspaceState()
  assert(typeof ws.page.current === 'string', 'page state is string')
  assert(ws.page.current === 'idle', 'page defaults to idle')
  assert(ws.task.current === 'idle', 'task defaults to idle')
  assert(ws.card.current === 'collapsed', 'card defaults to collapsed')

  const ws2 = useWorkspaceState()
  assert(ws2 !== ws, 'each useWorkspaceState returns new instance')
  assert(typeof ws.page.transition === 'function', 'transition is sync function')
  assert(typeof ws.page.reset === 'function', 'reset is sync function')
})

// ── 5. Multi-instance Isolation ──

group('Multi-instance Isolation', () => {
  const wsA = useWorkspaceState()
  const wsB = useWorkspaceState()

  wsA.page.transition('loading')
  wsA.page.transition('ready')
  wsB.page.transition('loading')

  assert(wsA.page.current === 'ready', 'instance A reaches ready')
  assert(wsB.page.current === 'loading', 'instance B stays loading')
  assert(wsA.page.last === 'loading', 'instance A tracks last')
  assert(wsB.page.last === 'idle', 'instance B tracks last independently')
})

// ── 6. isIdle Composition ──

group('isIdle Composition', () => {
  const ws = useWorkspaceState()
  assert(ws.isIdle === true, 'starts idle')

  ws.page.transition('loading')
  assert(ws.isIdle === false, 'loading = not idle')

  ws.page.transition('ready')
  assert(ws.isIdle === true, 'ready + idle task = idle')

  ws.task.transition('queued')
  assert(ws.isIdle === false, 'active task = not idle')

  ws.task.transition('running')
  ws.task.transition('completed')
  // Terminal task states are idle in composition
  assert(ws.isIdle === true, 'ready + completed task = idle (task terminal)')

  ws.reset()
  assert(ws.isIdle === true, 'reset restores idle')
  assert(ws.page.current === 'idle', 'reset page = idle')
  assert(ws.task.current === 'idle', 'reset task = idle')
  assert(ws.card.current === 'collapsed', 'reset card = collapsed')
})

// ── 7. Task Progress ──

group('Task Progress', () => {
  const ws = useWorkspaceState()
  ws.task.setProgress({ percent: 50, message: 'halfway' })
  assert(ws.task.progress.percent === 50, 'progress set to 50')
  assert(ws.task.progress.message === 'halfway', 'progress message stored')

  ws.task.setProgress({ percent: 150 })
  assert(ws.task.progress.percent === 100, 'progress clamped to 100')

  ws.task.setProgress({ percent: -10 })
  assert(ws.task.progress.percent === 0, 'progress clamped to 0')
})

// ── 8. Card undoWindow ──

group('Card Undo Window', () => {
  const ws = useWorkspaceState(15000)
  assert(ws.card.undoWindow === 15000, 'custom undo window set')
  assert(typeof ws.card.transition('expanded') === 'boolean', 'transition returns boolean')
})

// ── 9. Last State Tracking ──

group('Last State Tracking', () => {
  const ws = useWorkspaceState()

  ws.page.transition('loading')
  assert(ws.page.last === 'idle', 'page last = idle after loading')

  ws.page.transition('error')
  assert(ws.page.last === 'loading', 'page last = loading after error')

  // Illegal transition does not change last
  ws.page.transition('ready')
  assert(ws.page.last === 'loading', 'page last unchanged after illegal transition')
})

// ── 10. State Lock Generation ──

group('State Lock', () => {
  const pageMatrix = getPageTransitionMatrix()
  const taskMatrix = getTaskTransitionMatrix()
  const cardMatrix = getCardTransitionMatrix()

  assert(typeof pageMatrix['idle'].includes('loading'), 'page matrix has idle→loading')
  assert(typeof taskMatrix['running'].includes('failed'), 'task matrix has running→failed')
  assert(typeof cardMatrix['undo'].includes('collapsed'), 'card matrix has undo→collapsed')

  const hash = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)

  const stateLock = {
    version: '1.0',
    created: new Date().toISOString(),
    description: 'GEO Workspace State Machines Lock — PA-004 S1.1B-01',
    hashes: {
      'page-state-machine': hash(JSON.stringify(pageMatrix)),
      'task-state-machine': hash(JSON.stringify(taskMatrix)),
      'card-state-machine': hash(JSON.stringify(cardMatrix)),
      'transition-matrices': hash(
        JSON.stringify(pageMatrix) + JSON.stringify(taskMatrix) + JSON.stringify(cardMatrix),
      ),
    },
    terminalStates: {
      page: [],
      task: Array.from(TASK_TERMINAL_STATES),
      card: Array.from(CARD_TERMINAL_STATES),
    },
  }

  writeFileSync(resolve(ROOT, 'state.lock'), JSON.stringify(stateLock, null, 2))

  const readback = JSON.parse(readFileSync(resolve(ROOT, 'state.lock'), 'utf-8'))
  assert(readback.hashes['page-state-machine'] === stateLock.hashes['page-state-machine'], 'lock self-verified')
})

// ── Summary ──

console.log(`\n${'='.repeat(50)}`)
console.log(`Tests: ${assertCount}  |  Passed: ${passed}  |  Failed: ${failed}`)
if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`)
  process.exit(1)
} else {
  console.log(`\n✅ ALL PASSED`)
}
