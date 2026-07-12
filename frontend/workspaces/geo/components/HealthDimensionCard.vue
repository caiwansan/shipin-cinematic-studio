<!-- @deprecated 未被任何页面引用，保留仅作参考 -->
<template>
  <div class="health-dimension-card">
    <div class="health-dimension-card__header">
      <div class="health-dimension-card__title-row">
        <span class="health-dimension-card__icon">{{ icon }}</span>
        <div>
          <h3 class="health-dimension-card__title">{{ title }}</h3>
          <p class="health-dimension-card__description">{{ description }}</p>
        </div>
      </div>
      <div class="health-dimension-card__score">
        <div class="relative w-14 h-14">
          <svg class="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="4.5" />
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              :stroke="scoreColor"
              stroke-width="4.5"
              stroke-linecap="round"
              :stroke-dasharray="`${(score / maxScore) * 138} 138`"
              class="transition-all duration-700"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span v-if="score > 0" class="text-sm font-bold" :class="scoreTextColor">{{ score }}</span>
            <span v-else class="text-xs text-gray-400">—</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="score > 0" class="health-dimension-card__bar">
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-700"
          :style="{ width: (score / maxScore * 100) + '%', backgroundColor: scoreColor }"
        />
      </div>
    </div>
    <div v-if="details.length > 0" class="health-dimension-card__details">
      <div
        v-for="(item, idx) in details"
        :key="idx"
        class="health-dimension-card__detail-item"
      >
        <span class="health-dimension-card__detail-label">{{ item.label }}</span>
        <span class="health-dimension-card__detail-score" :class="detailScoreColor(item.score)">
          {{ item.score }}/100
        </span>
      </div>
    </div>
    <div v-if="score === 0 && !showEmpty" class="health-dimension-card__unavailable">
      <span class="text-xs text-gray-400">不可用</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface DetailItem {
  label: string
  score: number
}

interface HealthDimensionCardProps {
  title: string
  score: number
  maxScore?: number
  details?: DetailItem[]
  description?: string
  icon?: string
  showEmpty?: boolean
}

const props = withDefaults(defineProps<HealthDimensionCardProps>(), {
  maxScore: 100,
  details: () => [],
  description: '',
  icon: '📊',
  showEmpty: false,
})

const scoreColor = computed(() => {
  const s = props.score
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#eab308'
  if (s >= 40) return '#f97316'
  return '#ef4444'
})

const scoreTextColor = computed(() => {
  const s = props.score
  if (s >= 80) return 'text-green-600'
  if (s >= 60) return 'text-yellow-600'
  if (s >= 40) return 'text-orange-600'
  return 'text-red-600'
})

function detailScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}
</script>

<style scoped>
.health-dimension-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
}

.health-dimension-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.health-dimension-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.health-dimension-card__icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.health-dimension-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.health-dimension-card__description {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 2px 0 0;
}

.health-dimension-card__score {
  flex-shrink: 0;
}

.health-dimension-card__bar {
  margin-top: 12px;
}

.health-dimension-card__details {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-dimension-card__detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.health-dimension-card__detail-label {
  color: #6b7280;
}

.health-dimension-card__detail-score {
  font-weight: 500;
}

.health-dimension-card__unavailable {
  margin-top: 8px;
  padding: 6px 0;
  text-align: center;
}
</style>
