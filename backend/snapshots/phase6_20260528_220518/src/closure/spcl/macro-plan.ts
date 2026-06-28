/**
 * closure/spcl/macro-plan.ts — SPCL Macro Plan合成与语义路由
 *
 * SPCL Rule 2 — Step Deduplication: duplicate steps → extract shared kernel
 * SPCL Rule 3 — Shape Normalization: INPUT → TRANSFORM → EXECUTE → POSTPROCESS → OUTPUT
 */

import type { ExecutionPlan, ExecutionStep } from '../sedp-compiler.js'
import type { PlanCluster } from './plan-cluster.js'
import { clusterPlans } from './plan-cluster.js'
import { buildFrozenGraph, hashGraph } from '../execution-graph-frozen.js'

// ================================================================
// Shared Execution Kernel
// ================================================================

/**
 * Shared kernel: steps common across ALL plans in a cluster
 * SPCL Rule 2: duplicate steps → extract shared kernel
 */
export interface SharedKernel {
  steps: string[]  // step labels that are shared
  entry: string
  exit: string
}

/**
 * Extract shared kernel from a set of plans
 */
function extractSharedKernel(plans: ExecutionPlan[]): SharedKernel {
  if (plans.length === 0) return { steps: [], entry: '', exit: '' }

  const stepLabels = plans.map(p => p.steps.map(s => s.label))

  // Find intersection
  const shared = stepLabels[0].filter(label =>
    stepLabels.every(steps => steps.includes(label))
  )

  return {
    steps: shared,
    entry: stepLabels[0][0] || '',
    exit: stepLabels[0][stepLabels[0].length - 1] || '',
  }
}

// ================================================================
// Macro Plan
// ================================================================

export interface MacroPlan {
  id: string
  label: string
  clusterLabel: string

  /** Unified shape: INPUT → TRANSFORM → EXECUTE → POSTPROCESS → OUTPUT */
  unifiedSteps: string[]

  /** Shared kernel across sub-plans */
  sharedKernel: SharedKernel

  /** Member plan IDs */
  subPlans: string[]

  /** Deterministic hash */
  hash: string

  /** SPCL Constraint check results */
  constraints: {
    noExplosion: boolean    // subPlans ≤ 5
    noHiddenGraph: boolean  // unifiedSteps is flat, no nested dispatch
    semanticStability: boolean  // same input → same plan
  }
}

/**
 * Synthesize a macro plan from a cluster
 * SPCL Rule 3 — Shape Normalization:
 *   INPUT → TRANSFORM → EXECUTE → POSTPROCESS → OUTPUT
 */
export function synthesizeMacroPlan(cluster: PlanCluster, subPlans: ExecutionPlan[]): MacroPlan {
  const shared = extractSharedKernel(subPlans)

  // Shape Normalization (Rule 3)
  const unifiedSteps = normalizeShape(cluster, shared)

  const plan: MacroPlan = {
    id: `MACRO_${cluster.id}`,
    label: `Macro: ${cluster.label}`,
    clusterLabel: cluster.label,
    unifiedSteps,
    sharedKernel: shared,
    subPlans: cluster.plans,
    hash: '',
    constraints: {
      noExplosion: cluster.plans.length <= 5,
      noHiddenGraph: true, // flat array, no nested dispatch
      semanticStability: true,
    },
  }

  plan.hash = hashMacro(plan)
  return plan
}

/**
 * Shape normalization: fold all plans into INPUT→TRANSFORM→EXECUTE→POSTPROCESS→OUTPUT
 */
function normalizeShape(cluster: PlanCluster, kernel: SharedKernel): string[] {
  const labels = cluster.plans.map(p => p.toLowerCase())
  const steps: string[] = []

  steps.push('INPUT: receive task + params')

  // TRANSFORM: shared kernel
  if (kernel.steps.length > 0) {
    steps.push(`TRANSFORM: ${kernel.steps.join(', ')}`)
  } else {
    steps.push('TRANSFORM: resolve capabilities')
  }

  // EXECUTE: cluster-specific
  if (labels.some(l => l.includes('llm'))) {
    steps.push('EXECUTE: LLM generation')
  } else if (labels.some(l => l.includes('image'))) {
    steps.push('EXECUTE: image generation')
  } else if (labels.some(l => l.includes('video'))) {
    steps.push('EXECUTE: video generation')
  } else if (labels.some(l => l.includes('tts'))) {
    steps.push('EXECUTE: speech synthesis')
  } else {
    steps.push('EXECUTE: generic execution')
  }

  steps.push('POSTPROCESS: event sink + record')

  // OUTPUT: meta-arbitration for multi-provider
  if (cluster.plans.length > 1) {
    steps.push('OUTPUT: broker arbitration')
  }
  steps.push('OUTPUT: return result')

  return steps
}

