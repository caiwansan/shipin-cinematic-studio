<template>
  <div :class="['proof-panel', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="proof-panel__title">{{ title }}</h3>
    <div class="proof-panel__list">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="proof-panel__item"
        @click="handleLearn(index)"
      >
        <div class="proof-panel__item-header">
          <span class="proof-panel__item-name">{{ item.name }}</span>
          <span v-if="item.isUnavailable" class="proof-panel__item-unavailable">--- unavailable ---</span>
          <template v-else>
            <span class="proof-panel__item-values">
              <span class="proof-panel__item-before">{{ item.before }}</span>
              <span class="proof-panel__item-arrow">→</span>
              <span class="proof-panel__item-after">{{ item.after }}</span>
            </span>
            <span class="proof-panel__item-delta" :class="deltaClass(item.delta)">
              {{ deltaPrefix(item.delta) }}{{ item.delta }}{{ item.suffix || '' }}
            </span>
          </template>
        </div>
        <div v-if="learnedIndex === index && item.learnContent" class="proof-panel__learn-content">
          <p>{{ item.learnContent }}</p>
        </div>
      </div>
    </div>
    <div v-if="showMore" class="proof-panel__footer">
      <a class="proof-panel__more" @click="$emit('showMore')">
        Show more dimensions ↓
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

export interface ProofItem {
  name: string
  before: string | number
  after: string | number
  delta: number
  suffix?: string
  isUnavailable?: boolean
  learnContent?: string
}

const props = withDefaults(defineProps<{
  title?: string
  items: ProofItem[]
  showMore?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Before vs After',
  items: () => [],
  showMore: false,
})

defineEmits<{
  showMore: []
  learn: [name: string]
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const learnedIndex = ref<number | null>(null)

function handleLearn(index: number) {
  learnedIndex.value = learnedIndex.value === index ? null : index
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'proof-panel__item-delta--positive'
  if (delta < 0) return 'proof-panel__item-delta--negative'
  return 'proof-panel__item-delta--neutral'
}

function deltaPrefix(delta: number): string {
  return delta > 0 ? '+' : ''
}
</script>

<style scoped>
.proof-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.proof-panel__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.proof-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.proof-panel__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
}

.proof-panel__item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.proof-panel__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  flex-wrap: wrap;
}

.proof-panel__item-name {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
  flex: 1;
}

.proof-panel__item-unavailable {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-style: italic;
  color: var(--color-text-tertiary, #9ca3af);
}

.proof-panel__item-values {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.proof-panel__item-arrow {
  color: var(--color-text-tertiary, #9ca3af);
}

.proof-panel__item-delta {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  min-width: 48px;
  text-align: right;
}

.proof-panel__item-delta--positive {
  color: var(--color-success, #22c55e);
}

.proof-panel__item-delta--negative {
  color: var(--color-error, #ef4444);
}

.proof-panel__item-delta--neutral {
  color: var(--color-text-tertiary, #9ca3af);
}

.proof-panel__learn-content {
  padding: var(--space-3, 12px);
  background-color: var(--color-surface-dim, #f9fafb);
  border-radius: var(--radius-sm, 4px);
}

.proof-panel__learn-content p {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  line-height: 1.5;
}

.proof-panel__footer {
  display: flex;
  justify-content: center;
}

.proof-panel__more {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-info, #3b82f6);
  cursor: pointer;
  transition: color var(--motion-fast-duration, 100ms) ease-out;
}

.proof-panel__more:hover {
  color: #2563eb;
  text-decoration: underline;
}
</style>
