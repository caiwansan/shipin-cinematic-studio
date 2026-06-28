/**
 * stability/adapter-governance.ts
 *
 * Phase 4 — Adapter Governance
 *
 * 版本化管理 + 回归锁（rollback lock）。
 * 当 adapter 被锁定后，不允许切换到不同版本。
 *
 * 铁律：
 * - 不修改 adapter 逻辑
 * - 不改变 projection 行为
 * - 只做准入判断
 */

export interface AdapterVersion {
  domain: string;
  version: string;
  locked: boolean;
}

const ADAPTER_VERSIONS: Record<string, string> = {
  "agent-graph": "v1.0.0",
  "decision-graph": "v1.0.0",
  "character-image-dag": "v1.0.0",
  "prompt-version-graph": "v1.0.0",
};

export class AdapterGovernance {
  private registry: Map<string, AdapterVersion> = new Map();

  constructor() {
    // Register defaults
    for (const [domain, version] of Object.entries(ADAPTER_VERSIONS)) {
      this.registry.set(domain, { domain, version, locked: false });
    }
  }

  /**
   * Register or update an adapter version entry.
   */
  register(v: AdapterVersion): void {
    const existing = this.registry.get(v.domain);
    // 如果已锁定，则不允许修改
    if (existing?.locked) return;
    this.registry.set(v.domain, v);
  }

  /**
   * Can the adapter be updated to a new version?
   * Returns false if locked.
   */
  canUpdate(domain: string, newVersion: string): boolean {
    const v = this.registry.get(domain);
    if (!v) return true;
    if (v.locked) return false;
    return v.version !== newVersion;
  }

  /**
   * Lock an adapter at its current version (prevents updates).
   */
  lock(domain: string): boolean {
    const v = this.registry.get(domain);
    if (!v) return false;
    v.locked = true;
    return true;
  }

  /**
   * Unlock an adapter.
   */
  unlock(domain: string): boolean {
    const v = this.registry.get(domain);
    if (!v) return false;
    v.locked = false;
    return true;
  }

  /**
   * Get adapter version info.
   */
  get(domain: string): AdapterVersion | undefined {
    return this.registry.get(domain);
  }

  /**
   * List all registered adapters.
   */
  list(): AdapterVersion[] {
    return Array.from(this.registry.values());
  }
}
