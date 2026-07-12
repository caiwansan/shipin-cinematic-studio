<template>
  <section class="geo-showcase__section">
    <GeoSectionHeader
      title="成功案例"
      subtitle="AI 可见度优化成果"
    />
    <template v-if="stories.length > 0">
      <div class="geo-showcase__stories-grid">
        <GeoCard
          v-for="(story, i) in stories"
          :key="i"
          title="案例"
          variant="outline"
          class="geo-showcase__story-card"
          @click="onStoryClick(story)"
        >
          <p class="geo-showcase__story-industry">{{ story.industry }}</p>
          <div class="geo-showcase__story-metrics">
            <span>ADI +{{ story.adiImprovement }}</span>
            <span>可见度 +{{ story.visibilityImprovement }}</span>
          </div>
        </GeoCard>
      </div>
    </template>
    <template v-else>
      <GeoEmptyState
        icon="📈"
        title="成功案例即将上线"
        description="我们正在收集更多品牌优化案例，敬请期待"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import GeoSectionHeader from '../GeoSectionHeader/index.vue'
import GeoCard from '../GeoCard/index.vue'
import GeoEmptyState from '../GeoEmptyState/index.vue'
import type { ShowcaseStory } from '../../services/showcaseService'

defineProps<{
  stories: ShowcaseStory[]
}>()

function onStoryClick(story: ShowcaseStory) {
  void story.industry // @beta-stub: Analytics — 生产环境请接入正式埋点服务
}
</script>

<style scoped>
.geo-showcase__section {
  margin-bottom: 28px;
}

.geo-showcase__stories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.geo-showcase__story-card {
  cursor: pointer;
}

.geo-showcase__story-industry {
  font-size: 14px;
  color: #374151;
  margin: 0 0 8px;
}

.geo-showcase__story-metrics {
  display: flex;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #059669;
}
</style>
