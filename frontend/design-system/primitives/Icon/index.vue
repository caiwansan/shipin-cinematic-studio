<template>
  <span
    :class="['ds-icon', `ds-icon--${size}`, classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
    :aria-label="label"
    role="img"
    v-html="iconContent"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  icon?: string
  label?: string
  size?: IconSize
  color?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  size: 'md',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => {
  const base = props.style ? (typeof props.style === 'string' ? {} : { ...props.style }) : {}
  if (props.color) {
    base.color = props.color
  }
  return base
})
const dataTestId = computed(() => props['data-testid'] || undefined)

const iconContent = computed(() => {
  if (props.icon) return props.icon
  return '<!-- icon -->'
})
</script>

<style scoped>
.ds-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

.ds-icon svg,
.ds-icon img {
  width: 100%;
  height: 100%;
  display: block;
}

.ds-icon--sm {
  width: 14px;
  height: 14px;
}

.ds-icon--md {
  width: 18px;
  height: 18px;
}

.ds-icon--lg {
  width: 24px;
  height: 24px;
}

.ds-icon--xl {
  width: 32px;
  height: 32px;
}
</style>
