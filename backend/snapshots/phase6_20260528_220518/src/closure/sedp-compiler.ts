/**
 * closure/sedp-compiler.ts — Static Execution Determinism Protocol (SEDP)
 *
 * SEDP Core Premise:
 *   Runtime no longer traverses a graph.
 *   Runtime only executes a pre-flattened linear execution plan.
 *
 * Three layers:
 *   L1 — Build Time Intelligence (graph analysis, branch resolution, plan compilation)
 *   L2 — Frozen Execution Artifact (immutable linear plan + deterministic hash)
 *   L3 — Runtime Dumb Executor (no logic, no routing, no branching, only sequential execution)
 */

import path from 'path'
import fs from 'fs'
import { loadFrozenGraph, type FrozenExecutionGraph } from './execution-graph-frozen.js'

// ================================================================
// Types
// ================================================================

export interface ExecutionStep {
  /** Step id (position in plan) */
  id: number
  /** Human label */
  label: string
  /** File to execute */
  file: string
  /** Capability required */
  requiresCapability: string
  /** Input params type */
  paramsType: string
  /** Expected output type */
  outputType: string
}

export interface ExecutionPlan {
  /** Unique plan id */
  planId: string
  /** Version */
  version: string
  /** Build time */
  builtAt: string
  /** Deterministic hash */
  hash: string
  /** Plan info */
  description: string
  /** Linear steps — ALL logic resolved at build time */
  steps: ExecutionStep[]
}

/**
 * Runtime Executor State — the ONLY thing runtime holds
 * SEDP Layer 3: no logic, no graph, no routing
 */
export interface ExecutorState {
  plan: ExecutionPlan
  currentStep: number
  results: Map<number, unknown>
  context: Record<string, unknown>
}

// ================================================================
// Plan Compiler (L1 + L2)
// ================================================================

function hashPlan(plan: Omit<ExecutionPlan, 'hash'>): string {
  const canonical = JSON.stringify(plan.steps) + plan.planId + plan.version
  let hash = 0
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash) + canonical.charCodeAt(i)
    hash |= 0
  }
  return `SEDP-${Math.abs(hash).toString(16).padStart(8, '0')}`
}

/**
 * Flatten an execution graph into a linear execution plan.
 *
 * Graph → Plan transformation:
 *   All routing/branching/conditions are resolved at build time.
 *   Output is a flat array of steps with deterministic ordering.
 */
export function compilePlan(
  graph: FrozenExecutionGraph,
  taskType: string,
  providerName?: string,
  modelName?: string,
): ExecutionPlan {
  const planId = `ep-${taskType}-${providerName || 'auto'}-${modelName || 'auto'}`
  const steps: ExecutionStep[] = []

  // Build task-type-specific plan
  const isLLM = taskType === 'llm'
  const isImage = taskType === 'image'
  const isVideo = taskType === 'video'
  const isTTS = taskType === 'tts'

  // Resolve entry suffix based on task type
  const providerSuffix = providerName
    ? `-${providerName}`
    : ''

  const adapterKey = isLLM ? `llm-${providerName || 'openai'}`
    : isImage ? `image-${providerName || 'qwen'}`
    : isVideo ? `video-${providerName || 'aliyun'}`
    : isTTS ? `tts-${providerName || 'volcengine'}`
    : null

  // Step 1: Adapt
  if (adapterKey && graph.nodes[adapterKey]) {
    steps.push({
      id: 1,
      label: `Adapter: ${adapterKey}`,
      file: graph.nodes[adapterKey].file,
      requiresCapability: taskType,
      paramsType: `${taskType}Input`,
      outputType: `${taskType}Output`,
    })
  }

  // Step 2: Event sourcing
  if (graph.nodes['event-sourcing']) {
    steps.push({
      id: steps.length + 1,
      label: 'Event Sink',
      file: graph.nodes['event-sourcing'].file,
      requiresCapability: '',
      paramsType: 'ExecutionEvent',
      outputType: 'void',
    })
  }

  // Step 3: Truth arbitration
  if (graph.nodes['truth-arbitration']) {
    steps.push({
      id: steps.length + 1,
      label: 'Truth Arbitration',
      file: graph.nodes['truth-arbitration'].file,
      requiresCapability: '',
      paramsType: 'ExecutionResult[]',
      outputType: 'ArbitrationResult',
    })
  }

  // Boot sequence plan (when no task type specified)
  if (!isLLM && !isImage && !isVideo && !isTTS) {
    // Build full boot plan: governance → kernel → truth → adapter → freeze → self-test
    const bootOrder = [
      'governance-init', 'kernel-init', 'truth-init',
      'adapter-registry', 'adapter-freeze',
      'determinism-test', 'runtime-self-test',
    ]

    for (let i = 0; i < bootOrder.length; i++) {
      const node = graph.nodes[bootOrder[i]]
      if (node) {
        steps.push({
          id: i + 1,
          label: `Boot: ${node.label}`,
          file: node.file,
          requiresCapability: node.type,
          paramsType: 'void',
          outputType: 'void',
        })
      }
    }
  }

  steps.sort((a, b) => a.id - b.id)

  const planBase = {
    planId,
    version: 'v1.0.0',
    builtAt: new Date().toISOString(),
    hash: 'PENDING',
    description: `SEDP plan for taskType=${taskType}${providerName ? ` provider=${providerName}` : ''}${modelName ? ` model=${modelName}` : ''}`,
    steps,
  }

  const plan: ExecutionPlan = {
    ...planBase,
    hash: hashPlan(planBase),
  }

  return plan
}

