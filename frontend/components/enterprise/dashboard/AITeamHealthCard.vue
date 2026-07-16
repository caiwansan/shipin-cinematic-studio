<template>
  <div class="ai-team-health-card">
    <div class="health-header">
      <h4 class="health-title">AI 部门健康度</h4>
      <span class="health-status-badge" :class="statusClass">{{ data.status }}</span>
    </div>

    <!-- Big Score -->
    <div class="health-score-section">
      <div class="score-ring">
        <svg viewBox="0 0 80 80" class="ring-svg">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#1A2240" stroke-width="5" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            :stroke="ringColor"
            stroke-width="5"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="circumference * (1 - data.score / 100)"
            class="ring-progress"
            transform="rotate(-90 40 40)"
          />
        </svg>
        <span class="score-text" :class="scoreTextClass">{{ data.score }}</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="health-stats">
      <div class="health-stat">
        <span class="hs-label">任务成功率</span>
        <span class="hs-value text-green">{{ data.taskSuccessRate }}%</span>
      </div>
      <div class="health-stat">
        <span class="hs-label">异常次数</span>
        <span class="hs-value" :class="data.errorCount > 0 ? 'text-red' : 'text-green'">
          {{ data.errorCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({ score: 100, status: '良好', taskSuccessRate: 100, errorCount: 0 })
  }
})

const circumference = 2 * Math.PI * 34

const ringColor = computed(() => {
  const s = props.data.score
  if (s >= 90) return '#22c55e'
  if (s >= 70) return '#eab308'
  return '#ef4444'
})

const scoreTextClass = computed(() => {
  const s = props.data.score
  if (s >= 90) return 'text-green'
  if (s >= 70) return 'text-yellow'
  return 'text-red'
})

const statusClass = computed(() => {
  const s = props.data.score
  if (s >= 90) return 'badge-green'
  if (s >= 70) return 'badge-yellow'
  return 'badge-red'
})
</script>

<style scoped>
.ai-team-health-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}
.health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.health-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
}
.health-status-badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.badge-green { background: #22c55e1a; color: #22c55e; }
.badge-yellow { background: #eab3081a; color: #eab308; }
.badge-red { background: #ef44441a; color: #ef4444; }

.health-score-section {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.score-ring {
  position: relative;
  width: 80px;
  height: 80px;
}
.ring-svg {
  width: 100%;
  height: 100%;
}
.ring-progress {
  transition: stroke-dashoffset 0.6s ease;
}
.score-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
}
.score-text.text-green { color: #22c55e; }
.score-text.text-yellow { color: #eab308; }
.score-text.text-red { color: #ef4444; }

.health-stats {
  display: flex;
  gap: 12px;
}
.health-stat {
  flex: 1;
  background: #0A0F1E;
  border-radius: 10px;
  padding: 10px;
  text-align: center;
}
.hs-label {
  display: block;
  font-size: 10px;
  color: #5A6A8A;
  margin-bottom: 4px;
}
.hs-value {
  font-size: 15px;
  font-weight: 700;
}
.hs-value.text-green { color: #22c55e; }
.hs-value.text-yellow { color: #eab308; }
.hs-value.text-red { color: #ef4444; }
</style>
