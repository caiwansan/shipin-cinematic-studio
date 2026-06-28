<template>
  <div class="flow-pipeline">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="flow-pipeline__step"
      :class="`flow-pipeline__step--${step.status}`"
    >
      <div class="flow-pipeline__connector" v-if="index > 0" />
      <div class="flow-pipeline__node">
        <span class="flow-pipeline__icon">{{ step.icon }}</span>
        <div class="flow-pipeline__label">{{ step.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineStep } from '../types/index'

defineProps<{
  steps: PipelineStep[]
}>()
</script>

<style scoped>
.flow-pipeline {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 0;
}

.flow-pipeline__step {
  display: flex;
  align-items: center;
  flex: 1;
}

.flow-pipeline__node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  transition: all 0.3s ease;
  flex: 1;
}

.flow-pipeline__icon {
  font-size: 24px;
  line-height: 1;
}

.flow-pipeline__label {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
  text-align: center;
}

.flow-pipeline__connector {
  width: 24px;
  height: 2px;
  background: #e5e7eb;
  flex-shrink: 0;
}

.flow-pipeline__step--pending .flow-pipeline__icon {
  opacity: 0.4;
}
.flow-pipeline__step--pending .flow-pipeline__label {
  color: #d1d5db;
}

.flow-pipeline__step--active .flow-pipeline__node {
  background: #eef2ff;
  border: 1px solid #6366f1;
}
.flow-pipeline__step--active .flow-pipeline__icon {
  animation: pulse 1.5s infinite;
}
.flow-pipeline__step--active .flow-pipeline__label {
  color: #4338ca;
  font-weight: 600;
}

.flow-pipeline__step--completed .flow-pipeline__node {
  background: #f0fdf4;
}
.flow-pipeline__step--completed .flow-pipeline__icon {
  opacity: 1;
}
.flow-pipeline__step--completed .flow-pipeline__label {
  color: #16a34a;
  font-weight: 500;
}
.flow-pipeline__step--completed + .flow-pipeline__step .flow-pipeline__connector {
  background: #16a34a;
}

.flow-pipeline__step--error .flow-pipeline__node {
  background: #fef2f2;
  border: 1px solid #ef4444;
}
.flow-pipeline__step--error .flow-pipeline__label {
  color: #dc2626;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
</style>
