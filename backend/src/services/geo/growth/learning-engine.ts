import { PrismaClient } from '@prisma/client'
import { signalRegistry } from './normalizers/signal-registry'
import { versionManager } from '../../../platform/version'
import { eventBus } from '../../../platform/event-bus'
import type { RawSignal, LearningSignalDTO, RecommendationSignal, LearningExplain } from './learning.types'

export class LearningEngine {
  private learningVersion: string

  constructor(
    private prisma: PrismaClient,
  ) {
    this.learningVersion = versionManager.getActiveVersion('learning') || 'v1.0'
  }

  /**
   * Run learning for a project — collect signals from all providers, normalize, persist
   */
  async learn(projectId: string): Promise<LearningSignalDTO[]> {
    // Notify start
    await eventBus.publish({
      type: 'learning.started',
      source: 'LearningEngine',
      payload: { projectId, learningVersion: this.learningVersion },
    })

    try {
      // 1. Collect raw signals from all providers
      const providers = signalRegistry.list()
      const allRawSignals: RawSignal[] = []

      for (const provider of providers) {
        try {
          const signals = await provider.collect(projectId)
          allRawSignals.push(...signals)
        } catch (err: any) {
          console.warn(`[LearningEngine] Provider ${provider.name} failed: ${err.message}`)
        }
      }

      // 2. Normalize and persist
      const learningSignals: LearningSignalDTO[] = []
      for (const raw of allRawSignals) {
        const normalized = this.normalize(raw)

        const signal = await this.prisma.learningSignal.create({
          data: {
            source: raw.evidence?.providerName || 'learning-engine',
            signalType: raw.signalType,
            originalValue: raw.originalValue,
            normalizedValue: normalized,
            weight: 1.0,
            weightedValue: normalized * 1.0,
            industry: raw.industry,
            optimizationType: raw.optimizationType,
            reason: raw.reason || null,
          },
        })

        learningSignals.push({
          id: signal.id,
          source: signal.source,
          signalType: signal.signalType,
          originalValue: signal.originalValue,
          normalizedValue: signal.normalizedValue,
          weight: signal.weight,
          weightedValue: signal.weightedValue,
          industry: signal.industry || undefined,
          optimizationType: signal.optimizationType || undefined,
          reason: signal.reason || undefined,
          generatedAt: signal.generatedAt,
        })
      }

      // 3. Publish completion event
      await eventBus.publish({
        type: 'learning.completed',
        source: 'LearningEngine',
        payload: {
          projectId,
          learningVersion: this.learningVersion,
          signalCount: learningSignals.length,
          signals: learningSignals.map(s => ({
            type: s.signalType,
            normalizedValue: s.normalizedValue,
            weight: s.weight,
          })),
        },
      })

      return learningSignals

    } catch (err: any) {
      await eventBus.publish({
        type: 'learning.failed',
        source: 'LearningEngine',
        payload: { projectId, learningVersion: this.learningVersion, error: err.message },
      })
      throw err
    }
  }

  /**
   * Normalize a raw signal to 0~1 range
   */
  private normalize(raw: RawSignal): number {
    switch (raw.signalType) {
      case 'publishing.success_rate':
      case 'publishing.index_rate':
        return Math.min(Math.max(raw.originalValue, 0), 1) // Already 0~1

      case 'optimization.knowledge_creation':
      case 'optimization.faq_generation':
      case 'optimization.schema_markup':
      case 'optimization.brand_story':
      case 'optimization.about_page':
        // Delta-based: typical range 0~20, normalize to 0~1
        return Math.min(Math.max(raw.originalValue / 20, 0), 1)

      default:
        return Math.min(Math.max(raw.originalValue / 100, 0), 1)
    }
  }

