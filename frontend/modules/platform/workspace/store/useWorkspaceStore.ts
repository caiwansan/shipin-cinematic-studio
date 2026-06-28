// ============================================================
// Workspace Store — 统一状态管理 (Pinia)
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { workspaceApi } from '../services/workspace.service'
import type {
  Workspace,
  WorkspaceSnapshot,
  WorkspaceVersion,
  WorkspaceManifest,
  WorkspaceAsset,
  WorkspaceConversationMessage,
  CreateWorkspacePayload,
  UndoRedoState,
} from '../types/index'

export const useWorkspaceStore = defineStore('workspace', () => {
  // ─── State ───
  const workspaces = ref<Workspace[]>([])
  const currentWorkspace = ref<Workspace | null>(null)
  const snapshots = ref<WorkspaceSnapshot[]>([])
  const versions = ref<WorkspaceVersion[]>([])
  const manifest = ref<WorkspaceManifest | null>(null)
  const assets = ref<WorkspaceAsset[]>([])
  const conversations = ref<WorkspaceConversationMessage[]>([])
  const undoRedoState = ref<UndoRedoState>({ canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ─── Getters ───
  const activeWorkspaces = computed(() =>
    workspaces.value.filter(w => w.status === 'active'),
  )
  const recentWorkspaces = computed(() =>
    [...workspaces.value].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ).slice(0, 10),
  )
  const publishedWorkspaces = computed(() =>
    workspaces.value.filter(w => w.status === 'published'),
  )
  const workspaceCount = computed(() => workspaces.value.length)

  // ─── Actions ───

  async function loadWorkspaces(params?: {
    type?: string
    status?: string
    tenantId?: string
  }) {
    loading.value = true
    error.value = null
    try {
      workspaces.value = await workspaceApi.list(params)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createWorkspace(payload: CreateWorkspacePayload) {
    loading.value = true
    error.value = null
    try {
      const w = await workspaceApi.create(payload)
      workspaces.value.unshift(w)
      return w
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function openWorkspace(id: string) {
    loading.value = true
    error.value = null
    try {
      const { workspace, state } = await workspaceApi.open(id)
      currentWorkspace.value = workspace
      // Load related data
      await Promise.all([
        loadSnapshots(id),
        loadVersions(id),
        loadAssets(id),
        loadUndoRedoState(id),
      ])
      return { workspace, state }
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateWorkspace(id: string, data: Partial<Workspace>) {
    try {
      const w = await workspaceApi.update(id, data)
      const idx = workspaces.value.findIndex(x => x.id === id)
      if (idx >= 0) workspaces.value[idx] = w
      if (currentWorkspace.value?.id === id) currentWorkspace.value = w
      return w
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function deleteWorkspace(id: string) {
    try {
      await workspaceApi.delete(id)
      workspaces.value = workspaces.value.filter(w => w.id !== id)
      if (currentWorkspace.value?.id === id) currentWorkspace.value = null
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function publishWorkspace(id: string) {
    try {
      const version = await workspaceApi.publish(id)
      await loadWorkspaces()
      return version
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function archiveWorkspace(id: string) {
    try {
      await workspaceApi.archive(id)
      await loadWorkspaces()
    } catch (e: any) {
      error.value = e.message
    }
  }

  // ─── Snapshot Actions ───

  async function createSnapshot(workspaceId: string, label?: string) {
    try {
      const sn = await workspaceApi.createSnapshot(workspaceId, { label })
      snapshots.value.unshift(sn)
      return sn
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function loadSnapshots(workspaceId: string) {
    try {
      snapshots.value = await workspaceApi.listSnapshots(workspaceId)
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function restoreSnapshot(snapshotId: string) {
    try {
      const result = await workspaceApi.restoreSnapshot(snapshotId)
      return result
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  // ─── Version Actions ───

  async function loadVersions(workspaceId: string) {
    try {
      versions.value = await workspaceApi.listVersions(workspaceId)
    } catch (e: any) {
      error.value = e.message
    }
  }

  // ─── Undo/Redo Actions ───

  async function undo(workspaceId: string) {
    try {
      const result = await workspaceApi.undo(workspaceId)
      await loadUndoRedoState(workspaceId)
      return result
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function redo(workspaceId: string) {
    try {
      const result = await workspaceApi.redo(workspaceId)
      await loadUndoRedoState(workspaceId)
      return result
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function loadUndoRedoState(workspaceId: string) {
    try {
      undoRedoState.value = await workspaceApi.getUndoRedoState(workspaceId)
    } catch {
      undoRedoState.value = { canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 }
    }
  }

  // ─── Manifest Actions ───

  async function loadManifest(workspaceId: string) {
    try {
      manifest.value = await workspaceApi.getManifest(workspaceId)
    } catch (e: any) {
      error.value = e.message
    }
  }

  // ─── Asset Actions ───

  async function loadAssets(workspaceId: string) {
    try {
      assets.value = await workspaceApi.listAssets(workspaceId)
    } catch (e: any) {
      error.value = e.message
    }
  }

  // ─── Conversation Actions ───

  async function logMessage(
    workspaceId: string,
    sessionId: string,
    role: string,
    content: string,
    context?: Record<string, unknown>,
  ) {
    try {
      const msg = await workspaceApi.logMessage(workspaceId, sessionId, role, content, context)
      conversations.value.push(msg)
      return msg
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  // ─── State Actions ───

  async function saveState(workspaceId: string, state: Record<string, unknown>) {
    try {
      await workspaceApi.saveState(workspaceId, state)
    } catch (e: any) {
      error.value = e.message
    }
  }

  // ─── Reset ───

  function reset() {
    currentWorkspace.value = null
    snapshots.value = []
    versions.value = []
    manifest.value = null
    assets.value = []
    conversations.value = []
    undoRedoState.value = { canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 }
    error.value = null
  }

  return {
    // State
    workspaces,
    currentWorkspace,
    snapshots,
    versions,
    manifest,
    assets,
    conversations,
    undoRedoState,
    loading,
    error,
    // Getters
    activeWorkspaces,
    recentWorkspaces,
    publishedWorkspaces,
    workspaceCount,
    // Actions
    loadWorkspaces,
    createWorkspace,
    openWorkspace,
    updateWorkspace,
    deleteWorkspace,
    publishWorkspace,
    archiveWorkspace,
    createSnapshot,
    loadSnapshots,
    restoreSnapshot,
    loadVersions,
    undo,
    redo,
    loadManifest,
    loadAssets,
    logMessage,
    saveState,
    reset,
  }
})