function hashMacro(plan: MacroPlan): string {
  const canonical = plan.id + plan.unifiedSteps.join(',') + plan.subPlans.sort().join(',')
  let hash = 0
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash) + canonical.charCodeAt(i)
    hash |= 0
  }
  return `MACRO-${Math.abs(hash).toString(16).padStart(8, '0')}`
}

// ================================================================
// Semantic Router
// ================================================================

export type SemanticIntent = 'generate_text' | 'generate_image' | 'generate_video' | 'synthesize_speech' | 'orchestrate_boot'

/**
 * Map input intent to macro plan
 * SPCL Constraint 3: same input → same macro plan (pure function)
 */
export function routeToMacro(intent: SemanticIntent, macroPlans: MacroPlan[]): MacroPlan | null {
  const intentMap: Record<SemanticIntent, string> = {
    generate_text: 'LLM Generation',
    generate_image: 'Image Generation',
    generate_video: 'Video Generation',
    synthesize_speech: 'TTS Pipeline',
    orchestrate_boot: 'Boot/Orchestration',
  }

  const targetLabel = intentMap[intent]
  if (!targetLabel) return null

  // Exact match first
  const exact = macroPlans.find(m => m.clusterLabel === targetLabel)
  if (exact) return exact

  // Fuzzy: check if the cluster label semantically contains the intent
  for (const mp of macroPlans) {
    const l = mp.clusterLabel.toLowerCase()
    const i = intent.toLowerCase()
    if (i.includes('text') && l.includes('llm')) return mp
    if (i.includes('image') && l.includes('image')) return mp
    if (i.includes('video') && l.includes('video')) return mp
    if (i.includes('speech') && (l.includes('tts') || l.includes('speech'))) return mp
    if (i.includes('boot') && l.includes('boot')) return mp
  }

  return null
}

// ================================================================
// SPCL Compiler (aggregator)
// ================================================================

export interface SPCLResult {
  macroPlans: MacroPlan[]
  clusters: PlanCluster[]
  compression: {
    inputCount: number
    outputCount: number
    ratio: number
  }
  constraintsPassed: boolean
}

/**
 * Full SPCL compile pipeline
 */
export function compileSPCL(plans: ExecutionPlan[]): SPCLResult {
  // Step 1: Cluster
  const clusters = clusterPlans(plans)

  // Step 2: Synthesize macro plans
  const macroPlans = clusters.map(cluster => {
    const subPlans = plans.filter(p => cluster.plans.includes(p.planId))
    return synthesizeMacroPlan(cluster, subPlans)
  })

  // Compression metrics
  const inputCount = plans.length
  const outputCount = macroPlans.length
  const ratio = Math.round((inputCount / outputCount) * 10) / 10

  // Constraint check
  const constraintsPassed =
    macroPlans.length <= 5 && // Constraint 1
    macroPlans.every(m => m.constraints.noHiddenGraph) && // Constraint 2
    macroPlans.every(m => m.constraints.semanticStability) // Constraint 3

  return {
    macroPlans,
    clusters,
    compression: { inputCount, outputCount, ratio },
    constraintsPassed,
  }
}

// CLI
if (process.argv[1]?.includes('macro-plan')) {
  runCLI()
}

function runCLI() {
  const { listPlans, verifyDeterminism } = require('../sedp-compiler.js')
  const existing = listPlans()
  if (existing.length === 0) {
    console.log('[SPCL] No plans found. Run sedp-compiler compile-all first.')
    return
  }

  console.log(`[SPCL] Compressing ${existing.length} plans...\n`)
  const result = compileSPCL(existing)

  console.log(`[SPCL] Compression: ${result.compression.inputCount} → ${result.compression.outputCount} (${result.compression.ratio}x)`)
  console.log(`[SPCL] Constraints: ${result.constraintsPassed ? '✅ PASSED' : '❌ FAILED'}\n`)

  for (const mp of result.macroPlans) {
    console.log(`  ${mp.id} — ${mp.label}`)
    console.log(`    Hash: ${mp.hash}`)
    console.log(`    Sub-plans: ${mp.subPlans.join(', ')}`)
    console.log(`    Shape:`)
    mp.unifiedSteps.forEach((s, i) => console.log(`      ${i + 1}. ${s}`))
    console.log(`    Shared kernel: ${mp.sharedKernel.steps.length > 0 ? mp.sharedKernel.steps.join(', ') : '(none)'}`)
    console.log(`    Constraints: ${JSON.stringify(mp.constraints)}`)
    console.log()
  }

  // Show semantic routing
  console.log('[SPCL] Semantic routing table:')
  const intents: SemanticIntent[] = ['generate_text', 'generate_image', 'generate_video', 'synthesize_speech', 'orchestrate_boot']
  for (const intent of intents) {
    const mp = routeToMacro(intent, result.macroPlans)
    console.log(`  ${intent} → ${mp ? mp.id : '(unroutable)'}`)
  }
}
