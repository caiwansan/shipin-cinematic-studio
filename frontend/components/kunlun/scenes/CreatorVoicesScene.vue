<template>
  <section ref="sceneRef" class="voices-scene">
    <div class="voices-container">
      <!-- 标题 -->
      <div ref="titleRef" class="voices-title">
        <h2>{{ data.title }}</h2>
        <p v-if="data.subtitle" class="voices-subtitle">
          {{ data.subtitle }}
        </p>
      </div>

      <!-- Masonry 评价卡 -->
      <div ref="gridRef" class="voices-grid">
        <div
          v-for="(voice, i) in data.voices"
          :key="voice.name"
          class="voice-card"
          :style="{ '--card-delay': `${i * 0.2}s` }"
        >
          <!-- 头像 -->
          <div class="voice-avatar">
            {{ voice.avatar }}
          </div>

          <!-- 作者信息 -->
          <div class="voice-author">
            <div class="voice-name">{{ voice.name }}</div>
            <div class="voice-title-tag">{{ voice.title }}</div>
          </div>

          <!-- 星级 -->
          <div class="voice-stars">
            <span
              v-for="n in 5"
              :key="n"
              class="star"
              :class="{ active: n <= voice.rating }"
            >
              ★
            </span>
          </div>

          <!-- 内容 -->
          <p class="voice-content">
            "{{ voice.content }}"
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[CreatorVoicesScene] setup')
/**
 * CreatorVoicesScene — 创作者证言
 *
 * 层级：L4 scenes
 * 用途：Masonry 瀑布流 + 浮动评价卡。
 * 组合：Glass 风格卡片
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { CreatorVoicesSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'

const props = withDefaults(defineProps<{
  data?: CreatorVoicesSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.voices,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[CreatorVoicesScene] mounted')
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
.voices-scene {
  position: relative;
  padding: 100px 24px;
}

.voices-container {
  max-width: 900px;
  margin: 0 auto;
}

.voices-title {
  text-align: center;
  margin-bottom: 56px;
}

.voices-title h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 12px;
}

.voices-subtitle {
  font-size: 1.05rem;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

/* Masonry Grid */
.voices-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.voice-card {
  padding: 28px;
  border-radius: 16px;
  background: rgba(14, 29, 49, 0.35);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(248, 246, 241, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: card-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--card-delay);
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.3s ease;
}

.voice-card:hover {
  transform: translateY(-4px);
  border-color: rgba(201, 168, 108, 0.12);
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

.voice-avatar {
  font-size: 2.2rem;
}

.voice-author {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voice-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #F8F6F1;
}

.voice-title-tag {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
}

.voice-stars {
  display: flex;
  gap: 2px;
}

.star {
  color: rgba(248, 246, 241, 0.15);
  font-size: 0.9rem;
}

.star.active {
  color: #C9A86C;
}

.voice-content {
  font-size: 0.9rem;
  color: rgba(248, 246, 241, 0.6);
  line-height: 1.7;
  margin: 0;
  font-style: italic;
}

@media (max-width: 768px) {
  .voices-grid {
    grid-template-columns: 1fr;
  }
}
</style>
