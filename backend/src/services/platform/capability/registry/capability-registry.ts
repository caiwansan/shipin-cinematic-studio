// ============================================================
// Capability Registry — Single Source of Truth for all Capabilities
// No module shall maintain a private capability list.
// ============================================================

import type { CapabilityContract, ContractStatus } from '../types.js'

export interface RegistryEntry {
  contract: CapabilityContract
  registeredAt: Date
  updatedAt: Date
  source: string
}

class CapabilityRegistry {
  private contracts: Map<string, RegistryEntry> = new Map()
  private nameIndex: Map<string, string> = new Map() // name → id

  // ─── Register ───

  register(contract: CapabilityContract, source?: string): void {
    const existing = this.contracts.get(contract.id)
    if (existing) {
      console.warn(`[CapabilityRegistry] Overwriting existing contract: ${contract.name} (${contract.id})`)
    }
    this.contracts.set(contract.id, {
      contract,
      registeredAt: existing?.registeredAt || new Date(),
      updatedAt: new Date(),
      source: source || 'runtime',
    })
    this.nameIndex.set(contract.name, contract.id)
    console.log(`[CapabilityRegistry] ✅ Registered: ${contract.name} v${contract.version} (${contract.category})`)
  }

  // ─── Update ───

  update(id: string, updates: Partial<CapabilityContract>): CapabilityContract | null {
    const entry = this.contracts.get(id)
    if (!entry) return null

    // If name changed, update name index
    if (updates.name && updates.name !== entry.contract.name) {
      this.nameIndex.delete(entry.contract.name)
      this.nameIndex.set(updates.name, id)
    }

    const oldVersion = entry.contract.version
    entry.contract = { ...entry.contract, ...updates }
    entry.updatedAt = new Date()
    console.log(`[CapabilityRegistry] ✅ Updated: ${entry.contract.name} (${oldVersion} → ${entry.contract.version})`)
    return entry.contract
  }

  // ─── Deprecate ───

  deprecate(id: string): CapabilityContract | null {
    return this.update(id, { status: 'deprecated' as ContractStatus })
  }

  // ─── Remove ───

  remove(id: string): boolean {
    const entry = this.contracts.get(id)
    if (!entry) return false
    this.nameIndex.delete(entry.contract.name)
    this.contracts.delete(id)
    console.log(`[CapabilityRegistry] 🗑️ Removed: ${entry.contract.name}`)
    return true
  }

  // ─── Get by ID ───

  get(id: string): CapabilityContract | undefined {
    return this.contracts.get(id)?.contract
  }

  // ─── Get by Name ───

  getByName(name: string): CapabilityContract | undefined {
    const id = this.nameIndex.get(name)
    if (!id) return undefined
    return this.contracts.get(id)?.contract
  }

  // ─── List All ───

  list(): CapabilityContract[] {
    return Array.from(this.contracts.values()).map(e => e.contract)
  }

  // ─── List by Category ───

  listByCategory(category: string): CapabilityContract[] {
    return this.list().filter(c => c.category === category)
  }

  // ─── List by Status ───

  listByStatus(status: ContractStatus): CapabilityContract[] {
    return this.list().filter(c => c.status === status)
  }

  // ─── Search ───

  search(query: string): CapabilityContract[] {
    const lower = query.toLowerCase()
    return this.list().filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.displayName.toLowerCase().includes(lower) ||
      (c.description && c.description.toLowerCase().includes(lower)) ||
      (c.tags && c.tags.toLowerCase().includes(lower))
    )
  }

  // ─── Version ───

  getVersions(name: string): CapabilityContract[] {
    return this.list().filter(c => c.name === name)
  }

  // ─── Validate ───

  validate(id: string): { valid: boolean; errors: string[] } {
    const entry = this.contracts.get(id)
    if (!entry) return { valid: false, errors: ['Contract not found'] }

    const errors: string[] = []
    const c = entry.contract

    if (!c.name) errors.push('name is required')
    if (!c.displayName) errors.push('displayName is required')
    if (!c.category) errors.push('category is required')
    if (!c.version) errors.push('version is required')

    return { valid: errors.length === 0, errors }
  }

  // ─── Discover ───

  discover(filter?: {
    category?: string
    status?: ContractStatus
    tags?: string[]
    search?: string
  }): CapabilityContract[] {
    let results = this.list()

    if (filter?.category) {
      results = results.filter(c => c.category === filter.category)
    }
    if (filter?.status) {
      results = results.filter(c => c.status === filter.status)
    }
    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter(c => {
        if (!c.tags) return false
        try {
          const tags: string[] = JSON.parse(c.tags)
          return filter.tags!.some(t => tags.includes(t))
        } catch {
          return false
        }
      })
    }
    if (filter?.search) {
      results = results.filter(c => {
        const q = filter.search!.toLowerCase()
        return c.name.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q)
      })
    }

    return results
  }

  // ─── Count ───

  get count(): number {
    return this.contracts.size
  }

  // ─── Clear (for testing) ───

  clear(): void {
    this.contracts.clear()
    this.nameIndex.clear()
  }
}

// Singleton
export const capabilityRegistry = new CapabilityRegistry()
