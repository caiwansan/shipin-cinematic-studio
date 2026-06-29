// ============================================================
// Dual Write Hook Registry
// Central hub for registering all dual-write hooks
// ============================================================

import { DualWriteManager, DualWriteHook } from './dualwrite-manager'
import { projectDualWriteHook } from './hooks/project.hook'
import { geoProfileDualWriteHook } from './hooks/geoProfile.hook'

/**
 * Initialize and return a fully configured DualWriteManager
 * with all registered hooks.
 */
export function createDualWriteManager(flagService: any): DualWriteManager {
  const manager = new DualWriteManager(flagService)

  // Register hooks — add new ones here as Phase 1a progresses
  registerHooks(manager)

  return manager
}

/**
 * Register all available hooks.
 * Separate function so tests can call it independently.
 */
export function registerHooks(manager: DualWriteManager): void {
  const hooks: DualWriteHook[] = [
    projectDualWriteHook,
    geoProfileDualWriteHook,
  ]

  for (const hook of hooks) {
    manager.registerHook(hook)
  }
}

export { DualWriteManager } from './dualwrite-manager'
export type { WriteEvent, SyncResult, DualWriteHook, WatcherReport } from './dualwrite-manager'
