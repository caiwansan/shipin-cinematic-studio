/**
 * Learning Store — Sprint 4-4: Discovery → Learn
 *
 * Pinia store for managing LearningRound state.
 * Persists learning rounds to localStorage (can be upgraded to API-backed).
 *
 * Reuses:
 *   - learningService.generateLearningRound()
 *   - types/learning/learning-signal.ts
 *
 * Does NOT require a new Engine or Domain Model.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateLearningRound } from '../services/learningService'
import type { LearningRound, LearningSignal, NextAction } from '../types/learning/learning-signal'

const STORAGE_KEY = 'geo-learning-rounds'

function loadFromStorage(): Record<string, LearningRound> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(rounds: Record<string, LearningRound>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds))
  } catch {
    // silent fail
  }
}

export const useLearningStore = defineStore('geo-learning', () => {
  const rounds = ref<Record<string, LearningRound>>(loadFromStorage())
  const latestRound = ref<LearningRound | null>(null)
  const isGenerating = ref(false)

  // ── Computed ──

  /** 是否有当前激活的学习信号 */
  const hasActiveLearning = computed(() => latestRound.value !== null)

  /** 当前推荐的下一步行动 */
  const currentNextAction = computed<NextAction | null>(() => {
    if (!latestRound.value) return null
    return latestRound.value.nextAction
  })

  /** 当前洞察文本 */
  const currentInsight = computed<string | null>(() => {
    return latestRound.value?.insight ?? null
  })

  /** 当前信号摘要 */
  const currentSignalSummary = computed(() => {
    return latestRound.value?.signalSummary ?? null
  })

  /** 所有正向信号（按幅度排序） */
  const positiveSignals = computed<LearningSignal[]>(() => {
    if (!latestRound.value) return []
    return [...latestRound.value.signals]
      .filter(s => s.direction === 'positive')
      .sort((a, b) => b.magnitude - a.magnitude)
  })

  /** 所有学习轮次（按时间降序） */
  const allRounds = computed(() => {
    return Object.values(rounds.value).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })

  /** 最近的 N 个轮次 */
  const recentRounds = computed(() => allRounds.value.slice(0, 5))

  // ── Actions ──

  /**
   * 从事件生成学习轮次
   * This is the core of Sprint 4-4: transforming event → learning signal
   */
  function createFromEvent(options: {
    projectId: string
    entityName: string
    triggerEvent: LearningRound['triggerEvent']
    beforeAdi?: number
    afterAdi?: number
  }): LearningRound | null {
    isGenerating.value = true
    try {
      const round = generateLearningRound({
        projectId: options.projectId,
        entityName: options.entityName,
        triggerEvent: options.triggerEvent,
        beforeAdi: options.beforeAdi,
        afterAdi: options.afterAdi,
      })

      // Store and persist
      rounds.value[round.id] = round
      latestRound.value = round
      saveToStorage(rounds.value)

      // Emit event for downstream consumers
      if (typeof window !== 'undefined') {
        import('../composables/useEventBus').then(({ useEventBus }) => {
          try {
            const bus = useEventBus()
            bus.emit('LEARN:GENERATED', {
              projectId: round.projectId,
              entityId: round.entityName,
              timestamp: round.createdAt,
              source: 'LearningStore',
              roundId: round.id,
              signalCount: round.signalSummary.total_signals,
              nextActionTitle: round.nextAction.missionTitle,
              summary: round.insight,
            })
          } catch {
            // Event bus emission is non-critical
          }
        })
      }

      return round
    } finally {
      isGenerating.value = false
    }
  }

  /** 清除当前学习信号 */
  function dismissCurrent() {
    latestRound.value = null
  }

  /** 加载指定轮次 */
  function loadRound(roundId: string) {
    const round = rounds.value[roundId]
    if (round) {
      latestRound.value = round
    }
  }

  /** 清除所有学习数据 */
  function clearAll() {
    rounds.value = {}
    latestRound.value = null
    saveToStorage(rounds.value)
  }

  return {
    // State
    rounds,
    latestRound,
    isGenerating,
    // Computed
    hasActiveLearning,
    currentNextAction,
    currentInsight,
    currentSignalSummary,
    positiveSignals,
    allRounds,
    recentRounds,
    // Actions
    createFromEvent,
    dismissCurrent,
    loadRound,
    clearAll,
  }
})
