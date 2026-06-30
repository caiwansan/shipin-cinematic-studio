<template>
  <div
    :class="['ds-spacer', classOverride]"
    :style="[styleOverride, spacerStyle]"
    :data-testid="dataTestId"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SpacerAxis = 'horizontal' | 'vertical'
type SpacerSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

const props = withDefaults(defineProps<{
  axis?: SpacerAxis
  size?: SpacerSize
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  axis: 'vertical',
  size: 4,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const spacerStyle = computed(() => {
  const spaceVar = `var(--space-${props.size}, ${props.size * 4}px)`
  return {
    width: props.axis === 'horizontal' ? spaceVar : undefined,
    height: props.axis === 'vertical' ? spaceVar : undefined,
    flexShrink: 0,
  }
})
</script>

<style scoped>
.ds-spacer {
  flex-shrink: 0;
}
</style>
