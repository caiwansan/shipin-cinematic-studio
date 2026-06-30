<template>
  <div :class="['knowledge-overview', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="knowledge-overview__title">{{ title }}</h3>
    <div class="knowledge-overview__description" v-if="brandDescription">
      <h4 class="knowledge-overview__desc-label">Brand Description</h4>
      <p class="knowledge-overview__desc-text">{{ brandDescription }}</p>
    </div>
    <div v-if="coverage" class="knowledge-overview__coverage">
      <span class="knowledge-overview__coverage-label">Knowledge Coverage</span>
      <div class="knowledge-overview__coverage-bar">
        <div class="knowledge-overview__coverage-fill" :style="{ width: coverage + '%' }" />
      </div>
      <span class="knowledge-overview__coverage-value">{{ coverage }}%</span>
    </div>
    <div v-if="categories && categories.length > 0" class="knowledge-overview__categories">
      <h4 class="knowledge-overview__cat-title">Categories</h4>
      <div class="knowledge-overview__cat-list">
        <span
          v-for="cat in categories"
          :key="cat"
          class="knowledge-overview__cat-tag"
        >{{ cat }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  brandDescription?: string
  coverage?: number
  categories?: string[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Brand Knowledge',
  coverage: 0,
  categories: () => [],
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.knowledge-overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.knowledge-overview__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-2-size, 24px);
  font-weight: var(--text-heading-2-weight, 600);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.knowledge-overview__description {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
}

.knowledge-overview__desc-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.knowledge-overview__desc-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-primary, #111111);
  margin: 0;
  line-height: 1.5;
}

.knowledge-overview__coverage {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.knowledge-overview__coverage-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.knowledge-overview__coverage-bar {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  overflow: hidden;
  max-width: 200px;
}

.knowledge-overview__coverage-fill {
  height: 100%;
  border-radius: var(--radius-full, 9999px);
  background: linear-gradient(90deg, var(--color-info, #3b82f6), var(--color-health, #22c55e));
  transition: width var(--motion-slow-duration, 400ms) ease-in-out;
}

.knowledge-overview__coverage-value {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.knowledge-overview__categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.knowledge-overview__cat-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

.knowledge-overview__cat-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 8px);
}

.knowledge-overview__cat-tag {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}
</style>
