<template>
  <div :class="['learning-summary', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="learning-summary__title">{{ title }}</h3>
    <div class="learning-summary__list">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="learning-summary__item"
        @click="$emit('viewDetail', item.action)"
      >
        <span class="learning-summary__item-action">{{ item.action }}</span>
        <span class="learning-summary__item-arrow">→</span>
        <span class="learning-summary__item-impact">+{{ item.impact }} Brand Health</span>
      </div>
    </div>
    <div v-if="showMore" class="learning-summary__footer">
      <a class="learning-summary__more" @click="$emit('showMore')">
        Show more actions ↓
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface LearningItem {
  action: string
  impact: number
}

const props = withDefaults(defineProps<{
  title?: string
  items: LearningItem[]
  showMore?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Most effective actions this period',
  items: () => [],
  showMore: false,
})

defineEmits<{
  viewDetail: [action: string]
  showMore: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.learning-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.learning-summary__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.learning-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.learning-summary__item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
}

.learning-summary__item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.learning-summary__item-action {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
  flex: 1;
}

.learning-summary__item-arrow {
  color: var(--color-text-tertiary, #9ca3af);
  font-size: var(--text-body-sm-size, 14px);
}

.learning-summary__item-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
  white-space: nowrap;
}

.learning-summary__footer {
  display: flex;
  justify-content: center;
}

.learning-summary__more {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-info, #3b82f6);
  cursor: pointer;
  transition: color var(--motion-fast-duration, 100ms) ease-out;
}

.learning-summary__more:hover {
  color: #2563eb;
  text-decoration: underline;
}
</style>
