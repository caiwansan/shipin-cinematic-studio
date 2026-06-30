<template>
  <div :class="['next-step-panel', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div v-if="isUpToDate" class="next-step-panel__uptodate">
      <span class="next-step-panel__uptodate-icon">✓</span>
      <span class="next-step-panel__uptodate-text">{{ upToDateText }}</span>
    </div>
    <button
      v-else
      class="next-step-panel__cta"
      :disabled="disabled"
      @click="handleAction"
    >
      {{ ctaText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  actionCount?: number
  isUpToDate?: boolean
  ctaLabel?: string
  upToDateText?: string
  disabled?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
  onAction?: () => void
}>(), {
  actionCount: 0,
  isUpToDate: false,
  ctaLabel: 'Improve Brand Health',
  upToDateText: 'Brand Health up to date ✓',
  disabled: false,
})

const emit = defineEmits<{
  action: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const ctaText = computed(() => {
  if (props.actionCount > 0) {
    return `${props.ctaLabel} — ${props.actionCount} action${props.actionCount !== 1 ? 's' : ''} pending`
  }
  return props.ctaLabel
})

function handleAction() {
  emit('action')
  props.onAction?.()
}
</script>

<style scoped>
.next-step-panel {
  display: flex;
  justify-content: center;
  padding: var(--space-6, 32px) 0;
  border-top: 1px solid var(--color-border, #e5e7eb);
  margin-top: var(--space-6, 32px);
}

.next-step-panel__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-6, 32px);
  border: none;
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
  white-space: nowrap;
}

.next-step-panel__cta:hover:not(:disabled) {
  background-color: #2563eb;
  transform: translateY(-1px);
}

.next-step-panel__cta:active:not(:disabled) {
  background-color: #1d4ed8;
  transform: translateY(0);
}

.next-step-panel__cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.next-step-panel__uptodate {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-5, 24px);
  border-radius: var(--radius-md, 8px);
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.next-step-panel__uptodate-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-success, #22c55e);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.next-step-panel__uptodate-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 500;
  color: var(--color-success, #22c55e);
}
</style>
