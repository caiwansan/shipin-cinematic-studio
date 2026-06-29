// ============================================================
// useGeoHydrate — GEO Workspace 唯一状态入口
// 封装 GET /api/projects/:id/hydrate，所有 Panel 从它派生
//
// 规则：
//   1. 所有 Panel 禁止独立 fetch → 统一走这里
//   2. watcher 事件是 hydrate 的伴生数据流，不属于独立状态
//   3. 执行动作后自动触发 refresh
//
// Freeze Manifest: docs/freeze/GEO-FRONTEND-FREEZE-MANIFEST.md
// ============================================================

import { ref, computed, readonly, watch, onMounted, onBeforeUnmount } from 'vue'

// ---- Types ----
export interface HydrateProject {
  id: string
  name: string
  description: string | null
  status: string
  projectType: string | null
  tenantId: string | null
  ownerId: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  executionResults: any
}

export interface HydrateData {
  project: HydrateProject
  designSpec?: Record<string, any>
  characters?: any[]
  scenes?: any[]
  voices?: any[]
  segments?: any[]
  frames?: any[]
  production?: any
  effects?: any[]
  actions?: any[]
  cameras?: any[]
  emotions?: any[]
  propImages?: any[]
  storyboardImages?: any[]
  characterImages?: any[]
  sceneImages?: any[]
}

export interface WatcherEvent {
  id: string
  entity: string
  entity_id: string
  operation: string
  status: string
  latency_ms: number | null
  error: string | null
  created_at: string
}

export interface GeoWorkspaceState {
  /** 项目全量数据（hydrate） */
  hydrate: HydrateData | null
  /** 最近 watcher 事件（由 poll 填充，不作为单源） */
  watcherEvents: WatcherEvent[]
  /** 正在执行的动作标识 */
  runningAction: string | null
  /** 上次动作结果 */
  actionResult: { success: boolean; message: string } | null
  /** 加载状态 */
  loading: boolean
  /** 错误 */
  error: string | null
}

// ---- Default State ----
function defaultState(): GeoWorkspaceState {
  return {
    hydrate: null,
    watcherEvents: [],
    runningAction: null,
    actionResult: null,
    loading: false,
    error: null,
  }
}

