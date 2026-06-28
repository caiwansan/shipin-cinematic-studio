<template>
  <canvas ref="canvasRef" class="particle-field" />
</template>

<script setup lang="ts">
/**
 * ParticleField — Three.js 星空粒子场
 *
 * 归属原语：Particle
 * 层级：L1 effects
 * 用途：动态星空粒子背景，鼠标驱动 + 粒子间连线。
 * 限制：仅做背景，不做交互。
 */

import { useParticles } from '~/composables/kunlun/useParticles'

const props = withDefaults(defineProps<{
  particleCount?: number
  connectDistance?: number
  mouseInfluence?: number
  color?: string
  backgroundColor?: string
  fps?: number
  disabled?: boolean
}>(), {
  particleCount: 800,
  connectDistance: 100,
  mouseInfluence: 0.5,
  color: '#C9A86C',
  backgroundColor: 'transparent',
  fps: 30,
  disabled: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

onMounted(() => {
  if (!canvasRef.value || props.disabled) return

  const result = useParticles(canvasRef.value, {
    count: props.particleCount,
    connectionDistance: props.connectDistance,
    color: props.color,
    autoAnimate: true,
  })
  result.init()
  cleanup = () => { result.cleanup() }
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<style scoped>
.particle-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>