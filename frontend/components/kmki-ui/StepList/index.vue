<!--
  StepList.vue — 可勾选的步骤列表

  P0-T007 — Action Plan Engine

  Features:
    - 每个步骤可勾选
    - 支持 v-model:checkedSteps 双向绑定
    - 支持 v-model:allChecked 全选状态
-->
<template>
  <div class="kmki-step-list">
    <div
      v-for="step in steps"
      :key="step.id"
      class="kmki-step-list__item"
      :class="{ 'kmki-step-list__item--done': checkedIds.has(step.id) }"
      @click="toggleStep(step.id)"
    >
      <span class="kmki-step-list__checkbox" :class="{ 'kmki-step-list__checkbox--checked': checkedIds.has(step.id) }">
        <span v-if="checkedIds.has(step.id)" class="kmki-step-list__checkmark">✓</span>
      </span>
      <div class="kmki-step-list__content">
        <span class="kmki-step-list__title">
          <span class="kmki-step-list__order">{{ step.order }}.</span> {{ step.title }}
        </span>
        <p v-if="step.description" class="kmki-step-list__desc">{{ step.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface StepListItem {
  id: string
  title: string
  description: string
  order: number
}

const props = defineProps<{
  steps: StepListItem[]
  checkedSteps?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:checkedSteps', value: string[]): void
  (e: 'update:allChecked', value: boolean): void
}>()

const checkedIds = computed(() => new Set(props.checkedSteps ?? []))

function toggleStep(id: string) {
  const current = new Set(checkedIds.value)
  if (current.has(id)) {
    current.delete(id)
  } else {
    current.add(id)
  }
  const newValue = Array.from(current)
  emit('update:checkedSteps', newValue)
  emit('update:allChecked', newValue.length === props.steps.length)
}
</script>

<style scoped>
.kmki-step-list__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.kmki-step-list__item:hover {
  background: #f9fafb;
}

.kmki-step-list__item--done {
  opacity: 0.7;
}

.kmki-step-list__item--done .kmki-step-list__title {
  text-decoration: line-through;
  color: #9ca3af;
}

.kmki-step-list__checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
  border-radius: 3px;
  border: 2px solid #d1d5db;
  background: #fff;
  transition: all 0.12s;
}

.kmki-step-list__checkbox--checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.kmki-step-list__checkmark {
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.kmki-step-list__content {
  flex: 1;
  min-width: 0;
}

.kmki-step-list__title {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  line-height: 1.4;
}

.kmki-step-list__order {
  color: #9ca3af;
  font-weight: 400;
}

.kmki-step-list__desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}
</style>
