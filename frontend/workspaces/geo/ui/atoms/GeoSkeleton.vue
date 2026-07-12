<template>
  <div
    :class="['geo-skeleton', className]"
    :data-testid="dataTestId"
    aria-hidden="true"
  >
    <!-- Page skeleton (merges GeoPageSkeleton) -->
    <template v-if="type === 'page'">
      <div class="geo-skeleton__header">
        <div class="geo-skeleton__title-block">
          <div class="geo-skeleton__title-line" />
          <div class="geo-skeleton__subtitle-line" />
        </div>
      </div>
      <div :class="['geo-skeleton__grid', `geo-skeleton__grid--${layout}`]">
        <div v-for="i in cardCount" :key="i" class="geo-skeleton__page-card">
          <div class="geo-skeleton__card-header" />
          <div class="geo-skeleton__card-body">
            <div class="geo-skeleton__card-line" />
            <div class="geo-skeleton__card-line" style="width: 60%" />
            <div class="geo-skeleton__card-line" style="width: 80%" />
          </div>
        </div>
      </div>
    </template>

    <!-- Card skeleton (from kmki) -->
    <template v-else-if="type === 'card'">
      <div v-for="i in rows" :key="i" class="geo-skeleton__kmki-card">
        <div class="geo-skeleton__kmki-line geo-skeleton__kmki-line--short" />
        <div class="geo-skeleton__kmki-line geo-skeleton__kmki-line--medium" />
        <div class="geo-skeleton__kmki-line geo-skeleton__kmki-line--long" />
      </div>
    </template>

    <!-- Text skeleton (from kmki) -->
    <template v-else-if="type === 'text'">
      <div class="geo-skeleton__text-list">
        <div
          v-for="i in rows"
          :key="i"
          :class="['geo-skeleton__text-line', i % 2 === 0 ? 'geo-skeleton__text-line--shorter' : '']"
        />
      </div>
    </template>

    <!-- Table skeleton (from kmki) -->
    <template v-else-if="type === 'table'">
      <div class="geo-skeleton__table">
        <div v-for="i in rows" :key="i" class="geo-skeleton__table-row" />
      </div>
    </template>

    <!-- Single element skeleton (from DS Skeleton) -->
    <template v-else>
      <div
        :class="[
          'geo-skeleton__element',
          `geo-skeleton__element--${elementVariant}`,
        ]"
        :style="elementStyle"
      >
        <span v-if="elementVariant === 'text'" class="geo-skeleton__element-text">&zwnj;</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SkeletonType = 'element' | 'text' | 'card' | 'table' | 'page'
type ElementVariant = 'text' | 'circle' | 'rect' | 'card'
type PageLayout = 'grid' | 'list' | 'dashboard'

const props = withDefaults(defineProps<{
  /** Skeleton type */
  type?: SkeletonType
  /** Element variant (when type='element') */
  elementVariant?: ElementVariant
  /** Width (element mode) */
  width?: string
  /** Height (element mode) */
  height?: string
  /** Number of rows/cards (card/text/table/page modes) */
  rows?: number
  /** Number of cards (page mode) */
  cardCount?: number
  /** Page skeleton layout (page mode) */
  layout?: PageLayout
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  type: 'element',
  elementVariant: 'text',
  rows: 3,
  cardCount: 4,
  layout: 'grid',
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)

const elementStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<style scoped>
/* ── Base shimmer ── */
.geo-skeleton,
.geo-skeleton__element,
.geo-skeleton__title-line,
.geo-skeleton__subtitle-line,
.geo-skeleton__page-card,
.geo-skeleton__card-header,
.geo-skeleton__card-line,
.geo-skeleton__kmki-card,
.geo-skeleton__kmki-line,
.geo-skeleton__text-line,
.geo-skeleton__table-row {
  background: linear-gradient(
    90deg,
    var(--geo-border-light, #f3f4f6) 25%,
    var(--geo-bg-secondary, #f9fafb) 50%,
    var(--geo-border-light, #f3f4f6) 75%
  );
  background-size: 200% 100%;
  animation: geo-skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--geo-radius-sm, 4px);
}

@keyframes geo-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Element mode (from DS Skeleton) ── */
.geo-skeleton__element {
  display: inline-block;
}

.geo-skeleton__element--text {
  height: 1em;
  width: 100%;
  margin-bottom: var(--geo-space-xs, 4px);
}

.geo-skeleton__element--circle {
  border-radius: 9999px;
}

.geo-skeleton__element--rect {
  border-radius: var(--geo-radius-sm, 4px);
}

.geo-skeleton__element--card {
  border-radius: var(--geo-radius-lg, 8px);
  min-height: 80px;
  display: block;
}

.geo-skeleton__element-text {
  visibility: hidden;
}

/* ── Page skeleton mode (from GeoPageSkeleton) ── */
.geo-skeleton__header {
  padding: var(--geo-space-2xl, 24px) 0 var(--geo-space-lg, 16px);
}

.geo-skeleton__title-block {
  max-width: 400px;
}

.geo-skeleton__title-line {
  height: 28px;
  width: 240px;
  margin-bottom: 10px;
}

.geo-skeleton__subtitle-line {
  height: 14px;
  width: 320px;
}

.geo-skeleton__grid {
  display: grid;
  gap: 20px;
  margin-top: var(--geo-space-sm, 8px);
}

.geo-skeleton__grid--grid {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.geo-skeleton__grid--list {
  grid-template-columns: 1fr;
}

.geo-skeleton__grid--dashboard {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.geo-skeleton__page-card {
  padding: var(--geo-space-2xl, 24px);
  border-radius: var(--geo-radius-round, 12px);
  background-color: var(--geo-bg, #ffffff);
  border: 1px solid var(--geo-border, #e5e7eb);
}

.geo-skeleton__card-header {
  height: 20px;
  width: 120px;
  margin-bottom: 20px;
}

.geo-skeleton__card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.geo-skeleton__card-line {
  height: 14px;
  width: 100%;
}

/* ── kmki card skeleton ── */
.geo-skeleton__kmki-card {
  padding: var(--geo-space-lg, 16px);
  border-radius: var(--geo-radius-lg, 8px);
  border: 1px solid var(--geo-border, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.geo-skeleton__kmki-line {
  height: 12px;
  background: none;
  animation: none;
}

.geo-skeleton__kmki-line--short {
  width: 33%;
  height: 16px;
}

.geo-skeleton__kmki-line--medium {
  width: 66%;
  height: 32px;
}

.geo-skeleton__kmki-line--long {
  width: 50%;
  height: 12px;
}

/* ── Text skeleton ── */
.geo-skeleton__text-list {
  display: flex;
  flex-direction: column;
  gap: var(--geo-space-sm, 8px);
}

.geo-skeleton__text-line {
  height: 12px;
  width: 100%;
}

.geo-skeleton__text-line--shorter {
  width: 75%;
}

/* ── Table skeleton ── */
.geo-skeleton__table {
  display: flex;
  flex-direction: column;
  gap: var(--geo-space-xs, 4px);
}

.geo-skeleton__table-row {
  height: 40px;
}
</style>
