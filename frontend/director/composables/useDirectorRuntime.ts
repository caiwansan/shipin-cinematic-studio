// director/composables/useDirectorRuntime.ts
// 唯一 API 入口 + SSE 订阅 — 所有组件通过它消费数据

import { createDirectorStore } from '../stores/directorStore'

export function useDirectorRuntime() {
  const {
    state, reset,
    setSession, setScenes, setRuntimeState,
    setIdentity, setMemory, addAdaptiveDecision,
    setConnected, setPending, setError,
  } = createDirectorStore()

  // ─── API 基址 ───────────────────────────────────────

  const API = '/api/director'

  function apiUrl(path: string): string {
    return `${API}${path}`
  }

  // ─── HTTP 请求 ──────────────────────────────────────

  async function apiPost(path: string, body: any): Promise<any> {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message || 'API error')
        return null
      }
      return json.data
    } catch (e: any) {
      setError(e.message || 'Network error')
      return null
    } finally {
      setPending(false)
    }
  }

  // ─── 核心动作 ───────────────────────────────────────

  let sseSource: EventSource | null = null
  let autoTickTimer: ReturnType<typeof setInterval> | null = null

  /** 编译并启动运行时 */
  async function runStory(scenes: any[], title?: string) {
    const data = await apiPost('/runtime/start', {
      storyGraph: { title: title || '新故事', scenes },
    })
    if (data) {
      setSession(data.sessionKey)
      setRuntimeState(data.state.runtimeState, data.state.sceneContexts)
      setScenes(scenes as any)
    }
    return data
  }

  /** 单帧推进 */
  async function tick(delta = 1.0) {
    if (!state.sessionKey) return null
    const data = await apiPost('/runtime/tick', {
      sessionKey: state.sessionKey,
      deltaTime: delta,
    })
    if (data) {
      setRuntimeState(data.state.runtimeState, data.state.sceneContexts)
    }
    return data
  }

  /** 跳转 */
  async function seek(sceneId: string, shotIndex = 0) {
    if (!state.sessionKey) return null
    return await apiPost('/runtime/seek', {
      sessionKey: state.sessionKey,
      sceneId,
      shotIndex,
    })
  }

  /** 拉取 Export 投影 */
  async function fetchExport() {
    if (!state.sessionKey) return null
    return await apiPost('/export', { sessionKey: state.sessionKey })
  }

  /** 启动自动 tick */
  function startAutoTick(intervalMs = 1000) {
    if (autoTickTimer) return
    autoTickTimer = setInterval(async () => {
      await tick()
    }, intervalMs)
  }

  /** 停止自动 tick */
  function stopAutoTick() {
    if (autoTickTimer) {
      clearInterval(autoTickTimer)
      autoTickTimer = null
    }
  }

  /** 连接 SSE 事件流 */
  function connectSSE() {
    if (!state.sessionKey || sseSource) return
    sseSource = new EventSource(`/api/director/runtime/stream/${state.sessionKey}`)

    sseSource.onopen = () => setConnected(true)
    sseSource.onerror = () => setConnected(false)

    sseSource.addEventListener('tick', (e) => {
      try {
        const data = JSON.parse(e.data)
        setRuntimeState(data.runtimeState, data.sceneContexts || {})
      } catch { /* ignore parse errors */ }
    })

    sseSource.addEventListener('identity', (e) => {
      try {
        setIdentity(JSON.parse(e.data))
      } catch { /* ignore */ }
    })

    sseSource.addEventListener('memory', (e) => {
      try {
        setMemory(JSON.parse(e.data))
      } catch { /* ignore */ }
    })

    sseSource.addEventListener('adaptive', (e) => {
      try {
        const data = JSON.parse(e.data)
        addAdaptiveDecision(data)
      } catch { /* ignore */ }
    })

    sseSource.addEventListener('scene-complete', () => {
      // 场景完成 → 可触发后续动作
    })
  }

  /** 断开 SSE */
  function disconnectSSE() {
    if (sseSource) {
      sseSource.close()
      sseSource = null
      setConnected(false)
    }
  }

  /** 停止运行 */
  async function stopStory() {
    stopAutoTick()
    disconnectSSE()
    if (state.sessionKey) {
      await apiPost('/runtime/stop', { sessionKey: state.sessionKey })
    }
    reset()
  }

  return {
    state,
    runStory,
    tick,
    seek,
    fetchExport,
    startAutoTick,
    stopAutoTick,
    connectSSE,
    disconnectSSE,
    stopStory,
  }
}