// ---- Composable ----
export function useGeoHydrate(projectId: string | null | undefined | (() => string | null | undefined)) {
  // Resolve if a getter function was passed (Vue pattern: () => props.projectId)
  if (typeof projectId === "function") {
    projectId = projectId()
  }
  const state = ref<GeoWorkspaceState>(defaultState())
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // ---- Auth Helpers ----
  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const token = localStorage.getItem('accessToken')
      if (token) h['Authorization'] = `Bearer ${token}`
    } catch {}
    return h
  }

  function authFetch(url: string, opts?: RequestInit): Promise<Response> {
    return fetch(url, { ...opts, headers: { ...authHeaders(), ...((opts?.headers as any) || {}) } })
  }

  // ---- Core: Load Hydrate ----
  async function loadHydrate() {
    if (!projectId) return
    
    // GEO 项目的 id 是 UUID v4 格式（xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
    // 且 GEO 项目不存在于旧 Project 表中，hydrate API 必然返回 404。
    // 直接注入空数据结构，跳过 API 调用。
    const isGeoProject = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
    if (isGeoProject) {
      state.value.hydrate = {
        project: { id: projectId, name: '', executionResults: null, status: 'draft' },
        designSpec: null, production: null, characters: [],
        scenes: [], voices: [], segments: [], frames: [],
        effects: [], actions: [], cameras: [], emotions: [],
        storyboardImages: [], characterImages: [], sceneImages: [],
        audioFiles: [], propImages: [],
      } as any
      return
    }
    state.value.loading = true
    state.value.error = null
    try {
      const res = await authFetch(`/api/projects/${projectId}/hydrate`)
      if (res.ok) {
        const data = await res.json()
        state.value.hydrate = data as HydrateData
      } else if (res.status === 401 || res.status === 403) {
        state.value.error = '认证失败，请重新登录'
      } else if (res.status === 404) {
        // 404: GEO 项目没有独立的 hydrate API（项目已创建，在 /api/geo/projects 中管理）
        // 静默降级，不影响页面渲染
        state.value.hydrate = {
          project: { id: projectId, name: '', executionResults: null, status: 'draft' },
          designSpec: null, production: null, characters: [],
          scenes: [], voices: [], segments: [], frames: [],
          effects: [], actions: [], cameras: [], emotions: [],
          storyboardImages: [], characterImages: [], sceneImages: [],
          audioFiles: [], propImages: [],
        } as any
      } else {
        state.value.error = `加载失败: HTTP ${res.status}`
      }
    } catch (e: any) {
      state.value.error = e.message
    } finally {
      state.value.loading = false
    }
  }

  // ---- Core: Load Watcher Events ----
  async function loadWatcherEvents() {
    if (!projectId) return
    try {
      const res = await authFetch(`/api/geo/watcher/recent?entityId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        state.value.watcherEvents = data.data || data.events || []
      }
    } catch {}
  }

  // ---- Action: Execute ----
  async function executeAction(
    actionId: string,
    endpoint: string,
    body?: any
  ): Promise<boolean> {
    if (!projectId || state.value.runningAction) return false
    state.value.runningAction = actionId
    state.value.actionResult = null
    try {
      const res = await authFetch(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      state.value.actionResult = {
        success: res.ok,
        message: data.error || data.message || (data.success ? '执行成功' : '执行返回异常'),
      }
      // 动作后自动刷新
      setTimeout(() => { loadHydrate(); loadWatcherEvents() }, 500)
      return res.ok
    } catch (e: any) {
      state.value.actionResult = { success: false, message: e.message }
      return false
    } finally {
      state.value.runningAction = null
    }
  }

  // ---- Actions ----
  function discoverEntities() {
    // Read topic from hydrate data (fallback: projectId)
    const topic = state.value.hydrate?.project?.name || projectId
    return executeAction('discovery', `/api/geo/projects/${projectId}/discover`, { topic })
  }

  function buildKnowledgeGraph() {
    return executeAction('knowledge-graph', `/api/geo/projects/${projectId}/graph/build`)
  }

  function evaluateQuality() {
    // 自动从 graphNodes 获取 entityIds（discover 的结果）
    const entityIds: string[] = state.value.graphNodes?.map(n => n.id).filter(Boolean) || []
    // 如果没有 entityIds，跳过 API 直接返回（无需评估）
    if (entityIds.length === 0) {
      state.value.actionResult = { success: true, message: '没有可评估的实体，请先执行实体发现' }
      return true
    }
    return executeAction('kq', `/api/geo/knowledge-quality`, {
      projectId,
      entityIds,
      options: { type: 'full' }
    })
  }

  function refresh() {
    loadHydrate()
    loadWatcherEvents()
  }

  // ---- Polling ----
  function startPolling() {
    stopPolling()
    pollTimer = setInterval(() => loadWatcherEvents(), 8000)
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  // ---- Derived State ----
  const projectInfo = computed(() => state.value.hydrate?.project || null)
  const executionResults = computed(() => state.value.hydrate?.project?.executionResults || null)
  const designSpec = computed(() => state.value.hydrate?.designSpec || null)

  const executionSummary = computed(() => {
    const exec = state.value.hydrate?.project?.executionResults
    if (!exec) return null
    const summary: Record<string, number> = {}
    if (exec.workflows) summary['工作流'] = Object.keys(exec.workflows).length
    if (exec.completed) summary['已完成'] = exec.completed
    if (exec.failed) summary['失败'] = exec.failed
    if (exec.pipelineStage) summary['流水线阶段'] = exec.pipelineStage
    return Object.keys(summary).length > 0 ? summary : null
  })

  const recentWatcherEvents = computed(() => state.value.watcherEvents.slice(0, 10))

  const watcherSummary = computed(() => {
    const events = state.value.watcherEvents
    if (!events.length) return null
    return {
      total: events.length,
      success: events.filter(e => e.status === 'SUCCESS').length,
      fail: events.filter(e => e.status === 'FAIL').length,
      skip: events.filter(e => e.status === 'SKIP').length,
    }
  })

  const lastActionStatus = computed(() => {
    const result = state.value.actionResult
    if (!result) return null
    return result.success ? 'success' : 'fail'
  })

  // ---- Lifecycle ----
  function init() {
    if (projectId) {
      loadHydrate()
      loadWatcherEvents()
      startPolling()
    }
  }

  function destroy() {
    stopPolling()
    state.value = defaultState()
  }

  // Watch projectId changes
  watch(() => projectId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      state.value = defaultState()
      loadHydrate()
      loadWatcherEvents()
      startPolling()
    } else if (!newId) {
      destroy()
    }
  })

  // ---- Expose ----
  return {
    // State
    state: readonly(state),
    loading: computed(() => state.value.loading),
    error: computed(() => state.value.error),
    runningAction: computed(() => state.value.runningAction),

    // Derived
    projectInfo,
    executionResults,
    designSpec,
    executionSummary,
    recentWatcherEvents,
    watcherSummary,
    lastActionStatus,

    // Actions
    discoverEntities,
    buildKnowledgeGraph,
    evaluateQuality,
    refresh,
    loadHydrate,
    loadWatcherEvents,

    // Lifecycle
    init,
    destroy,
  }
}
