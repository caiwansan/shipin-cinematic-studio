// ============================================================
// Capability Store — state management for Capability Platform
// ============================================================

import { reactive, computed } from 'vue'
import { capabilityService } from '../services/capability.service'
import type {
  CapabilityContract,
  CapabilityStats,
  CapabilityHealth,
  ContractStatus,
  CapabilityCategory,
} from '../types/index'

interface CapabilityStoreState {
  contracts: CapabilityContract[]
  contractsTotal: number
  selectedContract: CapabilityContract | null
  stats: CapabilityStats | null
  health: CapabilityHealth | null
  categories: string[]
  loading: boolean
  error: string | null
}

const state = reactive<CapabilityStoreState>({
  contracts: [],
  contractsTotal: 0,
  selectedContract: null,
  stats: null,
  health: null,
  categories: [],
  loading: false,
  error: null,
})

export function useCapabilityStore() {
  function setLoading(loading: boolean) { state.loading = loading }
  function setError(error: string | null) { state.error = error }

  // ─── Contracts ───

  async function fetchContracts(params?: {
    category?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await capabilityService.listContracts(params)
      state.contracts = result.items
      state.contractsTotal = result.total
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchContract(id: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const contract = await capabilityService.getContract(id)
      state.selectedContract = contract
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Stats ───

  async function fetchStats(): Promise<boolean> {
    try {
      state.stats = await capabilityService.getStats()
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    }
  }

  // ─── Health ───

  async function fetchHealth(): Promise<boolean> {
    try {
      state.health = await capabilityService.getHealth()
      return true
    } catch {
      return false
    }
  }

  // ─── Categories ───

  async function fetchCategories(): Promise<boolean> {
    try {
      state.categories = await capabilityService.getCategories()
      return true
    } catch {
      return false
    }
  }

  // ─── Computed ───

  const activeContracts = computed(() =>
    state.contracts.filter(c => c.status === 'active')
  )

  const deprecatedContracts = computed(() =>
    state.contracts.filter(c => c.status === 'deprecated')
  )

  const contractsByCategory = computed(() => {
    const map = new Map<string, CapabilityContract[]>()
    for (const c of state.contracts) {
      const list = map.get(c.category) || []
      list.push(c)
      map.set(c.category, list)
    }
    return map
  })

  // ─── Selections ───

  function selectContract(contract: CapabilityContract | null) {
    state.selectedContract = contract
  }

  // ─── Reset ───

  function reset() {
    state.contracts = []
    state.contractsTotal = 0
    state.selectedContract = null
    state.stats = null
    state.health = null
    state.categories = []
    state.loading = false
    state.error = null
  }

  return {
    state,
    fetchContracts,
    fetchContract,
    fetchStats,
    fetchHealth,
    fetchCategories,
    activeContracts,
    deprecatedContracts,
    contractsByCategory,
    selectContract,
    reset,
    setLoading,
    setError,
  }
}
