<template>
  <div class="task-card-renderer" data-testid="task-card-renderer">
    <!-- Loading 骨架 -->
    <div v-if="loading" class="task-card-renderer__loading" data-testid="task-card-loading">
      <div class="task-card-renderer__skeleton task-card-renderer__skeleton--title" />
      <div class="task-card-renderer__skeleton task-card-renderer__skeleton--body" />
      <div class="task-card-renderer__skeleton task-card-renderer__skeleton--actions" />
    </div>

    <!-- Error 状态 -->
    <div v-else-if="error" class="task-card-renderer__error" data-testid="task-card-error">
      <p class="task-card-renderer__error-title">{{ errorTitle || '加载失败' }}</p>
      <p v-if="errorMessage" class="task-card-renderer__error-message">{{ errorMessage }}</p>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <!-- Header -->
      <div v-if="card" class="task-card-renderer__header" data-testid="task-card-header">
        <h3 class="task-card-renderer__title">{{ card.title }}</h3>
        <div class="task-card-renderer__badges">
          <PriorityBadge :priority="card.priority" />
          <StatusBadge :status="card.status" />
        </div>
        <p v-if="card.summary" class="task-card-renderer__summary">{{ card.summary }}</p>
      </div>

      <!-- Body Slot -->
      <div v-if="$slots.body" class="task-card-renderer__body" data-testid="task-card-body">
        <slot name="body" />
      </div>

      <!-- Explain Slot -->
      <div
        v-if="hasExplain"
        class="task-card-renderer__explain"
        data-testid="task-card-explain"
      >
        <slot name="explain">
          <!-- 默认 Explain 渲染 -->
          <div class="task-card-renderer__explain-default">
            <div class="task-card-renderer__explain-row">
              <span class="task-card-renderer__explain-label">影响</span>
              <span>{{ card?.explain?.impact }}</span>
            </div>
            <div class="task-card-renderer__explain-row">
              <span class="task-card-renderer__explain-label">建议</span>
              <span>{{ card?.explain?.recommendation }}</span>
            </div>
          </div>
        </slot>
      </div>

      <!-- Actions -->
      <div v-if="hasActions" class="task-card-renderer__actions" data-testid="task-card-actions">
        <TaskActionBar
          :actions="card!.actions"
          @action="(id) => $emit('action', id)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskCardModel } from '~/workspaces/geo/types/business'
import PriorityBadge from '../badges/PriorityBadge.vue'
import StatusBadge from '../badges/StatusBadge.vue'
import TaskActionBar from '../actions/TaskActionBar.vue'

const props = defineProps<{
  card?: TaskCardModel | null
  loading?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
}>()

defineEmits<{
  action: [actionId: string]
}>()

const hasExplain = computed(() => {
  return props.card?.explain != null && (
    !!props.card.explain.impact ||
    !!props.card.explain.recommendation
  )
})

const hasActions = computed(() => {
  return props.card?.actions != null && props.card.actions.length > 0
})
</script>

<style scoped>
.task-card-renderer {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.task-card-renderer__header {
  margin-bottom: 12px;
}

.task-card-renderer__title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.task-card-renderer__badges {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.task-card-renderer__summary {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 0;
}

.task-card-renderer__body {
  margin-bottom: 12px;
}

.task-card-renderer__explain {
  margin-bottom: 12px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 6px;
}

.task-card-renderer__explain-default {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card-renderer__explain-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.task-card-renderer__explain-label {
  font-weight: 500;
  color: #374151;
  min-width: 40px;
}

.task-card-renderer__actions {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

/* Loading */
.task-card-renderer__loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card-renderer__skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.task-card-renderer__skeleton--title {
  width: 60%;
  height: 20px;
}

.task-card-renderer__skeleton--body {
  width: 100%;
  height: 60px;
}

.task-card-renderer__skeleton--actions {
  width: 40%;
  height: 32px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error */
.task-card-renderer__error {
  padding: 20px;
  text-align: center;
  color: #ef4444;
}

.task-card-renderer__error-title {
  font-weight: 600;
  margin: 0 0 4px;
}

.task-card-renderer__error-message {
  font-size: 13px;
  margin: 0;
}
</style>
