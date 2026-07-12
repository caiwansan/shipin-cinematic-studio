<template>
  <section class="next-action-panel" data-testid="next-action-panel">
    <h3 class="next-action-panel__title">{{ title || '下一步' }}</h3>
    <div class="next-action-panel__actions">
      <button
        v-for="action in sortedActions"
        :key="action.id"
        :class="['next-action-panel__btn', { 'next-action-panel__btn--primary': action.primary }]"
        :disabled="action.disabled"
        :title="action.disabled ? action.disabledReason : ''"
        @click="handleAction(action)"
      >
        <span class="next-action-panel__btn-title">{{ action.title }}</span>
        <span v-if="action.description" class="next-action-panel__btn-desc">{{ action.description }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { NextAction } from '~/workspaces/geo/types/ai'

interface NextActionPanelProps {
  actions: NextAction[]
  title?: string
}

const props = withDefaults(defineProps<NextActionPanelProps>(), {
  title: '下一步',
})

const router = useRouter()

// Primary action first, then preserve original order
const sortedActions = computed(() => {
  return [...props.actions].sort((a, b) => {
    if (a.primary && !b.primary) return -1
    if (!a.primary && b.primary) return 1
    return 0
  })
})

function handleAction(action: NextAction) {
  if (action.disabled) return

  // Direct callback takes priority over route navigation
  if (action.action) {
    action.action()
    return
  }

  // Route navigation
  if (action.route) {
    router.push(action.route)
  }
}
</script>

<style scoped>
.next-action-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.next-action-panel__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.next-action-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.next-action-panel__btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  font-size: 0.8125rem;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.next-action-panel__btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.next-action-panel__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.next-action-panel__btn--primary {
  background: #6366f1;
  color: #ffffff;
  border-color: #6366f1;
}

.next-action-panel__btn--primary:hover:not(:disabled) {
  background: #4f46e5;
  border-color: #4f46e5;
}

.next-action-panel__btn-title {
  font-weight: 500;
}

.next-action-panel__btn-desc {
  font-size: 0.75rem;
  opacity: 0.75;
}
</style>
