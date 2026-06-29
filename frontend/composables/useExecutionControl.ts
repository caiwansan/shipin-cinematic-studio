// P3.2 — useExecutionControl (Sprint 2)
// ============================================================
// Vue composable: 将 ExecutionController 绑定到组件生命周期
//
// 用法:
//   const control = useExecutionControl(props.projectId, 'VIP_1')
//   control.runSteps(recipe.steps)  // 根据 mode 自动推进
//   control.pause()
//   control.resume()
//
// 数据来源:
//   - ExecutionStateManager（状态）
//   - ExecutionController（控制信号）
//   - 不新增 store / API
// ============================================================

import { ref, computed, onBeforeUnmount } from 'vue'
import { ExecutionController } from '~/core/control/executionController'
import { createPolicy } from '~/core/control/executionPolicy'
import { shouldPauseAfterStep } from '~/core/control/executionModeResolver'
import { ExecutionStateManager } from '~/utils/executionStateManager'
import type { CapabilityId } from '~/utils/geoCapability'
import type { ExecutionMode, ExecutionPolicy } from '~/core/control/executionPolicy'
import type { RecipeStep } from '~/utils/executionRecipe'

export interface UseExecutionControlReturn {
  // 状态
  mode: ReturnType<typeof ref<ExecutionMode>>
  paused: ReturnType<typeof ref<boolean>>
  currentStepIndex: ReturnType<typeof ref<number>>
  running: ReturnType<typeof ref<boolean>>

  // 计算属性
  totalSteps: ReturnType<typeof computed<number>>
  progressLabel: ReturnType<typeof computed<string>>
  isPausable: ReturnType<typeof computed<boolean>>
  isStepable: ReturnType<typeof computed<boolean>>
  traces: ReturnType<typeof computed<any[]>>

  // 操作
  setMode(mode: ExecutionMode): void
  pause(): void
  resume(): void
  stepForward(): void
  stepBack(): void
  abort(): void

  /** 核心入口：按 recipe 自动执行 */
  runSteps(
    steps: RecipeStep[],
    executeFn: (capabilityId: CapabilityId) => Promise<void>
  ): Promise<void>

  reset(): void
}

export function useExecutionControl(
  projectId: string | null,
  tier: string,
  initialMode?: ExecutionMode
): UseExecutionControlReturn {
  const stateMgr = ExecutionStateManager.getInstance()

  const policy = createPolicy(initialMode || 'auto', tier)
  const controller = new ExecutionController(policy)

  const mode = ref<ExecutionMode>(policy.mode)
  const paused = ref(false)
  const currentStepIndex = ref(0)
  const running = ref(false)
  const traces = ref<any[]>([])

  const totalSteps = computed(() => 0) // 由 runSteps 动态更新
  const progressLabel = computed(() => {
    if (!running.value) return '就绪'
    return `${currentStepIndex.value + 1} / ${totalSteps.value}`
  })
  const isPausable = computed(() => policy.allowPause)
  const isStepable = computed(() => policy.allowStep)

  // 同步 controller 事件到响应式状态
  const unsub = controller.onEvent((event) => {
    switch (event.type) {
      case 'pause':
        paused.value = true
        break
      case 'resume':
        paused.value = false
        break
      case 'stepForward':
        currentStepIndex.value = controller.currentStepIndex
        break
      case 'stepBack':
        currentStepIndex.value = controller.currentStepIndex
        break
      case 'abort':
        paused.value = false
        running.value = false
        break
      case 'modeChange':
        mode.value = event.payload.mode
        break
    }
    traces.value = controller.getRecentTraces()
  })

  function setMode(m: ExecutionMode): void {
    controller.setMode(m)
  }

  function pause(): void {
    controller.pause('用户暂停')
  }

  function resume(): void {
    controller.resume()
  }

  function stepForward(): void {
    controller.stepForward()
  }

  function stepBack(): void {
    controller.stepBack()
  }

  function abort(): void {
    controller.abort()
    running.value = false
  }

  async function runSteps(
    steps: RecipeStep[],
    executeFn: (capabilityId: CapabilityId) => Promise<void>
  ): Promise<void> {
    if (!projectId) return
    if (running.value) return

    controller.bindProject(projectId)
    controller.reset()
    running.value = true
    paused.value = false
    currentStepIndex.value = 0
    totalSteps.value = steps.length

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]

        // 检查是否应该暂停（step/debug mode）
        if (shouldPauseAfterStep(controller.policy, i, steps.length)) {
          controller.pause(`Step ${i + 1} 完成，等待确认`)
          // 在 auto 模式下不阻塞
          if (controller.mode !== 'auto') {
            // 轮询等待 resume
            while (controller.paused) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }
        }

        currentStepIndex.value = i
        controller.recordStep(i, step.capabilityId as CapabilityId, 'start')
        await executeFn(step.capabilityId as CapabilityId)
        controller.recordStep(i, step.capabilityId as CapabilityId, 'complete')

        // step 模式：执行后暂停等确认
        const shouldPause = shouldPauseAfterStep(controller.policy, i, steps.length)
        if (shouldPause && controller.mode !== 'auto') {
          controller.pause(`Step ${i + 1} 完成，确认后继续`)
          while (controller.paused) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
      }
    } finally {
      running.value = false
      currentStepIndex.value = 0
    }
  }

  function reset(): void {
    controller.reset()
    mode.value = 'auto'
    paused.value = false
    currentStepIndex.value = 0
    running.value = false
  }

  onBeforeUnmount(() => {
    unsub()
    controller.unbindProject()
  })

  return {
    mode,
    paused,
    currentStepIndex,
    running,
    totalSteps,
    progressLabel,
    isPausable,
    isStepable,
    traces: computed(() => controller.getRecentTraces()),
    setMode,
    pause,
    resume,
    stepForward,
    stepBack,
    abort,
    runSteps,
    reset,
  }
}
