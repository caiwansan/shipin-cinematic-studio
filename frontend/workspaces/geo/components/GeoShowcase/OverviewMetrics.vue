<template>
  <section class="geo-showcase__section">
    <GeoSectionHeader
      title="AI 可见度概览"
      subtitle="品牌在 AI 生态系统中的综合表现"
    />
    <div class="geo-showcase__metrics-grid">
      <GeoMetricCard
        label="监控品牌"
        :display-value="overview.brandsMonitored"
      />
      <GeoMetricCard
        label="活跃项目"
        :display-value="overview.activeProjects"
      />
      <GeoMetricCard
        label="已验证引用"
        :display-value="overview.verifiedCitations"
      />
      <GeoMetricCard
        label="推荐出现"
        :display-value="overview.recommendationAppearances"
      />
      <GeoMetricCard
        label="知识资产"
        :display-value="overview.knowledgeAssetsManaged"
      />
      <GeoMetricCard
        label="验证报告"
        :display-value="overview.verificationReportsCompleted"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import GeoSectionHeader from '../GeoSectionHeader/index.vue'
import GeoMetricCard from '../GeoMetricCard/index.vue'

defineProps<{
  overview: {
    brandsMonitored: number
    activeProjects: number
    verifiedCitations: number
    recommendationAppearances: number
    knowledgeAssetsManaged: number
    verificationReportsCompleted: number
  }
}>()
</script>

<style scoped>
.geo-showcase__section {
  margin-bottom: 28px;
}

.geo-showcase__metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 1024px) {
  .geo-showcase__metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .geo-showcase__metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
