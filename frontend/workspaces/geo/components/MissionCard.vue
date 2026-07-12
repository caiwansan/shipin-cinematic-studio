<template>
  <div
    class="mission-card"
    :class="missionCardClasses"
  >
    <TaskCardRenderer
      :card="cardModel"
      @action="onAction"
    >
      <template #body>
        <!-- Why section (collapsible) -->
        <div class="mission-card__why">
          <button class="mission-card__why-toggle" @click="showWhy = !showWhy">
            <span>💡</span>
            <span>{{ showWhy ? '收起原因' : '为什么要做？' }}</span>
            <span class="mission-card__why-arrow" :class="{ 'mission-card__why-arrow--open': showWhy }">▼</span>
          </button>
          <p v-if="showWhy" class="mission-card__why-text">{{ missionWhy }}</p>
        </div>

        <!-- Impact (预计收益) -->
        <div class="mission-card__impact">
          <span class="mission-card__impact-label">预计收益</span>
          <div class="mission-card__impact-list">
            <div
              v-for="(item, idx) in missionImpact"
              :key="idx"
              class="mission-card__impact-item"
            >
              <span class="mission-card__impact-dimension">{{ item.dimension }}</span>
              <span class="mission-card__impact-gain">+{{ item.gain }}{{ item.unit }}</span>
            </div>
          </div>
        </div>

        <!-- Meta: Time + Difficulty -->
        <div class="mission-card__meta">
          <span class="mission-card__time">⏱ {{ estimatedTime }}</span>
          <span class="mission-card__difficulty" :class="`mission-card__difficulty--${difficulty}`">
            {{ difficultyLabel }}
          </span>
        </div>
      </template>
    </TaskCardRenderer>

    <!-- Custom actions (execute, explain, skip) -->
    <div class="mission-card__actions">
      <button
        class="mission-card__execute-btn"
        :class="{
          'mission-card__execute-btn--executing': executeState === 'executing',
          'mission-card__execute-btn--done': executeState === 'done',
          'mission-card__execute-btn--error': executeState === 'error',
        }"
        :disabled="executeState === 'executing' || executeState === 'done'"
        @click="handleExecute"
        :title="executeTooltip"
      >
        <template v-if="executeState === 'idle'">⚡ 执行</template>
        <template v-else-if="executeState === 'executing'">⏳ 执行中...</template>
        <template v-else-if="executeState === 'done'">✅ 已执行</template>
        <template v-else-if="executeState === 'error'">❌ 失败</template>
      </button>

      <button
        class="mission-card__explain-btn"
        title="Explain"
        @click="handleExplain"
      >
        💡
      </button>

      <button
        v-if="missionStatus === 'pending'"
        class="mission-card__skip-btn"
        @click="handleSkip"
        title="跳过"
      >
        ⏭
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TaskCardModel } from '~/workspaces/geo/types/business'
import TaskCardRenderer from './business/renderer/TaskCardRenderer.vue'
import { createExecution, updateExecutionStatus } from '../services/executionPersistenceService'
import { useEventBus } from '../composables/useEventBus'
console.log('[MissionCard:setup] initializing')
const { emit: busEmit } = useEventBus()
console.log('[MissionCard:setup] busEmit ready')

// Execution status type (Part D)
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed'

const props = defineProps<{
  card: TaskCardModel
  executionStatus?: ExecutionStatus | null
  executionId?: string | null
}>()

const emit = defineEmits<{
  action: [actionId: string]
  skip: [missionId: string]
  execute: [missionId: string]
  explain: [missionId: string]
  explainExecution: [executionId: string]
  executed: [missionId: string]
}>()

// ── Business fields derived from card metadata ──
const missionWhy = computed(() => (props.card.metadata?.why as string) || '')
const missionImpact = computed(() => (props.card.metadata?.impact || []) as Array<{ dimension: string; gain: number; unit: string }>)
const estimatedTime = computed(() => (props.card.metadata?.estimatedTime as string) || '')
const difficulty = computed(() => (props.card.metadata?.difficulty as string) || 'medium')
const missionStatus = computed(() => (props.card.metadata?.missionStatus as string) || 'pending')

// ── UI State ──
const showWhy = ref(false)
const executeState = ref<'idle' | 'executing' | 'done' | 'error'>('idle')
const executeError = ref<string | null>(null)

// ── Computed ──
const cardModel = computed<TaskCardModel>(() => props.card)

const missionCardClasses = computed(() => {
  const cls: string[] = []
  if (missionStatus.value === 'completed') cls.push('mission-card--completed')
  if (missionStatus.value === 'skipped') cls.push('mission-card--skipped')
  return cls
})

const difficultyLabel = computed(() => {
  const labels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }
  return labels[difficulty.value] || difficulty.value
})

const executeTooltip = computed(() => {
  if (executeState.value === 'error' && executeError.value) return executeError.value
  if (executeState.value === 'done') return 'Execution completed'
  return 'Execute this mission'
})

// ── Handlers ──
function onAction(actionId: string) {
  emit('action', actionId)
}

