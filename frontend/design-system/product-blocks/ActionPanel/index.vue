<template>
  <div :class="['action-panel', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="action-panel__title">{{ title }}</h3>
    <div class="action-panel__list">
      <div
        v-for="action in actions"
        :key="action.id"
        class="action-panel__card"
        :class="{ 'action-panel__card--running': action.status === 'running', 'action-panel__card--success': action.status === 'success', 'action-panel__card--error': action.status === 'error' }"
      >
        <div class="action-panel__card-header">
          <span class="action-panel__card-index">{{ getIndex(action.id) }}</span>
          <span class="action-panel__card-title">{{ action.title }}</span>
        </div>
        <div class="action-panel__card-details">
          <span class="action-panel__card-impact">+{{ action.expectedImpact }} Brand Health</span>
          <span class="action-panel__card-divider" />
          <span class="action-panel__card-effort" :class="`action-panel__card-effort--${action.effort}`">
            {{ effortLabel(action.effort) }}
          </span>
        </div>
        <p v-if="action.reason" class="action-panel__card-reason">{{ action.reason }}</p>
        <div class="action-panel__card-actions">
          <button
            v-if="action.status === 'error'"
            class="action-panel__btn action-panel__btn--secondary"
            @click="$emit('retry', action.id)"
          >
            Retry
          </button>
          <button
            v-else
            class="action-panel__btn action-panel__btn--primary"
            :disabled="action.status === 'running' || action.status === 'success'"
            @click="$emit('execute', action.id)"
          >
            <span v-if="action.status === 'running'" class="action-panel__spinner" />
            <span v-else-if="action.status === 'success'">✓ Done</span>
            <span v-else>{{ actionLabel(action.effort) }}</span>
          </button>
        </div>
      </div>
    </div>
    <div v-if="showViewAll" class="action-panel__footer">
      <a class="action-panel__view-all" @click="$emit('viewAll')">
        View all {{ totalCount }} recommendations →
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ActionItem {
  id: string
  title: string
  expectedImpact: number
  effort: 'low' | 'medium' | 'high'
  reason?: string
  status?: 'pending' | 'running' | 'success' | 'error'
}

const props = withDefaults(defineProps<{
  title?: string
  actions: ActionItem[]
  showViewAll?: boolean
  totalCount?: number
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: '',
  actions: () => [],
  showViewAll: false,
  totalCount: 0,
})

defineEmits<{
  execute: [id: string]
  retry: [id: string]
  viewAll: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function getIndex(id: string): number {
  return props.actions.findIndex(a => a.id === id) + 1
}

function effortLabel(effort: 'low' | 'medium' | 'high'): string {
  switch (effort) {
    case 'low': return 'Low effort'
    case 'medium': return 'Medium effort'
    case 'high': return 'High effort'
  }
}

function actionLabel(effort: 'low' | 'medium' | 'high'): string {
  switch (effort) {
    case 'low': return 'One-click Improve'
    case 'medium': return 'One-click Improve'
    case 'high': return 'One-click Improve'
  }
}
</script>

<style scoped>
.action-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.action-panel__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.action-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.action-panel__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: all var(--motion-normal-duration, 200ms) ease-out;
}

.action-panel__card:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.action-panel__card--running {
  border-color: var(--color-info, #3b82f6);
  background-color: #f0f7ff;
}

.action-panel__card--success {
  border-color: var(--color-success, #22c55e);
  background-color: #f0fdf4;
}

.action-panel__card--error {
  border-color: var(--color-error, #ef4444);
  background-color: #fef2f2;
}

.action-panel__card-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.action-panel__card-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 600;
  color: var(--color-text-tertiary, #9ca3af);
  flex-shrink: 0;
}

.action-panel__card-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.action-panel__card-details {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.action-panel__card-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.action-panel__card-divider {
  width: 1px;
  height: 12px;
  background-color: var(--color-border, #e5e7eb);
}

.action-panel__card-effort {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.action-panel__card-effort--low { color: var(--color-success, #22c55e); }
.action-panel__card-effort--medium { color: var(--color-warning, #eab308); }
.action-panel__card-effort--high { color: var(--color-risk, #ef4444); }

.action-panel__card-reason {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  line-height: 1.5;
}

.action-panel__card-actions {
  display: flex;
  gap: var(--space-2, 8px);
  margin-top: var(--space-1, 4px);
}

.action-panel__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  border: none;
}

.action-panel__btn--primary {
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
}

.action-panel__btn--primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.action-panel__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-panel__btn--secondary {
  background-color: transparent;
  color: var(--color-error, #ef4444);
  border: 1px solid var(--color-error, #ef4444);
}

.action-panel__btn--secondary:hover {
  background-color: #fef2f2;
}

.action-panel__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: ap-spin 0.6s linear infinite;
}

@keyframes ap-spin {
  to { transform: rotate(360deg); }
}

.action-panel__footer {
  display: flex;
  justify-content: center;
}

.action-panel__view-all {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-info, #3b82f6);
  cursor: pointer;
  text-decoration: none;
  transition: color var(--motion-fast-duration, 100ms) ease-out;
}

.action-panel__view-all:hover {
  color: #2563eb;
  text-decoration: underline;
}
</style>
