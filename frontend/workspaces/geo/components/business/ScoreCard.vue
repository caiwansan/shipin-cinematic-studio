<template>
  <div class="score-card" data-testid="score-card">
    <!-- 左侧：分数环/数字 -->
    <div class="score-card__score">
      <template v-if="loading">
        <div class="score-card__skeleton" data-testid="score-card-loading">—</div>
      </template>
      <template v-else>
        <div
          class="score-card__value"
          :style="{ color: GRADE_COLORS[data.grade] }"
          data-testid="score-card-value"
        >
          {{ data.score }}
        </div>
        <div
          class="score-card__grade"
          :style="{ color: GRADE_COLORS[data.grade] }"
          data-testid="score-card-grade"
        >
          {{ data.gradeLabel }}
        </div>
      </template>
    </div>

    <!-- 右侧：趋势 + 摘要 -->
    <div class="score-card__info">
      <div v-if="label" class="score-card__label" data-testid="score-card-label">{{ label }}</div>
      <div v-if="data.trend" class="score-card__trend" data-testid="score-card-trend">
        <span
          class="score-card__trend-arrow"
          :class="`score-card__trend--${data.trend.direction}`"
          data-testid="score-card-trend-arrow"
        >
          {{ trendArrow(data.trend.direction) }}
        </span>
        <span
          class="score-card__trend-delta"
          :class="`score-card__trend--${data.trend.direction}`"
          data-testid="score-card-trend-delta"
        >
          {{ data.trend.direction === 'up' ? '+' : '' }}{{ data.trend.delta }}
        </span>
        <span v-if="data.trend.label" class="score-card__trend-label" data-testid="score-card-trend-label">
          {{ data.trend.label }}
        </span>
      </div>
      <p v-if="data.summary" class="score-card__summary" data-testid="score-card-summary">{{ data.summary }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ScoreCardModel } from '~/workspaces/geo/types/business'
import { GRADE_COLORS } from '~/workspaces/geo/types/business'

interface ScoreCardProps {
  data: ScoreCardModel
  /** 标签文字（如 "品牌健康"、"知识覆盖"），由父组件传入 */
  label?: string
  /** 是否正在加载 */
  loading?: boolean
}

defineProps<ScoreCardProps>()

function trendArrow(direction: string): string {
  return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
}
</script>

<style scoped>
.score-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #ffffff;
}

/* 左侧：分数区域 */
.score-card__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  min-width: 80px;
}

.score-card__skeleton {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: #f3f4f6;
  animation: pulse 1.5s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 24px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.score-card__value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.score-card__grade {
  font-size: 14px;
  font-weight: 500;
  margin-top: 4px;
}

/* 右侧：信息区域 */
.score-card__info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.score-card__label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.score-card__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.score-card__trend-arrow,
.score-card__trend-delta {
  font-weight: 600;
}

.score-card__trend--up {
  color: #22c55e;
}

.score-card__trend--down {
  color: #ef4444;
}

.score-card__trend--flat {
  color: #6b7280;
}

.score-card__trend-label {
  color: #9ca3af;
  margin-left: 2px;
}

.score-card__summary {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
