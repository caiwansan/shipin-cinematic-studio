// ============================================================
// Runtime State Manager — 保存/加载运行时状态
// 刷新网页后恢复工作区状态
// 支持 Video Workspace: currentStep, executing, plannerState, segmentRuntime, progress
// ============================================================

import { workspaceRepository } from '../repositories/workspace.repository.js'

// Type for video workspace runtime state
export interface VideoWorkspaceState {
  currentStep: string
  executing: boolean
  plannerState?: Record<string, unknown>
  segmentRuntime?: Record<string, unknown>
  progress: number // 0-100
  [key: string]: unknown
}

// Type for generic workspace runtime state
export type RuntimeState = Record<string, unknown>

export const runtimeStateManager = {
  /**
   * Save runtime state for a workspace.
   * State is persisted to the workspace record for crash recovery and page refresh.
   */
  async saveState(
    workspaceId: string,
    state: RuntimeState,
  ): Promise<void> {
    await workspaceRepository.saveRuntimeState(workspaceId, state)
  },

  /**
   * Load runtime state for a workspace.
   * Returns null if no state has been saved.
   */
  async loadState(workspaceId: string): Promise<RuntimeState | null> {
    const workspace = await workspaceRepository.findById(workspaceId)
    if (!workspace) return null
    return workspace.runtimeState ?? null
  },

  /**
   * Clear runtime state for a workspace.
   */
  async clearState(workspaceId: string): Promise<void> {
    await workspaceRepository.saveRuntimeState(workspaceId, {})
  },

  /**
   * Update specific fields in the runtime state (partial update).
   */
  async patchState(
    workspaceId: string,
    patch: Partial<RuntimeState>,
  ): Promise<RuntimeState> {
    const current = await this.loadState(workspaceId) ?? {}
    const newState = { ...current, ...patch } as RuntimeState
    await this.saveState(workspaceId, newState)
    return newState
  },

  /**
   * Check if a workspace has a saved runtime state.
   */
  async hasState(workspaceId: string): Promise<boolean> {
    const state = await this.loadState(workspaceId)
    return state !== null && Object.keys(state).length > 0
  },

  /**
   * Create a checkpoint state — saves the current state and creates a snapshot.
   * Used for crash recovery points.
   */
  async createCheckpoint(
    workspaceId: string,
    state: RuntimeState,
  ): Promise<void> {
    await this.saveState(workspaceId, {
      ...state,
      _checkpoint: true,
      _checkpointAt: new Date().toISOString(),
    })
  },
}
