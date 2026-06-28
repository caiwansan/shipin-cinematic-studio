<template>
  <canvas ref="canvasRef" class="aurora-layer" />
</template>

<script setup lang="ts">
/**
 * AuroraLayer — Canvas 2D 极光慢速流动层
 *
 * 归属原语：Aurora
 * 层级：L1 effects
 * 用途：轻量极光氛围，用于 Hero 和 Final CTA 背景层。
 * 限制：仅做背景层，不做交互。
 */

import { useAurora } from '~/composables/kunlun/useAurora'

const props = withDefaults(defineProps<{
  speed?: number
  opacity?: number
  colors?: string[]
  blur?: number
}>(), {
  speed: 0.3,
  opacity: 0.3,
  colors: () => [
    'rgba(201, 168, 108, 0.08)',
    'rgba(0, 212, 255, 0.06)',
    'rgba(167, 139, 250, 0.05)',
  ],
  blur: 80,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

onMounted(() => {
  if (!canvasRef.value) return
  const aurora = useAurora(canvasRef.value, {
    speed: props.speed,
    opacity: props.opacity,
    colors: props.colors,
    blur: props.blur,
  })
  aurora.start()
  cleanup = () => { aurora.stop() }
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<style scoped>
.aurora-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>