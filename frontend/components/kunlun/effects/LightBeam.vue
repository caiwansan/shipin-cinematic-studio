<template>
  <div
    ref="el"
    class="light-beam"
    :class="[direction, `duration-${variant}`]"
    :style="beamStyle"
  />
</template>

<script setup lang="ts">
/**
 * LightBeam — 光束/光芒
 *
 * 归属原语：Light
 * 层级：L1 effects
 * 用途：径向或线性渐变光柱，用于 Hero 和 CTA 的视觉强调。
 * 限制：仅做光束效果，不做交互。
 */

const props = withDefaults(defineProps<{
  direction?: 'horizontal' | 'vertical' | 'radial'
  variant?: 'slow' | 'normal' | 'fast'
  color?: string
  opacity?: number
  size?: string
}>(), {
  direction: 'horizontal',
  variant: 'normal',
  color: '#C9A86C',
  opacity: 0.15,
  size: '100%',
})

const beamStyle = computed(() => ({
  '--beam-color': props.color,
  '--beam-opacity': props.opacity,
  '--beam-size': props.size,
}))

const el = ref<HTMLElement | null>(null)
</script>

<style scoped>
.light-beam {
  position: absolute;
  pointer-events: none;
  will-change: transform;
}

/* 方向 */
.horizontal {
  height: var(--beam-size);
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(201, 168, 108, var(--beam-opacity)) 50%,
    transparent 100%
  );
}

.vertical {
  width: var(--beam-size);
  height: 100%;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(201, 168, 108, var(--beam-opacity)) 50%,
    transparent 100%
  );
}

.radial {
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  background: radial-gradient(
    ellipse at center,
    rgba(201, 168, 108, calc(var(--beam-opacity) * 0.6)) 0%,
    rgba(201, 168, 108, 0) 70%
  );
}

/* 变体速度 */
.duration-slow {
  animation: beam-sweep 8s ease-in-out infinite alternate;
}
.duration-normal {
  animation: beam-sweep 5s ease-in-out infinite alternate;
}
.duration-fast {
  animation: beam-sweep 3s ease-in-out infinite alternate;
}

.radial.duration-slow {
  animation: beam-breathe 8s ease-in-out infinite alternate;
}
.radial.duration-normal {
  animation: beam-breathe 5s ease-in-out infinite alternate;
}
.radial.duration-fast {
  animation: beam-breathe 3s ease-in-out infinite alternate;
}

@keyframes beam-sweep {
  0% {
    transform: translateX(-100%) scaleX(0.5);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(100%) scaleX(1);
    opacity: 0;
  }
}

@keyframes beam-breathe {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}
</style>
