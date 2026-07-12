<template>
  <div class="geo-action-completion">
    <div class="geo-action-completion__progress">
      <div class="geo-action-completion__progress-bar">
        <div
          class="geo-action-completion__progress-fill"
          :style="{ width: completionRate + '%' }"
          :class="completionColorClass"
        />
      </div>
      <span class="geo-action-completion__rate">{{ completionRate.toFixed(1) }}%</span>
    </div>
    <div class="geo-action-completion__stats">
      <div class="geo-action-completion__stat">
        <span class="geo-action-completion__stat-value geo-action-completion__stat-value--completed">{{ completedActions }}</span>
        <span class="geo-action-completion__stat-label">已完成</span>
      </div>
      <div class="geo-action-completion__stat">
        <span class="geo-action-completion__stat-value">{{ pendingActions }}</span>
        <span class="geo-action-completion__stat-label">待完成</span>
      </div>
      <div class="geo-action-completion__stat">
        <span class="geo-action-completion__stat-value geo-action-completion__stat-value--skipped">{{ skippedActions }}</span>
        <span class="geo-action-completion__stat-label">已忽略</span>
      </div>
      <div class="geo-action-completion__stat">
        <span class="geo-action-completion__stat-value">{{ totalActions }}</span>
        <span class="geo-action-completion__stat-label">总计</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completionRate: number
  totalActions: number
  completedActions: number
  pendingActions: number
  skippedActions: number
}>()

const completionColorClass = computed(() => {
  const rate = props.completionRate
  if (rate > 80) return 'geo-action-completion__progress-fill--high'
  if (rate > 60) return 'geo-action-completion__progress-fill--medium'
  if (rate > 40) return 'geo-action-completion__progress-fill--fair'
  return 'geo-action-completion__progress-fill--low'
})
</script>

<style scoped>
.geo-action-completion {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
}

.geo-action-completion__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.geo-action-completion__progress-bar {
  flex: 1;
  height: 12px;
  background-color: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.geo-action-completion__progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease-out;
}

.geo-action-completion__progress-fill--high {
  background-color: #059669;
}

.geo-action-completion__progress-fill--medium {
  background-color: #d97706;
}

.geo-action-completion__progress-fill--fair {
  background-color: #f59e0b;
}

.geo-action-completion__progress-fill--low {
  background-color: #ef4444;
}

.geo-action-completion__rate {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.geo-action-completion__stats {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.geo-action-completion__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.geo-action-completion__stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.geo-action-completion__stat-value--completed {
  color: #059669;
}

.geo-action-completion__stat-value--skipped {
  color: #9ca3af;
}

.geo-action-completion__stat-label {
  font-size: 12px;
  color: #6b7280;
}
</style>
