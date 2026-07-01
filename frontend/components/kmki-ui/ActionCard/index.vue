<!--
  ActionCard.vue — 展示单个 Action Plan 的卡片

  P0-T007 — Action Plan Engine

  Features:
    - 显示标题、描述、priority、estimatedImpact
    - 集成 StepList（可勾选步骤）
    - Done / Skip / Later 操作按钮
    - 支持 v-model:status 双向绑定
    - 支持 v-model:checkedSteps 双向绑定
-->
<template>
  <div class="kmki-action-card" :class="[`kmki-action-card--${status}`, cardPriorityClass]">
    <!-- Header -->
    <div class="kmki-action-card__header">
      <div class="kmki-action-card__title-row">
        <h4 class="kmki-action-card__title">{{ actionPlan.title }}</h4>
        <StatusChip :status="status" />
      </div>
      <p class="kmki-action-card__desc">{{ actionPlan.description }}</p>

      <!-- Meta Bar -->
      <div class="kmki-action-card__meta">
        <span class="kmki-action-card__priority" :class="priorityClass">
          {{ priorityLabel }}
        </span>
        <ImpactBadge :value="actionPlan.estimatedImpact" />
        <EffortBadge :effort="actionPlan.estimatedEffort" />
        <span class="kmki-action-card__time">⏱️ {{ actionPlan.estimatedTime }}</span>
      </div>
    </div>

    <!-- Steps -->
    <div class="kmki-action-card__steps">
      <p class="kmki-action-card__steps-title">推荐步骤：</p>
      <StepList
        :steps="stepItems"
        :checked-steps="checkedSteps"
        @update:checked-steps="onStepsChange"
        @update:all-checked="onAllChecked"
      />
    </div>

    <!-- Actions -->
    <div class="kmki-action-card__actions">
      <button
        class="kmki-action-card__btn kmki-action-card__btn--done"
        :disabled="status === 'completed'"
        @click="setStatus('completed')"
      >
        ✅ Done
      </button>
      <button
        class="kmki-action-card__btn kmki-action-card__btn--skip"
        :disabled="status === 'skipped'"
        @click="setStatus('skipped')"
      >
        ⏭️ Skip
      </button>
      <button
        class="kmki-action-card__btn kmki-action-card__btn--later"
        :disabled="status === 'later'"
        @click="setStatus('later')"
      >
        📅 Later
      </button>
      <button
        v-if="status !== 'pending'"
        class="kmki-action-card__btn kmki-action-card__btn--reset"
        @click="setStatus('pending')"
      >
        ↩️ 重置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusChip from '../StatusChip/index.vue'
import ImpactBadge from '../ImpactBadge/index.vue'
import EffortBadge from '../EffortBadge/index.vue'
import StepList from '../StepList/index.vue'
import type { StepListItem } from '../StepList/index.vue'

export interface ActionPlanCardData {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact: number
  estimatedEffort: 'easy' | 'medium' | 'hard'
  estimatedTime: string
  steps: Array<{ id: string; title: string; description: string; order: number }>
  status: 'pending' | 'completed' | 'skipped' | 'later'
  tags: string[]
}

const props = defineProps<{
  actionPlan: ActionPlanCardData
  modelValue?: ActionPlanCardData['status']
  checkedSteps?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ActionPlanCardData['status']): void
  (e: 'update:checkedSteps', value: string[]): void
  (e: 'status-change', planId: string, newStatus: ActionPlanCardData['status']): void
}>()

const status = computed(() => props.modelValue ?? props.actionPlan.status)

const stepItems = computed<StepListItem[]>(() =>
  props.actionPlan.steps.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    order: s.order,
  }))
)

const priorityLabel = computed(() => {
  const map: Record<string, string> = { high: '🔴 High Priority', medium: '🟡 Medium Priority', low: '⚪ Low Priority' }
  return map[props.actionPlan.priority] ?? props.actionPlan.priority
})

const priorityClass = computed(() => `kmki-action-card__priority--${props.actionPlan.priority}`)
const cardPriorityClass = computed(() => `kmki-action-card--p-${props.actionPlan.priority}`)

function setStatus(newStatus: ActionPlanCardData['status']) {
  emit('update:modelValue', newStatus)
  emit('status-change', props.actionPlan.id, newStatus)
}

function onStepsChange(value: string[]) {
  emit('update:checkedSteps', value)
}

function onAllChecked(allChecked: boolean) {
  // Optionally auto-complete when all steps checked
}
</script>

<style scoped>
.kmki-action-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.kmki-action-card:hover {
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.kmki-action-card--p-high {
  border-left: 3px solid #ef4444;
}

.kmki-action-card--p-medium {
  border-left: 3px solid #f59e0b;
}

.kmki-action-card--p-low {
  border-left: 3px solid #d1d5db;
}

.kmki-action-card--completed {
  opacity: 0.75;
}

.kmki-action-card__header {
  margin-bottom: 12px;
}

.kmki-action-card__title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.kmki-action-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.kmki-action-card__desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
}

.kmki-action-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.kmki-action-card__priority {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.kmki-action-card__priority--high {
  background: #fef2f2;
  color: #991b1b;
}

.kmki-action-card__priority--medium {
  background: #fffbeb;
  color: #92400e;
}

.kmki-action-card__priority--low {
  background: #f9fafb;
  color: #6b7280;
}

.kmki-action-card__time {
  font-size: 11px;
  color: #9ca3af;
}

/* Steps */
.kmki-action-card__steps {
  margin-bottom: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.kmki-action-card__steps-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Actions */
.kmki-action-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.kmki-action-card__btn {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  background: #fff;
  color: #374151;
}

.kmki-action-card__btn:hover:not(:disabled) {
  border-color: #d1d5db;
  background: #f9fafb;
}

.kmki-action-card__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kmki-action-card__btn--done:hover:not(:disabled) {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}

.kmki-action-card__btn--skip:hover:not(:disabled) {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.kmki-action-card__btn--later:hover:not(:disabled) {
  background: #e0f2fe;
  color: #075985;
  border-color: #bae6fd;
}

.kmki-action-card__btn--reset {
  color: #6b7280;
  font-size: 11px;
}
</style>
