import { ref, computed } from 'vue'

export interface Region {
  code: string
  name: string
}

export interface RegionWithChildren extends Region {
  children?: RegionWithChildren[]
}

/**
 * 统一省市区数据源 hook
 * 唯一数据源：/api/regions
 */
export function useRegions() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const version = ref<string>('')

  // 缓存：避免重复请求
  const treeCache = ref<RegionWithChildren[] | null>(null)
  const childrenCache = ref<Record<string, Region[]>>({})

  async function fetchChildren(parentCode?: string): Promise<Region[]> {
    const cacheKey = parentCode || '__root__'
    if (childrenCache.value[cacheKey]) {
      return childrenCache.value[cacheKey]
    }
    const url = parentCode ? `/api/regions?parentCode=${parentCode}` : '/api/regions'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const regions: Region[] = (data.data || []).map((r: any) => ({
      code: r.code,
      name: r.name,
    }))
    childrenCache.value[cacheKey] = regions
    return regions
  }

  async function fetchTree(): Promise<RegionWithChildren[]> {
    if (treeCache.value) return treeCache.value
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/regions/tree')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      treeCache.value = data.data || []
      return treeCache.value
    } catch (e: any) {
      error.value = e.message || '加载地区数据失败'
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchProvinces(): Promise<Region[]> {
    return fetchChildren()
  }

  async function fetchCities(provinceCode: string): Promise<Region[]> {
    return fetchChildren(provinceCode)
  }

  async function fetchDistricts(cityCode: string): Promise<Region[]> {
    return fetchChildren(cityCode)
  }

  return {
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    version,
    fetchProvinces,
    fetchCities,
    fetchDistricts,
    fetchTree,
    fetchChildren,
  }
}
