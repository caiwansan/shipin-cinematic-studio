<template>
  <section ref="sceneRef" class="steps-scene">
    <div class="steps-container">
      <!-- 标题 -->
      <div ref="titleRef" class="steps-title">
        <h2>{{ data.title }}</h2>
        <p v-if="data.subtitle" class="steps-subtitle">
          {{ data.subtitle }}
        </p>
      </div>

      <!-- 四步时间线 -->
      <div ref="timelineRef" class="steps-timeline">
        <!-- 光流路径 -->
        <div class="timeline-beam">
          <LightBeam
            direction="horizontal"
            variant="slow"
            color="#C9A86C"
            :opacity="0.1"
            size="2px"
          />
        </div>

        <div
          v-for="(step, i) in data.steps"
          :key="step.index"
          class="step-node"
          :style="{ '--step-delay': `${i * 0.2}s` }"
        >
          <div class="step-marker">
            <div class="step-dot" />
            <div class="step-ring" />
          </div>
          <div class="step-card">
            <div class="step-icon">{{ step.icon }}</div>
            <h3 class="step-name">{{ step.title }}</h3>
            <p class="step-desc">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[FourStepScene] setup')
/**
 * FourStepScene — 四步照鉴万物
 *
 * 层级：L4 scenes
 * 用途：Timeline 布局 + 光流路径连接四个步骤。
 * 组合：LightBeam
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { FourStepSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'
import LightBeam from '~/components/kunlun/effects/LightBeam.vue'

const props = withDefaults(defineProps<{
  data?: FourStepSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.steps,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const timelineRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[FourStepScene] mounted')
  const { useScrollTrigger } = useMotion()

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
  })

  useScrollTrigger(timelineRef.value, {
    opacity: { from: 0, to: 1 },
    duration: 0.8,
    delay: 0.2,
  })
})
</script>

<style scoped>
.steps-scene {
  position: relative;
  padding: 100px 24px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 29, 49, 0.3) 50%,
    transparent 100%
  );
}

.steps-container {
  max-width: 800px;
  margin: 0 auto;
}

.steps-title {
  text-align: center;
  margin-bottom: 64px;
}

.steps-title h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 12px;
}

.steps-subtitle {
  font-size: 1.05rem;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

/* Timeline */
.steps-timeline {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.timeline-beam {
  position: absolute;
  top: 28px;
  left: 10%;
  right: 10%;
  height: 2px;
  overflow: hidden;
  pointer-events: none;
}

.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  flex: 1;
  animation: step-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--step-delay);
}

@keyframes step-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-marker {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #C9A86C;
  z-index: 2;
  box-shadow: 0 0 12px rgba(201, 168, 108, 0.4);
}

.step-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(201, 168, 108, 0.15);
  animation: ring-pulse 3s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.3; }
}

.step-card {
  text-align: center;
  padding: 20px;
  border-radius: 12px;
  background: rgba(14, 29, 49, 0.3);
  border: 1px solid rgba(248, 246, 241, 0.05);
  width: 100%;
  transition:
    transform 0.3s ease,
    border-color 0.3s ease;
}

.step-card:hover {
  transform: translateY(-2px);
  border-color: rgba(201, 168, 108, 0.15);
}

.step-icon {
  font-size: 1.6rem;
  margin-bottom: 8px;
}

.step-name {
  font-size: 1rem;
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 6px;
}

.step-desc {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

@media (max-width: 640px) {
  .steps-timeline {
    flex-direction: column;
    align-items: center;
  }

  .timeline-beam {
    display: none;
  }

  .step-node {
    flex-direction: row;
    width: 100%;
  }

  .step-card {
    text-align: left;
  }
}
</style>
