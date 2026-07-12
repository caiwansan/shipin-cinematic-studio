<template>
  <div class="geo-showcase">
    <!-- Skeleton Loading State -->
    <GeoPageSkeleton
      v-if="loading"
      :card-count="6"
      layout="dashboard"
      class="geo-showcase__skeleton"
    />

    <!-- Error State -->
    <GeoErrorState
      v-else-if="error"
      :message="error"
      @retry="loadData"
    />

    <!-- Data State -->
    <template v-else-if="data">
      <OverviewMetrics :overview="data.overview" />
      <ProviderStatusGrid :providers="data.providers" />
      <SuccessStoryCarousel :stories="data.stories" />
      <TrendingTopics :topics="data.trending" />
      <PlatformInsights :insights="data.insights" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getShowcaseData, type ShowcaseResponse } from '../../services/showcaseService'
import GeoPageSkeleton from '../GeoPageSkeleton/index.vue'
import GeoErrorState from '../GeoErrorState/index.vue'
import OverviewMetrics from './OverviewMetrics.vue'
import ProviderStatusGrid from './ProviderStatusGrid.vue'
import SuccessStoryCarousel from './SuccessStoryCarousel.vue'
import TrendingTopics from './TrendingTopics.vue'
import PlatformInsights from './PlatformInsights.vue'

// @beta-stub: Analytics — 生产环境请接入正式埋点服务

// ── State ──
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<ShowcaseResponse | null>(null)

// ── Lifecycle ──
onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  error.value = null
  try {
    data.value = await getShowcaseData()
  } catch (err: any) {
    error.value = err?.message || '加载 Showcase 数据失败'
  } finally {
    loading.value = false
  }
}

defineExpose({ loadData })
</script>

<style scoped>
.geo-showcase {
  margin-bottom: 32px;
}

.geo-showcase__skeleton {
  margin-bottom: 0;
}
</style>
