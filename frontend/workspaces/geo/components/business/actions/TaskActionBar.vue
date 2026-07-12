<template>
  <div class="task-action-bar" data-testid="task-action-bar">
    <button
      v-for="action in actions"
      :key="action.id"
      class="task-action-bar__btn"
      :class="`task-action-bar__btn--${action.variant}`"
      :disabled="action.disabled || action.loading"
      :data-testid="`task-action-btn-${action.id}`"
      @click="handleAction(action.id)"
    >
      <span v-if="action.loading" class="task-action-bar__spinner" />
      {{ action.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TaskAction } from '~/workspaces/geo/types/business'

defineProps<{
  actions: TaskAction[]
}>()

const emit = defineEmits<{
  action: [actionId: string]
}>()

function handleAction(actionId: string) {
  emit('action', actionId)
}
</script>

<style scoped>
.task-action-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-action-bar__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.task-action-bar__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-action-bar__btn--primary {
  background-color: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.task-action-bar__btn--secondary {
  background-color: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.task-action-bar__btn--ghost {
  background-color: transparent;
  color: #6b7280;
  border-color: transparent;
}

.task-action-bar__btn--danger {
  background-color: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.task-action-bar__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: action-spin 0.6s linear infinite;
}

@keyframes action-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
