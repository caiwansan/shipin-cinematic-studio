<template>
  <div :class="['recommendation-list', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 class="recommendation-list__title">{{ title }}</h3>
    <ul class="recommendation-list__items">
      <li
        v-for="item in displayItems"
        :key="item.id"
        class="recommendation-list__item"
      >
        <span class="recommendation-list__item-index">{{ itemIndex(item) }}</span>
        <div class="recommendation-list__item-content">
          <span class="recommendation-list__item-title">{{ item.title }}</span>
        </div>
        <span class="recommendation-list__item-impact">+{{ item.expectedImpact }}</span>
      </li>
    </ul>
    <a
      v-if="hasMore"
      class="recommendation-list__view-all"
      @click="$emit('viewAll')"
    >
      View all →<template v-if="totalCount"> ({{ totalCount }} total)</template>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface RecommendationItem {
  id: string
  title: string
  expectedImpact: number
}

const props = withDefaults(defineProps<{
  title?: string
  items: RecommendationItem[]
  maxDisplay?: number
  totalCount?: number
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: "Today's Actions",
  items: () => [],
  maxDisplay: 3,
})

defineEmits<{
  viewAll: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayItems = computed(() => props.items.slice(0, props.maxDisplay))

const hasMore = computed(() => props.items.length > props.maxDisplay || (props.totalCount !== undefined && props.totalCount > props.maxDisplay))

function itemIndex(item: RecommendationItem): number {
  return props.items.indexOf(item) + 1
}
</script>

<style scoped>
.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.recommendation-list__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.recommendation-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.recommendation-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.recommendation-list__item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.recommendation-list__item-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 600;
  color: var(--color-text-tertiary, #9ca3af);
  flex-shrink: 0;
}

.recommendation-list__item-content {
  flex: 1;
  min-width: 0;
}

.recommendation-list__item-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.recommendation-list__item-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
  flex-shrink: 0;
}

.recommendation-list__view-all {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-info, #3b82f6);
  cursor: pointer;
  text-decoration: none;
  transition: color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.recommendation-list__view-all:hover {
  color: #2563eb;
  text-decoration: underline;
}
</style>