// ================================================================
// Plan Store
// ================================================================

const PLANS_DIR = path.resolve(__dirname, '../../config/plans')

function ensurePlansDir(): void {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true })
}

export function persistPlan(plan: ExecutionPlan): void {
  ensurePlansDir()
  const filePath = path.join(PLANS_DIR, `${plan.planId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2))
  console.log(`[SEDP] Plan written: ${filePath} (${plan.hash})`)
}

export function loadPlan(planId: string): ExecutionPlan | null {
  try {
    const filePath = path.join(PLANS_DIR, `${planId}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export function listPlans(): ExecutionPlan[] {
  ensurePlansDir()
  const plans: ExecutionPlan[] = []
  try {
    const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.json'))
    for (const f of files) {
      try {
        plans.push(JSON.parse(fs.readFileSync(path.join(PLANS_DIR, f), 'utf-8')))
      } catch { /* skip corrupt */ }
    }
  } catch { /* no dir */ }
  return plans
}

// ================================================================
// Determinism Verification
// ================================================================

export function verifyDeterminism(plan: ExecutionPlan): {
  pass: boolean
  message: string
} {
  const planBase = { ...plan, hash: 'PENDING' }
  const expectedHash = hashPlan(planBase)
  const match = expectedHash === plan.hash

  return {
    pass: match,
    message: match
      ? `[SEDP] ✅ Determinism verified: ${plan.hash}`
      : `[SEDP] ❌ Determinism violation: expected ${expectedHash}, got ${plan.hash}`,
  }
}

export function verifyExecutionOrder(plan: ExecutionPlan, executedStepIds: number[]): boolean {
  const expectedIds = plan.steps.map(s => s.id)
  if (executedStepIds.length !== expectedIds.length) return false
  for (let i = 0; i < expectedIds.length; i++) {
    if (executedStepIds[i] !== expectedIds[i]) return false
  }
  return true
}

// ================================================================
// Runtime Dumb Executor (L3)
//
// SEDP Layer 3 constraints:
//   - NO branching logic
//   - NO routing
//   - NO condition checks
//   - NO registry lookups
//   - ONLY: read plan, execute step, pass context forward, append result
// ================================================================

export class DumbExecutor {
  private state: ExecutorState

  constructor(plan: ExecutionPlan, initialContext: Record<string, unknown> = {}) {
    this.state = {
      plan,
      currentStep: 0,
      results: new Map(),
      context: initialContext,
    }
  }

  get currentStep(): number {
    return this.state.currentStep
  }

  get totalSteps(): number {
    return this.state.plan.steps.length
  }

  get progress(): number {
    return Math.round((this.state.currentStep / this.totalSteps) * 100)
  }

  /**
   * Execute next step.
   * The executor does NOT decide which step to run.
   * It reads plan.steps[state.currentStep] — that's it.
   */
  async executeNext(): Promise<{ step: ExecutionStep; result: unknown; done: boolean }> {
    if (this.state.currentStep >= this.state.plan.steps.length) {
      return {
        step: null as unknown as ExecutionStep,
        result: null,
        done: true,
      }
    }

    const step = this.state.plan.steps[this.state.currentStep]
    const context = { ...this.state.context, currentStep: step.id }

    // Simulated execution — in production this would call the actual handler
    const result = await this.executeStep(step, context)

    this.state.results.set(step.id, result)
    this.state.context = { ...this.state.context, [`step${step.id}Result`]: result }
    this.state.currentStep++

    return {
      step,
      result,
      done: this.state.currentStep >= this.state.plan.steps.length,
    }
  }

  /**
   * Pure step executor — could be swapped with real adapter calls
   */
  private async executeStep(step: ExecutionStep, context: Record<string, unknown>): Promise<unknown> {
    // In production: import and call the actual handler
    // e.g. const module = await import(`../${step.file.replace('.ts', '')}`)
    console.log(`[SEDP/Executor] Step ${step.id}/${this.totalSteps}: ${step.label}`)
    return {
      stepId: step.id,
      label: step.label,
      executedAt: Date.now(),
      contextKeys: Object.keys(context),
    }
  }

  /**
   * Run entire plan sequentially
   */
  async executeAll(): Promise<Map<number, unknown>> {
    while (this.state.currentStep < this.state.plan.steps.length) {
      await this.executeNext()
    }
    return this.state.results
  }

  /**
   * Determinism verification after execution
   */
  verify(): { orderValid: boolean; hashValid: boolean } {
    const executedStepIds = Array.from(this.state.results.keys()).sort((a, b) => a - b)
    const orderValid = verifyExecutionOrder(this.state.plan, executedStepIds)
    const { pass: hashValid } = verifyDeterminism(this.state.plan)
    return { orderValid, hashValid }
  }
}

// ================================================================
// Forbidden Mechanisms (SEDP)
// ================================================================

export const SEDP_FORBIDDEN = [
  'runtime decision making',
  'dynamic provider selection',
  'adaptive routing',
  'hot patch execution graph',
  'plugin injection',
  'conditional execution path',
  'runtime branching (if/else for routing)',
  'registry lookup at runtime',
  'fallback resolution at runtime',
  'switch dispatch for provider selection',
  'runtime graph traversal',
] as const

// ================================================================
// CLI
// ================================================================

if (process.argv[1]?.includes('sedp-compiler')) {
  runCLI()
}

function runCLI() {
  const action = process.argv[2] || 'compile-all'

  const graph = loadFrozenGraph()
  if (!graph) {
    console.error('[SEDP] No frozen graph found. Build EGIL graph first.')
    process.exit(1)
  }

  if (action === 'compile-all') {
    // Compile plans for all known task types
    const taskTypes = ['llm', 'image', 'video', 'tts', 'boot']
    const providers: Record<string, string[]> = {
      llm: ['openai', 'volcengine', 'aliyun'],
      image: ['qwen', 'wan', 'seedream', 'dalle', 'siliconflow'],
      video: ['aliyun', 'volcengine'],
      tts: ['volcengine', 'aliyun', 'siliconflow'],
    }

    const plans: ExecutionPlan[] = []
    for (const taskType of taskTypes) {
      if (taskType === 'boot') {
        const plan = compilePlan(graph, 'boot')
        plans.push(plan)
        persistPlan(plan)
        continue
      }
      const provs = providers[taskType] || []
      for (const provider of provs) {
        const plan = compilePlan(graph, taskType, provider)
        plans.push(plan)
        persistPlan(plan)
      }
    }

    console.log(`[SEDP] Compiled ${plans.length} plans`)
    console.log(`[SEDP] Plans stored in: ${PLANS_DIR}`)

    // Verify all
    let allPass = true
    for (const plan of plans) {
      const { pass, message } = verifyDeterminism(plan)
      if (!pass) allPass = false
      console.log(`  ${message}`)
    }

    // List all
    console.log('\n[SEDP] Plans:')
    for (const plan of listPlans()) {
      console.log(`  ${plan.planId} → ${plan.steps.length} steps [${plan.hash}]`)
    }

    if (allPass) {
      console.log('\n[SEDP] ✅ All plans deterministic')
    }
  }

  if (action === 'run') {
    const planId = process.argv[3]
    if (!planId) {
      console.error('[SEDP] Usage: run <planId>')
      process.exit(1)
    }
    const plan = loadPlan(planId)
    if (!plan) {
      console.error(`[SEDP] Plan not found: ${planId}`)
      process.exit(1)
    }

    console.log(`[SEDP] Executing plan: ${plan.planId} (${plan.steps.length} steps)`)
    const executor = new DumbExecutor(plan)
    executor.executeAll().then(results => {
      console.log(`[SEDP] ✅ Execution complete: ${results.size} steps`)
      const { orderValid, hashValid } = executor.verify()
      console.log(`  Order valid: ${orderValid}`)
      console.log(`  Hash valid: ${hashValid}`)
    })
  }
}
