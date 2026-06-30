import type { SignalProvider, RawSignal } from '../learning.types'
import { prisma } from '../../../utils/index.js'

export const provider: SignalProvider = {
  name: 'growth-memory',
  source: 'growth_memory',

  supports(industry?: string, optimizationType?: string): boolean {
    return true // Always available
  },

  async collect(projectId: string): Promise<RawSignal[]> {
    const signals: RawSignal[] = []

    // Get the project to find industry info
    const project = await prisma.geoProject.findUnique({ where: { id: projectId } })
    const industry = project?.industry || undefined

    // Find matching growth memories
    const memories = await prisma.growthMemory.findMany({
      where: {
        ...(industry ? { industry } : {}),
      },
    })

    for (const memory of memories) {
      if (memory.sampleSize < 5 || memory.successRate < 0.3) continue // Skip low-confidence

      signals.push({
        signalType: `optimization.${memory.optimizationType}`,
        originalValue: memory.averageDelta,
        industry: memory.industry,
        optimizationType: memory.optimizationType,
        reason: `${memory.optimizationType}: successRate=${(memory.successRate * 100).toFixed(0)}%, sample=${memory.sampleSize}, avgDelta=${memory.averageDelta.toFixed(1)}`,
        evidence: {
          totalExecutions: memory.totalExecutions,
          successfulCount: memory.successfulCount,
          sampleSize: memory.sampleSize,
          confidence: memory.confidence,
          successRate: memory.successRate,
          averageDelta: memory.averageDelta,
        },
        sourceRecordId: memory.id,
      })
    }

    return signals
  },
}
