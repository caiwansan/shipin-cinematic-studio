<template>
  <section ref="sceneRef" class="laws-scene">
    <div class="laws-container">
      <!-- 标题 -->
      <div ref="titleRef" class="laws-title">
        <h2>{{ data.title }}</h2>
      </div>

      <!-- 三大铁律 -->
      <div ref="gridRef" class="laws-grid">
        <div
          v-for="(law, i) in data.laws"
          :key="law.index"
          class="law-card"
          :style="{ '--card-delay': `${i * 0.15}s` }"
        >
          <div class="law-index">0{{ law.index }}</div>
          <div class="law-icon">{{ law.icon }}</div>
          <h3 class="law-title">{{ law.title }}</h3>
          <p class="law-desc">{{ law.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[CreationLawScene] setup')
/**
 * CreationLawScene — 三大创作铁律
 *
 * 层级：L4 scenes
 * 用途：三列 GlassPanel 展示昆仑镜核心品质承诺。
 * 组合：无（纯 CSS Glass）
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { CreationLawSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'

const props = withDefaults(defineProps<{
  data?: CreationLawSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.laws,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[CreationLawScene] mounted')
  const { useScrollTrigger } = useMotion()

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
  })

  useScrollTrigger(gridRef.value, {
    opacity: { from: 0, to: 1 },
    duration: 0.8,
    delay: 0.2,
  })
})
</script>

<style scoped>
.laws-scene {
  position: relative;
  padding: 100px 24px;
}

.laws-container {
  max-width: 960px;
  margin: 0 auto;
}

.laws-title {
  text-align: center;
  margin-bottom: 56px;
}

.laws-title h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0;
}

.laws-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.law-card {
  display: flex;
  flex-direction: column;
  padding: 36px 28px;
  border-radius: 16px;
  background: rgba(14, 29, 49, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(248, 246, 241, 0.06);
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.3s ease,
    box-shadow 0.5s ease;
  animation: card-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--card-delay);
}

.law-card:hover {
  transform: translateY(-6px);
  border-color: rgba(201, 168, 108, 0.2);
  box-shadow: 0 12px 40px rgba(201, 168, 108, 0.08);
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.law-index {
  font-size: 0.75rem;
  color: rgba(201, 168, 108, 0.3);
  letter-spacing: 2px;
  margin-bottom: 16px;
}

.law-icon {
  font-size: 2rem;
  margin-bottom: 16px;
}

.law-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 12px;
}

.law-desc {
  font-size: 0.9rem;
  color: rgba(248, 246, 241, 0.5);
  line-height: 1.7;
  margin: 0;
  flex: 1;
}

@media (max-width: 768px) {
  .laws-grid {
    grid-template-columns: 1fr;
  }
}
</style>
