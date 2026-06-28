// ============================================================
// Undo/Redo — 基于 WorkspaceOperation 的统一撤销/重做
// 所有工作台（短剧/小说/PPT/GEO）天然支持
// ============================================================

import { operationRepository } from '../repositories/operation.repository.js'
import { workspaceRepository } from '../repositories/workspace.repository.js'
import { snapshotSystem } from '../snapshot/snapshot-system.js'
import type { OperationType, WorkspaceOperationDTO } from '../types.js'

// In-memory undo/redo cursor per workspace
// Each workspace has a pointer to the "current" operation.
// Operations after the cursor are treated as "redo" candidates.
const cursors = new Map<string, { undoStack: string[]; redoStack: string[] }>()

function getCursor(workspaceId: string) {
  if (!cursors.has(workspaceId)) {
    cursors.set(workspaceId, { undoStack: [], redoStack: [] })
  }
  return cursors.get(workspaceId)!
}

export const undoRedoService = {
  /**
   * Record an operation in the workspace's operation log.
   * This automatically clears the redo stack (new action branches history).
   */
  async recordOperation(
    workspaceId: string,
    type: OperationType,
    target?: string,
    targetId?: string,
    diff?: Record<string, unknown>,
    reverseDiff?: Record<string, unknown>,
    description?: string,
    userId?: string,
  ): Promise<WorkspaceOperationDTO> {
    const operation = await operationRepository.create({
      workspaceId,
      type,
      target,
      targetId,
      diff,
      reverseDiff,
      description,
      userId,
    })

    // Update cursor: push to undo, clear redo
    const cursor = getCursor(workspaceId)
    cursor.undoStack.push(operation.id)
    cursor.redoStack = []

    return operation
  },

  /**
   * Undo the last operation on a workspace.
   * Applies the reverseDiff from the operation.
   */
  async undo(workspaceId: string): Promise<WorkspaceOperationDTO | null> {
    const cursor = getCursor(workspaceId)

    if (cursor.undoStack.length === 0) return null

    const opId = cursor.undoStack.pop()!
    const operation = await operationRepository.findById(opId)
    if (!operation) return null

    // Apply reverseDiff to restore previous state
    if (operation.reverseDiff) {
      await this._applyDiff(workspaceId, operation.reverseDiff)
    }

    // Push to redo stack
    cursor.redoStack.push(opId)

    return operation
  },

  /**
   * Redo the last undone operation on a workspace.
   * Applies the original diff from the operation.
   */
  async redo(workspaceId: string): Promise<WorkspaceOperationDTO | null> {
    const cursor = getCursor(workspaceId)

    if (cursor.redoStack.length === 0) return null

    const opId = cursor.redoStack.pop()!
    const operation = await operationRepository.findById(opId)
    if (!operation) return null

    // Apply original diff to redo
    if (operation.diff) {
      await this._applyDiff(workspaceId, operation.diff)
    }

    // Push back to undo stack
    cursor.undoStack.push(opId)

    return operation
  },

  /**
   * Get undo/redo state for a workspace.
   */
  getState(workspaceId: string): {
    canUndo: boolean
    canRedo: boolean
    undoCount: number
    redoCount: number
  } {
    const cursor = getCursor(workspaceId)
    return {
      canUndo: cursor.undoStack.length > 0,
      canRedo: cursor.redoStack.length > 0,
      undoCount: cursor.undoStack.length,
      redoCount: cursor.redoStack.length,
    }
  },

  /**
   * Load the undo/redo cursor from persisted operations.
   * Called when opening a workspace.
   */
  async loadCursor(workspaceId: string): Promise<void> {
    const operations = await operationRepository.findByWorkspaceId(workspaceId, 1000)
    const cursor = getCursor(workspaceId)
    cursor.undoStack = operations.map(op => op.id)
    cursor.redoStack = []
  },

  /**
   * Clear undo/redo history for a workspace.
   */
  clearHistory(workspaceId: string): void {
    cursors.delete(workspaceId)
  },

  /**
   * Internal: apply a diff to the workspace state.
   * Diff format: { runtimeState?: object, settings?: object, metadata?: object }
   */
  async _applyDiff(
    workspaceId: string,
    diff: Record<string, unknown>,
  ): Promise<void> {
    if (diff.runtimeState) {
      await workspaceRepository.saveRuntimeState(
        workspaceId,
        diff.runtimeState as Record<string, unknown>,
      )
    }
    // Additional diff types can be added here as needed
    // e.g., asset changes, version changes, etc.
  },
}
