<template>
  <div :class="['ds-status-indicator', `ds-status-indicator--${status}`, classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <span class="ds-status-indicator__icon">{{ statusIcon }}</span>
    <span class="ds-status-indicator__label">{{ displayLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type StatusType = 'connected' | 'pending' | 'error' | 'not-set-up'

const props = withDefaults(defineProps<{
  status?: StatusType
  label?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  status: 'pending',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const statusIcon = computed(() => {
  switch (props.status) {
    case 'connected': return '✓'
    case 'pending': return '⌛'
    case 'error': return '⚠'
    case 'not-set-up': return '⚠'
    default: return '⌛'
  }
})

const displayLabel = computed(() => {
  if (props.label) return props.label
  switch (props.status) {
    case 'connected': return 'Connected'
    case 'pending': return 'Pending'
    case 'error': return 'Error'
    case 'not-set-up': return 'Not Set Up'
    default: return 'Pending'
  }
})
</script>

<style scoped>
.ds-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-full, 9999px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  line-height: 1;
}

.ds-status-indicator--connected {
  background-color: #f0fdf4;
  color: var(--color-success, #22c55e);
}

.ds-status-indicator--pending {
  background-color: #fefce8;
  color: #a16207;
}

.ds-status-indicator--error {
  background-color: #fef2f2;
  color: var(--color-error, #ef4444);
}

.ds-status-indicator--not-set-up {
  background-color: #fef2f2;
  color: var(--color-caution, #f97316);
}

.ds-status-indicator__icon {
  font-size: var(--text-caption-size, 12px);
  line-height: 1;
}

.ds-status-indicator__label {
  line-height: 1;
}
</style>
