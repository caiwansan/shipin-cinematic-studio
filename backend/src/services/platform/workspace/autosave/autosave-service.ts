// ============================================================
// AutoSave Service — Runtime-level auto-save
// Not a frontend concern — managed by the Workspace Runtime
// ============================================================

import { snapshotSystem } from '../snapshot/snapshot-system.js'
import type { AutoSaveConfig, DEFAULT_AUTOSAVE_CONFIG } from '../types.js'

interface AutoSaveSession {
  workspaceId: string
  config: AutoSaveConfig
  timer: ReturnType<typeof setInterval> | null
  dirty: boolean
  debounceTimer: ReturnType<typeof setTimeout> | null
  onSaveCallback?: (workspaceId: string, snapshotId: string) => void | Promise<void>
}

const sessions = new Map<string, AutoSaveSession>()

export const autoSaveService = {
  /**
   * Start auto-saving for a workspace with the given configuration.
   */
  startAutoSave(workspaceId: string, config: AutoSaveConfig): void {
    // Stop existing session if any
    this.stopAutoSave(workspaceId)

    const session: AutoSaveSession = {
      workspaceId,
      config,
      timer: null,
      dirty: false,
      debounceTimer: null,
      onSaveCallback: config.onSaveCallback,
    }

    // Periodic check interval
    session.timer = setInterval(async () => {
      await this.flush(workspaceId)
    }, config.interval)

    sessions.set(workspaceId, session)
  },

  /**
   * Stop auto-saving for a workspace.
   */
  stopAutoSave(workspaceId: string): void {
    const session = sessions.get(workspaceId)
    if (!session) return

    if (session.timer) clearInterval(session.timer)
    if (session.debounceTimer) clearTimeout(session.debounceTimer)
    sessions.delete(workspaceId)
  },

  /**
   * Mark a workspace as dirty — triggers debounced auto-save.
   */
  onDirty(workspaceId: string): void {
    const session = sessions.get(workspaceId)
    if (!session) return

    session.dirty = true

    // Debounce: reset timer on each dirty call
    if (session.debounceTimer) clearTimeout(session.debounceTimer)
    session.debounceTimer = setTimeout(async () => {
      await this.flush(workspaceId)
    }, session.config.debounceMs)
  },

  /**
   * Force-flush a dirty workspace's auto-save immediately.
   */
  async flush(workspaceId: string): Promise<void> {
    const session = sessions.get(workspaceId)
    if (!session || !session.dirty) return

    session.dirty = false
    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer)
      session.debounceTimer = null
    }

    try {
      const snapshot = await snapshotSystem.createSnapshot(workspaceId, {
        autoSave: true,
      })

      // Prune old snapshots if needed
      const count = await snapshotSystem.countSnapshots(workspaceId)
      if (count > session.config.maxSnapshots) {
        await snapshotSystem.pruneSnapshots(
          workspaceId,
          session.config.maxSnapshots,
        )
      }

      // Invoke callback
      if (session.onSaveCallback) {
        await session.onSaveCallback(workspaceId, snapshot.id)
      }

      console.debug(`[AutoSave] Workspace ${workspaceId}: snapshot ${snapshot.version} saved`)
    } catch (err) {
      console.error(`[AutoSave] Failed for workspace ${workspaceId}:`, err)
      // Mark dirty again so retry happens
      session.dirty = true
    }
  },

  /**
   * Check if a workspace has auto-save active.
   */
  isAutoSaving(workspaceId: string): boolean {
    return sessions.has(workspaceId)
  },

  /**
   * Update auto-save config for a workspace.
   */
  updateConfig(workspaceId: string, config: Partial<AutoSaveConfig>): void {
    const session = sessions.get(workspaceId)
    if (!session) return

    Object.assign(session.config, config)

    // If interval changed, restart timer
    if (config.interval) {
      if (session.timer) clearInterval(session.timer)
      session.timer = setInterval(async () => {
        await this.flush(workspaceId)
      }, session.config.interval)
    }
  },

  /**
   * Get auto-save status for all workspaces.
   */
  getStatus(): Array<{
    workspaceId: string
    dirty: boolean
    interval: number
    debounceMs: number
  }> {
    const result: Array<{
      workspaceId: string
      dirty: boolean
      interval: number
      debounceMs: number
    }> = []
    for (const [workspaceId, session] of sessions) {
      result.push({
        workspaceId,
        dirty: session.dirty,
        interval: session.config.interval,
        debounceMs: session.config.debounceMs,
      })
    }
    return result
  },
}
