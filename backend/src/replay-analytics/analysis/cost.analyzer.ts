/**
 * Cost Analyzer — token/cost estimation per node
 *
 * Since we don't have real token counting yet,
 * we estimate based on node type + duration + output size.
 */

import type { RuntimeRunEvent } from '../../api/runtime/run.model.js'
import type { RunMetricsAggregate } from '../metrics/execution.metrics.js'

// Cost per 1K tokens (approx)
const MODEL_COST_MAP: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  'deepseek-v4-flash': { inputPer1K: 0.0005, outputPer1K: 0.002 },
  'deepseek-v4-pro': { inputPer1K: 0.004, outputPer1K: 0.016 },
  'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'flux-schnell': { inputPer1K: 0, outputPer1K: 0 },
  'flux-pro': { inputPer1K: 0, outputPer1K: 0 },
  'default': { inputPer1K: 0.001, outputPer1K: 0.002 },
}

const FIXED_COST_PER_TYPE: Record<string, number> = {
  image_gen: 0.003,       // per image
  prompt_builder: 0.001,
  script_writer: 0.005,
  storyboard: 0.008,
  shot_split: 0.002,
  image_prompt: 0.003,
}

export interface CostAnalysisResult {
  totalCostUsd: number
  totalTokens: number
  nodeCount: number
  costPerNodeType: Record<string, number>
  costHotspot: string       // highest cost node type
  breakdown: Array<{
    nodeId: string
    nodeType: string
    estimatedTokens: number
    estimatedCostUsd: number
    modelName?: string
    pctOfTotal: number
  }>
}

/**
 * Analyze cost from events and node artifacts
 */
export function analyzeCost(
  events: RuntimeRunEvent[],
  nodeStates: Record<string, { status: string; durationMs?: number; output?: any }>,
  artifacts?: any, // Record<string, any> or array
): CostAnalysisResult {
  const breakdown: CostAnalysisResult['breakdown'] = []
  let totalCost = 0
  let totalTokens = 0
  const costPerNodeType: Record<string, number> = {}

  // Normalize artifacts to record format
  const artifactRecord: Record<string, any> = {}
  if (artifacts) {
    if (Array.isArray(artifacts)) {
      for (const a of artifacts) {
        artifactRecord[a.nodeId] = a.value
      }
    } else {
      Object.assign(artifactRecord, artifacts)
    }
  }

  for (const [nodeId, state] of Object.entries(nodeStates)) {
    const nodeEvent = events.find(e => e.nodeId === nodeId && e.type === 'node:start')
    const nodeType = nodeEvent?.nodeType ?? 'unknown'

    // Find output size if available
    let outputSize = 0
    if (state.output) {
      outputSize = estimateTokenCount(state.output)
    }
    if (outputSize === 0 && artifactRecord[nodeId]) {
      outputSize = estimateTokenCount(artifactRecord[nodeId])
    }

    // Estimate tokens based on type + duration heuristic
    const baseDurationMs = state.durationMs ?? 1000
    // Rough estimate: ~100 tokens per second for LLM, less for image gen
    const inputTokens = Math.round(baseDurationMs / 10000 * 100) // ~100 tokens per 10s
    const outputTokens = Math.max(outputSize, Math.round(baseDurationMs / 5000 * 100))
    const totalNodeTokens = inputTokens + outputTokens

    const costPer = MODEL_COST_MAP[nodeType] ?? MODEL_COST_MAP['default']
    const estimatedCost = (inputTokens / 1000) * costPer.inputPer1K
      + (outputTokens / 1000) * costPer.outputPer1K
    const fixedCost = FIXED_COST_PER_TYPE[nodeType] ?? 0.001
    const finalCost = Math.max(estimatedCost, fixedCost)

    totalCost += finalCost
    totalTokens += totalNodeTokens
    costPerNodeType[nodeType] = (costPerNodeType[nodeType] ?? 0) + finalCost

    breakdown.push({
      nodeId,
      nodeType,
      estimatedTokens: totalNodeTokens,
      estimatedCostUsd: finalCost,
      modelName: nodeEvent?.nodeType === 'image_gen' ? 'flux-schnell' : 'deepseek-v4-flash',
      pctOfTotal: 0, // calculated below
    })
  }

  // Calculate percentages
  for (const item of breakdown) {
    item.pctOfTotal = totalCost > 0 ? Math.round((item.estimatedCostUsd / totalCost) * 100) : 0
  }

  breakdown.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)

  const hotspotEntries = Object.entries(costPerNodeType).sort(([, a], [, b]) => b - a)
  const costHotspot = hotspotEntries[0]?.[0] ?? ''

  return {
    totalCostUsd: Math.round(totalCost * 1000000) / 1000000,
    totalTokens,
    nodeCount: Object.keys(nodeStates).length,
    costPerNodeType,
    costHotspot,
    breakdown,
  }
}

function estimateTokenCount(value: any): number {
  if (value === null || value === undefined) return 0
  if (Array.isArray(value)) return value.length * 20 // rough per-item
  if (typeof value === 'string') return Math.ceil(value.length / 4)
  if (typeof value === 'object') return Math.ceil(JSON.stringify(value).length / 4)
  return 0
}
