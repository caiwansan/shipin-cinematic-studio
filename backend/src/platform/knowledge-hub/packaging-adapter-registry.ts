// ════════════════════════════════════════════════════════════
// KDP K2 — PackagingAdapterRegistry
// ════════════════════════════════════════════════════════════
// Central registry for all PackagerAdapters.
// Each package type registers exactly one adapter.
// ════════════════════════════════════════════════════════════

import { PackageType } from '../types'
import { PackagerAdapter } from './packaging-pipeline'

export class PackagingAdapterRegistry {
  private adapters: Map<PackageType, PackagerAdapter> = new Map()

  register(adapter: PackagerAdapter): void {
    if (this.adapters.has(adapter.packageType)) {
      throw new Error(`Adapter already registered for package type: ${adapter.packageType}`)
    }
    this.adapters.set(adapter.packageType, adapter)
  }

  get(packageType: PackageType): PackagerAdapter | undefined {
    return this.adapters.get(packageType)
  }

  getAll(): PackagerAdapter[] {
    return Array.from(this.adapters.values())
  }

  getAvailableTypes(): PackageType[] {
    return Array.from(this.adapters.keys())
  }

  has(packageType: PackageType): boolean {
    return this.adapters.has(packageType)
  }

  count(): number {
    return this.adapters.size
  }
}
