<template>
  <section ref="sceneRef" class="wenquxing-scene">
    <div class="wenquxing-container">
      <!-- 标题区 -->
      <div ref="titleRef" class="wenquxing-header">
        <h2>{{ data.title }}</h2>
        <p v-if="data.subtitle" class="wenquxing-subtitle">
          {{ data.subtitle }}
        </p>
      </div>

      <!-- 数字展示区 -->
      <div ref="countRef" class="wenquxing-count">
        <div class="count-visual">
          <span
            ref="numberRef"
            class="count-number"
          >
            {{ formattedCount }}
          </span>
          <span class="count-unit">+</span>
        </div>
        <div class="count-label">
          {{ data.countLabel }}
        </div>
      </div>

      <!-- 演示步骤 -->
      <div ref="stepsRef" class="wenquxing-steps">
        <div
          v-for="(step, i) in data.demoSteps"
          :key="step"
          class="demo-step"
        >
          <div class="step-index">{{ i + 1 }}</div>
          <span class="step-text">{{ step }}</span>
          <div
            v-if="i < data.demoSteps.length - 1"
            class="step-connector"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[WenquxingScene] setup')
/**
 * WenquxingScene — 文曲星引擎展示
 *
 * 层级：L4 scenes
 * 用途：1000 万数字滚动 + 长期记忆可视化。
 * 组合：可选 ParticleField
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { WenquxingSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'

const props = withDefaults(defineProps<{
  data?: WenquxingSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.wenquxing,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const countRef = ref<HTMLElement | null>(null)
const numberRef = ref<HTMLElement | null>(null)
const stepsRef = ref<HTMLElement | null>(null)

const currentCount = ref(0)
const animated = ref(false)

const formattedCount = computed(() => {
  return currentCount.value.toLocaleString('zh-CN')
})

onMounted(() => {
    console.log('[WenquxingScene] mounted')
  const { useScrollTrigger, animateNumber } = useMotion()

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
  })

  useScrollTrigger(countRef.value, {
    opacity: { from: 0, to: 1 },
    scale: { from: 0.9, to: 1 },
    duration: 1,
    delay: 0.2,
    onComplete: () => {
      if (!animated.value) {
        animated.value = true
        animateNumber(
          currentCount,
          0,
          props.data.countTarget,
          2000,
        )
      }
    },
  })

  useScrollTrigger(stepsRef.value, {
    opacity: { from: 0, to: 1 },
    duration: 0.8,
    delay: 0.4,
  })
})
</script>

<style scoped>
.wenquxing-scene {
  position: relative;
  padding: 100px 24px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 29, 49, 0.5) 50%,
    transparent 100%
  );
}

.wenquxing-container {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}

.wenquxing-header {
  margin-bottom: 48px;
}

.wenquxing-header h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 12px;
}

.wenquxing-subtitle {
  font-size: 1.05rem;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

/* 数字展示 */
.wenquxing-count {
  margin-bottom: 56px;
}

.count-visual {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.count-number {
  font-size: clamp(3rem, 8vw, 5rem);
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  tab-size: 4;
}

.count-unit {
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: #C9A86C;
}

.count-label {
  margin-top: 8px;
  font-size: 1rem;
  color: rgba(248, 246, 241, 0.5);
  letter-spacing: 2px;
}

/* 演示步骤 */
.wenquxing-steps {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}

.demo-step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(201, 168, 108, 0.15);
  border: 1px solid rgba(201, 168, 108, 0.2);
  color: #C9A86C;
  font-size: 0.8rem;
  font-weight: 600;
}

.step-text {
  color: rgba(248, 246, 241, 0.7);
  font-size: 0.9rem;
  white-space: nowrap;
}

.step-connector {
  width: 24px;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(201, 168, 108, 0.3),
    transparent
  );
}
</style>
