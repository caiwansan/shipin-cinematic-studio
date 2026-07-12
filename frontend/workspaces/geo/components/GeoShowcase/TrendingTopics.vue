<template>
  <section class="geo-showcase__section">
    <GeoSectionHeader
      title="热门话题"
      subtitle="AI 生态中的品牌话题趋势"
    />
    <template v-if="topics.length > 0">
      <div class="geo-showcase__topics-list">
        <GeoCard
          v-for="(topic, i) in topics"
          :key="i"
          variant="outline"
          class="geo-showcase__topic-item"
          @click="onTopicClick(topic)"
        >
          <div class="geo-showcase__topic-content">
            <span class="geo-showcase__topic-name">{{ topic.topic }}</span>
            <span class="geo-showcase__topic-mentions">{{ topic.mentions }} 次提及</span>
            <span
              class="geo-showcase__topic-trend"
              :class="`geo-showcase__topic-trend--${topic.trend}`"
            >
              {{ trendIcon(topic.trend) }}
            </span>
          </div>
        </GeoCard>
      </div>
    </template>
    <template v-else>
      <GeoEmptyState
        icon="📊"
        title="数据采集中"
        description="AI 生态话题趋势数据正在收集，稍后即可查看"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import GeoSectionHeader from '../GeoSectionHeader/index.vue'
import GeoCard from '../GeoCard/index.vue'
import GeoEmptyState from '../GeoEmptyState/index.vue'
import type { ShowcaseTrending } from '../../services/showcaseService'

defineProps<{
  topics: ShowcaseTrending[]
}>()

function trendIcon(trend: ShowcaseTrending['trend']): string {
  switch (trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    case 'stable': return '→'
  }
}

function onTopicClick(topic: ShowcaseTrending) {
  void topic.topic // @beta-stub: Analytics — 生产环境请接入正式埋点服务
}
</script>

<style scoped>
.geo-showcase__section {
  margin-bottom: 28px;
}

.geo-showcase__topics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-showcase__topic-item {
  cursor: pointer;
}

.geo-showcase__topic-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.geo-showcase__topic-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.geo-showcase__topic-mentions {
  font-size: 13px;
  color: #6b7280;
}

.geo-showcase__topic-trend {
  font-size: 14px;
  font-weight: 700;
  width: 20px;
  text-align: center;
}

.geo-showcase__topic-trend--up { color: #059669; }
.geo-showcase__topic-trend--down { color: #dc2626; }
.geo-showcase__topic-trend--stable { color: #6b7280; }
</style>
