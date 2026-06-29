// P3.1.6 — GEO Bootstrap Layer
// ============================================================
// 职责:
//   - 初始化 ExecutionController
//   - 绑定项目
//   - ❌ 不触发任何 legacy API fetch
//
// 规则:
//   Execution System → drives UI
//   UI → no longer triggers data loading (useGeoHydrate 是例外)
//
// 用法:
//   const bootstrap = useGeoBootstrap()
//   bootstrap.init(projectId)
//   bootstrap.mount()  // 可选：挂载到 workspace
// ============================================================

import { ref, computed, onBeforeUnmount } from 'vue'
import { ExecutionStateManager } from '~/utils/executionStateManager'
import type { CapabilityId } from '~/utils/geoCapability'
import { getDefaultPolicy, type ExecutionPolicy } from '~/core/control/executionPolicy'
import { getAvailableModes, recommendMode } from '~/core/control/executionModeResolver'

export interface GeoBootstrapState {
  projectId: string | null
  initialized: boolean
  tier: string
}

/**
 * GEO Bootstrap — 纯初始化层
 *
 * 职责:
 *   1. 读取项目 ID（来自 props / route / store）
 *   2. 绑定到 ExecutionStateManager
 *   3. 解析 tier → policy
 *   4. ❌ 不触发任何 fetch
 *   5. ❌ 不初始化任何 legacy store
 *
 * 数据来源:
 *   - ExecutionStateManager (singleton)
 *   - 项目 ID (外部传入)
 *
 * 不依赖:
 *   - useBrandGeoStore  ✗
 *   - useGeoHydrate     ✗ (页面自行管理)
 *   - 任何 API fetch    ✗
 */
export function useGeoBootstrap() {
  const stateMgr = ExecutionStateManager.getInstance()
  const policy = ref<ExecutionPolicy>(getDefaultPolicy('FREE'))
  const bootstrapped = ref(false)
  const currentProjectId = ref<string | null>(null)
  const currentTier = ref<string>('FREE')

  // 可用模式（由 tier 决定）
  const availableModes = computed(() =>
    getAvailableModes(currentTier.value)
  )

  // 项目所有 capability 状态
  const allCapabilityStates = computed(() => {
    if (!currentProjectId.value) return []
    return stateMgr.getAllStates(currentProjectId.value)
  })

  // 某个 capability 是否稳定
  function isCapabilityStable(capabilityId: CapabilityId): boolean {
    if (!currentProjectId.value) return false
    const ctx = stateMgr.getState(currentProjectId.value, capabilityId)
    return ctx.state === 'STABLE' || ctx.state === 'WATCHING'
  }

  // 推荐执行模式
  const modeRecommendation = computed(() => {
    if (!currentProjectId.value) return null
    const steps: CapabilityId[] = [
      'geo.execution.discover',
      'geo.execution.graph.build',
      'geo.execution.kq',
    ]
    return recommendMode(currentTier.value, currentProjectId.value, steps)
  })

  /**
   * 初始化 — 绑定项目 ID + 解析 tier
   * ❌ 不触发 fetch
   * ❌ 不读取 store
   */
  function init(projectId: string, tier: string = 'FREE'): void {
    currentProjectId.value = projectId
    currentTier.value = tier
    policy.value = getDefaultPolicy(tier)
    bootstrapped.value = true
  }

  /**
   * 重置 — 解绑项目
   */
  function reset(): void {
    if (currentProjectId.value) {
      stateMgr.clearProject(currentProjectId.value)
    }
    currentProjectId.value = null
    bootstrapped.value = false
  }

  /**
   * 重新绑定（切换项目时使用）
   */
  function rebind(projectId: string, tier?: string): void {
    reset()
    init(projectId, tier || currentTier.value)
  }

  onBeforeUnmount(() => {
    // 不自动 reset —— 由调用方决定生命周期
  })

  return {
    // 状态
    bootstrapped,
    currentProjectId,
    currentTier,
    policy,
    availableModes,
    allCapabilityStates,
    modeRecommendation,
    // 方法
    init,
    reset,
    rebind,
    isCapabilityStable,
  }
}
