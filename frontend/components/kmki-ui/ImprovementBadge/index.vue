<template>
  <span :class="['improvement-badge', `improvement-badge--${variant}`]">
    <span class="improvement-badge__sign">{{ contribution >= 0 ? '+' : '' }}</span>
    {{ contribution }}
    <span class="improvement-badge__unit">ADI</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  contribution: number
}>()

const variant = computed(() => {
  if (props.contribution >= 8) return 'high'
  if (props.contribution >= 4) return 'medium'
  return 'low'
})
</script>

<style scoped>
.improvement-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.improvement-badge--high {
  background-color: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.improvement-badge--medium {
  background-color: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.improvement-badge--low {
  background-color: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.improvement-badge__sign {
  font-weight: 700;
}

.improvement-badge__unit {
  font-weight: 400;
  opacity: 0.7;
}
</style>
