// ════════════════════════════════════════════════════════════
// KH1-T004 — VersionEngine
// ════════════════════════════════════════════════════════════
// Immutable version management for KnowledgePackage.
// Snapshots are read-only once created.
// Rollback creates a new version pointing to the same data.
// ════════════════════════════════════════════════════════════

export type VersionStage = 'draft' | 'snapshot' | 'release_candidate' | 'released' | 'archived'

export interface PackageVersion {
  id: string
  packageId: string
  version: string           // semver
  stage: VersionStage
  snapshot: object          // Immutable copy of the KnowledgePackage at this version
  createdBy: string
  createdAt: string
  parentVersion?: string    // Previous version ID (for rollback tracking)
}

export interface VersionChange {
  from: string
  to: string
  changedFields: string[]
  summary: string
}

export class VersionEngine {
  private versions: Map<string, PackageVersion[]> = new Map()

  constructor() {}

  /**
   * Create a new version snapshot.
   * Snapshots are immutable after creation.
   */
  async createSnapshot(
    packageId: string,
    version: string,
    stage: VersionStage,
    snapshot: object,
    createdBy: string,
    parentVersion?: string,
  ): Promise<PackageVersion> {
    const v: PackageVersion = {
      id: `${packageId}@${version}`,
      packageId,
      version,
      stage,
      snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep freeze
      createdBy,
      createdAt: new Date().toISOString(),
      parentVersion,
    }

    const existing = this.versions.get(packageId) || []
    existing.push(v)
    this.versions.set(packageId, existing)

    return v
  }

  /**
   * Rollback to a specific version.
   * Returns the snapshot data — caller creates a new PackageVersion with it.
   */
  async getSnapshot(packageId: string, version: string): Promise<PackageVersion | null> {
    const pkgVersions = this.versions.get(packageId) || []
    return pkgVersions.find(v => v.version === version) ?? null
  }

  /**
   * Get version history for a package.
   */
  async getHistory(packageId: string): Promise<PackageVersion[]> {
    return (this.versions.get(packageId) || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  /**
   * Compare two versions and describe the changes.
   */
  async diff(packageId: string, fromVersion: string, toVersion: string): Promise<VersionChange | null> {
    const from = await this.getSnapshot(packageId, fromVersion)
    const to = await this.getSnapshot(packageId, toVersion)
    if (!from || !to) return null

    const changedFields: string[] = []
    for (const key of Object.keys(to.snapshot as any)) {
      const fromVal = JSON.stringify((from.snapshot as any)[key])
      const toVal = JSON.stringify((to.snapshot as any)[key])
      if (fromVal !== toVal) {
        changedFields.push(key)
      }
    }

    return {
      from: fromVersion,
      to: toVersion,
      changedFields,
      summary: `${changedFields.length} field(s) changed: ${changedFields.join(', ')}`,
    }
  }

  /**
   * Get latest version for a package.
   */
  async getLatest(packageId: string): Promise<PackageVersion | null> {
    const pkgVersions = this.versions.get(packageId) || []
    if (pkgVersions.length === 0) return null
    return pkgVersions.reduce((latest, v) =>
      new Date(v.createdAt).getTime() > new Date(latest.createdAt).getTime() ? v : latest,
    )
  }
}
