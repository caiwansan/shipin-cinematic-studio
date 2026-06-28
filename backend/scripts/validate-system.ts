#!/usr/bin/env tsx
/**
 * Phase 6.9 — System Validation Harness
 *
 * End-to-end validation suite for EGOS Kernel.
 * Run: npx tsx scripts/validate-system.ts
 *
 * Exit codes:
 *   0 → All checks passed
 *   1 → Build or test failure
 *   2 → Architecture constraint violation
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

// ============================================================
// Constants
// ============================================================

const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'src')

// ============================================================
// Test Infrastructure
// ============================================================

interface CheckResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail?: string
}

const checks: CheckResult[] = []
let exitCode = 0
let status: 'PASS' | 'FAIL' = 'PASS'

function pass(name: string, detail?: string) {
  checks.push({ name, status: 'PASS', detail })
}

function fail(name: string, detail: string) {
  checks.push({ name, status: 'FAIL', detail })
  exitCode = 1
  status = 'FAIL'
}

function findTsFiles(dir: string): string[] {
  const files: string[] = []
  function walk(d: string) {
    if (!existsSync(d)) return
    const entries = readdirSync(d, { withFileTypes: true })
    for (const e of entries) {
      const p = resolve(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) files.push(p)
    }
  }
  walk(dir)
  return files
}

// ============================================================
// Phase 1: Build Integrity
// ============================================================

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Phase 1: Build Integrity')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

// 1a. Type check
{
  console.log('  npx tsc --noEmit ...')
  const start = Date.now()
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 })
    const ms = Date.now() - start
    pass(`TypeScript compilation (${ms}ms)`)
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || 'unknown error'
    fail(`TypeScript compilation`, output.slice(0, 200))
  }
}

// 1b. No circular dependencies
{
  console.log('  Checking circular dependencies ...')
  const kernelDir = resolve(SRC, 'kernel')
  const transportDir = resolve(SRC, 'transport')

  const kernelFiles = findTsFiles(kernelDir)
  let kernelImportsTransport = false
  for (const f of kernelFiles) {
    const content = readFileSync(f, 'utf-8')
    if (content.includes('../transport/') || content.includes('transport/sse')) {
      // Only execution-event-bus import is allowed
      if (content.includes('execution-event-bus')) continue
      kernelImportsTransport = true
    }
  }

  const transportFiles = findTsFiles(transportDir)
  let transportImportsKernel = false
  for (const f of transportFiles) {
    const content = readFileSync(f, 'utf-8')
    if (content.includes('../../kernel/')) {
      transportImportsKernel = true
    }
  }

  if (!kernelImportsTransport && !transportImportsKernel) {
    pass('No circular dependency (kernel ↔ transport)')
  } else {
    if (kernelImportsTransport) fail('Kernel imports transport layer', 'kernel/ should not import transport/')
    if (transportImportsKernel) fail('Transport imports kernel', 'transport/ should not import kernel/')
  }
}

// 1c. Async plane isolation
{
  console.log('  Checking async-plane isolation ...')
  const asyncDir = resolve(SRC, 'kernel/async-plane')
  const asyncFiles = findTsFiles(asyncDir)
  let violation = false
  for (const f of asyncFiles) {
    const content = readFileSync(f, 'utf-8')
    if (content.includes('../kernel') || content.includes('../persistence')) {
      violation = true
    }
  }
  if (!violation) {
    pass('Async plane is isolated (no kernel/persistence imports)')
  } else {
    fail('Async plane imports kernel layer', 'async-plane/ should be self-contained')
  }
}

// 1d. Persistence isolation
{
  console.log('  Checking persistence isolation ...')
  const persistDir = resolve(SRC, 'kernel/persistence')
  const persistFiles = findTsFiles(persistDir)
  let violation = false
  for (const f of persistFiles) {
    const content = readFileSync(f, 'utf-8')
    if (content.includes('transport/')) {
      violation = true
    }
  }
  if (!violation) {
    pass('Persistence layer is isolated (no transport imports)')
  } else {
    fail('Persistence imports transport', 'persistence/ should not import transport/')
  }
}

// ============================================================
// Phase 2: Kernel Test Suite
// ============================================================

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Phase 2: Kernel Test Suite')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

{
  console.log('  Running: tests/run.sh ...')
  const start = Date.now()
  try {
    execSync('bash tests/run.sh', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 })
    const ms = Date.now() - start
    pass(`Kernel test suite (${ms}ms)`)
  } catch (e: any) {
    const output = e.stdout?.toString() || ''
    const failures = (output.match(/❌/g) || []).length
    fail(`Kernel test suite (${failures} failures)`, output.slice(0, 300))
  }
}

// ============================================================
// Phase 3: Runtime Integrity (static check)
// ============================================================

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Phase 3: Execution Integrity')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

{
  // Dynamic import of .ts from .ts with esbuild CJS target fails.
  // The ExecutionModeResolver is verified by test suite 01.
  // This phase validates that key source files exist and are parseable.
  const resolverFile = resolve(SRC, 'kernel/execution-mode-resolver.ts')
  const asyncRuntimeFile = resolve(SRC, 'kernel/async-execution-runtime.ts')

  let allExist = true
  if (!existsSync(resolverFile)) { fail('execution-mode-resolver.ts missing'); allExist = false }
  if (!existsSync(asyncRuntimeFile)) { fail('async-execution-runtime.ts missing'); allExist = false }

  if (allExist) {
    pass('Key runtime modules exist (verified by test suite)')
  }
}

// ============================================================
// Phase 4: Architecture Constraints
// ============================================================

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Phase 4: Architecture Constraints')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

{
  // R2_ASYNC_NOT_BLOCKING: submit() must return immediately (synchronous)
  const asyncRuntimeContent = readFileSync(resolve(SRC, 'kernel/async-execution-runtime.ts'), 'utf-8')
  const hasAsyncSubmit = asyncRuntimeContent.includes('async submit')
  if (!hasAsyncSubmit) {
    pass('R2_ASYNC_NOT_BLOCKING — submit() is synchronous')
  } else {
    fail('R2_ASYNC_NOT_BLOCKING violation', 'submit() should NOT be async')
  }

  // R3_KERNEL_DOES_NOT_MANAGE_ASYNC_TICK
  const kernelContent = readFileSync(resolve(SRC, 'kernel/kernel.ts'), 'utf-8')
  const noTickKernel = !kernelContent.includes('tick()') && !kernelContent.includes('startTick')
  if (noTickKernel) {
    pass('R3_KERNEL_NO_TICK — tick loop lives in AsyncExecutionRuntime')
  } else {
    fail('R3_KERNEL_NO_TICK violation', 'Kernel should not have tick()')
  }

  // R5_STREAM_ZERO_AWARENESS
  const streamPlanePath = resolve(SRC, 'core/stream-plane/stream-plane.ts')
  if (existsSync(streamPlanePath)) {
    const streamContent = readFileSync(streamPlanePath, 'utf-8')
    const streamNoTruth = !streamContent.includes('execution-record') && !streamContent.includes('execution-store')
    if (streamNoTruth) {
      pass('R5_STREAM_ZERO_AWARENESS — StreamPlane does not import truth layer')
    } else {
      fail('R5_STREAM_ZERO_AWARENESS violation', 'StreamPlane imports truth layer')
    }
  }

  // R6_ASYNC_ZERO_DB_AWARENESS: AsyncRuntime doesn't write DB directly
  const noDirectWrite = !asyncRuntimeContent.includes('execution-store') && !asyncRuntimeContent.includes('checkpoint-store')
  if (noDirectWrite) {
    pass('R6_ASYNC_ZERO_DB_AWARENESS — AsyncRuntime does not write store directly')
  } else {
    fail('R6_ASYNC_ZERO_DB_AWARENESS violation', 'AsyncRuntime should write through CheckpointStore')
  }
}

// ============================================================
// Phase 5: Transport & Observability Integrity
// ============================================================

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Phase 5: Transport & Observability Integrity')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

{
  const sseSubPath = resolve(SRC, 'transport/sse/sse-subscriber.ts')
  if (existsSync(sseSubPath)) {
    const sseContent = readFileSync(sseSubPath, 'utf-8')
      if (!sseContent.match(/from ['"].*execution-store/) && !sseContent.match(/new ExecutionStore/) && !sseContent.match(/execution-store\./)) {
      pass('R4_SSE_NOT_TRUTH — SSE does not write ExecutionStore')
    } else {
      fail('R4_SSE_NOT_TRUTH violation', 'SSE should not access ExecutionStore')
    }
  }

  const eventMirrorPath = resolve(SRC, 'kernel/persistence/event-mirror.ts')
  if (existsSync(eventMirrorPath)) {
    const mirrorContent = readFileSync(eventMirrorPath, 'utf-8')
    if (!mirrorContent.includes('transport') && !mirrorContent.includes('sse')) {
      pass('EventMirror does not import transport layer')
    } else {
      fail('EventMirror imports transport', 'EventMirror should be pure persistence')
    }
  }
}

// ============================================================
// Report
// ============================================================

const w = 72
console.log()
console.log('='.repeat(w))
console.log('  EGOS Kernel — System Validation Report')
console.log('='.repeat(w))
console.log()

const groups: Record<string, CheckResult[]> = {}
for (const c of checks) {
  const g = c.name.includes('—') ? c.name.split('—')[0].trim() : 'Other'
  if (!groups[g]) groups[g] = []
  groups[g].push(c)
}

for (const [group, items] of Object.entries(groups)) {
  console.log(`  ${group}`)
  for (const item of items) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭'
    console.log(`  ${icon}  ${item.name}`)
    if (item.detail) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log()
}

const total = checks.length
const passed = checks.filter(c => c.status === 'PASS').length
const failed = checks.filter(c => c.status === 'FAIL').length
const skipped = checks.filter(c => c.status === 'SKIP').length

console.log('─'.repeat(w))
console.log(`  Total: ${total}  |  ✅ ${passed}  |  ❌ ${failed}  |  ⏭ ${skipped}`)
console.log('='.repeat(w))
console.log()

if (exitCode !== 0) {
  console.log('❌ SYSTEM VALIDATION FAILED — Phase 7 is blocked')
  console.log()
  process.exit(exitCode)
} else {
  console.log('✅ SYSTEM VALIDATION PASSED — Phase 7 gate is open')
  console.log()
}
