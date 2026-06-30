<template>
  <component
    :is="tag"
    :class="[
      'ds-typography',
      `ds-typography--${variant}`,
      inline ? 'ds-typography--inline' : '',
      classOverride
    ]"
    :style="styleOverride"
    :data-testid="dataTestId"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type TypographyVariant =
  | 'display'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'metric'
  | 'metric-sm'

const props = withDefaults(defineProps<{
  variant?: TypographyVariant
  tag?: string
  inline?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  variant: 'body',
  tag: 'span',
  inline: false,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-typography {
  font-family: var(--font-family, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  margin: 0;
  padding: 0;
  transition: color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-typography--inline {
  display: inline;
}

.ds-typography--display {
  font-size: var(--text-display-size, 48px);
  line-height: var(--text-display-line, 1.1);
  font-weight: var(--text-display-weight, 700);
}

.ds-typography--heading-1 {
  font-size: var(--text-heading-1-size, 32px);
  line-height: var(--text-heading-1-line, 1.2);
  font-weight: var(--text-heading-1-weight, 600);
}

.ds-typography--heading-2 {
  font-size: var(--text-heading-2-size, 24px);
  line-height: var(--text-heading-2-line, 1.3);
  font-weight: var(--text-heading-2-weight, 600);
}

.ds-typography--heading-3 {
  font-size: var(--text-heading-3-size, 20px);
  line-height: var(--text-heading-3-line, 1.4);
  font-weight: var(--text-heading-3-weight, 500);
}

.ds-typography--body {
  font-size: var(--text-body-size, 16px);
  line-height: var(--text-body-line, 1.5);
  font-weight: var(--text-body-weight, 400);
}

.ds-typography--body-sm {
  font-size: var(--text-body-sm-size, 14px);
  line-height: var(--text-body-sm-line, 1.5);
  font-weight: var(--text-body-sm-weight, 400);
}

.ds-typography--caption {
  font-size: var(--text-caption-size, 12px);
  line-height: var(--text-caption-line, 1.4);
  font-weight: var(--text-caption-weight, 400);
}

.ds-typography--metric {
  font-size: var(--text-metric-size, 96px);
  line-height: var(--text-metric-line, 1.0);
  font-weight: var(--text-metric-weight, 700);
}

.ds-typography--metric-sm {
  font-size: var(--text-metric-sm-size, 32px);
  line-height: var(--text-metric-sm-line, 1.0);
  font-weight: var(--text-metric-sm-weight, 700);
}
</style>
