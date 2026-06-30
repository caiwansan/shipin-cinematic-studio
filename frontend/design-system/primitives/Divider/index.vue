<template>
  <hr
    :class="['ds-divider', `ds-divider--${orientation}`, classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
    role="separator"
    :aria-orientation="orientation"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type DividerOrientation = 'horizontal' | 'vertical'

const props = withDefaults(defineProps<{
  orientation?: DividerOrientation
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  orientation: 'horizontal',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-divider {
  border: none;
  background-color: var(--color-border, #e5e7eb);
  margin: 0;
  flex-shrink: 0;
}

.ds-divider--horizontal {
  height: 1px;
  width: 100%;
}

.ds-divider--vertical {
  width: 1px;
  height: 100%;
  align-self: stretch;
}
</style>
