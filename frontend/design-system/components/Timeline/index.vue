<template>
  <div :class="['ds-timeline', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div
      v-for="(event, index) in events"
      :key="index"
      :class="['ds-timeline__item', { 'ds-timeline__item--active': event.active }]"
    >
      <div class="ds-timeline__marker">
        <span v-if="event.icon" class="ds-timeline__icon" v-html="event.icon" />
        <span v-else-if="event.status === 'complete'" class="ds-timeline__dot ds-timeline__dot--complete">✓</span>
        <span v-else-if="event.status === 'error'" class="ds-timeline__dot ds-timeline__dot--error">✗</span>
        <span v-else class="ds-timeline__dot" />
      </div>
      <div class="ds-timeline__content">
        <div class="ds-timeline__header">
          <span v-if="event.title" class="ds-timeline__title">{{ event.title }}</span>
          <span v-if="event.time" class="ds-timeline__time">{{ event.time }}</span>
        </div>
        <p v-if="event.description" class="ds-timeline__description">{{ event.description }}</p>
        <div v-if="$slots[`event-${index}`]" class="ds-timeline__slot">
          <slot :name="`event-${index}`" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TimelineEvent {
  title?: string
  description?: string
  time?: string
  status?: 'default' | 'complete' | 'error'
  active?: boolean
  icon?: string
}

const props = withDefaults(defineProps<{
  events?: TimelineEvent[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  events: () => [],
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ds-timeline__item {
  display: flex;
  gap: var(--space-3, 12px);
  position: relative;
  padding-bottom: var(--space-5, 24px);
}

.ds-timeline__item:last-child {
  padding-bottom: 0;
}

.ds-timeline__marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 24px;
  position: relative;
}

.ds-timeline__item:not(:last-child) .ds-timeline__marker::after {
  content: '';
  position: absolute;
  top: 24px;
  width: 2px;
  flex: 1;
  height: calc(100% - 24px + var(--space-5, 24px));
  background-color: var(--color-border, #e5e7eb);
}

.ds-timeline__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-border, #e5e7eb);
  flex-shrink: 0;
  font-size: 8px;
  color: transparent;
}

.ds-timeline__dot--complete {
  background-color: var(--color-success, #22c55e);
  color: #ffffff;
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.ds-timeline__dot--error {
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.ds-timeline__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.ds-timeline__content {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.ds-timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2, 8px);
}

.ds-timeline__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.ds-timeline__time {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  white-space: nowrap;
}

.ds-timeline__description {
  margin: var(--space-1, 4px) 0 0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.ds-timeline__slot {
  margin-top: var(--space-2, 8px);
}
</style>
