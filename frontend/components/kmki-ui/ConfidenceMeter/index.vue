<template>
  <div class="confidence-meter">
    <div class="confidence-meter__header">
      <span class="confidence-meter__label">验证置信度</span>
      <span class="confidence-meter__percentage">{{ percentage }}%</span>
    </div>
    <div class="confidence-meter__bar">
      <div
        class="confidence-meter__fill"
        :style="{ width: percentage + '%' }"
        :class="`confidence-meter__fill--${level}`"
      />
    </div>
    <div class="confidence-meter__label-text">{{ labelText }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  confidence: number  // 0-1
}>()

const percentage = computed(() => Math.round(props.confidence * 100))

const level = computed(() => {
  if (props.confidence >= 0.8) return 'high'
  if (props.confidence >= 0.6) return 'medium'
  if (props.confidence >= 0.4) return 'fair'
  return 'low'
})

const labelText = computed(() => {
  if (props.confidence >= 0.8) return '高度可信'
  if (props.confidence >= 0.6) return '基本可信'
  if (props.confidence >= 0.4) return '部分可信'
  return '可信度较低'
})
</script>

<style scoped>
.confidence-meter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.confidence-meter__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.confidence-meter__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.confidence-meter__percentage {
  font-size: 14px;
  font-weight: 600;
  color: #059669;
}

.confidence-meter__bar {
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.confidence-meter__fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease-out;
}

.confidence-meter__fill--high {
  background-color: #059669;
}

.confidence-meter__fill--medium {
  background-color: #d97706;
}

.confidence-meter__fill--fair {
  background-color: #f59e0b;
}

.confidence-meter__fill--low {
  background-color: #ef4444;
}

.confidence-meter__label-text {
  font-size: 12px;
  color: #6b7280;
}
</style>
