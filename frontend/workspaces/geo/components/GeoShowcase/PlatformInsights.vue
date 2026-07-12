<template>
  <section class="geo-showcase__section">
    <GeoSectionHeader
      title="平台洞察"
      subtitle="GEO 工作台的核心能力"
    />
    <div class="geo-showcase__insights-grid">
      <GeoCard
        v-for="(insight, i) in insights"
        :key="i"
        variant="outline"
        class="geo-showcase__insight-card"
        @click="navigateTo(insight.link)"
      >
        <div class="geo-showcase__insight-content">
          <h4 class="geo-showcase__insight-title">{{ insight.title }}</h4>
          <p class="geo-showcase__insight-desc">{{ insight.description }}</p>
        </div>
      </GeoCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import GeoSectionHeader from '../GeoSectionHeader/index.vue'
import GeoCard from '../GeoCard/index.vue'
import type { ShowcaseInsight } from '../../services/showcaseService'

defineProps<{
  insights: ShowcaseInsight[]
}>()

const router = useRouter()

function navigateTo(link: string) {
  router.push(link)
}
</script>

<style scoped>
.geo-showcase__section {
  margin-bottom: 28px;
}

.geo-showcase__insights-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.geo-showcase__insight-card {
  cursor: pointer;
  transition: all 0.15s;
}

.geo-showcase__insight-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.geo-showcase__insight-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-showcase__insight-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.geo-showcase__insight-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .geo-showcase__insights-grid {
    grid-template-columns: 1fr;
  }
}
</style>
