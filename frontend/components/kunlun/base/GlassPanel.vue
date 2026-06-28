<template>
  <div
    ref="el"
    class="glass-panel"
    :class="[`level-${level}`]"
    :style="panelStyle"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * GlassPanel — 玻璃态通用容器
 *
 * 归属原语：Glass
 * 层级：L1 base
 * 用途：玻璃态通用容器。接受 level 参数映射 glass.ts 中的玻璃级别。
 * 限制：仅做容器，不做光效。
 */

import { getGlassCSS } from '~/utils/kunlun/glass'

const props = withDefaults(defineProps<{
  level?: 'nav' | 'card' | 'modal' | 'mirror'
  rounded?: string
  padding?: string
  fullHeight?: boolean
}>(), {
  level: 'card',
  rounded: '12px',
  padding: '24px',
  fullHeight: false,
})

const el = ref<HTMLElement | null>(null)

const panelStyle = computed(() => {
  const g = getGlassCSS(props.level)
  return {
    ...g,
    borderRadius: props.rounded,
    padding: props.padding,
    height: props.fullHeight ? '100%' : undefined,
  }
})
</script>

<style scoped>
.glass-panel {
  position: relative;
  backdrop-filter: var(--kl-glass-blur, blur(12px));
  -webkit-backdrop-filter: var(--kl-glass-blur, blur(12px));
  transition:
    background var(--kl-duration-normal, 500ms) cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow var(--kl-duration-normal, 500ms) cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
