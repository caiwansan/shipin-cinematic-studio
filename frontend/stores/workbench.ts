// ============================================================================
// @deprecated — Reality Recovery Phase5
// Production path unused — 仅被 pages/workbench/*（旧调试台）使用；
// 其 API（/api/repair、/api/trace、/api/replay）后端未注册（404）；
// studio-v2/workspace/* 生产链 0 引用本 store。保留：勿删除。
// ============================================================================
// 盘古斧 AI OS — Phase 7A Workbench Store
// 统一状态管理：负载 / 健康 / 认证 / 运行时状态
// ============================================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useWorkbenchStore = defineStore('workbench', () => {
  // ── 运行时状态 ─────────────────────────────────────────────────────────

  const runtimeState = ref<'running' | 'stopped'>('running')
  const mode = ref<'production' | 'debug' | 'chaos'>('production')

  // ── 系统指标 ───────────────────────────────────────────────────────────

  const healthScore = ref(74.4)
  const driftRate = ref(0.004)
  const recoveryRate = ref(0.948)
  const replayIntegrity = ref(0.98)
  const loadTier = ref<'LIGHT' | 'MODERATE' | 'HEAVY' | 'SATURATION'>('LIGHT')
  const certStatus = ref<'CERTIFIED' | 'CONDITIONALLY_CERTIFIED' | 'NOT_CERTIFIED'>('CONDITIONALLY_CERTIFIED')

  // ── 事件流 ─────────────────────────────────────────────────────────────

  const events = ref<{ time: string; level: string; msg: string }[]>([])

  function pushEvent(level: string, msg: string) {
    events.value.push({
      time: new Date().toLocaleTimeString(),
      level,
      msg
    })
    if (events.value.length > 200) events.value.splice(0, 50)
  }

  // ── 运行控制 ───────────────────────────────────────────────────────────

  function toggleRuntime() {
    runtimeState.value = runtimeState.value === 'running' ? 'stopped' : 'running'
    pushEvent(
      runtimeState.value === 'running' ? 'info' : 'warn',
      runtimeState.value === 'running' ? 'Runtime resumed' : 'Runtime suspended'
    )
  }

  function setMode(m: typeof mode.value) {
    mode.value = m
    pushEvent('info', `Mode switched to ${m}`)
  }

  // ── 计算属性 ───────────────────────────────────────────────────────────

  const isProductionSafe = computed(() => loadTier.value === 'LIGHT')
  const healthGrade = computed(() => {
    if (healthScore.value >= 90) return 'A'
    if (healthScore.value >= 74) return 'B+'
    if (healthScore.value >= 40) return 'C'
    return 'D'
  })

  // ── API 连接 ───────────────────────────────────────────────────────────

  const apiBase = '/api'

  async function fetchHealth() {
    try {
      const res = await fetch(`${apiBase}/health`)
      const data = await res.json()
      healthScore.value = data.healthScore
      driftRate.value = data.driftRate
      recoveryRate.value = data.recoveryRate
      replayIntegrity.value = data.replayIntegrity
      loadTier.value = data.loadTier
      certStatus.value = data.certificationStatus
      return data
    } catch (e) {
      pushEvent('error', `Health fetch failed: ${e}`)
      return null
    }
  }

  async function executeDAG(dagId: string, input: any, seed?: string) {
    try {
      const res = await fetch(`${apiBase}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dagId, input, seed })
      })
      return await res.json()
    } catch (e) {
      pushEvent('error', `Execute failed: ${e}`)
      return null
    }
  }

  async function triggerReplay(executionId: string, seed?: string) {
    try {
      const res = await fetch(`${apiBase}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, seed })
      })
      const data = await res.json()
      pushEvent('info', `Replay triggered: ${data.replayId}`)
      return data
    } catch (e) {
      pushEvent('error', `Replay failed: ${e}`)
      return null
    }
  }

  // ── 轮询健康检查 ───────────────────────────────────────────────────────

  let healthInterval: ReturnType<typeof setInterval> | null = null

  function startHealthPolling(intervalMs = 10000) {
    stopHealthPolling()
    fetchHealth()
    healthInterval = setInterval(fetchHealth, intervalMs)
  }

  function stopHealthPolling() {
    if (healthInterval) {
      clearInterval(healthInterval)
      healthInterval = null
    }
  }

  return {
    runtimeState, mode, healthScore, driftRate, recoveryRate,
    replayIntegrity, loadTier, certStatus, events,
    isProductionSafe, healthGrade,
    pushEvent, toggleRuntime, setMode,
    fetchHealth, executeDAG, triggerReplay,
    startHealthPolling, stopHealthPolling
  }
})
