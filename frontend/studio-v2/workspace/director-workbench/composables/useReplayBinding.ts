/**
 * useReplayBinding
 * 回放绑定钩子 — 在 Runtime Binding Layer 上加外挂式 Replay Layer
 *
 * 核心逻辑：
 *   IF replayStore.liveMode = true
 *     → 用 replay store 的 activeShots/activeEmotionCurve 覆盖 runtime store
 *   ELSE
 *     → pass-through 正常 runtime binding
 */

import { watch } from 'vue'
import { useDirectorRuntimeStore } from '../stores/director-runtime-store'
import { useDirectorReplayStore } from '../stores/director-replay-store'

export function useReplayBinding() {
  const runtimeStore = useDirectorRuntimeStore()
  const replayStore = useDirectorReplayStore()

  /**
   * 将 replay 的快照状态写入 runtime store
   * 让现有 UI 组件无感知消费
   */
  function applyReplayToRuntime() {
    if (!replayStore.liveMode) return

    const shots = replayStore.activeShots
    const emotions = replayStore.activeEmotionCurve
    const motions = replayStore.activeMotionEvents

    if (shots.length === 0) return

    // 构建 timeline（覆盖 runtimeStore 的状态）
    const timeline = shots.map((shot: any, i: number) => ({
      id: `replay_shot_${i}`,
      index: i,
      description: shot.data?.text ?? '',
      duration: 2,
      grammarType: shot.grammarType ?? 'build_up',
      grammarIntensity: 0.6,
      emotionalTension: emotions[i]?.tension
        ? emotions[i].tension / 100
        : 0.5,
      emotionalMood: emotions[i]?.mood ?? 'calm',
      motionStyle: shot.motionStyle ?? 'static',
      motionDirective: '',
      motionPressure: motions[i]?.intent?.pressure
        ? motions[i].intent.pressure / 100
        : 0.3,
      motionInstability: motions[i]?.intent?.instability
        ? motions[i].intent.instability / 100
        : 0.2,
      motionEnergyFlow: motions[i]?.intent?.energyFlow ?? 0,
      temporalContinuity: 0.7,
      temporalHintNeeded: false,
      characterStable: true,
      characterDrift: 0,
      selected: i === runtimeStore.state.currentShotIndex,
      hovered: false,
    }))

    // 只更新不替换（保留 selected 状态）
    runtimeStore.state.timeline = timeline
  }

  /**
   * 切换到 replay 模式：监听 replay store 的 cursor 变化
   */
  function enableReplayMode(traceId?: string) {
    if (traceId) {
      replayStore.connectSSE(traceId)
    } else {
      replayStore.liveMode = true
    }

    // 监听 cursor 变化 → 同步至 runtime
    watch(
      () => replayStore.cursor,
      () => {
        applyReplayToRuntime()
      },
    )
  }

  /**
   * 退出 replay 模式
   */
  function disableReplayMode() {
    replayStore.disconnectSSE()
    replayStore.liveMode = false
    replayStore.reset()
  }

  /**
   * 获取当前状态摘要（用于 inspector 显示）
   */
  function getReplayStatus() {
    return {
      mode: replayStore.liveMode ? 'live_replay' : 'normal',
      traceId: replayStore.traceId,
      progress: replayStore.progress,
      currentEvent: replayStore.currentEvent,
      eventCount: replayStore.totalEvents,
      playing: replayStore.isPlaying,
      speed: replayStore.replaySpeed,
    }
  }

  return {
    applyReplayToRuntime,
    enableReplayMode,
    disableReplayMode,
    getReplayStatus,
  }
}
