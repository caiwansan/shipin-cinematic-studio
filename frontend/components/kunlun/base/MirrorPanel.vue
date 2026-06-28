<template>
  <div
    ref="el"
    class="mirror-panel"
    :class="{ rotating: rotate, 'spectrum-breathing': breathe }"
    :style="panelStyle"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- 折射光层 -->
    <div
      class="mirror-highlight"
      :style="highlightStyle"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * MirrorPanel — 镜面品牌容器
 *
 * 归属原语：Glass + Mirror
 * 层级：L1 base
 * 用途：比 GlassPanel 多一层折射/反射质感，用于品牌核心区域。
 * 限制：仅做品牌容器，不做业务卡片。
 */

import { useMirror } from '~/composables/kunlun/useMirror'
import { getGlassCSS } from '~/utils/kunlun/glass'

const props = withDefaults(defineProps<{
  rotate?: boolean
  breathe?: boolean
  rounded?: string
  padding?: string
}>(), {
  rotate: false,
  breathe: true,
  rounded: '16px',
  padding: '32px',
})

const el = ref<HTMLElement | null>(null)
const { highlightX, highlightY, onMouseMove, onMouseLeave } = useMirror(el)

const panelStyle = computed(() => ({
  ...getGlassCSS('mirror'),
  borderRadius: props.rounded,
  padding: props.padding,
}))

const highlightStyle = computed(() => ({
  left: `${highlightX.value}%`,
  top: `${highlightY.value}%`,
}))
</script>

<style scoped>
.mirror-panel {
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  will-change: transform;
  transition:
    transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.rotating {
  animation: mirror-rotate 12s ease-in-out infinite alternate;
}

.spectrum-breathing {
  animation: spectrum-breathe 6s ease-in-out infinite alternate;
}

.mirror-highlight {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.12) 0%,
    transparent 70%
  );
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: all 0.3s ease-out;
}

@keyframes mirror-rotate {
  0% {
    transform: perspective(800px) rotateY(-3deg) rotateX(1deg);
  }
  100% {
    transform: perspective(800px) rotateY(3deg) rotateX(-1deg);
  }
}

@keyframes spectrum-breathe {
  0% {
    box-shadow:
      0 0 30px rgba(201, 168, 108, 0.15),
      0 0 60px rgba(0, 212, 255, 0.05);
  }
  50% {
    box-shadow:
      0 0 40px rgba(201, 168, 108, 0.25),
      0 0 80px rgba(0, 212, 255, 0.1);
  }
  100% {
    box-shadow:
      0 0 30px rgba(167, 139, 250, 0.15),
      0 0 60px rgba(0, 212, 255, 0.05);
  }
}
</style>
