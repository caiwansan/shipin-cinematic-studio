<template>
  <div
    :class="['ds-skeleton', `ds-skeleton--${variant}`, classOverride]"
    :style="[styleOverride, skeletonStyle]"
    :data-testid="dataTestId"
    aria-hidden="true"
  >
    <span v-if="variant === 'text'" class="ds-skeleton__text">&zwnj;</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card'

const props = withDefaults(defineProps<{
  variant?: SkeletonVariant
  width?: string
  height?: string
  lines?: number
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  variant: 'text',
  lines: 1,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const skeletonStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<style scoped>
.ds-skeleton {
  background: linear-gradient(90deg, var(--color-surface-dim, #f9fafb) 25%, var(--color-border, #e5e7eb) 50%, var(--color-surface-dim, #f9fafb) 75%);
  background-size: 200% 100%;
  animation: ds-skeleton-shimmer 1.5s ease-in-out infinite;
}

.ds-skeleton--text {
  display: inline-block;
  height: 1em;
  border-radius: var(--radius-sm, 4px);
  width: 100%;
  margin-bottom: var(--space-1, 4px);
}

.ds-skeleton--circle {
  border-radius: var(--radius-full, 9999px);
}

.ds-skeleton--rect {
  border-radius: var(--radius-sm, 4px);
}

.ds-skeleton--card {
  border-radius: var(--radius-md, 8px);
  min-height: 80px;
}

.ds-skeleton__text {
  visibility: hidden;
}

@keyframes ds-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
