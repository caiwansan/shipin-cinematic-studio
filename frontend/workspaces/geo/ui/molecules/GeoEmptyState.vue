<template>
  <div
    :class="['geo-empty-state', className]"
    :data-testid="dataTestId"
  >
    <div v-if="$slots.icon || icon" class="geo-empty-state__icon">
      <slot name="icon">
        <span class="geo-empty-state__icon-emoji">{{ icon }}</span>
      </slot>
    </div>
    <h3 v-if="title" class="geo-empty-state__title">{{ title }}</h3>
    <p v-if="description" class="geo-empty-state__description">{{ description }}</p>
    <div v-if="$slots.cta || $slots.default || action" class="geo-empty-state__cta">
      <slot name="cta">
        <slot />
      </slot>
      <GeoButton
        v-if="action && !$slots.default && !$slots.cta"
        :variant="action.variant || 'primary'"
        size="sm"
        @click="action.onClick"
      >
        {{ action.label }}
      </GeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GeoButton from '../atoms/GeoButton.vue'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

const props = withDefaults(defineProps<{
  /** Icon (emoji or HTML) */
  icon?: string
  /** Empty state title */
  title?: string
  /** Empty state description */
  description?: string
  /** Optional action button config */
  action?: EmptyStateAction
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  icon: '📭',
  title: '暂无数据',
  description: '',
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.geo-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--geo-space-2xl, 24px) var(--geo-space-lg, 16px);
  text-align: center;
}

.geo-empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--geo-space-lg, 16px);
  border-radius: 9999px;
  background-color: var(--geo-bg-secondary, #f9fafb);
}

.geo-empty-state__icon-emoji {
  font-size: 28px;
  line-height: 1;
}

.geo-empty-state__title {
  margin: 0 0 var(--geo-space-sm, 8px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-lg, 14px);
  font-weight: 600;
  color: var(--geo-text, #111827);
}

.geo-empty-state__description {
  margin: 0 0 var(--geo-space-lg, 16px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-base, 13px);
  color: var(--geo-text-tertiary, #6b7280);
  max-width: 360px;
  line-height: 1.5;
}

.geo-empty-state__cta {
  display: flex;
  gap: var(--geo-space-sm, 8px);
}
</style>
