<template>
  <div
    ref="el"
    class="mirror-card"
    :class="{ hoverable: hoverable, glowing: activeGlow }"
    :style="cardStyle"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <!-- 棱镜边缘 -->
    <div
      v-if="prism"
      class="prism-edge"
      :style="prismStyle"
    />

    <!-- 发光层 -->
    <div
      v-if="glow"
      class="glow-layer"
    />

    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * MirrorCard — 通用玻璃信息卡片
 *
 * 归属原语：Glass + 可选 Prism
 * 层级：L2 cards
 * 用途：标准玻璃信息卡片，组合 GlassPanel + 可选的 PrismBorder。
 * 限制：不做品牌核心展示。
 */

import { getGlassCSS } from '~/utils/kunlun/glass'

const props = withDefaults(defineProps<{
  glow?: boolean
  prism?: boolean
  hoverable?: boolean
  size?: 'sm' | 'md' | 'lg'
  rounded?: string
  padding?: string
}>(), {
  glow: false,
  prism: false,
  hoverable: false,
  size: 'md',
  rounded: '12px',
  padding: '24px',
})

const el = ref<HTMLElement | null>(null)
const activeGlow = ref(false)

const sizeMap: Record<string, { minHeight: string }> = {
  sm: { minHeight: '120px' },
  md: { minHeight: '200px' },
  lg: { minHeight: '320px' },
}

const cardStyle = computed(() => ({
  ...getGlassCSS('card'),
  borderRadius: props.rounded,
  padding: props.padding,
  minHeight: sizeMap[props.size]?.minHeight ?? '200px',
}))

const prismStyle = computed(() => ({
  '--prism-color': 'rgba(201, 168, 108, 0.3)',
}))

function onEnter() {
  if (props.hoverable) {
    activeGlow.value = true
  }
}

function onLeave() {
  activeGlow.value = false
}
</script>

<style scoped>
.mirror-card {
  position: relative;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.hoverable:hover {
  transform: translateY(-4px);
}

.glowing {
  box-shadow:
    0 8px 32px rgba(201, 168, 108, 0.1),
    0 0 0 1px rgba(201, 168, 108, 0.15);
}

.glow-layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(201, 168, 108, 0.05) 0%,
    transparent 50%,
    rgba(0, 212, 255, 0.05) 100%
  );
  pointer-events: none;
}

.prism-edge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    135deg,
    transparent 40%,
    rgba(201, 168, 108, 0.3) 50%,
    transparent 60%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.mirror-card:hover .prism-edge {
  opacity: 1;
}
</style>
