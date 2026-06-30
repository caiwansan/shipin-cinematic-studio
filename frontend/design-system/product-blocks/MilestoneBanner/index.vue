<template>
  <div :class="['milestone-banner', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="milestone-banner__title">{{ title }}</h3>
    <div class="milestone-banner__list">
      <div
        v-for="(milestone, index) in milestones"
        :key="index"
        class="milestone-banner__item"
      >
        <span class="milestone-banner__icon">{{ icon }}</span>
        <span class="milestone-banner__text">{{ milestone }}</span>
      </div>
    </div>
    <div v-if="milestones.length === 0 && !hideEmpty" class="milestone-banner__empty">
      <p class="milestone-banner__empty-text">No milestones yet. Complete recommendations to earn them.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  milestones?: string[]
  icon?: string
  hideEmpty?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Milestones',
  milestones: () => [],
  icon: '🏆',
  hideEmpty: true,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.milestone-banner {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.milestone-banner__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.milestone-banner__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.milestone-banner__item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border: 1px solid #fde68a;
}

.milestone-banner__icon {
  flex-shrink: 0;
  font-size: 20px;
}

.milestone-banner__text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.milestone-banner__empty {
  display: flex;
  justify-content: center;
  padding: var(--space-3, 12px);
}

.milestone-banner__empty-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-tertiary, #9ca3af);
  font-style: italic;
  margin: 0;
}
</style>
