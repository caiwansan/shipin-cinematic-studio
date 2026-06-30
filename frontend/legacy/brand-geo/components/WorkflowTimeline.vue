<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="workflow-timeline">
    <div class="workflow-timeline__steps">
      <div
        v-for="(step, idx) in steps"
        :key="step.id"
        class="workflow-timeline__step"
        :class="[
          `workflow-timeline__step--${step.state}`,
          { 'workflow-timeline__step--active': step.state === 'EXECUTING' || step.state === 'WATCHING' },
          { 'workflow-timeline__step--locked': step.locked },
        ]"
      >
        <!-- 连接线 -->
        <div v-if="idx > 0" class="workflow-timeline__connector">
          <div class="workflow-timeline__connector-line"
            :class="{ 'workflow-timeline__connector-line--done': isConnectorDone(idx) }">
          </div>
        </div>

        <div class="workflow-timeline__step-card" @click="handleStepClick(step)">
          <!-- Step icon + name -->
          <div class="workflow-timeline__step-header">
            <span class="workflow-timeline__step-icon">{{ step.icon }}</span>
            <span class="workflow-timeline__step-name">{{ step.label }}</span>
            <span v-if="step.locked" class="workflow-timeline__step-lock">🔒</span>
          </div>

          <!-- State banner -->
          <div class="workflow-timeline__state-row">
            <span class="workflow-timeline__state-badge"
              :style="stateBadgeStyle(step.state)">
              {{ stateIcon(step.state) }} {{ stateLabel(step.state) }}
            </span>
            <span v-if="step.duration" class="workflow-timeline__duration">
              {{ fmtDuration(step.duration) }}
            </span>
          </div>

          <!-- 执行按钮 (只在 IDLE / FAILED / DRIFTED 显示) -->
          <button
            v-if="isClickable(step.state)"
            class="workflow-timeline__execute-btn"
            :disabled="step.locked"
            @click.stop="emitExecute(step)"
          >
            {{ step.state === 'IDLE' ? '开始' : step.state === 'FAILED' ? '重试' : '重新执行' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Pipeline flow arrow (visual hint) -->
    <div class="workflow-timeline__flow-hint">
      <span v-for="(step, idx) in steps" :key="'arrow-' + step.id">
        <span :class="flowHintClass(idx)">{{ step.shortLabel }}</span>
        <span v-if="idx < steps.length - 1" class="workflow-timeline__flow-arrow">→</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import type { ExecutionState, CapabilityId } from '~/utils/executionStateManager'
import { PermissionService, getCurrentUserTier } from '~/utils/geoCapability'
import type { SubscriberTier } from '~/utils/geoCapability'

interface TimelineStep {
  id: CapabilityId
  label: string
  shortLabel: string
  icon: string
  state: ExecutionState
  duration?: number
  locked: boolean       // 前置步骤未完成 → locked
  tierRequired: string
}

const props = defineProps<{ projectId: string | null }>()

const emit = defineEmits<{
  execute: [capabilityId: CapabilityId]
}>()

const stateMgr = ExecutionStateManager.getInstance()
const userTier = computed<SubscriberTier>(() => getCurrentUserTier())
const steps = ref<TimelineStep[]>([])
let unsub: (() => void) | null = null

// 构建步骤列表
function buildSteps(): TimelineStep[] {
  if (!props.projectId) return []

  const discoverCtx = stateMgr.getState(props.projectId, 'geo.execution.discover')
  const graphCtx = stateMgr.getState(props.projectId, 'geo.execution.graph.build')
  const kqCtx = stateMgr.getState(props.projectId, 'geo.execution.kq')

  const discoverLocked = !PermissionService.hasCapability(userTier.value, 'geo.execution.discover')
  const graphLocked = !PermissionService.hasCapability(userTier.value, 'geo.execution.graph.build')
  const kqLocked = !PermissionService.hasCapability(userTier.value, 'geo.execution.kq')

  // Graph 依赖 discover 的 STABLE 状态
  const graphDependencyLocked = graphLocked || (
    discoverCtx.state !== 'STABLE' &&
    discoverCtx.state !== 'WATCHING' &&
    discoverCtx.state !== 'EXECUTING'
  )

  // KQ 依赖 graph 的 STABLE 状态
  const kqDependencyLocked = kqLocked || (
    graphCtx.state !== 'STABLE' &&
    graphCtx.state !== 'WATCHING' &&
    graphCtx.state !== 'EXECUTING'
  )

  return [
    {
      id: 'geo.execution.discover',
      label: '实体发现',
      shortLabel: 'Discover',
      icon: '🔍',
      state: discoverCtx.state,
      duration: discoverCtx.duration,
      locked: discoverLocked,
      tierRequired: 'FREE',
    },
    {
      id: 'geo.execution.graph.build',
      label: '知识图谱',
      shortLabel: 'Graph',
      icon: '🔗',
      state: graphCtx.state,
      duration: graphCtx.duration,
      locked: graphDependencyLocked,
      tierRequired: 'VIP_1',
    },
    {
      id: 'geo.execution.kq',
      label: '质量评估',
      shortLabel: 'KQ',
      icon: '✅',
      state: kqCtx.state,
      duration: kqCtx.duration,
      locked: kqDependencyLocked,
      tierRequired: 'VIP_2',
    },
  ]
}

function updateSteps(): void {
  steps.value = buildSteps()
}

// 状态订阅
onMounted(() => {
  updateSteps()
  unsub = stateMgr.onStateChange((ctx) => {
    if (ctx.projectId === props.projectId) {
      updateSteps()
    }
  })
})

onBeforeUnmount(() => {
  if (unsub) unsub()
})

// 连接线状态
function isConnectorDone(idx: number): boolean {
  if (idx <= 0 || idx > steps.value.length) return false
  const prevStep = steps.value[idx - 1]
  return prevStep.state === 'STABLE' || prevStep.state === 'DRIFTED'
}

// 步骤点击 — 只允许点击已完成的步骤跳到对应状态
function handleStepClick(step: TimelineStep): void {
  const clickable = ['STABLE', 'DRIFTED', 'FAILED'].includes(step.state)
  if (clickable && !step.locked) {
    emitExecute(step)
  }
}

// 是否可点击执行
function isClickable(state: ExecutionState): boolean {
  return ['IDLE', 'FAILED', 'DRIFTED'].includes(state)
}

// 触发执行
function emitExecute(step: TimelineStep): void {
  if (step.locked) return
  emit('execute', step.id)
}

// 状态标签映射
function stateIcon(state: ExecutionState): string {
  return ExecutionStateDisplay[state]?.icon || '⏸️'
}

function stateLabel(state: ExecutionState): string {
  return ExecutionStateDisplay[state]?.label || '未知'
}

function stateBadgeStyle(state: ExecutionState): Record<string, string> {
  const c = ExecutionStateDisplay[state]?.color || '#6b7280'
  return {
    background: c + '22',
    color: c,
    borderColor: c + '44',
  }
}

// 流程箭头颜色
function flowHintClass(idx: number): string {
  if (idx < 0 || idx >= steps.value.length) return ''
  const s = steps.value[idx].state
  if (s === 'STABLE' || s === 'DRIFTED') return 'workflow-timeline__flow-item--done'
  return ''
}

// 格式化时长
function fmtDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
</script>

<style scoped>
.workflow-timeline { padding: 0; }
.workflow-timeline__steps { display: flex; flex-direction: column; gap: 0; }

.workflow-timeline__step { display: flex; flex-direction: column; }
.workflow-timeline__step-card {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 20px;
  background: #1e1e2e; border: 1px solid #333; border-radius: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: default;
}
.workflow-timeline__step-card:hover { border-color: #555; }

/* Active state highlight */
.workflow-timeline__step--active .workflow-timeline__step-card {
  border-color: #4ecca3; box-shadow: 0 0 12px rgba(78, 204, 163, 0.08);
}
.workflow-timeline__step--EXECUTING .workflow-timeline__step-card {
  border-color: #f59e0b; box-shadow: 0 0 12px rgba(245, 158, 11, 0.1);
}
.workflow-timeline__step--FAILED .workflow-timeline__step-card {
  border-color: #ef4444; box-shadow: 0 0 12px rgba(239, 68, 68, 0.08);
}
.workflow-timeline__step--DRIFTED .workflow-timeline__step-card {
  border-color: #f97316; box-shadow: 0 0 12px rgba(249, 115, 22, 0.08);
}

.workflow-timeline__step--locked .workflow-timeline__step-card { opacity: 0.6; }

/* Connector line */
.workflow-timeline__connector { display: flex; justify-content: center; padding: 4px 0; }
.workflow-timeline__connector-line {
  width: 2px; height: 24px; background: #333; transition: background 0.3s;
}
.workflow-timeline__connector-line--done { background: #22c55e; }

/* Step header */
.workflow-timeline__step-header { display: flex; align-items: center; gap: 8px; min-width: 140px; }
.workflow-timeline__step-icon { font-size: 18px; }
.workflow-timeline__step-name { font-size: 14px; font-weight: 600; color: #e0e0e0; }
.workflow-timeline__step-lock { font-size: 12px; }

/* State badge */
.workflow-timeline__state-row { display: flex; align-items: center; gap: 8px; flex: 1; }
.workflow-timeline__state-badge {
  padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid;
}
.workflow-timeline__duration { font-size: 11px; color: #6b7280; font-family: monospace; }

/* Execute button */
.workflow-timeline__execute-btn {
  padding: 6px 16px; border: 1px solid #4ecca3; border-radius: 6px;
  background: linear-gradient(180deg, #1a3a2e 0%, #0e2a1e 100%);
  color: #4ecca3; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: background 0.2s;
}
.workflow-timeline__execute-btn:hover { background: linear-gradient(180deg, #2a4a3e 0%, #1a3a2e 100%); }
.workflow-timeline__execute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Flow hint */
.workflow-timeline__flow-hint {
  margin-top: 20px; padding: 12px 16px; background: #1a1a2a; border-radius: 6px;
  display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280;
  font-family: monospace; justify-content: center;
}
.workflow-timeline__flow-arrow { color: #444; margin: 0 2px; }
.workflow-timeline__flow-item--done { color: #22c55e; font-weight: 600; }
</style>
