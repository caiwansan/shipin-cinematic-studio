<template>
  <section ref="sceneRef" class="choice-scene">
    <div class="choice-container">
      <!-- 标题 -->
      <div ref="titleRef" class="choice-title">
        <h2>{{ data.title }}</h2>
      </div>

      <!-- 对比区 -->
      <div class="choice-compare">
        <!-- 旧世界 —— Pain -->
        <div ref="painRef" class="choice-side pain">
          <div class="side-label">
            <span class="side-icon">⚔️</span>
            {{ data.pain.label }}
          </div>
          <ul class="side-points">
            <li
              v-for="point in data.pain.points"
              :key="point.label"
              class="point-item"
            >
              <span class="point-icon">{{ point.icon }}</span>
              <span>{{ point.label }}</span>
            </li>
          </ul>
        </div>

        <!-- VS 分隔 -->
        <div class="choice-vs">
          <div class="vs-line" />
          <span class="vs-text">VS</span>
          <div class="vs-line" />
        </div>

        <!-- 昆仑镜 —— Freedom -->
        <div ref="freedomRef" class="choice-side freedom">
          <div class="side-label">
            <span class="side-icon">🔑</span>
            {{ data.freedom.label }}
          </div>
          <ul class="side-points">
            <li
              v-for="point in data.freedom.points"
              :key="point.label"
              class="point-item freedom-item"
            >
              <span class="point-icon">{{ point.icon }}</span>
              <span>{{ point.label }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[ChoiceLiberationScene] setup')
/**
 * ChoiceLiberationScene — 左右对比：Pain vs Freedom
 *
 * 层级：L4 scenes
 * 用途：旧世界 vs 昆仑镜。滚动触发左右对比动画。
 * 组合：GlassPanel（可选内嵌）
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { ChoiceLiberationSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'

const props = withDefaults(defineProps<{
  data?: ChoiceLiberationSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.choice,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const painRef = ref<HTMLElement | null>(null)
const freedomRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[ChoiceLiberationScene] mounted')
  const { useScrollTrigger } = useMotion()

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
  })

  useScrollTrigger(painRef.value, {
    opacity: { from: 0, to: 1 },
    x: { from: -40, to: 0 },
    duration: 0.8,
    delay: 0.2,
  })

  useScrollTrigger(freedomRef.value, {
    opacity: { from: 0, to: 1 },
    x: { from: 40, to: 0 },
    duration: 0.8,
    delay: 0.4,
  })
})
</script>

<style scoped>
.choice-scene {
  position: relative;
  padding: 100px 24px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 29, 49, 0.4) 50%,
    transparent 100%
  );
}

.choice-container {
  max-width: 960px;
  margin: 0 auto;
}

.choice-title {
  text-align: center;
  margin-bottom: 64px;
}

.choice-title h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0;
}

.choice-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 32px;
  align-items: center;
}

.choice-side {
  padding: 32px;
  border-radius: 16px;
  background: rgba(14, 29, 49, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(248, 246, 241, 0.06);
}

.pain {
  border-color: rgba(239, 68, 68, 0.15);
}

.freedom {
  border-color: rgba(52, 211, 153, 0.15);
}

.side-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #F8F6F1;
  margin-bottom: 24px;
}

.side-icon {
  font-size: 1.4rem;
}

.side-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.point-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(248, 246, 241, 0.6);
  font-size: 0.95rem;
}

.point-icon {
  font-size: 1.2rem;
}

.freedom-item {
  color: rgba(248, 246, 241, 0.85);
}

/* VS 分隔 */
.choice-vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.vs-line {
  width: 1px;
  height: 40px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(201, 168, 108, 0.3),
    transparent
  );
}

.vs-text {
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(201, 168, 108, 0.5);
  letter-spacing: 2px;
}

@media (max-width: 768px) {
  .choice-compare {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .choice-vs {
    flex-direction: row;
  }

  .vs-line {
    width: 40px;
    height: 1px;
  }
}
</style>
