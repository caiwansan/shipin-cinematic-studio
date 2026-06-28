// ============================================================
// Asset Store — state management for Unified Assets
// ============================================================

import { reactive, computed } from 'vue'
import { assetService } from '../services/asset.service'
import type { UnifiedAsset, AssetFilter, AssetListResult } from '../types/index'

interface AssetStoreState {
  items: UnifiedAsset[]
  total: number
  loading: boolean
  error: string | null
  selectedAsset: UnifiedAsset | null
  projectStats: Record<string, number>
  filter: AssetFilter
}

const state = reactive<AssetStoreState>({
  items: [],
  total: 0,
  loading: false,
  error: null,
  selectedAsset: null,
  projectStats: { total: 0 },
  filter: {},
})

export function useAssetStore() {
  function setLoading(loading: boolean) { state.loading = loading }
  function setError(error: string | null) { state.error = error }
  function setFilter(filter: AssetFilter) { Object.assign(state.filter, filter) }
  function resetFilter() { state.filter = {} }

  async function fetchAssets(projectId: string, filter?: AssetFilter): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await assetService.list(projectId, filter || state.filter)
      state.items = result.items
      state.total = result.total
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchAssetById(id: string): Promise<UnifiedAsset | null> {
    state.loading = true
    state.error = null
    try {
      const asset = await assetService.getById(id)
      state.selectedAsset = asset
      return asset
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  async function fetchProjectStats(projectId: string): Promise<boolean> {
    try {
      const stats = await assetService.getStats(projectId)
      state.projectStats = stats
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    }
  }

  async function createAsset(data: Partial<UnifiedAsset> & { projectId: string; type: string; title: string }): Promise<UnifiedAsset | null> {
    state.loading = true
    state.error = null
    try {
      const asset = await assetService.create(data)
      if (asset) state.items.unshift(asset)
      return asset
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  async function updateAsset(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset | null> {
    state.loading = true
    state.error = null
    try {
      const asset = await assetService.update(id, data)
      if (asset) {
        const idx = state.items.findIndex(a => a.id === id)
        if (idx >= 0) state.items[idx] = asset
      }
      return asset
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  async function deleteAsset(id: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const success = await assetService.delete(id)
      if (success) state.items = state.items.filter(a => a.id !== id)
      return success
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  const statsCards = computed(() => {
    const stats = state.projectStats
    const cards: { icon: string; label: string; value: number | string; color: string }[] = [
      { icon: '📦', label: '总资产数', value: stats.total || 0, color: '#6366f1' },
      { icon: '📄', label: '文章', value: (stats as any).Article || 0, color: '#06b6d4' },
      { icon: '❓', label: 'FAQ', value: (stats as any).FAQ || 0, color: '#10b981' },
      { icon: '📚', label: '文档', value: ((stats as any).Document || 0) + ((stats as any).API || 0), color: '#8b5cf6' },
      { icon: '🖼️', label: '图片', value: (stats as any).Image || 0, color: '#f59e0b' },
      { icon: '🎬', label: '视频', value: (stats as any).Video || 0, color: '#ef4444' },
      { icon: '🤖', label: '提示词', value: (stats as any).Prompt || 0, color: '#ec4899' },
    ]
    return cards
  })

  return {
    // State
    state: state as Readonly<AssetStoreState>,
    items: computed(() => state.items),
    total: computed(() => state.total),
    loading: computed(() => state.loading),
    error: computed(() => state.error),
    selectedAsset: computed(() => state.selectedAsset),
    projectStats: computed(() => state.projectStats),
    filter: computed(() => state.filter),

    // Actions
    setLoading,
    setError,
    setFilter,
    resetFilter,
    fetchAssets,
    fetchAssetById,
    fetchProjectStats,
    createAsset,
    updateAsset,
    deleteAsset,

    // Computed
    statsCards,
  }
}
