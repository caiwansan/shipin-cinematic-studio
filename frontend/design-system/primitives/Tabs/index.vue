<template>
  <div
    :class="['ds-tabs', classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
  >
    <div class="ds-tabs__header" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['ds-tabs__tab', { 'ds-tabs__tab--active': modelValue === tab.value, 'ds-tabs__tab--disabled': tab.disabled }]"
        role="tab"
        :aria-selected="modelValue === tab.value"
        :aria-disabled="tab.disabled || undefined"
        :disabled="tab.disabled"
        @click="selectTab(tab.value)"
      >
        <span v-if="tab.icon" class="ds-tabs__tab-icon" v-html="tab.icon" />
        <span class="ds-tabs__tab-label">{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="ds-tabs__tab-count">{{ tab.count }}</span>
      </button>
    </div>
    <div v-if="$slots.default" class="ds-tabs__content" role="tabpanel">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TabItem {
  label: string
  value: string
  icon?: string
  count?: number
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string
  tabs?: TabItem[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  modelValue: '',
  tabs: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function selectTab(value: string) {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.ds-tabs {
  display: flex;
  flex-direction: column;
}

.ds-tabs__header {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  gap: 0;
  overflow-x: auto;
}

.ds-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-tabs__tab:hover:not(.ds-tabs__tab--disabled) {
  color: var(--color-text-primary, #111111);
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-tabs__tab--active {
  color: var(--color-info, #3b82f6);
  border-bottom-color: var(--color-info, #3b82f6);
}

.ds-tabs__tab--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ds-tabs__tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1, 4px);
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.ds-tabs__content {
  padding-top: var(--space-4, 16px);
}
</style>
