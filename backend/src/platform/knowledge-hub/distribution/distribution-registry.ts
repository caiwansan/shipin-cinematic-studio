// ════════════════════════════════════════════════════════════
// KH4-T003 — TargetRegistry
// All DistributionTargets register here. Engine discovers via Registry.
// ════════════════════════════════════════════════════════════

import { DistributionTarget } from './types'

export class DistributionRegistry {
  private targets: Map<string, DistributionTarget> = new Map()

  register(target: DistributionTarget) {
    this.targets.set(target.name, target)
  }

  get(name: string): DistributionTarget | undefined {
    return this.targets.get(name)
  }

  getAll(): DistributionTarget[] {
    return Array.from(this.targets.values())
  }

  filterByCapability(capability: string): DistributionTarget[] {
    return this.getAll().filter(t => t.capabilities.includes(capability as any))
  }
}
