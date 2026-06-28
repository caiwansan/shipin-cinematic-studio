<template>
  <section ref="sceneRef" class="hero-section">
    <div class="hero-bg">
      <AuroraLayer />
      <!-- ParticleField 暂时禁用（Three.js 加载问题） -->
      <!-- <ParticleField /> -->
    </div>
    <div class="hero-layout">
      <div class="hero-text">
        <div v-if="props.data.tag" ref="tagRef" class="hero-tag">{{ props.data.tag }}</div>
        <h1 ref="titleRef" class="hero-title">
          <span v-for="(line, i) in headlineLines" :key="i" class="hero-title-line">
            {{ line }}<br v-if="i < headlineLines.length - 1">
          </span>
        </h1>
        <p ref="subtitleRef" class="hero-subtitle">{{ props.data.subline }}</p>
        <div ref="ctaRef" class="hero-cta">
          <NuxtLink :to="props.data.primaryCTA.route || '#'" class="btn btn-primary btn-hero">
            {{ props.data.primaryCTA.text }}
          </NuxtLink>
          <NuxtLink :to="props.data.secondaryCTA.route || '#'" class="btn btn-outline btn-hero">
            {{ props.data.secondaryCTA.text }}
          </NuxtLink>
        </div>
      </div>
      <div ref="mirrorRef" class="hero-mirror-area">
        <div class="mirror-placeholder">
          <div class="mirror-ring"></div>
          <div class="mirror-glass">
            <span class="mirror-icon">🪞</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMotion } from '~/composables/kunlun/useMotion'
import type { HeroSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'
import AuroraLayer from '~/components/kunlun/effects/AuroraLayer.vue'

const props = withDefaults(defineProps<{
  data?: HeroSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.hero,
})

const sceneRef = ref<HTMLElement | null>(null)
const tagRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const ctaRef = ref<HTMLElement | null>(null)
const mirrorRef = ref<HTMLElement | null>(null)

const headlineLines = computed(() => props.data.headline.split('\n'))

onMounted(() => {
  const { useScrollTrigger } = useMotion()
  useScrollTrigger(tagRef.value, { opacity: { from: 0, to: 1 }, y: { from: 20, to: 0 }, duration: 0.8 })
  useScrollTrigger(titleRef.value, { opacity: { from: 0, to: 1 }, y: { from: 30, to: 0 }, duration: 1, delay: 0.2 })
  useScrollTrigger(subtitleRef.value, { opacity: { from: 0, to: 1 }, y: { from: 20, to: 0 }, duration: 0.8, delay: 0.4 })
  useScrollTrigger(ctaRef.value, { opacity: { from: 0, to: 1 }, y: { from: 20, to: 0 }, duration: 0.8, delay: 0.6 })
  useScrollTrigger(mirrorRef.value, { opacity: { from: 0, to: 1 }, scale: { from: 0.95, to: 1 }, duration: 1.2, delay: 0.3 })
})
</script>

<style scoped>
.hero-section { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.hero-bg { position: absolute; inset: 0; overflow: hidden; }
.hero-layout { position: relative; z-index: 2; display: flex; align-items: center; gap: 60px; max-width: 1200px; margin: 0 auto; padding: 0 24px; width: 100%; }
.hero-text { flex: 1; display: flex; flex-direction: column; align-items: center; }
.hero-tag { display: inline-block; padding: 6px 16px; border-radius: 100px; background: rgba(201, 168, 108, 0.12); border: 1px solid rgba(201, 168, 108, 0.2); color: #C9A86C; font-size: 13px; margin-bottom: 20px; }
.hero-title { font-size: clamp(36px, 5vw, 56px); font-weight: 700; line-height: 1.2; color: #F8F6F1; margin-bottom: 16px; text-align: center; }
.hero-subtitle { font-size: clamp(16px, 2vw, 20px); color: rgba(248, 246, 241, 0.65); line-height: 1.6; max-width: 480px; margin-bottom: 32px; text-align: center; }
.hero-cta { display: flex; gap: 12px; }
.btn-hero { padding: 12px 32px; font-size: 16px; }
.hero-mirror-area { flex-shrink: 0; }
.mirror-placeholder { width: 280px; height: 280px; position: relative; display: flex; align-items: center; justify-content: center; }
.mirror-ring { position: absolute; width: 300px; height: 300px; border-radius: 50%; border: 1px solid rgba(201, 168, 108, 0.15); animation: ring-spin 20s linear infinite; }
.mirror-glass { width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(ellipse at 35% 35%, rgba(14,29,49,0.5), rgba(8,19,31,0.7) 50%, rgba(8,19,31,0.9) 100%); backdrop-filter: blur(24px); border: 1px solid rgba(201,168,108,0.2); display: flex; align-items: center; justify-content: center; font-size: 72px; }
@keyframes ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
