// ============================================================
// Contract Migrator — version migration with backward compatibility
// ============================================================

import type { CapabilityContract, ContractMigration, MigrationChange } from '../types.js'

export class ContractMigrator {
  private migrations: Map<string, MigrationRule> = new Map()
  // key = "fromVersion→toVersion"

  /**
   * Register a migration rule between versions
   */
  registerRule(fromVersion: string, toVersion: string, rule: MigrationRule): void {
    const key = `${fromVersion}→${toVersion}`
    this.migrations.set(key, rule)
    console.log(`[ContractMigrator] ✅ Migration rule registered: ${key}`)
  }

  /**
   * Migrate a contract from one version to another
   */
  async migrate(contract: CapabilityContract, targetVersion: string): Promise<CapabilityContract> {
    const path = this.resolvePath(contract.version, targetVersion)
    if (!path.length) {
      throw new Error(`No migration path from ${contract.version} to ${targetVersion}`)
    }

    let current = { ...contract }
    for (const step of path) {
      const rule = this.migrations.get(step)
      if (!rule) {
        throw new Error(`Migration rule not found: ${step}`)
      }
      current = await rule.migrate(current)
    }

    return { ...current, version: targetVersion }
  }

  /**
   * Check if migration is backward compatible
   */
  isBackwardCompatible(fromVersion: string, toVersion: string): boolean {
    const path = this.resolvePath(fromVersion, toVersion)
    for (const step of path) {
      const rule = this.migrations.get(step)
      if (rule && !rule.backwardCompatible) return false
    }
    return true
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(fromVersion: string, toVersion: string): ContractMigration | null {
    const path = this.resolvePath(fromVersion, toVersion)
    if (!path.length) return null

    const changes: MigrationChange[] = []
    let backwardCompatible = true

    for (const step of path) {
      const rule = this.migrations.get(step)
      if (rule) {
        changes.push(...rule.changes)
        if (!rule.backwardCompatible) backwardCompatible = false
      }
    }

    return {
      fromVersion,
      toVersion,
      changes,
      backwardCompatible,
    }
  }

  /**
   * List available versions for a contract
   */
  getAvailableVersions(currentVersion: string): string[] {
    const versions = new Set<string>()
    for (const key of this.migrations.keys()) {
      const [from, to] = key.split('→')
      if (from === currentVersion) versions.add(to)
      if (to === currentVersion) versions.add(from)
    }
    return Array.from(versions).sort()
  }

  private resolvePath(from: string, to: string): string[] {
    // Simple BFS to find path
    if (from === to) return []

    const visited = new Set<string>()
    const queue: { version: string; path: string[] }[] = [{ version: from, path: [] }]
    visited.add(from)

    while (queue.length > 0) {
      const { version, path } = queue.shift()!

      for (const key of this.migrations.keys()) {
        const [f, t] = key.split('→')

        if (f === version && !visited.has(t)) {
          const newPath = [...path, key]
          if (t === to) return newPath
          visited.add(t)
          queue.push({ version: t, path: newPath })
        }
      }
    }

    return []
  }
}

export interface MigrationRule {
  backwardCompatible: boolean
  migrate: (contract: CapabilityContract) => Promise<CapabilityContract>
  changes: MigrationChange[]
}

export const contractMigrator = new ContractMigrator()