async function handleExecute() {
  console.log('[MissionCard:handleExecute] clicked', props.card.id)
  if (executeState.value === 'executing' || executeState.value === 'done') return
  executeState.value = 'executing'
  executeError.value = null

  const projectId = (props.card.metadata?.brandId as string) || props.card.id
  let persistId: string | null = null

  try {
    // P0: Persist execution state to backend BEFORE execution
    try {
      const persisted = await createExecution({
        projectId,
        optimizationType: 'mission_execution',
        triggerSource: 'manual',
      })
      persistId = persisted.id
    } catch (persistErr) {
      // Non-fatal: execute even if persistence fails
      console.warn('[MissionCard] Execution persistence failed, continuing:', persistErr)
    }

    const res = await fetch(`/api/geo/missions/${encodeURIComponent(props.card.id)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: projectId }),
    })
    const json = await res.json()

    if (!json.success) {
      throw new Error(json.error || 'Execution failed')
    }

    executeState.value = 'done'

    // Persist completed status if we have a persistence ID
    if (persistId) {
      try {
        await updateExecutionStatus(persistId, 'completed', new Date().toISOString())
      } catch (updateErr) {
        console.warn('[MissionCard] Status update failed:', updateErr)
      }
    }

    // Emit flow events for Mission → Verification chain
    const executionId = json.data?.executionId || persistId || ''
    emit('executed', props.card.id)

    // Broadcast EXECUTION:COMPLETED event to trigger auto-verification
    busEmit('EXECUTION:COMPLETED', {
      projectId,
      entityId: projectId,
      timestamp: new Date().toISOString(),
      source: 'MissionCard',
      executionId,
      missionId: props.card.id,
      status: 'completed',
      completedAt: new Date().toISOString(),
      optimizedType: 'mission_execution',
    })
  } catch (err: any) {
    executeState.value = 'error'
    executeError.value = err.message || 'Unknown error'

    // Mark persisted execution as failed
    if (persistId) {
      try {
        await updateExecutionStatus(persistId, 'failed')
      } catch { /* ignore */ }
    }
  }
}

function handleExplain() {
  console.log('[MissionCard:handleExplain] clicked', props.card.id)
  if (props.executionId) {
    emit('explainExecution', props.executionId)
  } else {
    emit('explain', props.card.id)
  }
}

function handleSkip() {
  console.log('[MissionCard:handleSkip] clicked', props.card.id)
  emit('skip', props.card.id)
}
</script>

<style scoped>
.mission-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  font-family: Inter, -apple-system, sans-serif;
}

.mission-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  border-color: #d1d5db;
}

.mission-card--completed {
  opacity: 0.7;
}

.mission-card--skipped {
  opacity: 0.5;
}

/* Override inner TaskCardRenderer border to avoid double border */
.mission-card :deep(.task-card-renderer) {
  border: none;
  border-radius: 0;
  padding-bottom: 0;
}

.mission-card :deep(.task-card-renderer__actions) {
  border-top: none;
  padding-bottom: 0;
}

/* Why section */
.mission-card__why {
  margin-bottom: 12px;
}

.mission-card__why-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.mission-card__why-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.mission-card__why-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.mission-card__why-arrow--open {
  transform: rotate(180deg);
}

.mission-card__why-text {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
  line-height: 1.5;
}

/* Impact */
.mission-card__impact {
  margin-bottom: 12px;
}

.mission-card__impact-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 6px;
}

.mission-card__impact-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mission-card__impact-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  font-size: 13px;
}

.mission-card__impact-dimension {
  color: #374151;
}

.mission-card__impact-gain {
  font-weight: 700;
  color: #16a34a;
}

/* Meta */
.mission-card__meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mission-card__time {
  font-size: 13px;
  color: #6b7280;
}

.mission-card__difficulty {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.mission-card__difficulty--easy {
  background: #f0fdf4;
  color: #16a34a;
}

.mission-card__difficulty--medium {
  background: #fffbeb;
  color: #d97706;
}

.mission-card__difficulty--hard {
  background: #fef2f2;
  color: #dc2626;
}

/* Custom actions */
.mission-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f3f4f6;
}

.mission-card__execute-btn {
  padding: 10px 16px;
  background: #f0fdf4;
  color: #059669;
  border: 1px solid #86efac;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.mission-card__execute-btn:hover {
  background: #dcfce7;
  border-color: #22c55e;
  transform: translateY(-1px);
}

.mission-card__execute-btn--executing {
  background: #dbeafe;
  color: #2563eb;
  border-color: #93c5fd;
  cursor: wait;
}

.mission-card__execute-btn--done {
  background: #d1fae5;
  color: #059669;
  border-color: #6ee7b7;
  cursor: default;
}

.mission-card__execute-btn--error {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
}

.mission-card__execute-btn:disabled {
  opacity: 0.8;
  transform: none;
}

.mission-card__skip-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.mission-card__explain-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.mission-card__explain-btn:hover {
  background: #fef3c7;
  border-color: #f59e0b;
}

.mission-card__skip-btn:hover {
  background: #e5e7eb;
}
</style>
