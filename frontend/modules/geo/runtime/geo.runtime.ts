// ============================================================
// GEO Frontend Runtime — 初始化 & 注册
// ============================================================

import { useGEOStore } from '../store/useGEOStore'
import { geoApi } from '../services/geo.service'

class GEORuntime {
  private initialized = false

  async init(tenantId: string): Promise<void> {
    if (this.initialized) return
    console.log('[GEORuntime] Initializing...')

    const store = useGEOStore()
    store.reset()

    try {
      const projects = await geoApi.listProjects(tenantId)
      store.setProjects(projects)
      console.log(`[GEORuntime] Loaded ${projects.length} GEO projects`)
    } catch (err) {
      console.warn('[GEORuntime] Failed to load projects:', err)
    }

    this.initialized = true
    console.log('[GEORuntime] Initialized')
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async dispose(): Promise<void> {
    const store = useGEOStore()
    store.reset()
    this.initialized = false
    console.log('[GEORuntime] Disposed')
  }
}

export const georg = new GEORuntime()
