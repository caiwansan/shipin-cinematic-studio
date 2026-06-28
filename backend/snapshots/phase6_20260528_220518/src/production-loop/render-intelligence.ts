// Render Intelligence v2
// Cost-optimized routing with SLA compliance, fallback learning, and execution replay

import { listVideoProviders, getVideoProvider, type VideoPrompt, type VideoRenderJob } from './video/video-provider.js'
import { renderQueue } from './render-queue.js'
import { COST_PROFILES, type CostProfile } from './cost-profiles.js'
import { costLearner } from './cost-learner.js'
import { slaController, type SLATier } from './sla-controller.js'
import { eventBus } from './event-bus.js'

export interface RouteDecision {
  chosenProvider: string
  chosenModel: string
  reason: string
  confidence: number
  estimatedCost: number
  estimatedLatencyMs: number
  slaTier: SLATier
  alternatives: Array<{ provider: string; model: string; reason: string }>
}

export interface RoutingConstraints {
  maxBudgetUsd?: number
  maxLatencyMs?: number
  minQualityScore?: number
  slaTier?: SLATier
  preferredProvider?: string
  forceProvider?: string
}

// ── Scored provider with weighted rank ──

interface ScoredProvider {
  name: string
  model: string
  profile: CostProfile
  score: number   // weighted rank (higher = better)
  cost: number
  latency: number
}

export class RenderIntelligence {
  // ── Optimized multi-constraint decision ──

  async decide(
    prompt: VideoPrompt,
    constraints?: RoutingConstraints,
  ): Promise<RouteDecision> {
    const available = listVideoProviders()
    const slaTier = constraints?.slaTier || 'balanced'
    const sla = slaController.getConfig(slaTier)

    // Build scored candidates
    const candidates: ScoredProvider[] = []

    for (const name of available) {
      const model = prompt.model || COST_PROFILES.find(c => c.provider === name)?.model || name
      const profile = costLearner.getEffectiveProfile(name, model)

      // Skip if no profile (provider exists but no cost data)
      if (!profile || !profile.avgLatencyMs) continue

      const cost = this.estimateCost(profile, prompt.duration)
      const latency = profile.avgLatencyMs

      // SLA filters
      if (constraints?.maxLatencyMs && latency > constraints.maxLatencyMs) continue
      if (constraints?.maxBudgetUsd && cost > constraints.maxBudgetUsd) continue
      if (constraints?.minQualityScore && (profile.qualityScore || 0) < constraints.minQualityScore) continue
      if (sla.maxLatencyMs && latency > sla.maxLatencyMs) continue
      if (sla.maxCostPerMinute && (cost / Math.max(prompt.duration, 1)) * 60 > sla.maxCostPerMinute) continue

      // Weighted scoring:
      // quality_weight + speed_weight + cost_weight
      const qScore = (profile.qualityScore || 0) / 10
      const speedScore = 1 - Math.min(latency / 120_000, 1)  // normalize to 120s max
      const costScore = 1 - Math.min(cost / 1, 1)            // normalize to $1 max

      const score = qScore * 0.4 + speedScore * 0.3 + costScore * 0.3

      candidates.push({ name, model: profile.model || name, profile, score, cost, latency })
    }

    if (candidates.length === 0) {
      // Fallback: allow any without SLA filter
      return this.fallbackDecision(prompt, available, slaTier)
    }

    // Force provider
    if (constraints?.forceProvider) {
      const forced = candidates.find(c => c.name === constraints.forceProvider)
      if (forced) {
        return this.buildDecision(forced, `Forced provider: ${constraints.forceProvider}`, 1, slaTier)
      }
    }

    // Preferred provider
    if (constraints?.preferredProvider) {
      const preferred = candidates.find(c => c.name === constraints.preferredProvider)
      if (preferred) return this.buildDecision(preferred, `Preferred: ${constraints.preferredProvider}`, 0.9, slaTier)
    }

    // Score-based selection
    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]

