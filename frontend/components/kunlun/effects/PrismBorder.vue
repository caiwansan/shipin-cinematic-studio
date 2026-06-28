<template>
  <div
    ref="el"
    class="prism-border"
    :style="computedStyle"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * PrismBorder — 棱镜折射光效
 *
 * 归属原语：Prism
 * 层级：L1 effects
 * 用途：卡片边缘彩色折射光效。鼠标 hover 时在边缘渲染七彩渐变。
 * 限制：仅做边缘，不做背景。
 */

import { usePrism } from '~/composables/kunlun/usePrism'

const props = withDefaults(defineProps<{
  color?: string
  width?: number
  intensity?: number
  disabled?: boolean
}>(), {
  color: '#C9A86C',
  width: 2,
  intensity: 1,
  disabled: false,
})

const el = ref<HTMLElement | null>(null)
const prism = usePrism({
  intensity: props.intensity,
})

const computedStyle = computed(() => ({
  position: 'relative' as const,
  overflow: 'hidden' as const,
  '--prism-width': `${props.width}px`,
  '--prism-color': props.color,
}))

const prismBg = computed(() => {
  if (props.disabled) return 'none'
  return prism.prismStyle.value.background ?? 'none'
})

onMounted(() => {
  prism.elementRef.value = el.value
  prism.bindEvents()
})

onUnmounted(() => {
  prism.unbindEvents()
})
</script>

<style scoped>
.prism-border::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--prism-width);
  background: v-bind(prismBg);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 0;
}

.prism-border:hover::after {
  opacity: 1;
}
</style>
