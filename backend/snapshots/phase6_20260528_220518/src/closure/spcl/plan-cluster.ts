/**
 * closure/spcl/plan-cluster.ts — SPCL Plan语义聚类
 *
 * 根据语义嵌入将 plans 分簇，相同簇合并为 macro plan。
 * SPCL Rule 1: ∀ plans in cluster → merge into macro plan
 */

import type { ExecutionPlan } from '../sedp-compiler.js'
import type { PlanEmbedding } from './plan-embedding.js'
import { embedPlan, planDistance } from './plan-embedding.js'

export interface PlanCluster {
  /** Cluster id */
  id: string
  /** Human label */
  label: string
  /** Plans in this cluster */
  plans: string[]
  /** Average intra-cluster distance */
  cohesion: number
}

/**
 * SPCL Constraint 1: macro_plans_count ≤ 5
 */
const MAX_CLUSTERS = 5
const CLUSTER_THRESHOLD = 0.35

/**
 * Agglomerative clustering on plans
 *
 * SPCL Rule 1 — Plan Collapse:
 *   ∀ plans in cluster → merge into macro plan
 */
export function clusterPlans(plans: ExecutionPlan[]): PlanCluster[] {
  if (plans.length === 0) return []

  const embeddings = plans.map(p => ({ plan: p, embedding: embedPlan(p) }))

  // Start: each plan is its own cluster
  let clusters: string[][] = plans.map(p => [p.planId])

  // Greedy merge: combine most similar clusters
  let changed = true
  while (changed && clusters.length > 1) {
    changed = false
    let bestI = -1, bestJ = -1
    let bestDist = Infinity

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDistance(clusters[i], clusters[j], embeddings)
        if (dist < bestDist) {
          bestDist = dist
          bestI = i
          bestJ = j
        }
      }
    }

    // Only merge if below threshold and won't exceed MAX_CLUSTERS
    if (bestDist < CLUSTER_THRESHOLD && clusters.length - 1 >= 1) {
      // Merge bestJ into bestI
      clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]]
      clusters.splice(bestJ, 1)
      changed = true
    }
  }

  // Enforce MAX_CLUSTERS constraint
  while (clusters.length > MAX_CLUSTERS) {
    // Merge the two clusters with smallest distance
    let bestI = -1, bestJ = -1
    let bestDist = Infinity

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDistance(clusters[i], clusters[j], embeddings)
        if (dist < bestDist) {
          bestDist = dist
          bestI = i
          bestJ = j
        }
      }
    }

    if (bestI >= 0 && bestJ >= 0) {
      clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]]
      clusters.splice(bestJ, 1)
    }
  }

  // Build result with labels
  return clusters.map((members, idx) => {
    const memberEmbeds = members.map(m => embeddings.find(e => e.plan.planId === m)!.embedding)
    let cohesion = 0
    if (memberEmbeds.length > 1) {
      for (let i = 0; i < memberEmbeds.length; i++) {
        for (let j = i + 1; j < memberEmbeds.length; j++) {
          cohesion += planDistance(memberEmbeds[i], memberEmbeds[j])
        }
      }
      cohesion /= (memberEmbeds.length * (memberEmbeds.length - 1)) / 2
    }

    const label = inferLabel(members)

    return {
      id: `CLUSTER_${idx + 1}`,
      label,
      plans: members,
      cohesion: Math.round(cohesion * 100) / 100,
    }
  })
}

/**
 * Compute distance between two clusters (complete linkage)
 */
function clusterDistance(
  a: string[],
  b: string[],
  embeddings: Array<{ plan: ExecutionPlan; embedding: PlanEmbedding }>,
): number {
  let maxDist = 0
  for (const pA of a) {
    for (const pB of b) {
      const eA = embeddings.find(e => e.plan.planId === pA)?.embedding
      const eB = embeddings.find(e => e.plan.planId === pB)?.embedding
      if (eA && eB) {
        maxDist = Math.max(maxDist, planDistance(eA, eB))
      }
    }
  }
  return maxDist
}

/**
 * Infer cluster label from member plan IDs
 */
function inferLabel(members: string[]): string {
  const joined = members.join(' ').toLowerCase()

  if (joined.includes('llm')) return 'LLM Generation'
  if (joined.includes('image')) return 'Image Generation'
  if (joined.includes('video')) return 'Video Generation'
  if (joined.includes('tts')) return 'TTS Pipeline'
  if (joined.includes('boot')) return 'Boot/Orchestration'

  return `Mixed (${members.length} plans)`
}