    return this.buildDecision(
      best,
      `Optimized score: ${best.score.toFixed(3)} (q=${(best.profile.qualityScore || 0)}/10, latency=${best.latency}ms, cost=$${best.cost})`,
      0.85 + (candidates.filter(c => c.score > 0.8).length > 1 ? 0 : 0.1),  // boost confidence if clear winner
      slaTier,
    )
  }

  // ── Execute with full intelligence pipeline ──

  async execute(
    prompt: VideoPrompt,
    constraints?: RoutingConstraints,
  ): Promise<{ decision: RouteDecision; job: VideoRenderJob }> {
    const decision = await this.decide(prompt, constraints)
    prompt.model = decision.chosenModel

    // Emit intelligence decision event
    eventBus.emit({
      type: 'render.intelligence_decision',
      projectId: prompt.projectId,
      pipelineId: prompt.projectId,
      stepId: 'render',
      data: {
        promptId: prompt.id,
        decision,
      },
      metadata: {
        durationMs: decision.estimatedLatencyMs,
        cost: decision.estimatedCost,
        attempt: 1,
      },
    })

    // Execute with fallback chain
    return this.executeWithFallback(prompt, decision, 0)
  }

  // ── Fallback Chain ──

  private async executeWithFallback(
    prompt: VideoPrompt,
    decision: RouteDecision,
    attempt: number,
  ): Promise<{ decision: RouteDecision; job: VideoRenderJob }> {
    const maxFallbacks = 2

    try {
      const job = await renderQueue.enqueue(prompt)

      // If the job completes successfully — record it
      if (job.status === 'completed' && job.output) {
        costLearner.record({
          provider: decision.chosenProvider,
          model: decision.chosenModel,
          duration: prompt.duration,
          latencyMs: job.output.latencyMs,
          cost: job.output.cost || decision.estimatedCost,
          qualityScore: 0,  // user rates later
          timestamp: new Date().toISOString(),
          success: true,
        })

        slaController.check(
          decision.slaTier,
          job.id,
          decision.chosenProvider,
          job.output.latencyMs,
          job.output.cost || 0,
          prompt.duration,
        )
      }

      return { decision, job }
    } catch (err: any) {
      // Record failure for learning
      costLearner.record({
        provider: decision.chosenProvider,
        model: decision.chosenModel,
        duration: prompt.duration,
        latencyMs: 0,
        cost: 0,
        qualityScore: 0,
        timestamp: new Date().toISOString(),
        success: false,
        error: err.message,
      })

      if (attempt < maxFallbacks) {
        // Fallback: pick the next best provider
        const fallbackDecision = await this.decide(prompt)

        eventBus.emit({
          type: 'step.retrying',
          projectId: prompt.projectId,
          pipelineId: prompt.projectId,
          stepId: 'render',
          error: `Fell back from ${decision.chosenProvider} to ${fallbackDecision.chosenProvider}: ${err.message}`,
          metadata: { attempt: attempt + 1 },
        })

        return this.executeWithFallback(prompt, fallbackDecision, attempt + 1)
      }

      // All fallbacks exhausted
      const job = await renderQueue.enqueue(prompt)
      job.status = 'failed'
      job.error = `All providers failed after ${maxFallbacks + 1} attempts. Last: ${err.message}`

      eventBus.emit({
        type: 'render.failed',
        projectId: prompt.projectId,
        pipelineId: prompt.projectId,
        stepId: 'render',
        data: { jobId: job.id },
        error: job.error,
        metadata: { attempt: attempt + 1 },
      })

      return { decision, job }
    }
  }

  // ── Status & observability ──

  async getIntelligenceStatus() {
    const available = listVideoProviders()
    const providerStatuses = await Promise.all(
      available.map(async name => {
        const p = getVideoProvider(name)
        const model = COST_PROFILES.find(c => c.provider === name)?.model || name
        const profile = costLearner.getEffectiveProfile(name, model)
        return { name, status: p ? await p.status() : null, profile }
      })
    )

    return {
      available,
      providers: providerStatuses,
      queue: renderQueue.getQueueStats(),
      costProfiles: COST_PROFILES,
      costLearning: costLearner.getStats(),
      sla: slaController.getStatus(),
    }
  }

  // ── Private helpers ──

  private estimateCost(profile: CostProfile, durationSeconds: number): number {
    return +(profile.costPerSecond * Math.ceil(durationSeconds)).toFixed(6)
  }

  private buildDecision(
    candidate: ScoredProvider,
    reason: string,
    confidence: number,
    slaTier: SLATier,
  ): RouteDecision {
    return {
      chosenProvider: candidate.name,
      chosenModel: candidate.model,
      reason,
      confidence,
      estimatedCost: candidate.cost,
      estimatedLatencyMs: candidate.latency,
      slaTier,
      alternatives: listVideoProviders()
        .filter(n => n !== candidate.name)
        .map(n => ({
          provider: n,
          model: COST_PROFILES.find(p => p.provider === n)?.model || n,
          reason: `Score: ${COST_PROFILES.find(p => p.provider === n) ? 'profiled' : 'unprofiled'}`,
        })),
    }
  }

  private async fallbackDecision(
    prompt: VideoPrompt,
    available: string[],
    slaTier: SLATier,
  ): Promise<RouteDecision> {
    // Pick the first available provider even without SLA guarantee
    const fallbackProviderName = available[0] || 'mock'
    const profile = COST_PROFILES.find(p => p.provider === fallbackProviderName) || {
      provider: 'mock', model: 'mock-video-01',
      costPerSecond: 0, avgLatencyMs: 2000, qualityScore: 2,
      maxConcurrent: 10, rateLimitPerMinute: 60,
    }

    return {
      chosenProvider: fallbackProviderName,
      chosenModel: profile.model,
      reason: `No SLA-compliant provider found (tier: ${slaTier}), falling back to ${fallbackProviderName}`,
      confidence: 0.4,
      estimatedCost: this.estimateCost(profile, prompt.duration),
      estimatedLatencyMs: profile.avgLatencyMs,
      slaTier,
      alternatives: [],
    }
  }
}

export const renderIntelligence = new RenderIntelligence()