  /**
   * Get recommendation signals for a project (consumed by Recommendation Engine)
   */
  async getRecommendationSignals(projectId: string): Promise<RecommendationSignal[]> {
    const recentSignals = await this.prisma.learningSignal.findMany({
      where: { source: { in: ['growth-memory', 'observation'] } },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    })

    // Aggregate by signalType
    const aggregated = new Map<string, LearningSignalDTO[]>()
    for (const s of recentSignals) {
      const key = s.signalType
      if (!aggregated.has(key)) aggregated.set(key, [])
      aggregated.get(key)!.push({
        id: s.id,
        source: s.source,
        signalType: s.signalType,
        originalValue: s.originalValue,
        normalizedValue: s.normalizedValue,
        weight: s.weight,
        weightedValue: s.weightedValue,
        industry: s.industry || undefined,
        optimizationType: s.optimizationType || undefined,
        reason: s.reason || undefined,
        generatedAt: s.generatedAt,
      })
    }

    const signals: RecommendationSignal[] = []
    for (const [type, sigs] of aggregated) {
      const avgNormalized = sigs.reduce((sum, s) => sum + s.normalizedValue, 0) / sigs.length
      const avgWeighted = sigs.reduce((sum, s) => sum + s.weightedValue, 0) / sigs.length
      const sampleSize = sigs.length
      const maxReason = sigs.map(s => s.reason).find(Boolean) || ''

      signals.push({
        type,
        weight: avgWeighted,
        confidence: sampleSize >= 30 ? 'HIGH' : sampleSize >= 10 ? 'MEDIUM' : 'LOW',
        reason: `${type}: normalized=${avgNormalized.toFixed(2)}, sample=${sampleSize}`,
        evidence: maxReason,
        sampleSize,
        learningVersion: this.learningVersion,
      })
    }

    return signals
  }

  /**
   * Get explainability for a specific signal
   */
  async explain(signalId: string): Promise<LearningExplain | null> {
    const signal = await this.prisma.learningSignal.findUnique({ where: { id: signalId } })
    if (!signal) return null

    const recentSignals = await this.prisma.learningSignal.findMany({
      where: { signalType: signal.signalType },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    })

    const signals = recentSignals.map(s => ({
      id: s.id,
      source: s.source,
      signalType: s.signalType,
      originalValue: s.originalValue,
      normalizedValue: s.normalizedValue,
      weight: s.weight,
      weightedValue: s.weightedValue,
      industry: s.industry || undefined,
      optimizationType: s.optimizationType || undefined,
      reason: s.reason || undefined,
      generatedAt: s.generatedAt,
    }))

    const avgWeight = signals.reduce((sum, s) => sum + s.weightedValue, 0) / signals.length

    return {
      signalId: signal.id,
      signalType: signal.signalType,
      why: `Weight ${(avgWeight * 100).toFixed(0)}%: ${signal.signalType} from ${signal.source}`,
      evidence: signal.reason || `Based on ${signals.length} signals with avg weight ${avgWeight.toFixed(2)}`,
      confidence: signals.length >= 30 ? 'HIGH' : signals.length >= 10 ? 'MEDIUM' : 'LOW',
      source: signal.source,
      sampleSize: signals.length,
      signals,
      learningVersion: this.learningVersion,
      generatedAt: new Date(),
    }
  }

  /**
   * Get learning history for a project
   */
  async getHistory(projectId: string, limit = 20, offset = 0) {
    return this.prisma.learningSignal.findMany({
      where: {},
      orderBy: { generatedAt: 'desc' },
      take: limit,
      skip: offset,
    })
  }

  /**
   * Get learning dashboard
   */
  async getDashboard() {
    const totalSignals = await this.prisma.learningSignal.count()
    const sources = await this.prisma.learningSignal.groupBy({ by: ['source'], _count: true })
    const types = await this.prisma.learningSignal.groupBy({ by: ['signalType'], _count: true })

    return {
      totalSignals,
      sources: sources.map(s => ({ source: s.source, count: s._count })),
      types: types.map(t => ({ type: t.signalType, count: t._count })),
      learningVersion: this.learningVersion,
    }
  }
}
