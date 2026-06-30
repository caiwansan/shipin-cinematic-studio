import type { SignalProvider, RawSignal } from '../learning.types'

export const provider: SignalProvider = {
  name: 'benchmark',
  source: 'benchmark',

  supports(industry?: string, optimizationType?: string): boolean {
    return true
  },

  async collect(_projectId: string): Promise<RawSignal[]> {
    // Phase 1: Reserved — Benchmark integration (Sprint 6.1 or v5)
    // Phase 2: Read from benchmark table, compute industry benchmarks
    return []
  },
}
