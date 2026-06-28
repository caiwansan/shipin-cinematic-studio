<template>
  <section ref="sceneRef" class="final-scene">
    <!-- 极光氛围 -->
    <AuroraLayer
      :speed="0.15"
      :opacity="0.35"
      :colors="[
        'rgba(201, 168, 108, 0.08)',
        'rgba(0, 212, 255, 0.05)',
        'rgba(167, 139, 250, 0.04)',
      ]"
    />

    <div class="final-container">
      <!-- 镜面飞来（首尾呼应） -->
      <div ref="mirrorRef" class="final-mirror">
        <HeroMirror
          :size="160"
          :spectrum-scroll="false"
        />
      </div>

      <!-- 标题 -->
      <h2 ref="titleRef" class="final-headline">
        {{ data.headline }}
      </h2>

      <!-- 副标题 -->
      <p ref="subtitleRef" class="final-subheadline">
        {{ data.subheadline }}
      </p>

      <!-- CTA -->
      <div ref="ctaRef" class="final-cta">
        <NuxtLink
          :to="data.ctaRoute"
          class="final-cta-button"
        >
          {{ data.ctaText }}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9H15M15 9L10 4M15 9L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[FinalCTAScene] setup')
/**
 * FinalCTAScene — 终极 CTA
 *
 * 层级：L4 scenes
 * 用途：深空 + 极光 + 镜面飞来首尾呼应。
 * 组合：AuroraLayer, HeroMirror
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { FinalCTASceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'
import AuroraLayer from '~/components/kunlun/effects/AuroraLayer.vue'
import HeroMirror from '~/components/kunlun/hero/HeroMirror.vue'

const props = withDefaults(defineProps<{
  data?: FinalCTASceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.final,
})

const sceneRef = ref<HTMLElement | null>(null)
const mirrorRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const ctaRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[FinalCTAScene] mounted')
  const { useScrollTrigger } = useMotion()

  useScrollTrigger(mirrorRef.value, {
    opacity: { from: 0, to: 1 },
    scale: { from: 0.6, to: 1 },
    duration: 1.2,
  })

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
    delay: 0.2,
  })

  useScrollTrigger(subtitleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 20, to: 0 },
    duration: 0.8,
    delay: 0.4,
  })

  useScrollTrigger(ctaRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 20, to: 0 },
    duration: 0.8,
    delay: 0.6,
  })
})
</script>

<style scoped>
.final-scene {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 100px 24px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 29, 49, 0.4) 30%,
    transparent 100%
  );
}

.final-container {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 640px;
}

.final-mirror {
  margin-bottom: 32px;
  opacity: 0.6;
}

.final-headline {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  color: #F8F6F1;
  margin: 0 0 16px;
  line-height: 1.2;
  background: linear-gradient(135deg, #F8F6F1 0%, #C9A86C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.final-subheadline {
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  color: rgba(248, 246, 241, 0.5);
  margin: 0 0 40px;
  line-height: 1.6;
}

.final-cta-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 40px;
  border-radius: 40px;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
  font-size: 1.1rem;
  text-decoration: none;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.final-cta-button:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow:
    0 12px 32px rgba(201, 168, 108, 0.3),
    0 0 60px rgba(201, 168, 108, 0.1);
}
</style>
