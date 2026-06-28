<template>
  <div
    ref="el"
    class="hero-mirror"
    :style="mirrorStyle"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- 外层镜面环 -->
    <div class="mirror-outer-ring" />

    <!-- 主镜面 -->
    <div class="mirror-surface">
      <!-- 彩虹折射纹理 -->
      <div
        class="mirror-spectrum"
        :style="spectrumAngle"
      />

      <!-- 内发光 -->
      <div class="mirror-inner-glow" />

      <!-- 高光追踪 -->
      <div
        class="mirror-spotlight"
        :style="spotlightStyle"
      />

      <!-- 中心内容 -->
      <div class="mirror-content">
        <slot />
      </div>
    </div>

    <!-- 外能量流 -->
    <div class="mirror-flow energy-flow-1" />
    <div class="mirror-flow energy-flow-2" />
  </div>
</template>

<script setup lang="ts">
/**
 * HeroMirror — 昆仑镜品牌核心视觉
 *
 * 归属原语：Mirror + Glass + Light + Prism
 * 层级：L3.5 hero
 * 用途：半透明玻璃镜面 + 旋转 + 彩虹折射 + 边缘能量流。
 * 限制：仅首页 Hero 区使用，不可用于卡片。
 */

import { useMirror } from '~/composables/kunlun/useMirror'

const props = withDefaults(defineProps<{
  size?: number
  spectrumScroll?: boolean
}>(), {
  size: 280,
  spectrumScroll: false,
})

const el = ref<HTMLElement | null>(null)
const { rotation, glowIntensity, highlightPos, mirrorStyle: styleFn, start, stop } = useMirror(el)

const highlightX = computed(() => highlightPos.value.x)
const highlightY = computed(() => highlightPos.value.y)
const spectrumRotation = rotation
const onMouseMove = (e: MouseEvent) => {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  highlightPos.value = {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  }
}
const onMouseLeave = () => {}

const mirrorStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  '--mirror-size': `${props.size}px`,
}))

const spectrumAngle = computed(() => ({
  transform: props.spectrumScroll
    ? `rotate(${spectrumRotation.value}deg)`
    : undefined,
}))

const spotlightStyle = computed(() => ({
  left: `${highlightX.value}%`,
  top: `${highlightY.value}%`,
}))
</script>

<style scoped>
.hero-mirror {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

/* 外层环 */
.mirror-outer-ring {
  position: absolute;
  width: calc(var(--mirror-size) * 1.08);
  height: calc(var(--mirror-size) * 1.08);
  border-radius: 50%;
  border: 1px solid rgba(201, 168, 108, 0.15);
  animation: ring-rotate 20s linear infinite;
}

@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 主镜面 */
.mirror-surface {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 35% 35%,
    rgba(14, 29, 49, 0.5) 0%,
    rgba(8, 19, 31, 0.7) 50%,
    rgba(8, 19, 31, 0.9) 100%
  );
  backdrop-filter: blur(24px);
  border: 1px solid rgba(201, 168, 108, 0.2);
  overflow: hidden;
  animation: mirror-float 8s ease-in-out infinite alternate;
}

@keyframes mirror-float {
  0% {
    transform: perspective(600px) rotateY(-2deg) rotateX(1deg);
    box-shadow:
      0 0 40px rgba(201, 168, 108, 0.1),
      0 0 80px rgba(0, 212, 255, 0.03);
  }
  50% {
    transform: perspective(600px) rotateY(0deg) rotateX(0deg);
    box-shadow:
      0 0 60px rgba(201, 168, 108, 0.2),
      0 0 120px rgba(0, 212, 255, 0.06);
  }
  100% {
    transform: perspective(600px) rotateY(2deg) rotateX(-1deg);
    box-shadow:
      0 0 40px rgba(167, 139, 250, 0.1),
      0 0 80px rgba(0, 212, 255, 0.03);
  }
}

/* 彩虹折射 */
.mirror-spectrum {
  position: absolute;
  inset: -60%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg at 50% 50%,
    rgba(201, 168, 108, 0.06) 0deg,
    rgba(0, 212, 255, 0.04) 60deg,
    rgba(167, 139, 250, 0.04) 120deg,
    rgba(244, 114, 182, 0.04) 180deg,
    rgba(52, 211, 153, 0.04) 240deg,
    rgba(201, 168, 108, 0.06) 300deg,
    rgba(201, 168, 108, 0.06) 360deg
  );
  animation: spectrum-rotate 15s linear infinite;
  transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes spectrum-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mirror-inner-glow {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    rgba(201, 168, 108, 0.08) 0%,
    transparent 70%
  );
  animation: glow-breathe 4s ease-in-out infinite alternate;
}

@keyframes glow-breathe {
  0% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 高光追踪 */
.mirror-spotlight {
  position: absolute;
  width: 45%;
  height: 45%;
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.08) 0%,
    transparent 70%
  );
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: all 0.2s ease-out;
}

/* 中心内容 */
.mirror-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 能量流 */
.mirror-flow {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(201, 168, 108, 0.1);
  pointer-events: none;
}

.energy-flow-1 {
  width: calc(var(--mirror-size) * 1.2);
  height: calc(var(--mirror-size) * 1.2);
  animation: flow-rotate 25s linear infinite reverse;
}

.energy-flow-2 {
  width: calc(var(--mirror-size) * 1.35);
  height: calc(var(--mirror-size) * 1.35);
  animation: flow-rotate 30s linear infinite;
}

@keyframes flow-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
