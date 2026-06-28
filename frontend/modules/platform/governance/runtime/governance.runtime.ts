// ============================================================
// Governance Runtime — KMKI-PLAT-012
// Frontend runtime wrapper
// ============================================================

import { governanceApi } from '../services/governance.service.js'
import type { GovernanceService } from '../services/governance.service.js'

export class GovernanceRuntime {
  private api: GovernanceService
  private initialized = false

  constructor() {
    this.api = governanceApi as any
  }

  async init(): Promise<void> {
    if (this.initialized) return
    console.log('[GovernanceRuntime] Initializing...')
    this.initialized = true
    console.log('[GovernanceRuntime] ✅ Initialized')
  }

  get service(): any {
    return this.api
  }

  dispose(): void {
    this.initialized = false
    console.log('[GovernanceRuntime] Disposed')
  }
}

export const governanceRuntime = new GovernanceRuntime()
