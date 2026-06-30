import type { SignalProvider, RawSignal } from '../learning.types'
import { prisma } from '../../../utils/index.js'

export const provider: SignalProvider = {
  name: 'observation',
  source: 'monitor',

  supports(industry?: string, optimizationType?: string): boolean {
    return true
  },

  async collect(projectId: string): Promise<RawSignal[]> {
    const signals: RawSignal[] = []

    // Get publishing records with observation status
    const publishes = await prisma.publishingRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const total = publishes.length
    const indexed = publishes.filter(p => p.status === 'indexed').length
    const verified = publishes.filter(p => p.status === 'verified_online' || p.status === 'indexed').length
    const failed = publishes.filter(p => p.status === 'failed').length

    if (total > 0) {
      signals.push({
        signalType: 'publishing.success_rate',
        originalValue: verified / total,
        reason: `${verified}/${total} publications verified online (${((verified / total) * 100).toFixed(0)}%)`,
        evidence: { total, verified, indexed, failed },
      })
    }

    if (indexed > 0) {
      signals.push({
        signalType: 'publishing.index_rate',
        originalValue: indexed / total,
        reason: `${indexed}/${total} publications indexed (${((indexed / total) * 100).toFixed(0)}%)`,
        evidence: { total, indexed },
      })
    }

    return signals
  },
}
