<template>
  <div class="health-card" data-testid="health-card">
    <!-- 状态：loading -->
    <LoadingState v-if="model.loading" data-testid="health-card-loading" text="正在加载品牌健康数据..." />

    <!-- 状态：error -->
    <ErrorState
      v-else-if="model.error"
      data-testid="health-card-error"
      :title="model.error"
      suggestion="请稍后重试"
    />

    <!-- 状态：default -->
    <template v-else>
      <ScoreCard :data="model.score" :label="label || '品牌健康'" />
      <div class="health-card__actions">
        <button
          v-if="model.actionLabel"
          class="health-card__btn"
          data-testid="health-card-action"
          @click="model.onAction"
        >
          {{ model.actionLabel }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { HealthCardModel } from '~/workspaces/geo/types/business'
import ScoreCard from './ScoreCard.vue'
import LoadingState from '~/workspaces/geo/components/foundation/LoadingState.vue'
import ErrorState from '~/workspaces/geo/components/foundation/ErrorState.vue'

interface HealthCardProps {
  model: HealthCardModel
  /** ScoreCard 标签，默认 "品牌健康" */
  label?: string
}

defineProps<HealthCardProps>()
</script>

<style scoped>
.health-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background-color: #ffffff;
  overflow: hidden;
}

.health-card__actions {
  padding: 12px 16px;
  border-top: 1px solid #f3f4f6;
}

.health-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  background-color: #3b82f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.health-card__btn:hover {
  background-color: #2563eb;
}

.health-card__btn:active {
  background-color: #1d4ed8;
}
</style>
